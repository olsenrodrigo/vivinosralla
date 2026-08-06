# Design — Checkout, Pagamentos e Frete

**Requisitos cobertos:** REQ-1 … REQ-7 · **Spec:** ./requirements.md

## Visão arquitetural

A base já existe e é boa: `server/gateway/` tem o registry (`index.ts`), a interface
`PaymentGateway` (`types.ts:33`), o adaptador Asaas (`asaas.ts`) e o do MercadoPago
(`mercadopago.ts`); `server/routes.ts:402` implementa `POST /api/checkout`; `server/routes.ts:813`
recebe o webhook do Asaas; `server/smartenvios/` traz o conector de frete e
`server/smartenvios-integration.ts` a cola com o checkout.

Este epic **não reescreve** essa base. Ele:

1. troca o roteamento padrão de `PaymentConfig` (`shared/schema.ts:54`) para Asaas nos três métodos;
2. torna o webhook idempotente e autenticado;
3. introduz a **reserva de estoque** — hoje `decrementStock` (`server/storage.ts:265`) baixa direto,
   sem estágio intermediário, o que permite vender a mesma peça duas vezes entre a criação do pedido
   e a confirmação do pagamento;
4. extrai o frete para uma interface `ShippingProvider`, com retirada na loja e frete grátis por regra;
5. abre a geração de cobrança avulsa para o backoffice usar no PDV, no consignado e no WhatsApp.

```
Checkout ─┐
PDV ──────┼─→ CobrancaService ─→ gateway("asaas") ─→ Asaas
Consignado┘         │
                    └─→ payment_transactions ─→ (webhook) ─→ OrderService + FinanceiroService
```

## Modelo de dados

Migration nova: `migrations/013_reservas_e_cobrancas.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `stock_reservations` | `id serial pk`, `order_id int`, `product_id int not null`, `variant_id int`, `quantity int not null`, `status text not null default 'held'` (`held`/`consumed`/`released`), `expires_at timestamptz not null`, `created_at` | REQ-4.1 … REQ-4.6 |
| `gateway_events` | `id serial pk`, `gateway text not null`, `event_id text not null`, `event_type text`, `processed_at timestamptz`, unique(`gateway`,`event_id`) | REQ-5.2, REQ-5.4 |
| `payment_links` | `id serial pk`, `gateway_charge_id text not null`, `origin_type text not null` (`consignacao`/`pdv`/`avulso`), `origin_id int`, `customer_id int`, `amount numeric(10,2) not null`, `description text`, `url text not null`, `status text not null default 'pending'`, `created_by int not null`, `created_at` | REQ-6.1 … REQ-6.5 |
| `orders` (alter) | `+ access_token text not null default gen_random_uuid()::text`, `+ pix_discount_amount numeric(10,2) default 0`, `+ installments int` | REQ-7.1, REQ-2.1, REQ-2.4 |
| `store_settings` (alter) | `+ pix_discount_percent numeric(5,2) default 5.00`, `+ pickup_enabled bool default true`, `+ asaas_webhook_token text` | REQ-2.1, REQ-3.3, REQ-5.3 |

Índices: `idx_stock_reservations_expira` em (`status`,`expires_at`) para a varredura de expiração;
`idx_payment_links_origin` em (`origin_type`,`origin_id`).

`asaas_webhook_token` é segredo — nunca aparece em resposta de API nem em log (harness #9). O
endpoint `GET /api/admin/settings` devolve o campo mascarado.

**Saldo disponível** passa a ser uma expressão, não uma coluna:
`disponivel = variants.stock_quantity - COALESCE(reservas ativas, 0)`, resolvido em SQL único com
`LEFT JOIN LATERAL` sobre `stock_reservations` com `status='held' AND expires_at > now()`.

## Contratos de API

### POST /api/checkout — atende REQ-1, REQ-2, REQ-3.6, REQ-4.1, REQ-4.2

- **Request:** `checkoutSchema` (`shared/schema.ts:518`) estendido com `installments?: number`,
  `pickupInStore?: boolean`, `shippingQuoteId?: string`
- **201:** `{ orderNumber, accessToken, total, payment: { method, pixQrCode?, pixCopyPaste?, boletoUrl?, boletoBarcode?, status } }`
- **400:** payload fora do schema, `parcelas_invalidas` (REQ-2.5), `cep_invalido` (REQ-3.4)
- **409:** `estoque_insuficiente` com o SKU (REQ-4.2); `frete_divergente` (REQ-3.6)
- **502:** `falha_gateway` (REQ-1.4) — pedido permanece `pending_payment`, reserva liberada
- **503:** `gateway_nao_configurado` (REQ-1.6)
- **Autorização:** pública; o carrinho é identificado pelo `sessionId` (capability UUID já em uso)
- **Transação:** criação de pedido + itens + reservas em uma única transação. A chamada ao Asaas
  acontece **depois** do commit; falha ali dispara compensação que libera as reservas.

### POST /api/shipping/quote — atende REQ-3.1, REQ-3.2, REQ-3.4, REQ-3.5

- **Request:** `{ cep: string(8), items: [{variantId, quantity}] }`
- **200:** `{ options: [{ id, carrier, service, price, daysMin, daysMax, free: boolean }] }` — inclui a
  opção `retirada` quando `pickup_enabled`, e marca `free: true` quando o subtotal atinge o mínimo
- **400:** `cep_invalido` (REQ-3.4)
- **Timeout de 8 s** no provedor; ao estourar, responde 200 com as opções de `shipping_rates` e loga
  `shipping_provider_indisponivel` (REQ-3.5)

### POST /api/webhooks/asaas — atende REQ-5.1 … REQ-5.7

- **Autenticação:** header `asaas-access-token` comparado com `store_settings.asaas_webhook_token`
  em comparação de tempo constante. Divergente ou ausente → 401 (REQ-5.3)
- **Idempotência:** `INSERT INTO gateway_events (gateway,event_id) ON CONFLICT DO NOTHING`; se não
  inseriu, responde 200 sem reprocessar (REQ-5.2)
- **200:** sempre que o evento é aceito ou ignorado por ser órfão (REQ-5.4) — o Asaas reentrega
  indefinidamente enquanto não receber 2xx
- **Efeitos:** `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → pedido `confirmed`, reserva `consumed`, baixa
  no contas a receber (REQ-5.6); `PAYMENT_REFUNDED`/`PAYMENT_DELETED` → `refunded`/`cancelled`,
  reserva `released` (REQ-5.5)
- **Log:** apenas `{event_id, event_type, charge_id, order_number}` — nunca o corpo completo (REQ-5.7)

### POST /api/admin/payment-links — atende REQ-6.1 … REQ-6.5

- **Request:** `{ amount: number > 0, description: string(3..200), customerId?: number, originType: "consignacao"|"pdv"|"avulso", originId?: number, dueDate?: string }`
- **201:** `{ id, url, gatewayChargeId }`
- **400:** `valor_invalido` (REQ-6.3)
- **401:** sem sessão (REQ-6.4)
- **Autorização:** `requireAdmin`; grava `created_by` a partir da sessão (REQ-6.5)

### GET /api/orders/:orderNumber?token=… — atende REQ-7.1, REQ-7.2

- **200:** `{ orderNumber, status, paymentStatus, items[], total, shipping{carrier,service,trackingCode}, history[] }`
- **404:** token ausente ou divergente — mesma resposta de número inexistente (REQ-7.1)
- **Nunca retorna:** `internal_notes`, `payment_transactions.raw_response`, `access_token`

## Fluxos

**Compra com PIX (caminho feliz)**

1. `POST /api/shipping/quote` → cliente escolhe a opção.
2. `POST /api/checkout`: valida schema → recalcula subtotal, desconto de cupom, desconto de PIX e
   frete **no servidor** (REQ-2.6, REQ-3.6) → abre transação → cria `orders` + `order_items` +
   `stock_reservations` com `expires_at = now() + 30 min` → commit.
3. Chama `asaasGateway.createPayment()`. Sucesso → grava `payment_transactions` e responde 201 com o
   QR Code. Falha → `UPDATE stock_reservations SET status='released'`, responde 502.
4. Cliente paga. Asaas chama o webhook → autentica → registra em `gateway_events` → pedido vira
   `confirmed`, reservas viram `consumed`, `stock_movements` recebe a saída, contas a receber recebe a baixa.
5. `server/notify.ts` dispara o e-mail de confirmação.

**Expiração de reserva (REQ-4.4, REQ-4.5)**

Job interno no processo do servidor, a cada 5 minutos:
`UPDATE stock_reservations SET status='released' WHERE status='held' AND expires_at < now()`.
Uma única instrução, sem laço por linha. O job é idempotente e reentrante — rodar duas vezes não
libera nada a mais.

**Falha parcial deliberada:** se o webhook chega antes de `payment_transactions` ter sido gravado
(corrida rara em rede lenta), o evento é tratado como órfão, responde 200 e o reconciliador de
`payment_links`/`orders` — rodado no epic `financeiro-conciliacao` — captura a divergência. Nunca
se cria pedido a partir de webhook.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Reserva em tabela própria, não decremento direto | Continuar com `decrementStock` na criação do pedido | Decremento direto perde a peça em pedido abandonado até alguém reparar à mão; e o boleto seguraria estoque sem controle de prazo |
| Chamada ao gateway fora da transação do banco | Chamar o Asaas dentro da transação | Rede lenta seguraria conexão do Postgres; e um rollback depois de a cobrança existir no Asaas deixa cobrança órfã cobrando a cliente |
| Idempotência por `gateway_events` | Conferir `payment_status` antes de aplicar | Conferência não é atômica — duas entregas simultâneas passariam as duas. `UNIQUE` no banco é |
| `access_token` opaco no pedido | Consulta só por `orderNumber` | Número sequencial é enumerável; qualquer pessoa leria endereço e telefone de todas as clientes |
| `ShippingProvider` como interface, SmartEnvios como implementação inicial | Acoplar direto ao SmartEnvios | A proposta menciona Correios/Melhor Envio; trocar de agregador vira configuração e não reescrita do checkout |
| Fallback para `shipping_rates` quando o provedor cai | Bloquear o checkout até o provedor voltar | Provedor de frete fora do ar não pode derrubar a venda; faixa cadastrada cobre a operação |
| Total sempre recalculado no servidor | Confiar no total enviado pelo front | Preço vindo do cliente é manipulável; é a forma mais barata de fraudar checkout |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Webhook do Asaas configurado no painel do provedor com URL errada no go-live | Pedido pago fica em `pending_payment` e ninguém despacha | Item obrigatório no checklist do epic `implantacao-golive`, com teste de ponta a ponta em sandbox antes do corte |
| Expiração de reserva libera peça que a cliente está pagando naquele instante | Venda perdida com pagamento confirmado depois | Reserva de 30 min cobre folgadamente o PIX; ao chegar confirmação de reserva já liberada, o sistema reavalia o saldo e, se insuficiente, marca o pedido para tratamento manual em vez de vender negativo |
| Divergência entre o desconto de PIX exibido e o cobrado | Cliente paga valor diferente do combinado | O valor cobrado é sempre o recalculado no servidor e devolvido na resposta do checkout; o front exibe o valor da resposta, não o próprio cálculo |
| Token do webhook vazando em log de erro do Express | Terceiro forja confirmação de pagamento | Middleware de log com allowlist de headers; teste de que `asaas-access-token` não aparece na saída |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | Checkout PIX em sandbox → `SELECT gateway, pix_qr_code, pix_expiration FROM payment_transactions WHERE order_id=…` traz `asaas` e os campos preenchidos |
| REQ-1.2 | integração | Checkout boleto → `boleto_url` e `boleto_barcode` não nulos |
| REQ-1.3 | integração | Checkout cartão com token de teste → `payment_transactions.status` reflete o retorno do Asaas |
| REQ-1.4 | integração | Mock do Asaas retornando 500 → resposta 502 `falha_gateway`, `orders.status='pending_payment'`, `stock_reservations.status='released'` |
| REQ-1.5 | unitário | Executar o checkout com logger capturado; a saída não contém `cardToken`, CPF, e-mail nem telefone |
| REQ-1.6 | integração | Limpar a chave do Asaas → `POST /api/checkout` responde 503 e `SELECT count(*) FROM orders` não muda |
| REQ-2.1 | integração | Carrinho de R$ 400 com 5% → `orders.total = 380.00` e `pix_discount_amount = 20.00` |
| REQ-2.2 | integração | Mesmo carrinho com boleto → `total = 400.00` e `pix_discount_amount = 0` |
| REQ-2.3 | manual | Checkout exibe 1..12 parcelas, com as 3 primeiras rotuladas "sem juros" |
| REQ-2.4 | unitário | `calcularParcela(400, 6, 0.0199)` devolve o total com juros compostos esperado |
| REQ-2.5 | integração | `installments: 24` → 400 `parcelas_invalidas` |
| REQ-2.6 | integração | `POST /api/checkout` com `total: 1` no corpo → pedido criado com o total real recalculado |
| REQ-3.1 | integração | `POST /api/shipping/quote` com CEP válido → `options[]` com `carrier`, `daysMin`, `daysMax`, `price` |
| REQ-3.2 | integração | Subtotal ≥ mínimo → existe opção com `price = 0` e `free = true` |
| REQ-3.3 | integração | Checkout com `pickupInStore: true` → `shipping_amount = 0`, `shipping_service = 'retirada'`, criado sem endereço |
| REQ-3.4 | integração | `cep: "1234"` → 400 `cep_invalido`, sem chamada ao provedor (mock não recebe requisição) |
| REQ-3.5 | integração | Mock do provedor com atraso de 10 s → resposta em ≤ 9 s com opções vindas de `shipping_rates` e log `shipping_provider_indisponivel` |
| REQ-3.6 | integração | `POST /api/checkout` com `shippingAmount: 0` para CEP que cota R$ 28 → 409 `frete_divergente` |
| REQ-4.1 | integração | Após checkout, `SELECT quantity, status FROM stock_reservations WHERE order_id=…` traz a quantidade com `held` |
| REQ-4.2 | integração | Variação com saldo 1 e pedido de 2 → 409 `estoque_insuficiente` com o SKU, sem pedido criado |
| REQ-4.3 | integração | Disparar webhook de pagamento recebido → reserva vira `consumed` e existe linha de saída em `stock_movements` |
| REQ-4.4 | integração | Reserva com `expires_at` no passado + rodar o job → `status='released'` e saldo disponível volta ao valor original |
| REQ-4.5 | unitário | `calcularExpiracao("boleto")` devolve `now + 3 dias`; `calcularExpiracao("pix")` devolve `now + 30 min` |
| REQ-4.6 | integração | Cancelar pedido pelo admin → toda reserva daquele pedido fica `released` |
| REQ-5.1 | integração | POST do webhook `PAYMENT_RECEIVED` → `payment_status='approved'`, `status='confirmed'` e nova linha em `order_status_history` |
| REQ-5.2 | integração | Repetir o mesmo POST → 200 e `SELECT count(*) FROM order_status_history WHERE order_id=…` não aumenta |
| REQ-5.3 | integração | POST sem o header de token → 401 e nenhum pedido alterado |
| REQ-5.4 | integração | POST com `charge_id` inexistente → 200, log `webhook_evento_orfao`, nenhuma linha criada |
| REQ-5.5 | integração | POST `PAYMENT_REFUNDED` → `payment_status='refunded'` e reserva `released` |
| REQ-5.6 | integração | Após confirmação, `SELECT * FROM financeiro_lancamentos WHERE origem_id=<order_id>` traz a baixa |
| REQ-5.7 | unitário | Processar webhook com CPF no corpo e logger capturado: a saída não contém o CPF |
| REQ-6.1 | integração | `POST /api/admin/payment-links` autenticado → 201 com `url` de `asaas.com` |
| REQ-6.2 | integração | Webhook de pagamento do link → `payment_links.status='paid'` e baixa lançada com `origin_type`/`origin_id` corretos |
| REQ-6.3 | integração | `amount: 0` → 400 `valor_invalido` |
| REQ-6.4 | integração | Sem sessão → 401 e nada criado no Asaas (mock não recebe requisição) |
| REQ-6.5 | integração | `SELECT created_by, created_at FROM payment_links WHERE id=…` traz o id da usuária da sessão |
| REQ-7.1 | integração | `GET /api/orders/VN-0001` sem `token` → 404; com token de outro pedido → 404 |
| REQ-7.2 | integração | `GET` com token correto → 200 e o JSON não tem `internalNotes` nem `rawResponse` |
| REQ-7.3 | integração | `GET /api/admin/orders` sem sessão → 401 |

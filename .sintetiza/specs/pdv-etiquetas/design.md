# Design — Operação de Loja: PDV e Etiquetas

**Requisitos cobertos:** REQ-1 … REQ-7 · **Spec:** ./requirements.md

## Visão arquitetural

A venda de balcão reaproveita a espinha dorsal do pedido online: `orders`, `order_items`,
`order_status_history` (`shared/schema.ts:292`) e a coluna `channel` já criada em
`migrations/009_order_channel.sql`. Um cupom de PDV é um `order` com `channel = 'loja'`,
`status = 'delivered'` e `payment_status = 'approved'` no momento do fechamento — a peça sai com a
cliente, não há etapa de envio.

O que é novo: pagamentos múltiplos por venda, comissão, devolução com crédito e o gerador ZPL.

```
Tela PDV (React) ─→ POST /api/admin/pdv/vendas ─→ VendaService
                                                    ├─ EstoqueService.movimentar()  (epic catalogo-estoque)
                                                    ├─ orders + order_items + pdv_payments
                                                    ├─ CobrancaService (PIX)         (epic checkout)
                                                    └─ FinanceiroService.receber()   (epic financeiro)

Admin → POST /api/admin/labels/zpl ─→ ZplService ─→ (navegador) Zebra Browser Print ─→ GC420t
```

`server/auth.ts` já expõe `requireAdmin` e `requireRole`; o PDV usa `requireRole(["admin","operator"])`.

## Modelo de dados

Migration nova: `migrations/015_pdv.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `orders` (alter) | `+ seller_id int`, `+ commission_amount numeric(10,2) default 0`, `+ discount_percent numeric(5,2) default 0`, `+ discount_authorized_by int`, `+ cash_session_id int` | REQ-3.1, REQ-3.4, REQ-4.2 |
| `pdv_payments` | `id serial pk`, `order_id int not null`, `method text not null` (`dinheiro`/`pix`/`debito`/`credito`/`credito_troca`), `amount numeric(10,2) not null check (amount > 0)`, `installments int`, `change_amount numeric(10,2) default 0`, `gateway_charge_id text`, `created_at` | REQ-2.1 … REQ-2.6 |
| `returns` | `id serial pk`, `order_id int not null`, `type text not null` (`devolucao`/`troca`), `reason text not null`, `total_returned numeric(10,2) not null`, `total_taken numeric(10,2) default 0`, `difference numeric(10,2) not null`, `created_by int not null`, `created_at` | REQ-5.1 … REQ-5.6 |
| `return_items` | `id serial pk`, `return_id int not null`, `order_item_id int not null`, `variant_id int not null`, `quantity int not null check (quantity > 0)`, `direction text not null` (`in`/`out`) | REQ-5.1, REQ-5.3, REQ-5.5 |
| `customer_credits` | `id serial pk`, `customer_id int not null`, `amount numeric(10,2) not null`, `origin_type text not null` (`devolucao`/`uso`/`ajuste`), `origin_id int`, `note text`, `created_by int`, `created_at` | REQ-2.6, REQ-5.2 |
| `admin_users` (alter) | `+ commission_percent numeric(5,2) default 3.00`, `+ discount_limit_percent numeric(5,2)` | REQ-3.2, REQ-4.2 |
| `store_settings` (alter) | `+ label_template text`, `+ discount_limit_operator numeric(5,2) default 10.00` | REQ-3.2, REQ-6.1 |

Índices: `idx_orders_seller_created` em (`seller_id`,`created_at`) para a apuração (REQ-4.4);
`idx_customer_credits_customer` em `customer_id`; `idx_pdv_payments_order` em `order_id`.

**Saldo de crédito da cliente** é `SUM(amount)` em `customer_credits`, onde devolução entra positivo e
uso entra negativo. Sem coluna de saldo materializada — o volume é baixo e a pergunta "de onde veio"
é mais frequente que a pergunta "quanto tem".

## Contratos de API

### GET /api/admin/pdv/buscar?q=… — atende REQ-1.1, REQ-1.3, REQ-1.5

- **200:** `{ results: [{ variantId, sku, barcode, produto, tamanho, cor, preco, disponivel }] }`, no máximo 10
- Resolução: match exato em `variants.barcode` → match exato em `variants.sku` → busca textual
  (`ILIKE`) em `products.title`, `variants.sku`, `variants.barcode` com `q` de 3+ caracteres
- **200 com `results: []`** quando nada casa — o front exibe "Código não encontrado" (REQ-1.3)
- **Autorização:** `requireRole(["admin","operator"])`

### POST /api/admin/pdv/vendas — atende REQ-1.4, REQ-1.6, REQ-2, REQ-3, REQ-4.1, REQ-4.2, REQ-7

- **Request:**
  ```
  { sellerId: number, customerId?: number,
    items: [{ variantId, quantity, unitPrice }],
    discountPercent?: number (0..100), discountAuthorizedBy?: number,
    payments: [{ method, amount, installments?, gatewayChargeId? }] }
  ```
- **201:** `{ orderId, orderNumber, total, discountAmount, commissionAmount, changeAmount }`
- **400:** `vendedora_obrigatoria` (REQ-4.1), `pagamento_divergente` com a diferença (REQ-2.2),
  `meio_invalido` (REQ-2.5), `desconto_invalido` (REQ-3.5)
- **401:** sem sessão (REQ-7.4)
- **403:** `desconto_acima_da_alcada` com o limite do papel (REQ-3.2)
- **409:** `saldo_insuficiente` do `EstoqueService` (REQ-1.4), `credito_insuficiente` (REQ-2.6)
- **Transação única:** valida → grava `orders` + `order_items` + `pdv_payments` → movimenta estoque →
  debita crédito de troca quando usado → lança o recebimento no financeiro. Falha em qualquer etapa
  desfaz tudo (REQ-1.6)
- **Log:** apenas `{orderNumber, sellerId, total, itemCount}` — nunca dado pessoal da cliente (REQ-7.5)

### POST /api/admin/pdv/pix — atende REQ-2.4

- **Request:** `{ amount, customerId? }` → cria cobrança via `CobrancaService` (epic `checkout-pagamentos-frete`)
- **201:** `{ gatewayChargeId, qrCode, copyPaste }`
- O fechamento da venda só aceita um pagamento PIX cujo `gatewayChargeId` esteja com status
  `RECEIVED` — conferido no servidor no momento do `POST /vendas`, nunca no front

### POST /api/admin/pdv/devolucoes — atende REQ-5.1 … REQ-5.6

- **Request:** `{ orderId, type: "devolucao"|"troca", reason: string(3..300), returnedItems: [{orderItemId, quantity}], takenItems?: [{variantId, quantity, unitPrice}] }`
- **201:** `{ returnId, totalReturned, totalTaken, difference, creditGenerated }`
- **404:** `venda_nao_encontrada` (REQ-5.4)
- **409:** `quantidade_maior_que_vendida` com o SKU (REQ-5.3)
- Diferença positiva → cobrança adicional; negativa → crédito em `customer_credits` (REQ-5.2, REQ-5.5)

### GET /api/admin/pdv/comissoes?de=…&ate=… — atende REQ-4.3, REQ-4.4, REQ-4.5

- **200:** `[{ sellerId, nome, totalVendido, totalDevolvido, comissaoLiquida, cupons }]`
- Uma única consulta com `GROUP BY seller_id` e `LEFT JOIN` nas devoluções do período (REQ-4.4)
- **403:** papel diferente de `admin` (REQ-4.5)

### POST /api/admin/labels/zpl — atende REQ-6.1 … REQ-6.4, REQ-6.6, REQ-6.7

- **Request:** `{ variantIds: number[] }` ou `{ entryId: number }` (lote por entrada, REQ-6.3)
- **200:** `{ zpl: string, count: number }` — `Content-Type: application/json`; o front repassa ao
  Browser Print e, na ausência dele, oferece download como `.zpl` (REQ-6.5)
- **401:** sem sessão (REQ-6.6)
- **409:** `sem_codigo_de_barras` com o SKU (REQ-6.4)
- Dados lidos do banco a cada chamada, sem cache (REQ-6.7)

## Fluxos

**Fechamento de cupom (caminho completo)**

1. Vendedora bipa as peças; cada leitura chama `GET /pdv/buscar` e a linha entra no cupom no cliente.
2. Aplica desconto: o front pré-valida contra a alçada, mas **a decisão é do servidor** (REQ-3.2).
3. Lança pagamentos. Se houver PIX, `POST /pdv/pix` gera a cobrança e a tela faz *polling* do status.
4. `POST /pdv/vendas`:
   - `sum(payments) === total` senão 400 (REQ-2.2);
   - desconto dentro da alçada, ou com `discountAuthorizedBy` de papel `admin` (REQ-3.3);
   - PIX conferido no gateway;
   - transação: `orders` → `order_items` → `pdv_payments` → `EstoqueService.movimentar('saida', …)`
     por item → `customer_credits` negativo quando `credito_troca` for usado → lançamento a receber.
5. Comissão calculada como `(total - discountAmount) × commission_percent / 100` e gravada em `orders`.
6. Resposta traz o troco calculado para o dinheiro (REQ-2.3).

**Ordem de travamento:** as variações são travadas em ordem crescente de `variant_id` dentro da
transação, mesma convenção do checkout online — é o que impede deadlock quando uma venda de balcão e
um pedido online disputam as mesmas peças.

**Devolução**

Valida saldo devolvível por item (`vendido - já devolvido`) → transação: `returns` + `return_items` →
`EstoqueService.movimentar('entrada', origin_type='devolucao')` → `customer_credits` positivo →
estorno proporcional da comissão em `orders.commission_amount` da venda original (REQ-4.3).

**Etiqueta**

`ZplService.gerar(variacoes[])` monta um bloco ZPL por etiqueta:

```
^XA
^PW320                       ; 40 mm a 8 dots/mm
^LL200                       ; 25 mm
^FO12,14^A0N,22,22^FD<nome truncado em 26 chars>^FS
^FO12,44^A0N,20,20^FD<tamanho> · <cor>^FS
^FO12,72^A0N,34,34^FD<preço BRL>^FS
^FO12,112^BY2^BEN,60,Y,N^FD<ean13>^FS
^XZ
```

Truncagem em 26 caracteres (REQ-6.2) é calculada pela fonte `A0N,22` na largura de 320 dots.
Lote por entrada repete o bloco `quantity` vezes por item (REQ-6.3).

**Indisponibilidade do Browser Print (REQ-6.5):** o front tenta `BrowserPrint.getDefaultDevice()`
com timeout de 3 s; falhando, mostra o link de instalação da Zebra e um botão que baixa o `.zpl`
gerado — o operador consegue imprimir por outro caminho e a tela não fica presa.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Cupom de PDV em `orders` com `channel='loja'` | Tabela `sales` separada | Faturamento por canal, histórico da cliente e curva ABC viram consulta única; tabelas separadas obrigariam `UNION` em todo relatório do epic de indicadores |
| Pagamentos em tabela filha, não colunas no pedido | `payment_method` + `payment_method_2` no pedido | Três formas no mesmo cupom acontece no balcão; colunas fixas quebram na quarta |
| Alçada validada no servidor mesmo com pré-validação no front | Confiar na trava da interface | Requisição direta à API burlaria a interface; a margem é o ativo que a regra protege |
| Crédito de troca como lançamentos | Coluna `credit_balance` em `customers` | "De onde veio esse crédito" é a pergunta do balcão; saldo puro não responde |
| PIX conferido no gateway no momento do fechamento | Confiar no status que o front enviou | Front comprometido fecharia venda sem pagamento |
| ZPL gerado no servidor, impresso pelo navegador | Serviço de impressão no servidor | Impressora é USB local; imprimir do servidor exigiria túnel e agente próprio — o Browser Print da Zebra já resolve, sem licença |
| Truncagem do nome em vez de fonte proporcional | Reduzir a fonte até caber | Fonte pequena demais não é lida na arara; nome truncado com tamanho/cor legíveis atende o uso real |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Leitor de código de barras configurado sem sufixo Enter | Cada leitura exige clique e o balcão fica mais lento que o sistema atual | Item do roteiro de treinamento (`implantacao-golive`); o campo de leitura também dispara a busca por *debounce* de 300 ms sem depender do Enter |
| Venda de balcão e pedido online disputando a última peça | Cupom fechado sem estoque real | `SELECT ... FOR UPDATE` em ordem de `variant_id` no `EstoqueService`, com 409 explícito no PDV |
| Internet cai no meio do expediente e o PDV é web | Loja para de vender | Fora do escopo contratado resolver venda offline; mitigação operacional é o 4G do celular como rota reserva, documentada no manual. Risco registrado e aceito |
| Estorno de comissão em devolução parcial calculado errado | Vendedora recebe a mais ou a menos | Estorno proporcional ao valor devolvido, com teste unitário do cálculo em devolução parcial e integral |
| Etiqueta impressa com preço desatualizado após reajuste | Cliente cobra o preço da etiqueta na arara | Etiqueta sempre lida do banco no momento da geração (REQ-6.7) e procedimento de reimpressão em lote na alteração de preço |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | `GET /pdv/buscar?q=<barcode>` retorna a variação; repetir com o SKU retorna a mesma |
| REQ-1.2 | manual | Bipar a mesma peça duas vezes: o cupom mostra uma linha com quantidade 2 |
| REQ-1.3 | integração | `GET /pdv/buscar?q=000000000` → 200 com `results: []` |
| REQ-1.4 | integração | Variação com saldo 0 e `continueSelling=false` no `POST /vendas` → 409 `saldo_insuficiente` |
| REQ-1.5 | integração | `q=alina` → no máximo 10 resultados, todos contendo o termo em título, SKU ou barcode |
| REQ-1.6 | integração | Fechar cupom de 2 itens → 2 linhas em `stock_movements` com `origin_type='pdv'` e o `order_id` correto |
| REQ-2.1 | integração | Venda com dinheiro 100 + crédito 289 → 2 linhas em `pdv_payments` com os valores e o parcelamento |
| REQ-2.2 | integração | Pagamentos somando 300 num cupom de 389 → 400 `pagamento_divergente` com `diferenca: 89` e `count(*)` de `orders` inalterado |
| REQ-2.3 | unitário | `calcularTroco([{method:'dinheiro',amount:400}], 389)` devolve `11.00` |
| REQ-2.4 | integração | Fechar com PIX cuja cobrança está `PENDING` → recusa; após simular `RECEIVED` no mock, fecha |
| REQ-2.5 | integração | `method: "cheque"` → 400 `meio_invalido` |
| REQ-2.6 | integração | Cliente com crédito 50 usando 80 → 409 `credito_insuficiente`; usando 50 → venda fecha e `SUM(amount)` do crédito zera |
| REQ-3.1 | integração | `operator` aplicando 8% (limite 10%) → 201 com `discountPercent=8` gravado |
| REQ-3.2 | integração | `operator` aplicando 25% → 403 `desconto_acima_da_alcada` com `limite: 10` |
| REQ-3.3 | integração | 25% com `discountAuthorizedBy` de usuária `admin` → 201 e `discount_authorized_by` gravado |
| REQ-3.4 | integração | `SELECT discount_percent, discount_amount, discount_authorized_by FROM orders WHERE id=…` traz os três |
| REQ-3.5 | integração | `discountPercent: 120` → 400 `desconto_invalido`; `-5` idem |
| REQ-4.1 | integração | `POST /vendas` sem `sellerId` → 400 `vendedora_obrigatoria` |
| REQ-4.2 | unitário | `calcularComissao(389, 39, 3)` devolve `10.50` |
| REQ-4.3 | integração | Devolver a venda inteira → `orders.commission_amount` da venda original vai a 0 |
| REQ-4.4 | integração | `DEBUG=pg` em `GET /pdv/comissoes`: exatamente 1 consulta; totais conferidos contra o cenário de teste |
| REQ-4.5 | integração | Consulta com sessão `operator` → 403 |
| REQ-5.1 | integração | Devolver 1 un. → movimentação `entrada` com `origin_type='devolucao'` e saldo +1 |
| REQ-5.2 | integração | Após devolução de R$ 389 → linha em `customer_credits` com `amount=389` e `origin_id` do `return` |
| REQ-5.3 | integração | Devolver 3 de um item vendido 2 → 409 `quantidade_maior_que_vendida`; nenhum registro criado |
| REQ-5.4 | integração | `orderId` inexistente → 404 `venda_nao_encontrada` |
| REQ-5.5 | integração | Troca de peça de R$ 389 por peça de R$ 450 → `difference = 61`, entrada e saída registradas |
| REQ-5.6 | integração | `SELECT reason, created_by FROM returns WHERE id=…` traz os dois preenchidos |
| REQ-6.1 | unitário | `gerarZpl(variacao)` contém `^XA`, `^XZ`, o nome, `tamanho · cor`, o preço em `R$` e `^BEN` com o EAN-13 |
| REQ-6.2 | unitário | Nome de 60 caracteres → o campo `^FD` do nome tem no máximo 26 |
| REQ-6.3 | integração | `POST /labels/zpl {entryId}` de entrada com 3 un. de A e 2 de B → `count: 5` e 5 blocos `^XA` |
| REQ-6.4 | integração | Variação sem `barcode` → 409 `sem_codigo_de_barras` com o SKU |
| REQ-6.5 | manual | Navegador sem Browser Print: aparece a instrução de instalação e o botão de download baixa o `.zpl` |
| REQ-6.6 | integração | `POST /labels/zpl` sem sessão → 401 |
| REQ-6.7 | integração | Alterar o preço e regerar → o ZPL traz o preço novo |
| REQ-7.1 | integração | Após o cupom, `GET /api/admin/orders` lista o pedido com `channel='loja'` |
| REQ-7.2 | integração | Cupom com `customerId` → o pedido aparece no histórico daquela cliente |
| REQ-7.3 | integração | Cupom sem `customerId` → venda criada com `customer_id` nulo e `count(*)` de `customers` inalterado |
| REQ-7.4 | integração | `POST /pdv/vendas` sem sessão → 401 e nenhuma venda gravada |
| REQ-7.5 | unitário | Fechar venda com logger capturado: a saída não contém CPF, telefone nem e-mail |

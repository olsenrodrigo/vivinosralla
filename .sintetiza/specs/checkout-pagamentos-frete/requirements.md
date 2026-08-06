# Requisitos — Checkout, Pagamentos e Frete

**Projeto:** VIVI · **Plane:** módulo "Checkout, Pagamentos e Frete" · **Origem:** pré-projeto Viviane Nosralla, Blocos A3 e B8
**Status:** rascunho

## Contexto

Hoje o pagamento é combinado por mensagem: a cliente manda o comprovante, alguém confere e o pedido
segue. Não há checkout, não há confirmação automática e não há registro do recebimento em lugar
nenhum além do extrato. Este epic fecha o ciclo de dinheiro do sistema: a cliente paga PIX, cartão
ou boleto pelo Asaas dentro do próprio checkout, o webhook confirma, o pedido muda de status sozinho
e o recebimento nasce lançado no contas a receber. O mesmo motor de cobrança atende a loja virtual,
o PDV e o consignado — uma cobrança gerada em qualquer um dos três cai no mesmo lugar.

## Glossário

| Termo | Definição |
|---|---|
| Gateway | Provedor de pagamento acessado por um adaptador que implementa a interface `PaymentGateway` (`server/gateway/types.ts`) |
| Cobrança | Registro de intenção de recebimento no Asaas, com identificador próprio e um dos métodos PIX, boleto ou cartão |
| Link de cobrança | URL pública gerada pelo Asaas que permite pagar uma cobrança fora do checkout — usada no consignado e no atendimento por WhatsApp |
| Webhook | Requisição HTTP que o Asaas envia ao sistema quando o estado de uma cobrança muda |
| Idempotência | Propriedade de uma operação que, repetida com a mesma entrada, produz o mesmo estado final sem efeito colateral adicional |
| Reserva de estoque | Bloqueio temporário do saldo de uma variação enquanto a cliente conclui o pagamento |
| Retirada na loja | Modalidade de entrega em que a cliente busca a peça em Monte Alto, com frete zero |

## Fora de escopo

- Crediário próprio e análise de risco (previsto como evolução de Fase 2)
- Split de pagamento entre múltiplos recebedores
- Assinatura recorrente na loja virtual — o código de `subscriptions` permanece no repositório mas não é ativado para esta marca
- Emissão de documento fiscal, que vive no epic `fiscal-nfce`

---

## REQ-1 — Asaas como gateway de PIX, boleto e cartão

**Como** operação, **quero** que os três meios de pagamento passem pelo Asaas, **para** ter um único
extrato, uma única régua de taxas e um único ponto de conciliação.

**Critérios de aceite**

- **REQ-1.1** — QUANDO um pedido é criado com `paymentMethod = "pix"`, O SISTEMA DEVE criar a cobrança no Asaas e persistir em `payment_transactions` o `gateway = "asaas"`, o identificador da cobrança, o payload copia-e-cola do PIX e a data de expiração
- **REQ-1.2** — QUANDO um pedido é criado com `paymentMethod = "boleto"`, O SISTEMA DEVE persistir a URL do boleto e a linha digitável retornadas pelo Asaas
- **REQ-1.3** — QUANDO um pedido é criado com `paymentMethod = "credit_card"` e token de cartão válido, O SISTEMA DEVE enviar a cobrança ao Asaas e persistir o status retornado
- **REQ-1.4** — SE o Asaas responde com erro HTTP ou timeout na criação da cobrança, ENTÃO O SISTEMA DEVE responder HTTP 502 com `{"error":"falha_gateway"}`, manter o pedido em `pending_payment`, liberar a reserva de estoque e registrar log estruturado com `orderNumber` e código de erro do provedor
- **REQ-1.5** — O SISTEMA DEVE não gravar em log o token do cartão, o CPF, o e-mail nem o telefone da cliente
- **REQ-1.6** — SE a chave de API do Asaas não está configurada, ENTÃO O SISTEMA DEVE responder HTTP 503 com `{"error":"gateway_nao_configurado"}` e não criar pedido

## REQ-2 — Desconto no PIX e parcelamento no cartão

**Como** marca, **quero** premiar quem paga PIX e mostrar o parcelamento antes do aceite, **para**
aumentar a margem e reduzir o abandono no último passo.

**Critérios de aceite**

- **REQ-2.1** — QUANDO o método selecionado é PIX e existe percentual de desconto configurado, O SISTEMA DEVE cobrar o total com o desconto aplicado e gravar o valor descontado em `orders.discount_amount`
- **REQ-2.2** — QUANDO o método selecionado deixa de ser PIX, O SISTEMA DEVE recalcular o total sem o desconto de PIX antes de criar a cobrança
- **REQ-2.3** — QUANDO o checkout exibe as opções de parcelamento, O SISTEMA DEVE listar de 1 até `store_settings.max_installments` parcelas, marcando como sem juros as até `store_settings.free_installments`
- **REQ-2.4** — QUANDO a parcela escolhida está acima de `free_installments`, O SISTEMA DEVE aplicar `store_settings.monthly_interest_rate` ao valor e exibir o total com juros antes da confirmação
- **REQ-2.5** — SE o número de parcelas recebido é maior que `max_installments`, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"parcelas_invalidas"}` e não criar cobrança
- **REQ-2.6** — O SISTEMA DEVE calcular o valor cobrado no servidor, ignorando qualquer total enviado pelo cliente

## REQ-3 — Frete, frete grátis e retirada na loja

**Como** cliente, **quero** saber o frete antes de pagar e poder retirar na loja, **para** decidir com
o custo total na tela.

**Critérios de aceite**

- **REQ-3.1** — QUANDO o CEP é informado no checkout, O SISTEMA DEVE consultar o provedor de frete e retornar as opções disponíveis com transportadora, prazo em dias e valor
- **REQ-3.2** — QUANDO o subtotal do carrinho é maior ou igual a `store_settings.free_shipping_above`, O SISTEMA DEVE apresentar a opção de frete com valor zero e rótulo "Frete grátis"
- **REQ-3.3** — QUANDO a cliente escolhe retirada na loja, O SISTEMA DEVE gravar `shipping_amount = 0`, `shipping_service = "retirada"` e não exigir endereço de entrega
- **REQ-3.4** — SE o CEP informado não tem 8 dígitos numéricos, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"cep_invalido"}` e não consultar o provedor
- **REQ-3.5** — SE o provedor de frete não responde em até 8 segundos, ENTÃO O SISTEMA DEVE retornar as faixas de `shipping_rates` cadastradas como alternativa e registrar log de indisponibilidade do provedor
- **REQ-3.6** — QUANDO o pedido é criado, O SISTEMA DEVE recalcular o frete no servidor e recusar com HTTP 409 `{"error":"frete_divergente"}` se o valor recebido do cliente for menor que o recalculado

## REQ-4 — Reserva de estoque durante o pagamento

**Como** operação, **quero** que a peça fique reservada enquanto a cliente paga, **para** não vender
duas vezes a mesma peça nem segurar estoque indefinidamente.

**Critérios de aceite**

- **REQ-4.1** — QUANDO um pedido é criado, O SISTEMA DEVE reservar a quantidade de cada variação e reduzir o saldo disponível para venda na mesma transação da criação do pedido
- **REQ-4.2** — SE o saldo disponível de qualquer item é menor que a quantidade pedida no momento da criação, ENTÃO O SISTEMA DEVE responder HTTP 409 com `{"error":"estoque_insuficiente","sku":"<sku>"}` e não criar o pedido nem cobrança
- **REQ-4.3** — QUANDO o pagamento é confirmado, O SISTEMA DEVE converter a reserva em saída definitiva de estoque
- **REQ-4.4** — QUANDO uma reserva completa 30 minutos sem confirmação de pagamento em PIX ou cartão, O SISTEMA DEVE liberar a reserva e devolver o saldo ao disponível
- **REQ-4.5** — QUANDO a cobrança é boleto, O SISTEMA DEVE manter a reserva por 3 dias corridos antes de liberar
- **REQ-4.6** — QUANDO um pedido é cancelado, O SISTEMA DEVE liberar toda reserva ainda ativa daquele pedido

## REQ-5 — Webhook do Asaas

**Como** operação, **quero** que a confirmação do pagamento entre sozinha, **para** não conferir
comprovante à mão nem correr o risco de despachar peça não paga.

**Critérios de aceite**

- **REQ-5.1** — QUANDO o Asaas envia um evento de cobrança recebida, O SISTEMA DEVE atualizar `orders.payment_status` para `approved`, `orders.status` para `confirmed` e registrar a transição em `order_status_history`
- **REQ-5.2** — QUANDO o mesmo evento é entregue mais de uma vez, O SISTEMA DEVE aplicar o efeito uma única vez e responder HTTP 200 nas entregas repetidas
- **REQ-5.3** — SE o webhook chega sem o token de autenticação configurado ou com token divergente, ENTÃO O SISTEMA DEVE responder HTTP 401 e não alterar pedido nenhum
- **REQ-5.4** — SE o webhook referencia uma cobrança que não existe no banco, ENTÃO O SISTEMA DEVE responder HTTP 200, registrar log de evento órfão e não criar registro
- **REQ-5.5** — QUANDO o Asaas envia um evento de estorno ou de cobrança removida, O SISTEMA DEVE mudar `payment_status` para `refunded` ou `cancelled`, liberar a reserva de estoque e registrar a transição
- **REQ-5.6** — QUANDO um pagamento é confirmado, O SISTEMA DEVE registrar a baixa correspondente no contas a receber
- **REQ-5.7** — O SISTEMA DEVE não gravar o corpo completo do webhook em log quando ele contiver CPF, e-mail ou telefone da pagadora

## REQ-6 — Link de cobrança avulso a partir do backoffice

**Como** vendedora, **quero** gerar um link de pagamento para uma venda combinada por WhatsApp ou
para um saldo de consignado, **para** receber sem digitar pedido em outro sistema.

**Critérios de aceite**

- **REQ-6.1** — QUANDO uma usuária autenticada solicita um link de cobrança informando valor, descrição e cliente, O SISTEMA DEVE criar a cobrança no Asaas e responder HTTP 201 com a URL de pagamento
- **REQ-6.2** — QUANDO o link de cobrança é pago, O SISTEMA DEVE receber o webhook e registrar a baixa no contas a receber vinculada à origem que gerou o link
- **REQ-6.3** — SE o valor solicitado é menor ou igual a zero, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"valor_invalido"}`
- **REQ-6.4** — SE a requisição de link chega sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não criar cobrança
- **REQ-6.5** — QUANDO um link é criado, O SISTEMA DEVE registrar quem o gerou e o momento da criação

## REQ-7 — Isolamento do pedido da cliente

**Como** cliente, **quero** que meu pedido não seja acessível por quem não o fez, **para** que meus
dados de entrega e pagamento não vazem.

**Critérios de aceite**

- **REQ-7.1** — SE `GET /api/orders/:orderNumber` é chamado sem o token de acesso do pedido, ENTÃO O SISTEMA DEVE responder HTTP 404 e não revelar se o número existe
- **REQ-7.2** — QUANDO o pedido é consultado pela cliente com o token correto, O SISTEMA DEVE retornar apenas os campos de acompanhamento e omitir `internal_notes` e o payload bruto do gateway
- **REQ-7.3** — SE uma rota de backoffice de pedidos é chamada sem sessão administrativa, ENTÃO O SISTEMA DEVE responder HTTP 401

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Asaas passa a ser o gateway padrão dos três métodos; o adaptador MercadoPago permanece registrado e desativado | A proposta contrata Asaas; o registry de `server/gateway/index.ts` já suporta os dois, e manter o MercadoPago carregado custa zero e preserva a saída de emergência |
| 2 | Frete cotado pelo conector SmartEnvios já existente (`server/smartenvios/`), atrás de uma interface `ShippingProvider` | A proposta cita "Correios / Melhor Envio"; o SmartEnvios já está integrado e cota Correios entre as transportadoras. A interface deixa a troca por Melhor Envio como configuração, não como reescrita |
| 3 | Reserva de estoque expira em 30 min para PIX e cartão, 3 dias para boleto | O PIX cai em minutos; o boleto compensa em até 3 dias úteis, prazo que o próprio manual da plataforma já documenta. Reservar boleto por 30 min cancelaria venda paga |
| 4 | Desconto de PIX configurável em `store_settings`, com 5% como valor inicial | A proposta comercial cita 5% como exemplo; deixar fixo em código obrigaria deploy para mudar promoção |
| 5 | Acesso da cliente ao pedido por token opaco no link, não pelo número do pedido | Número de pedido é sequencial e adivinhável — consultar só pelo número é IDOR |
| 6 | Idempotência do webhook por chave única `(gateway, gateway_event_id)` em tabela própria | O Asaas reentrega evento em falha de rede; sem chave única a baixa duplica no financeiro |

## Perguntas em aberto

Nenhuma bloqueante. Duas confirmações operacionais antes da execução da task de configuração:
o percentual de desconto do PIX (assumido 5%) e o valor mínimo de frete grátis (assumido R$ 399,
que é o valor já usado em `client/src/lib/marca.ts:21`).

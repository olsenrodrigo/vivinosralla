# Design — Consignado com Controle de Retorno

**Requisitos cobertos:** REQ-1 … REQ-5 · **Spec:** ./requirements.md

## Visão arquitetural

O consignado é uma máquina de estados curta sobre três serviços que já existirão quando este epic
começar: `EstoqueService` (epic `catalogo-estoque-unificado`), `CobrancaService` (epic
`checkout-pagamentos-frete`) e o registro de venda em `orders` (epic `pdv-etiquetas`).

```
aberta ──(retorno: tudo voltou)──→ devolvida
   │
   └──(retorno: alguma peça ficou)──→ convertida ──→ order(channel='consignado')
                                                       └─→ payment_link ─→ Asaas ─→ baixa a receber
```

Nada aqui é um caminho novo de estoque ou de cobrança — são os mesmos serviços com um `origin_type`
diferente. O que este epic acrescenta é o **ciclo de conferência**, que hoje não existe em lugar
nenhum da operação.

`server/notify.ts` já implementa envio por WhatsApp (usado em `server/routes.ts:1506` para carrinho
abandonado); o romaneio reaproveita esse caminho.

## Modelo de dados

Migration nova: `migrations/016_consignado.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `consignments` | `id serial pk`, `customer_id int not null`, `status text not null default 'aberta'` (`aberta`/`devolvida`/`convertida`/`cancelada`), `expected_return_date date not null`, `total_value numeric(10,2) not null`, `balance_due numeric(10,2) default 0`, `order_id int`, `romaneio_sent_at timestamptz`, `created_by int not null`, `closed_by int`, `closed_at timestamptz`, `created_at timestamptz default now()` | REQ-1.1, REQ-1.7, REQ-3.4, REQ-3.5, REQ-3.8, REQ-2.3 |
| `consignment_items` | `id serial pk`, `consignment_id int not null`, `variant_id int not null`, `product_id int not null`, `quantity int not null check (quantity > 0)`, `unit_price numeric(10,2) not null`, `returned_quantity int default 0`, `kept_quantity int default 0` | REQ-1.1, REQ-3.1, REQ-3.6 |
| `consignment_receipts` | `id serial pk`, `consignment_id int not null`, `amount numeric(10,2) not null`, `method text not null`, `payment_link_id int`, `received_by int`, `created_at` | REQ-4.3, REQ-4.5 |

Índices: `idx_consignments_status_return` em (`status`,`expected_return_date`) — é o índice do painel
(REQ-5.1, REQ-5.2); `idx_consignment_items_consignment` em `consignment_id`;
`idx_consignments_customer` em `customer_id` (REQ-5.4).

`balance_due` é materializado no fechamento porque é o valor que a cobrança usa e que o painel
financeiro lê; recalculá-lo de `consignment_items` a cada leitura exigiria join em toda listagem.

## Contratos de API

### POST /api/admin/consignacoes — atende REQ-1.1 … REQ-1.7

- **Request:** `{ customerId: number, expectedReturnDate: "YYYY-MM-DD", items: [{ variantId, quantity, unitPrice? }] }`
  — `unitPrice` omitido usa o preço vigente da variação
- **201:** `{ id, totalValue, items: [...] }`
- **400:** `cliente_obrigatoria` (REQ-1.4), `data_retorno_invalida` (REQ-1.5)
- **401:** sem sessão (REQ-1.6)
- **409:** `saldo_insuficiente` com o SKU (REQ-1.3)
- **Autorização:** `requireRole(["admin","operator"])`
- **Transação única:** valida **todos** os itens antes de mover qualquer um → grava `consignments` +
  `consignment_items` → `EstoqueService.movimentar('consignacao_saida', origin_type='consignacao')`
  por item. Falha em qualquer ponto desfaz tudo (REQ-1.3)

### GET /api/admin/consignacoes/:id/romaneio?formato=pdf|json — atende REQ-2.1, REQ-2.2, REQ-2.5

- **200 (`pdf`):** `Content-Type: application/pdf`, com cabeçalho da marca, dados da cliente, datas e
  a tabela de itens (SKU, descrição, tamanho, cor, preço)
- **200 (`json`):** mesma estrutura em objeto, usada pela tela e pela montagem da mensagem
- **404:** consignação inexistente (REQ-2.5)

### POST /api/admin/consignacoes/:id/romaneio/whatsapp — atende REQ-2.3, REQ-2.4

- **200:** `{ sent: true, sentAt }` e `consignments.romaneio_sent_at` preenchido
- **409:** `cliente_sem_telefone` (REQ-2.4)
- Reaproveita o caminho de envio de `server/notify.ts`

### POST /api/admin/consignacoes/:id/retorno — atende REQ-3.1 … REQ-3.8

- **Request:** `{ items: [{ consignmentItemId, returnedQuantity, keptQuantity }] }`
- **200:** `{ status: "devolvida"|"convertida", orderId?: number, balanceDue: number }`
- **400:** `conferencia_incompleta` com o SKU quando `returned + kept !== quantity` (REQ-3.6)
- **409:** `consignacao_ja_fechada` (REQ-3.7)
- **Transação única:**
  1. valida a conferência de todos os itens;
  2. `EstoqueService.movimentar('consignacao_retorno', entrada)` para cada peça devolvida (REQ-3.1);
  3. se `sum(kept) > 0`: cria `orders` com `channel='consignado'`, `status='delivered'`,
     `payment_status='pending'`, itens = peças mantidas — **sem** movimentar estoque de novo (REQ-3.3);
  4. atualiza `consignments.status`, `balance_due`, `order_id`, `closed_by`, `closed_at`.

### POST /api/admin/consignacoes/:id/cobranca — atende REQ-4.1 … REQ-4.4

- **201:** `{ paymentLinkId, url }` — delega a `POST /api/admin/payment-links` com
  `originType='consignacao'` e `originId = consignment.id` (REQ-4.2)
- **409:** `sem_saldo_a_cobrar` quando `balance_due <= 0` (REQ-4.4)

### POST /api/admin/consignacoes/:id/recebimentos — atende REQ-4.5

- **Request:** `{ amount: number > 0, method: string }`
- **201:** `{ id, balanceDue }` — grava em `consignment_receipts` e reduz `balance_due`
- **400:** valor maior que o saldo em aberto → `{"error":"valor_acima_do_saldo"}`

### GET /api/admin/consignacoes — atende REQ-5.1 … REQ-5.5

- **Query:** `status?`, `customerId?`, `vencidas?=true`
- **200:** `[{ id, cliente, pecas, valorTotal, saidaEm, retornoPrevisto, vencida: boolean, diasAtraso: number }]`
- **401:** sem sessão (REQ-5.5)
- Uma única consulta: `consignments` + `LEFT JOIN LATERAL (SELECT count/sum FROM consignment_items …)`
  + `JOIN customers` — sem laço (REQ-5.3). `vencida` e `diasAtraso` calculados em SQL com
  `expected_return_date < current_date` e `current_date - expected_return_date`

**Log:** todas as rotas deste epic logam apenas `{consignmentId, customerId, itemCount, status}` —
nunca telefone, CPF ou e-mail (REQ-5.6).

## Fluxos

**Confirmação de pagamento do link (REQ-4.3)**

O webhook do Asaas (epic `checkout-pagamentos-frete`) resolve o `payment_links.origin_type`. Quando
é `consignacao`: grava `consignment_receipts`, reduz `balance_due`, marca a venda vinculada como
`payment_status='approved'` e lança a baixa no contas a receber. É o mesmo webhook, com um ramo a
mais — não há endpoint próprio de consignado, o que evita um segundo ponto de idempotência.

**Consistência de estoque na conversão**

A saída física acontece uma vez só, na criação da consignação. O `order` da conversão existe para
registrar faturamento e histórico da cliente, não para mover estoque. Por isso a criação de pedido
neste fluxo usa `VendaService.registrarSemMovimentar()` — uma porta explícita, para que a leitura do
código não sugira que alguém esqueceu de baixar o estoque.

**Cancelamento de consignação** (`status='cancelada'`): devolve todos os itens ao estoque com
`consignacao_retorno` e não cria venda. Usado quando a saída foi registrada por engano.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Baixa de estoque na saída, com tipo próprio | Manter o saldo e marcar a peça como "em consignação" numa flag | A loja virtual consulta saldo; peça na casa da cliente disponível para venda online é venda que não pode ser entregue |
| Venda da conversão não movimenta estoque | Estornar a saída e refazer como venda | Dois movimentos para um evento físico único; o extrato ficaria ilegível na auditoria |
| `balance_due` materializado | Recalcular a partir dos itens mantidos | Valor lido pelo painel, pela cobrança e pelo financeiro; recalcular obrigaria join em toda leitura |
| Conferência exige `devolvido + mantido = saiu` por item | Aceitar conferência parcial e deixar o resto em aberto | Peça sem decisão é exatamente o buraco atual da operação; forçar a conferência completa é o objetivo do módulo |
| Reuso do webhook do Asaas com ramo por `origin_type` | Endpoint de webhook próprio do consignado | Um segundo endpoint teria a própria tabela de idempotência e duplicaria o risco de baixa dupla |
| Prazo vencido apenas sinalizado, sem cobrança automática | Régua automática de cobrança por WhatsApp | Consignado é venda relacional; mensagem automática de cobrança tem custo de relacionamento maior que o ganho |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Peça consignada nunca conferida deixa saldo travado indefinidamente | Estoque "some" do disponível sem ninguém perceber | Painel com sinalização de vencida e dias de atraso é a tela de trabalho da operação; incluída no roteiro de treinamento |
| Cliente paga o saldo por PIX direto na chave, fora do link | `balance_due` fica aberto e o painel mostra dívida inexistente | Endpoint de recebimento manual (REQ-4.5) e passo explícito no manual de operação |
| Conversão criando venda enquanto o webhook do link chega | Baixa aplicada em pedido ainda não commitado | Ordem fixa: a venda é criada e commitada no retorno; o link só pode ser gerado depois, a partir da consignação já fechada |
| Romaneio em PDF acrescentando dependência pesada de renderização | Build maior e mais lento sem ganho proporcional | Gerar o PDF com um construtor mínimo de conteúdo textual e tabela; sem engine de HTML headless |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | Criar consignação de 3 itens → `status='aberta'` e 3 linhas em `stock_movements` com `type='consignacao_saida'` |
| REQ-1.2 | integração | Saldo da variação antes e depois: caiu pela quantidade consignada, na mesma transação |
| REQ-1.3 | integração | Item com saldo 1 e pedido de 2 → 409 `saldo_insuficiente`; `count(*)` de `consignments` e de `stock_movements` inalterados |
| REQ-1.4 | integração | `POST` sem `customerId` → 400 `cliente_obrigatoria` |
| REQ-1.5 | integração | `expectedReturnDate` de ontem → 400 `data_retorno_invalida` |
| REQ-1.6 | integração | `POST` sem sessão → 401 e nada criado |
| REQ-1.7 | integração | `SELECT created_by FROM consignments WHERE id=…` traz o id da usuária da sessão |
| REQ-2.1 | integração | `GET /romaneio?formato=json` traz cliente, datas e, por item, SKU, descrição, tamanho, cor e preço |
| REQ-2.2 | integração | `curl -sI .../romaneio?formato=pdf` → 200 e `Content-Type: application/pdf` |
| REQ-2.3 | integração | `POST /romaneio/whatsapp` com mock do notificador → `sent: true` e `romaneio_sent_at` preenchido |
| REQ-2.4 | integração | Cliente sem telefone → 409 `cliente_sem_telefone` e o mock não recebe chamada |
| REQ-2.5 | integração | `GET /api/admin/consignacoes/99999/romaneio` → 404 |
| REQ-3.1 | integração | Retorno com 2 devolvidas → 2 movimentações `consignacao_retorno` e saldo +2 |
| REQ-3.2 | integração | Retorno com 1 mantida → existe `order` com `channel='consignado'`, 1 item e `consignments.order_id` preenchido |
| REQ-3.3 | integração | Saldo da variação mantida após a conversão é o mesmo de logo após a saída — não caiu de novo |
| REQ-3.4 | integração | Retorno com tudo devolvido → `status='devolvida'`, `order_id` nulo, `balance_due = 0` |
| REQ-3.5 | integração | Retorno com peça mantida → `status='convertida'` e `balance_due` igual à soma das mantidas |
| REQ-3.6 | integração | Item que saiu 2 com `returned:1, kept:0` → 400 `conferencia_incompleta` com o SKU e nada gravado |
| REQ-3.7 | integração | Repetir o retorno numa consignação fechada → 409 `consignacao_ja_fechada` |
| REQ-3.8 | integração | `SELECT closed_by, closed_at FROM consignments WHERE id=…` preenchidos |
| REQ-4.1 | integração | `POST /cobranca` em consignação convertida → 201 com `url` |
| REQ-4.2 | integração | `SELECT origin_type, origin_id FROM payment_links WHERE id=…` traz `consignacao` e o id da consignação |
| REQ-4.3 | integração | Disparar o webhook do link → venda com `payment_status='approved'`, linha em `consignment_receipts` e baixa no financeiro |
| REQ-4.4 | integração | `POST /cobranca` com `balance_due = 0` → 409 `sem_saldo_a_cobrar` |
| REQ-4.5 | integração | Recebimento manual de metade do saldo → `balance_due` cai pela metade e existe linha em `consignment_receipts` |
| REQ-5.1 | integração | `GET /api/admin/consignacoes?status=aberta` traz cliente, peças, valor e as duas datas |
| REQ-5.2 | integração | Consignação com retorno previsto há 5 dias → `vencida: true`, `diasAtraso: 5` |
| REQ-5.3 | integração | `DEBUG=pg` na listagem com 20 consignações: exatamente 1 consulta |
| REQ-5.4 | integração | `?customerId=X` → todas as linhas retornadas têm aquele `customerId` |
| REQ-5.5 | integração | `GET` sem sessão → 401 |
| REQ-5.6 | unitário | Executar criação, romaneio e painel com logger capturado: a saída não contém telefone, CPF nem e-mail |

# Design — Financeiro, Caixa e Conciliação Bancária

**Requisitos cobertos:** REQ-1 … REQ-6 · **Spec:** ./requirements.md

## Visão arquitetural

O financeiro é a camada que os outros epics alimentam. Nenhum deles grava direto nas tabelas
financeiras: todos chamam `FinanceiroService`, que é o único ponto de escrita.

```
Checkout ──┐
PDV ───────┼─→ FinanceiroService.aReceber(origem, valor, previsao)
Consignado─┘
Webhook Asaas ─→ FinanceiroService.baixar(origemTipo, origemId, data, meio)

Admin ─→ contas a pagar / caixa / extrato ─→ FinanceiroService
                                               └─→ ConciliacaoService (extrato ↔ baixas)
```

A separação importa por um motivo prático: a baixa automática precisa ser idempotente (o webhook
reentrega), e concentrar a escrita em um serviço é o que permite garantir isso em um lugar só.

## Modelo de dados

Migration nova: `migrations/018_financeiro.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `fin_categories` | `id serial pk`, `group text not null` (`receita`/`despesa`), `name text not null`, `active bool default true`, unique(`group`,`name`) | REQ-1.1 |
| `fin_recurrences` | `id serial pk`, `description text not null`, `amount numeric(12,2) not null`, `category_id int not null`, `supplier_id int`, `day_of_month int not null`, `active bool default true`, `created_at` | REQ-1.3, REQ-1.7 |
| `fin_entries` | `id serial pk`, `direction text not null` (`pagar`/`receber`), `description text not null`, `amount numeric(12,2) not null check (amount > 0)`, `due_date date not null`, `category_id int`, `supplier_id int`, `customer_id int`, `origin_type text` (`pedido`/`consignacao`/`pdv`/`manual`/`recorrencia`), `origin_id int`, `installment_number int`, `installment_total int`, `recurrence_id int`, `status text not null default 'aberto'` (`aberto`/`pago`/`cancelado`), `created_by int`, `created_at` | REQ-1.1 … REQ-1.7, REQ-2.1, REQ-2.4, REQ-2.7 |
| `fin_settlements` | `id serial pk`, `entry_id int not null`, `amount numeric(12,2) not null`, `settled_at date not null`, `method text not null`, `gateway_event_id text`, `cash_session_id int`, `created_by int`, `created_at`, unique(`entry_id`,`gateway_event_id`) | REQ-1.4, REQ-2.2, REQ-2.3, REQ-2.5 |
| `cash_sessions` | `id serial pk`, `opened_by int not null`, `opened_at timestamptz not null`, `opening_amount numeric(10,2) not null`, `closed_by int`, `closed_at timestamptz`, `counted_amount numeric(10,2)`, `expected_amount numeric(10,2)`, `difference numeric(10,2)`, `status text not null default 'aberto'` | REQ-3.1, REQ-3.2, REQ-3.5, REQ-3.6, REQ-3.8 |
| `cash_movements` | `id serial pk`, `cash_session_id int not null`, `type text not null` (`sangria`/`suprimento`), `amount numeric(10,2) not null check (amount > 0)`, `reason text not null`, `created_by int not null`, `created_at` | REQ-3.3, REQ-3.4 |
| `bank_accounts` | `id serial pk`, `bank text not null` (`c6`/`bradesco`), `label text not null`, `agency text`, `account text`, `active bool default true` | REQ-5.1 |
| `bank_transactions` | `id serial pk`, `bank_account_id int not null`, `posted_at date not null`, `amount numeric(12,2) not null`, `descriptor text`, `bank_ref text`, `status text not null default 'pendente'` (`pendente`/`conciliada`/`ignorada`), `imported_at timestamptz default now()`, unique(`bank_account_id`,`posted_at`,`amount`,`bank_ref`) | REQ-5.1 … REQ-5.3, REQ-6.5 |
| `bank_reconciliations` | `id serial pk`, `bank_transaction_id int not null unique`, `settlement_id int not null`, `matched_by text not null` (`automatico`/`manual`), `confirmed_by int`, `created_at` | REQ-6.1, REQ-6.4, REQ-6.6, REQ-6.7 |
| `bank_rules` | `id serial pk`, `bank_account_id int`, `descriptor_pattern text not null`, `category_id int`, `direction text`, `active bool default true` | REQ-6.3 |
| `store_settings` (alter) | `+ opening_bank_balance numeric(12,2) default 0`, `+ reconciliation_day_tolerance int default 3` | REQ-4.2, REQ-6.1 |

Índices: `idx_fin_entries_status_due` em (`status`,`due_date`) — índice da projeção e da posição;
`idx_fin_entries_origin` em (`origin_type`,`origin_id`); `idx_settlements_settled` em `settled_at`;
`idx_bank_tx_status_posted` em (`status`,`posted_at`).

`bank_reconciliations.bank_transaction_id UNIQUE` é o que garante REQ-6.7 no banco, não no código.
`fin_settlements` com `UNIQUE(entry_id, gateway_event_id)` é o que garante REQ-2.3.

## Contratos de API

Todas as rotas deste epic exigem `requireRole(["admin"])` — 403 para os demais papéis (REQ-1.8).
Exceção: `POST /api/admin/caixa/*` aceita `operator`, porque quem opera a gaveta é a vendedora.

### POST /api/admin/financeiro/entries — atende REQ-1.1 … REQ-1.3, REQ-1.5, REQ-2.7

- **Request:** `{ direction, description, amount > 0, dueDate, categoryId?, supplierId?, customerId?, installments?: number >= 1, recurrence?: { dayOfMonth: number } }`
- **201:** `{ created: n, entries: [{id, dueDate, amount, installmentNumber}] }`
- **400:** `valor_invalido` (REQ-1.5), `data_prevista_invalida` (REQ-2.7)
- **Parcelamento (REQ-1.2):** `base = floor(amount / n * 100) / 100` nas n−1 primeiras; a última recebe
  `amount − base × (n−1)`, o que garante soma exata

### POST /api/admin/financeiro/entries/:id/settle — atende REQ-1.4, REQ-1.6, REQ-2.5

- **Request:** `{ settledAt: date, method: string, amount?: number, cashSessionId?: number }`
- **201:** `{ settlementId, entryStatus }`
- **400:** `dados_da_baixa_incompletos` (REQ-2.5)
- **409:** `lancamento_ja_baixado` (REQ-1.6)

### DELETE /api/admin/financeiro/recurrences/:id — atende REQ-1.7

- **200:** `{ removidos: n }` — apaga `fin_entries` com `recurrence_id = :id AND status = 'aberto'`;
  os `pago` permanecem

### GET /api/admin/financeiro/posicao?de=…&ate=… — atende REQ-2.6

- **200:** `{ aReceber: {aberto, vencido, recebidoNoPeriodo}, aPagar: {aberto, vencido, pagoNoPeriodo} }`
- Uma consulta com `FILTER (WHERE …)` sobre `fin_entries` + `fin_settlements` (REQ-2.6)

### POST /api/admin/caixa/abrir · /sangria · /suprimento · /fechar — atende REQ-3.1 … REQ-3.8

- **abrir 201:** `{ sessionId }`; **409** `caixa_ja_aberto` (REQ-3.2)
- **sangria 201:** `{ id, saldoEmDinheiro }`; **409** `saldo_em_caixa_insuficiente` (REQ-3.4)
- **fechar 200:** `{ expectedAmount, countedAmount, difference }` (REQ-3.5)
- **409** em qualquer lançamento após o fechamento (REQ-3.6)
- `expectedAmount = opening_amount + Σ(pdv_payments.method='dinheiro' da sessão) + Σ(suprimentos) − Σ(sangrias)`

### GET /api/admin/financeiro/projecao?de=…&ate=… — atende REQ-4.1 … REQ-4.6

- **200:** `[{ dia, aReceber, aPagar, saldoAcumulado, ruptura: boolean }]`
- **400:** `periodo_muito_longo` acima de 180 dias (REQ-4.5)
- Uma consulta: `generate_series(de, ate, '1 day')` `LEFT JOIN` agregados de `fin_entries` com
  `status='aberto'`, e `SUM(...) OVER (ORDER BY dia)` partindo de `opening_bank_balance` (REQ-4.6)

### POST /api/admin/financeiro/extratos — atende REQ-5.1 … REQ-5.7

- **Request:** `multipart/form-data` com `file`, `bankAccountId` e, para CSV, `mapping` (JSON com os
  índices de coluna de data, valor, descritor e identificador)
- **201:** `{ importadas, ignoradas, periodo: {de, ate} }` (REQ-5.6)
- **400:** `arquivo_invalido` (REQ-5.4) — nada é importado
- **401:** sem sessão (REQ-5.7)
- **413:** `arquivo_muito_grande` acima de 5 MB (REQ-5.5) — limite aplicado no `multer`
- **Deduplicação:** `INSERT … ON CONFLICT (bank_account_id, posted_at, amount, bank_ref) DO NOTHING`
  em lote único, com `RETURNING` para contar as importadas (REQ-5.3)

### POST /api/admin/financeiro/conciliar/auto — atende REQ-6.1 … REQ-6.3, REQ-6.8

- **Request:** `{ bankAccountId, de, ate }`
- **200:** `{ conciliadas: n, ambiguas: n, semCandidato: n }`
- **Algoritmo (uma consulta, REQ-6.8):**
  ```sql
  WITH cand AS (
    SELECT bt.id AS tx, s.id AS st,
           count(*) OVER (PARTITION BY bt.id) AS n_cand
      FROM bank_transactions bt
      JOIN fin_settlements s
        ON s.amount = abs(bt.amount)
       AND s.settled_at BETWEEN bt.posted_at - $tol AND bt.posted_at + $tol
      LEFT JOIN bank_reconciliations r ON r.settlement_id = s.id
     WHERE bt.status = 'pendente' AND r.id IS NULL
       AND (NOT EXISTS (SELECT 1 FROM bank_rules br WHERE …)
            OR bt.descriptor ILIKE (SELECT descriptor_pattern FROM bank_rules br WHERE …))
  )
  INSERT INTO bank_reconciliations (bank_transaction_id, settlement_id, matched_by)
  SELECT tx, st, 'automatico' FROM cand WHERE n_cand = 1
  ON CONFLICT DO NOTHING;
  ```
  `n_cand = 1` é o que implementa REQ-6.2: transação com dois candidatos não é conciliada.

### POST /api/admin/financeiro/conciliar/manual · DELETE /conciliar/:id — atende REQ-6.4, REQ-6.6, REQ-6.7

- **manual 201:** `{ id }`; grava `confirmed_by` e `created_at`
- **409:** transação já conciliada — garantido pelo `UNIQUE` (REQ-6.7)
- **DELETE 200:** apaga o vínculo, devolve `bank_transactions.status='pendente'` e registra quem desfez

### GET /api/admin/financeiro/divergencias?de=…&ate=… — atende REQ-6.5

- **200:** `{ semBaixa: [transações sem vínculo], semExtrato: [baixas sem vínculo] }`

## Fluxos

**Baixa automática pelo webhook (REQ-2.2, REQ-2.3)**

O webhook do Asaas (epic `checkout-pagamentos-frete`) chama
`FinanceiroService.baixar({originType, originId, amount, settledAt, method, gatewayEventId})`.
A idempotência vem do `UNIQUE(entry_id, gateway_event_id)`: a segunda entrega do mesmo evento
colide e é ignorada, sem `SELECT` prévio (que não seria atômico).

**Ciclo do caixa e a venda de PDV (REQ-3.7)**

O `POST /api/admin/pdv/vendas` consulta a sessão aberta antes de gravar. Não havendo, responde 409
`caixa_fechado`. Havendo, grava `orders.cash_session_id` e, para pagamentos em dinheiro, esses
valores entram no `expectedAmount` do fechamento.

**Importação de extrato**

Arquivo → detecção de formato pela extensão e pela assinatura do conteúdo (`OFXHEADER` para OFX) →
parse em memória (teto de 5 MB torna isso seguro) → normalização (`posted_at` em `date`, `amount`
com sinal, `bank_ref` = `FITID` no OFX ou a coluna mapeada no CSV) → `INSERT ... ON CONFLICT DO
NOTHING` em uma única instrução com `unnest` dos arrays. Falha de parse aborta antes de qualquer
`INSERT` (REQ-5.4).

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| `FinanceiroService` como único ponto de escrita | Cada epic gravando direto em `fin_entries` | A idempotência da baixa precisa de um dono; espalhada, cada canal reimplementa e algum erra |
| Idempotência por `UNIQUE(entry_id, gateway_event_id)` | `SELECT` antes do `INSERT` | Duas entregas simultâneas do webhook passariam pelo `SELECT` e gravariam duas baixas |
| Diferença de arredondamento no parcelamento vai na última parcela | Distribuir centavos entre as parcelas | Concentrar na última é a convenção do mercado e mantém as demais idênticas, o que é o que a usuária confere |
| Conciliação ambígua fica pendente | Escolher o candidato mais próximo em data | Conciliação errada sai da lista de pendências e ninguém revisa; ambiguidade explícita é trabalho de 10 segundos para a operação |
| `UNIQUE` em `bank_transaction_id` na conciliação | Validar unicidade no serviço | Regra de integridade no banco não depende de qual caminho de código gravou |
| Extrato importado por arquivo, sem API bancária | Agregador Open Finance | É a premissa da proposta comercial: nem C6 nem Bradesco oferecem API para contas deste porte. O agregador fica como evolução com custo à parte |
| Projeção com `generate_series` no banco | Montar os dias em TypeScript e consultar por dia | Consultar por dia é N+1 disfarçado; `generate_series` + `LEFT JOIN` resolve em uma consulta |
| Financeiro restrito a `admin`, caixa aberto a `operator` | Papel único para tudo | Vendedora precisa operar a gaveta e não precisa ver contas a pagar nem extrato bancário |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Formato de OFX do C6 ou do Bradesco divergir do esperado | Importação falha justamente no banco da cliente | Obter um extrato real de cada banco antes da task de importação; o caminho CSV com mapeamento configurável é a saída garantida |
| Baixa automática lançada em duplicidade por evento reentregue | Contas a receber infla e a conciliação nunca fecha | `UNIQUE(entry_id, gateway_event_id)` e teste explícito de reentrega |
| Caixa esquecido aberto de um dia para o outro | Fechamento com diferença gigante e sem rastro do dia | Alerta no painel quando existe sessão aberta há mais de 18 horas |
| Tolerância de 3 dias casando pagamento de fornecedor com recebimento de cliente de mesmo valor | Conciliação silenciosamente errada | O candidato é restringido pelo sinal do valor (`direction`) e, quando há regra de descritor, por ela; e a ambiguidade nunca concilia sozinha |
| Extrato com dado bancário sensível trafegando em log de upload | Exposição de informação financeira | Log de importação registra apenas `{bankAccountId, importadas, ignoradas}`; o conteúdo do arquivo nunca é logado e o arquivo não é persistido em disco |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | `POST /entries` a pagar → 201 e `status='aberto'` no banco |
| REQ-1.2 | unitário | `parcelar(100.00, 3)` devolve `[33.33, 33.33, 33.34]` com soma exata de 100.00 |
| REQ-1.3 | integração | Lançamento recorrente → 12 linhas com `recurrence_id` e vencimentos mensais consecutivos |
| REQ-1.4 | integração | `POST /settle` → `fin_settlements` gravado e `fin_entries.status='pago'` |
| REQ-1.5 | integração | `amount: 0` → 400 `valor_invalido` |
| REQ-1.6 | integração | `POST /settle` repetido → 409 `lancamento_ja_baixado` e uma única linha em `fin_settlements` |
| REQ-1.7 | integração | Cancelar recorrência com 3 baixados e 9 abertos → restam 3 lançamentos, todos `pago` |
| REQ-1.8 | integração | Rota de financeiro com sessão `operator` → 403 |
| REQ-2.1 | integração | Criar pedido em cada canal → 1 `fin_entries` `receber` por pedido, com `origin_type`/`origin_id` corretos |
| REQ-2.2 | integração | Webhook de confirmação → `fin_settlements` com `settled_at` igual à data do evento e entrada `pago` |
| REQ-2.3 | integração | Reenviar o mesmo webhook → `count(*)` de `fin_settlements` daquela entrada continua 1 |
| REQ-2.4 | integração | Cancelar pedido → `fin_entries.status='cancelado'` |
| REQ-2.5 | integração | Baixa manual sem `method` → 400 `dados_da_baixa_incompletos` |
| REQ-2.6 | integração | `DEBUG=pg` em `GET /posicao`: exatamente 1 consulta; totais conferidos contra o cenário |
| REQ-2.7 | integração | `dueDate` anterior à data do lançamento em `receber` → 400 `data_prevista_invalida` |
| REQ-2.8 | unitário | Registrar baixa com logger capturado: a saída não contém nome, CPF, e-mail nem telefone |
| REQ-3.1 | integração | `POST /caixa/abrir` → sessão `aberto` com `opened_by` e `opening_amount` |
| REQ-3.2 | integração | Abrir com sessão já aberta → 409 `caixa_ja_aberto` e `count(*)` de sessões inalterado |
| REQ-3.3 | integração | Sangria de R$ 200 → linha em `cash_movements` com motivo, usuária e horário |
| REQ-3.4 | integração | Sangria maior que o dinheiro em caixa → 409 `saldo_em_caixa_insuficiente` |
| REQ-3.5 | integração | Abertura 200 + venda dinheiro 500 + suprimento 100 − sangria 300, contado 480 → `expected=500`, `difference=-20` |
| REQ-3.6 | integração | Sangria após o fechamento → 409 |
| REQ-3.7 | integração | `POST /pdv/vendas` sem caixa aberto → 409 `caixa_fechado`; com caixa aberto → `orders.cash_session_id` preenchido |
| REQ-3.8 | integração | `GET /caixa/historico` traz inicial, esperado, contado e diferença por sessão |
| REQ-4.1 | integração | Projeção de 30 dias → uma linha por dia com `aReceber`, `aPagar` e `saldoAcumulado` |
| REQ-4.2 | integração | `opening_bank_balance = 5000` → o `saldoAcumulado` do primeiro dia parte de 5000 |
| REQ-4.3 | integração | Baixar um lançamento e reconsultar → ele sai da projeção |
| REQ-4.4 | integração | Cenário que leva o acumulado a negativo no dia 12 → aquele dia vem com `ruptura: true` |
| REQ-4.5 | integração | Intervalo de 200 dias → 400 `periodo_muito_longo` |
| REQ-4.6 | integração | `DEBUG=pg` na projeção de 90 dias: exatamente 1 consulta |
| REQ-5.1 | integração | Subir OFX de exemplo → transações com `posted_at`, `amount`, `descriptor` e `bank_ref` |
| REQ-5.2 | integração | Subir CSV com `mapping` → mesmas transações importadas |
| REQ-5.3 | integração | Subir o mesmo arquivo duas vezes → segunda importação com `importadas: 0` e `ignoradas: n` |
| REQ-5.4 | integração | Subir um `.txt` qualquer → 400 `arquivo_invalido` e `count(*)` de `bank_transactions` inalterado |
| REQ-5.5 | integração | Arquivo de 6 MB → 413 `arquivo_muito_grande` |
| REQ-5.6 | integração | Resposta traz `importadas`, `ignoradas` e `periodo` conferidos contra o arquivo |
| REQ-5.7 | integração | Upload sem sessão → 401 e nenhum arquivo persistido |
| REQ-5.8 | unitário | Importar extrato com logger capturado: a saída traz só `{bankAccountId, importadas, ignoradas}`, sem descritor nem conteúdo |
| REQ-6.1 | integração | 1 transação e 1 baixa de mesmo valor a 2 dias de distância → conciliadas automaticamente |
| REQ-6.2 | integração | 1 transação e 2 baixas de mesmo valor e data → `ambiguas: 1`, nenhuma conciliação gravada |
| REQ-6.3 | integração | Regra de descritor "ASAAS" → transação com descritor divergente não casa mesmo com valor e data iguais |
| REQ-6.4 | integração | Conciliação manual → `matched_by='manual'`, `confirmed_by` e `created_at` gravados |
| REQ-6.5 | integração | Cenário com 1 de cada lado → `divergencias` traz uma linha em `semBaixa` e uma em `semExtrato` |
| REQ-6.6 | integração | `DELETE /conciliar/:id` → transação volta a `pendente` e o vínculo some |
| REQ-6.7 | integração | Tentar conciliar a mesma transação a uma segunda baixa → 409 |
| REQ-6.8 | integração | `DEBUG=pg` na conciliação automática de 200 transações: 1 consulta de escrita, sem consulta por transação |

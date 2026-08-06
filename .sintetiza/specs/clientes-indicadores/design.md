# Design — Base Única de Clientes e Painel de Indicadores

**Requisitos cobertos:** REQ-1 … REQ-5 · **Spec:** ./requirements.md

## Visão arquitetural

Este epic é quase todo **camada de consulta**. As escritas já foram decididas nos epics anteriores:
`orders` com `channel` cobre os quatro canais, `order_items` guarda `unit_price` e `quantity`,
`stock_movements` guarda o histórico e `customer_credits` guarda o crédito. O que falta é (a) fazer
os quatro caminhos de venda escreverem na **mesma** cliente e (b) escrever as consultas agregadas.

`server/routes.ts:1628` já expõe `GET /api/admin/reports` e `client/src/pages/admin/Reports.tsx`
já existe — este epic substitui o conteúdo daquele endpoint por consultas de verdade, mantendo a
rota e a tela como ponto de entrada.

```
Checkout ─┐
PDV ──────┼─→ ClienteService.resolver({cpf, telefone, nome, email}) ─→ customers (registro único)
Consignado┤
WhatsApp ─┘

IndicadoresService ─→ (SQL agregado) ─→ GET /api/admin/reports/*
```

**Regra de custo para margem:** o custo usado é o `unit_cost` copiado para `order_items` no momento
da venda — não o custo atual da variação. Custo muda a cada remessa; usar o atual reescreveria a
margem histórica a cada entrada de mercadoria.

## Modelo de dados

Migration nova: `migrations/017_clientes_indicadores.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `customers` (alter) | `+ birth_date date`, `+ preferred_sizes jsonb`, `+ notes text`, `+ legal_basis text default 'execucao_contrato'`, `+ marketing_consent_at timestamptz`, `+ marketing_consent_source text`, `+ anonymized_at timestamptz`, `+ anonymized_by int`, `+ merged_into_id int` | REQ-2.1, REQ-2.4, REQ-3.1, REQ-3.3, REQ-3.4, REQ-1.6 |
| `order_items` (alter) | `+ unit_cost numeric(10,2)` | REQ-4.3, REQ-4.4, REQ-5.1 |
| `customer_events` | `id serial pk`, `customer_id int not null`, `type text not null` (`export`/`anonimizacao`/`merge`/`consentimento`), `detail jsonb`, `created_by int`, `created_at` | REQ-3.1, REQ-3.4 |

Índices: `idx_customers_cpf` único parcial em `cpf_cnpj` onde não nulo (REQ-1.1);
`idx_customers_phone` em `phone` (REQ-1.2); `idx_customers_birth_md` em
`(extract(month from birth_date), extract(day from birth_date))` (REQ-2.7);
`idx_orders_customer_created` em (`customer_id`,`created_at desc`) (REQ-2.1);
`idx_order_items_order` em `order_id`.

`customers.email` hoje é `notNull().unique()` (`shared/schema.ts:225`). A venda de balcão nem sempre
tem e-mail — a migration relaxa para `NULL` permitido e troca o `UNIQUE` por índice único parcial
onde `email IS NOT NULL AND anonymized_at IS NULL`. Sem isso a anonimização de duas clientes
colidiria no mesmo valor de e-mail anonimizado.

## Contratos de API

### POST /api/admin/customers · PUT /api/admin/customers/:id — atende REQ-1.1 … REQ-1.5, REQ-1.7

- **Request:** `{ name, cpfCnpj?, phone?, email?, birthDate?, preferredSizes?, notes?, marketingConsent?: boolean }`
- **200:** `{ id, created: boolean, matchedBy: "cpf"|"telefone"|null }`
- **400:** `cpf_invalido` (REQ-1.4), `telefone_invalido` (REQ-1.5)
- **401:** sem sessão (REQ-1.7)
- **Resolução:** `ClienteService.resolver()` — normaliza CPF e telefone para dígitos, busca por CPF,
  depois por telefone, e faz `COALESCE` dos campos vazios do registro encontrado com os informados
  (REQ-1.1, REQ-1.2). Não encontrando, cria (REQ-1.3). É a **mesma função** usada pelo checkout, pelo
  PDV, pelo consignado e pelo agente de WhatsApp

### POST /api/admin/customers/:id/merge — atende REQ-1.6

- **Request:** `{ sourceId: number }`
- **200:** `{ merged: { orders: n, credits: n, consignments: n } }`
- Transação: `UPDATE orders/customer_credits/consignments SET customer_id = :id WHERE customer_id = :sourceId`
  → `UPDATE customers SET active=false, merged_into_id=:id WHERE id=:sourceId` → evento em `customer_events`

### GET /api/admin/customers/:id — atende REQ-2.1 … REQ-2.3, REQ-2.5, REQ-2.6

- **200:**
  ```
  { cliente: {...}, creditoDisponivel, totais: { totalComprado, compras, ticketMedio },
    historico: [{ tipo, canal, numero, data, total, itens: n }] }
  ```
- **401 / 404:** sem sessão → 401; inexistente → 404. Ambas com corpo genérico, sem revelar
  existência a quem não está autenticado (REQ-2.6)
- **3 consultas no máximo (REQ-2.3):** (1) cliente + agregados via subselects,
  (2) histórico paginado com `count(order_items)` agregado, (3) `SUM` de `customer_credits`

### GET /api/admin/customers/aniversariantes?mes=… — atende REQ-2.7

- **200:** `[{ id, nome, dia, telefone }]` ordenado por dia do mês

### GET /api/admin/customers/:id/export — atende REQ-3.2, REQ-3.7

- **200:** `Content-Type: application/json`, `Content-Disposition: attachment` — cadastro, endereços,
  pedidos com itens, créditos e consignações
- **403:** papel diferente de `admin` (REQ-3.7); registra evento `export` (REQ-3.1)

### POST /api/admin/customers/:id/anonimizar — atende REQ-3.3 … REQ-3.5, REQ-3.7

- **200:** `{ anonymizedAt }`
- **403:** papel diferente de `admin`
- **409:** `consignacao_em_aberto` (REQ-3.5)
- **Efeito:** `name = 'Cliente anonimizada #<id>'`, `email = NULL`, `phone = NULL`, `cpf_cnpj = NULL`,
  endereços apagados, `anonymized_at`/`anonymized_by` preenchidos. `orders` e `order_items`
  preservam valores, datas e itens; os campos desnormalizados de contato do pedido
  (`customer_name`, `customer_email`, `customer_phone`, `customer_cpf`, endereço de entrega) também
  são limpos, porque são cópia do dado pessoal (REQ-3.3)

### GET /api/admin/reports/vendas?de=…&ate=… — atende REQ-4.1 … REQ-4.7

- **200:**
  ```
  { periodo: {de, ate},
    total: { faturamento, vendas, ticketMedio, pecas },
    porCanal: [{ canal, faturamento, vendas }],
    margem: { valor, percentual, itensSemCusto } }
  ```
- **400:** `periodo_invalido` (REQ-4.5), `periodo_muito_longo` (REQ-4.6)
- **401:** sem sessão (REQ-4.7)
- Uma consulta com CTEs: `vendas_periodo` → `agregado_total` + `agregado_canal` + `agregado_margem`.
  `itensSemCusto` é `count(*) FILTER (WHERE unit_cost IS NULL)` (REQ-4.4)

### GET /api/admin/reports/produtos?de=…&ate=…&metrica=ranking|abc|giro|colecao — atende REQ-5.1 … REQ-5.5

- **200 (`ranking`):** `[{ productId, titulo, quantidade, faturamento, margem, margemPercentual }]`
- **200 (`abc`):** o mesmo, mais `participacao`, `acumulado` e `curva: "A"|"B"|"C"` — calculado com
  `SUM(...) OVER (ORDER BY faturamento DESC)` sobre o total do período (REQ-5.2)
- **200 (`giro`):** `[{ productId, titulo, unidadesVendidas, saldoMedio, giro }]` — `saldoMedio` é a
  média entre o saldo do início e o do fim do período, reconstruído de `stock_movements.balance_after`
- **200 (`colecao`):** `[{ collectionId, nome, faturamento, custo, margemPercentual }]` (REQ-5.4)
- Sempre uma única consulta por métrica (REQ-5.5)

### GET /api/admin/reports/consignado?de=…&ate=… — atende REQ-5.6

- **200:** `{ abertas, devolvidas, convertidas, taxaConversao, valorConvertido }`

## Fluxos

**Resolução de cliente nos quatro canais**

```
resolver({cpf, telefone, nome, email}):
  cpfDigits = onlyDigits(cpf); if cpfDigits && !validaCpf → 400 cpf_invalido
  telDigits = onlyDigits(telefone); if telDigits && len ∉ [10,11] → 400 telefone_invalido
  match = SELECT … WHERE cpf_cnpj = cpfDigits            → matchedBy 'cpf'
        ?? SELECT … WHERE phone = telDigits              → matchedBy 'telefone'
  if match: UPDATE …  SET nome = COALESCE(nome_atual, novo), … (só preenche vazio)
  else: INSERT
```

O `COALESCE` na direção "só preenche o que está vazio" é deliberado: o balcão frequentemente digita
o nome abreviado, e sobrescrever um cadastro completo com um parcial é perda de informação.

**Cálculo da curva ABC (REQ-5.2)**

```sql
WITH fat AS (
  SELECT p.id, p.title, SUM(oi.total_price) AS faturamento
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
   WHERE o.created_at BETWEEN $1 AND $2 AND o.payment_status = 'approved'
   GROUP BY p.id, p.title
), acum AS (
  SELECT *, SUM(faturamento) OVER (ORDER BY faturamento DESC) /
            NULLIF(SUM(faturamento) OVER (), 0) AS acumulado
    FROM fat
)
SELECT *, CASE WHEN acumulado <= 0.80 THEN 'A'
               WHEN acumulado <= 0.95 THEN 'B' ELSE 'C' END AS curva
  FROM acum ORDER BY faturamento DESC;
```

Uma consulta, sem laço, sem materialização.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| `ClienteService.resolver()` compartilhado pelos quatro canais | Cada canal com a própria lógica de cadastro | É exatamente o que produz base duplicada hoje; centralizar é o objetivo do módulo |
| `unit_cost` copiado para `order_items` na venda | Ler o custo atual da variação no relatório | Custo muda por remessa; ler o atual reescreve a margem do passado a cada entrada |
| Anonimização em vez de exclusão física | `DELETE FROM customers` | Apagar a linha quebraria FK de pedidos e destruiria o faturamento; a LGPD exige eliminar o dado pessoal, não o registro comercial |
| Campos de contato desnormalizados no pedido também anonimizados | Anonimizar só a tabela `customers` | O pedido guarda cópia de nome, e-mail, telefone e endereço; anonimizar só a origem deixaria o dado pessoal intacto no histórico |
| Curva ABC via função de janela em SQL | Trazer as vendas e classificar em TypeScript | Trazer todas as vendas de um ano para a memória do Node por causa de uma soma acumulada é desperdício; `SUM() OVER` resolve no banco |
| Teto de 366 dias no período | Sem limite | Limita a varredura e cobre comparativo ano a ano, que é o recorte real de uso |
| Índice único parcial em e-mail | Manter `UNIQUE` simples | Venda de balcão sem e-mail e anonimização de várias clientes colidiriam no `UNIQUE` atual |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Base migrada do sistema atual chega com duplicatas que `resolver()` não une (CPF ausente e telefone divergente) | Ficha 360 fragmentada logo no go-live | Relatório de candidatos a merge por similaridade de nome + endereço, revisado na migração (`implantacao-golive`), com o endpoint de merge para consolidar |
| Anonimização executada por engano | Perda irreversível do contato da cliente | Papel `admin` exclusivo, confirmação por digitação do nome na interface e registro em `customer_events` |
| Relatório de período longo travando o banco em horário de venda | Painel derruba o PDV | Teto de 366 dias, índices por `created_at` e `payment_status`, e execução com `statement_timeout` de 10 s nas rotas de relatório |
| Itens vendidos antes da adoção de `unit_cost` sem custo | Margem histórica incompleta e sem explicação | `itensSemCusto` é devolvido junto do resultado e exibido no painel como ressalva explícita, não escondido |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | Cadastrar CPF já existente com e-mail novo → `created:false`, `matchedBy:"cpf"`, e-mail preenchido, `count(*)` de clientes inalterado |
| REQ-1.2 | integração | Cadastrar sem CPF com telefone existente → `matchedBy:"telefone"` e nenhum registro novo |
| REQ-1.3 | integração | CPF e telefone inéditos → `created:true` e `count(*)` +1 |
| REQ-1.4 | integração | `cpfCnpj: "11111111111"` → 400 `cpf_invalido` e nada gravado |
| REQ-1.5 | integração | `phone: "1234"` → 400 `telefone_invalido` |
| REQ-1.6 | integração | Merge de A em B → pedidos, créditos e consignações de A ficam com `customer_id` de B; A com `active=false` e `merged_into_id=B` |
| REQ-1.7 | integração | `POST /api/admin/customers` sem sessão → 401 |
| REQ-2.1 | integração | Cliente com 1 pedido online, 1 de loja e 1 de consignado → `historico` traz os 3, mais recente primeiro |
| REQ-2.2 | integração | Cenário com 3 compras somando 1.200 → `ticketMedio: 400.00` |
| REQ-2.3 | integração | `DEBUG=pg` em `GET /api/admin/customers/:id`: no máximo 3 consultas |
| REQ-2.4 | integração | Salvar `preferredSizes` e `notes` → a ficha os devolve |
| REQ-2.5 | integração | `GET /api/admin/customers/99999` autenticado → 404 |
| REQ-2.6 | integração | Mesma rota sem sessão → 401 com corpo idêntico ao de id inexistente |
| REQ-2.7 | integração | 3 aniversariantes no mês → retornadas ordenadas pelo dia |
| REQ-3.1 | integração | Cadastro com `marketingConsent:true` → `marketing_consent_at` e `marketing_consent_source` preenchidos e evento `consentimento` gravado |
| REQ-3.2 | integração | `GET /export` → o JSON traz cadastro, endereços, pedidos com itens, créditos e consignações |
| REQ-3.3 | integração | Anonimizar → `customers` e os campos de contato dos pedidos limpos; `orders.total` e `created_at` inalterados |
| REQ-3.4 | integração | `SELECT anonymized_at, anonymized_by FROM customers WHERE id=…` preenchidos e evento `anonimizacao` gravado |
| REQ-3.5 | integração | Anonimizar cliente com consignação `aberta` → 409 `consignacao_em_aberto` e nada alterado |
| REQ-3.6 | unitário | Executar as rotas do epic com logger capturado: a saída não contém nome, e-mail, telefone nem CPF |
| REQ-3.7 | integração | `export` e `anonimizar` com sessão `operator` → 403 |
| REQ-4.1 | integração | Cenário conhecido de 5 vendas → faturamento, vendas, ticket médio e peças conferidos contra o cálculo manual |
| REQ-4.2 | integração | Vendas em `online`, `loja` e `consignado` → `porCanal` com as 3 linhas somando o faturamento total |
| REQ-4.3 | integração | Itens com custo conhecido → margem absoluta e percentual conferidas contra o cálculo manual |
| REQ-4.4 | integração | 2 itens sem `unit_cost` → `itensSemCusto: 2` e esses itens fora do cálculo de margem |
| REQ-4.5 | integração | `de=2026-08-01&ate=2026-07-01` → 400 `periodo_invalido` |
| REQ-4.6 | integração | Intervalo de 400 dias → 400 `periodo_muito_longo` |
| REQ-4.7 | integração | Sem sessão → 401 |
| REQ-5.1 | integração | `metrica=ranking` → ordenado por faturamento decrescente, com quantidade e margem por peça |
| REQ-5.2 | integração | Cenário de 10 peças com distribuição conhecida → as classificadas `A` somam ≤ 80% do faturamento e a primeira `B` ultrapassa |
| REQ-5.3 | unitário | `calcularGiro(unidades=30, saldoInicial=10, saldoFinal=20)` devolve `2.0` |
| REQ-5.4 | integração | Vendas de 2 coleções → `colecao` traz faturamento, custo e margem por coleção |
| REQ-5.5 | integração | `DEBUG=pg` em cada uma das 4 métricas: exatamente 1 consulta cada |
| REQ-5.6 | integração | 4 consignações (2 convertidas, 1 devolvida, 1 aberta) → `taxaConversao: 0.5` sobre as fechadas |

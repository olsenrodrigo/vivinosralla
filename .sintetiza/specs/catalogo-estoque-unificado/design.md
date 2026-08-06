# Design — Catálogo e Estoque Unificado

**Requisitos cobertos:** REQ-1 … REQ-6 · **Spec:** ./requirements.md

## Visão arquitetural

O repositório já tem `products` (`shared/schema.ts:132`) com `costPerItem`, `sku`, `barcode`,
`ncmCode` e `stockQuantity`, e `variants` (`shared/schema.ts:199`) com `option1..option3`, `sku`,
`barcode`, `cost` e `stockQuantity`. O que **não** existe é histórico: `server/storage.ts:265`
implementa `decrementStock` como um `UPDATE` direto, sem rastro de quem baixou, por quê e de onde.

Este epic transforma o estoque de *número* em *conta corrente*:

- toda alteração de saldo passa por um `EstoqueService.movimentar()` único;
- `decrementStock` é substituído por chamadas a esse serviço em todos os pontos que hoje baixam
  saldo (`server/routes.ts` no checkout, e futuramente PDV e consignado);
- a ficha da peça ganha os campos comerciais e fiscais que faltam para precificar e faturar.

```
Checkout ─┐
PDV ──────┼─→ EstoqueService.movimentar(tipo, sku, qtd, origem, responsavel)
Consignado┤        │
Entrada ──┤        ├─ UPDATE variants.stock_quantity
Inventário┘        └─ INSERT stock_movements          (mesma transação)
```

## Modelo de dados

Migration nova: `migrations/014_catalogo_estoque.sql`, idempotente, no padrão das existentes.

| Entidade | Campos | Atende |
|---|---|---|
| `products` (alter) | `+ markup numeric(6,3)`, `+ suggested_price numeric(10,2)`, `+ supplier_id int`, `+ season text`, `+ composition text`, `+ measurements jsonb` | REQ-1.1 … REQ-1.3 |
| `variants` (alter) | `+ location text` (arara/prateleira), `+ last_exit_at timestamptz` | REQ-6.2 |
| `suppliers` | `id serial pk`, `name text not null`, `document text`, `contact_name text`, `phone text`, `email text`, `notes text`, `active bool default true`, `created_at` | REQ-1.3 |
| `stock_movements` | `id serial pk`, `variant_id int not null`, `product_id int not null`, `type text not null` (`entrada`/`saida`/`ajuste`/`consignacao_saida`/`consignacao_retorno`/`devolucao`), `quantity int not null`, `balance_after int not null`, `unit_cost numeric(10,2)`, `previous_unit_cost numeric(10,2)`, `origin_type text not null` (`pedido`/`pdv`/`entrada`/`inventario`/`consignacao`/`manual`), `origin_id int`, `reason text`, `created_by int`, `created_at timestamptz default now()` | REQ-3.2 … REQ-3.6, REQ-4.1, REQ-4.2, REQ-5.2 |
| `stock_entries` | `id serial pk`, `supplier_id int`, `invoice_number text`, `idempotency_key text unique`, `total_cost numeric(12,2)`, `status text default 'draft'` (`draft`/`confirmed`), `confirmed_by int`, `confirmed_at timestamptz`, `created_at` | REQ-4.1, REQ-4.4, REQ-4.5 |
| `stock_entry_items` | `id serial pk`, `entry_id int not null`, `variant_id int not null`, `quantity int not null check (quantity > 0)`, `unit_cost numeric(10,2)` | REQ-4.1, REQ-4.3 |
| `inventories` | `id serial pk`, `name text not null`, `status text default 'open'` (`open`/`closed`), `opened_by int`, `opened_at`, `closed_by int`, `closed_at` | REQ-5.1, REQ-5.4 |
| `inventory_items` | `id serial pk`, `inventory_id int not null`, `variant_id int not null`, `system_quantity int not null`, `counted_quantity int`, unique(`inventory_id`,`variant_id`) | REQ-5.1, REQ-5.2, REQ-5.5 |
| `store_settings` (alter) | `+ stale_product_days int default 90` | REQ-6.2 |

Índices: `idx_stock_movements_variant_created` em (`variant_id`,`created_at desc`) para o extrato
(REQ-3.6); `idx_stock_movements_origin` em (`origin_type`,`origin_id`); `idx_variants_last_exit` em
`last_exit_at` para o alerta de peça parada.

**Imutabilidade (REQ-3.5):** `REVOKE UPDATE, DELETE ON stock_movements FROM <app_user>` na migration,
mais trigger `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`. A garantia fica no banco, não na
disciplina do código de aplicação.

## Contratos de API

### POST /api/admin/products · PUT /api/admin/products/:id — atende REQ-1.1 … REQ-1.7

- **Request:** schema existente estendido com `markup?: number > 0`, `costPerItem?: number >= 0`,
  `supplierId?: number`, `season?: string`, `composition?: string`, `measurements?: Record<tamanho, {busto,cintura,quadril,comprimento}>`, `ncmCode?: string(/^\d{8}$/)`
- **200/201:** produto salvo com `suggestedPrice` e `marginPercent` calculados
- **400:** `ncm_invalido` (REQ-1.4), `custo_invalido` (REQ-1.5), `payload_invalido`
- **401:** sem sessão (REQ-1.6)
- **Regra:** `suggestedPrice = round(costPerItem × markup, 2)`; `marginPercent = (price - cost) / price × 100`,
  `null` quando não há custo (REQ-1.7)

### POST /api/admin/products/:id/grade — atende REQ-2.1 … REQ-2.6

- **Request:** `{ sizes: string[], colors: string[], basePrice?: number, baseCost?: number }`
- **201:** `{ created: Variant[], skipped: string[] }` — `skipped` traz as combinações já existentes
- **400:** `grade_vazia` quando qualquer das listas está vazia (REQ-2.6)
- **409:** `sku_duplicado` com o SKU conflitante (REQ-2.3)
- **Autorização:** `requireAdmin`
- **SKU:** `slugify(product.slug).toUpperCase().slice(0,8) + "-" + TAMANHO + "-" + COR3`, sem acento
- **EAN-13:** prefixo interno `789` + 9 dígitos derivados do `variant_id` + dígito verificador módulo 10

### POST /api/admin/stock/movements — atende REQ-3.2 … REQ-3.4, REQ-5.3

- **Request:** `{ variantId, type, quantity, reason?, originType, originId? }`
- **201:** `{ id, balanceAfter }`
- **400:** `motivo_obrigatorio` para `type = "ajuste"` sem `reason` (REQ-5.3)
- **409:** `saldo_insuficiente` com o SKU (REQ-3.4)
- **Autorização:** `requireAdmin`

### GET /api/admin/stock/movements?variantId=…&page=… — atende REQ-3.6

- **200:** `{ movements: [...], total, page, perPage: 100 }`, ordenado por `created_at desc`

### GET /api/admin/stock — atende REQ-3.7

- **200:** lista paginada com `sku`, `produto`, `tamanho`, `cor`, `saldo`, `reservado`, `disponivel`,
  `custo`, `ultimaSaida` — **uma única consulta** com `LEFT JOIN LATERAL` sobre `stock_reservations`

### POST /api/admin/stock/entries · POST /api/admin/stock/entries/:id/confirm — atende REQ-4.1 … REQ-4.5

- **Request (confirm):** header `Idempotency-Key` obrigatório
- **200:** `{ applied: true, movements: n }`; repetição com a mesma chave → 200 `{ applied: false }` (REQ-4.4)
- **400:** `quantidade_invalida` com o SKU — a entrada inteira é rejeitada, nada é aplicado (REQ-4.3)
- **Transação:** todos os itens em uma transação; custo anterior copiado para `previous_unit_cost` antes do update (REQ-4.2)

### POST /api/admin/inventories · POST /api/admin/inventories/:id/close — atende REQ-5.1 … REQ-5.5

- **Abertura:** snapshot de `system_quantity` para cada variação selecionada (REQ-5.1)
- **Fechamento 200:** `{ divergenciaPecas: number, divergenciaCusto: number, ajustes: n }` (REQ-5.5)
- **409:** fechar ou lançar contagem em inventário já fechado (REQ-5.4)

### GET /api/admin/stock/alerts — atende REQ-6.1 … REQ-6.5

- **200:** `{ rupturas: [{sku, produto, tamanho, cor}], paradas: [{sku, produto, ultimaSaida, diasParado}] }`
- **401:** sem sessão (REQ-6.4)
- Consulta única com dois CTEs (`FULL OUTER JOIN` no fim) — sem laço (REQ-6.3)

## Fluxos

**Movimentação (núcleo de tudo)**

```
EstoqueService.movimentar({variantId, type, quantity, originType, originId, reason, userId}):
  BEGIN
    SELECT stock_quantity, sku, continue_selling_out_of_stock
      FROM variants WHERE id = $1 FOR UPDATE          -- trava a linha
    novoSaldo = saldo ± quantity
    IF novoSaldo < 0 AND NOT continue_selling: ROLLBACK → 409 saldo_insuficiente
    UPDATE variants SET stock_quantity = novoSaldo,
           last_exit_at = CASE WHEN tipo é saída THEN now() ELSE last_exit_at END
    INSERT INTO stock_movements (..., balance_after = novoSaldo)
  COMMIT
```

`SELECT ... FOR UPDATE` é o que impede duas vendas simultâneas da última peça. Sem ele, duas
transações leem saldo 1 e ambas gravam 0.

**Entrada de mercadoria**

Rascunho (`draft`) → itens lançados/conferidos → confirmação com `Idempotency-Key`. A confirmação
valida **todos** os itens antes de aplicar qualquer um (REQ-4.3: falha parcial não existe — ou a
remessa inteira entra, ou nada entra), então aplica em transação única com uma movimentação por item.

**Inventário**

Abertura tira o retrato do saldo. A contagem pode levar horas e o estoque continua se movendo —
por isso o ajuste no fechamento é calculado contra o **saldo do momento do fechamento**, e a
divergência reportada é `contado - system_quantity_da_abertura`, com a movimentação de ajuste levando
no `reason` a referência do inventário. Isso evita que uma venda ocorrida durante a contagem seja
apagada pelo ajuste.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Saldo materializado em `variants` + histórico em `stock_movements` | Event sourcing puro (saldo = soma das movimentações) | A vitrine consulta saldo em toda listagem; somar histórico a cada leitura é varredura desnecessária. A consistência vem da transação única |
| `SELECT ... FOR UPDATE` na variação antes de movimentar | Checagem otimista com retry | Venda da última peça é exatamente o caso em que a corrida importa; trava de linha é barata e determinística no volume desta operação |
| Imutabilidade garantida por trigger e `REVOKE` no banco | Só disciplina no `storage.ts` | Qualquer caminho novo (script de migração, correção manual) burlaria a disciplina de aplicação; o banco não burla |
| Entrada tudo-ou-nada | Aplicar itens válidos e reportar os inválidos | Remessa parcialmente lançada é pior que remessa não lançada: ninguém sabe o que faltou conferir |
| Ajuste de inventário calculado contra o snapshot de abertura | Sobrescrever o saldo com o contado | Sobrescrever apaga as vendas ocorridas durante a contagem |
| Custo médio não é calculado; a entrada sobrescreve o custo da variação | Custo médio ponderado | A operação é de moda com lote pequeno e custo por remessa; média ponderada acrescenta complexidade sem mudar decisão de preço |
| `suppliers` como tabela nova mesmo com `products.vendor` já existindo | Continuar usando o texto livre `vendor` | Texto livre não permite contas a pagar por fornecedor no epic financeiro |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Trocar `decrementStock` por `EstoqueService` sem cobrir todos os pontos de baixa | Saldo divergente e sem histórico exatamente no fluxo esquecido | `grep -rn "decrementStock" server/` na task de refatoração; a função é removida do `storage.ts` ao fim, de modo que qualquer ponto esquecido quebra o build |
| `FOR UPDATE` em carrinho com muitos itens serializando o checkout | Lentidão no pico de lançamento de coleção | Travar as variações em ordem crescente de `variant_id` (evita deadlock) e manter a transação curta — a chamada ao gateway já ficou fora dela por decisão do epic de checkout |
| EAN-13 gerado internamente colidir com código de fornecedor lido no PDV | Leitor de código de barras abre a peça errada | Prefixo `789` reservado para uso interno e restrição `UNIQUE` em `variants.barcode`; a leitura no PDV busca por SKU e por barcode, nessa ordem |
| Migração do sistema atual trazer saldo sem histórico | Extrato começa com um salto inexplicado | A carga inicial gera movimentações de tipo `entrada` com `origin_type='migracao'` e motivo explícito |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | unitário | `calcularPrecoSugerido(120, 2.8)` devolve `336.00` |
| REQ-1.2 | integração | Salvar peça com custo 120 e preço 389 → `marginPercent` retornado ≈ 69.15 |
| REQ-1.3 | integração | `PUT /api/admin/products/:id` com os campos de moda → `SELECT composition, measurements, supplier_id, ncm_code, season FROM products WHERE id=…` traz todos preenchidos |
| REQ-1.4 | integração | `ncmCode: "123"` → 400 `ncm_invalido` e a peça não muda |
| REQ-1.5 | integração | `costPerItem: -1` → 400 `custo_invalido` |
| REQ-1.6 | integração | `POST /api/admin/products` sem sessão → 401 e `count(*)` de produtos inalterado |
| REQ-1.7 | integração | Salvar sem custo → 200 e `marginPercent` vem `null` |
| REQ-2.1 | integração | `POST /grade` com 3 tamanhos × 2 cores → 6 variações; repetir → `created: []`, `skipped` com 6 |
| REQ-2.2 | unitário | `gerarSku({slug:"vestido-alina"}, "M", "Oliva")` devolve `VESTIDOA-M-OLI` |
| REQ-2.3 | integração | Forçar SKU já existente → 409 `sku_duplicado` e nenhuma variação criada |
| REQ-2.4 | unitário | `gerarEan13(42)` devolve 13 dígitos e `validarEan13()` do resultado é `true` |
| REQ-2.5 | integração | Desativar variação → `active=false` no banco e ela some de `GET /api/store/products/:slug` |
| REQ-2.6 | integração | `{sizes: [], colors: ["Oliva"]}` → 400 `grade_vazia` |
| REQ-3.1 | manual | `\d variants` no psql: existe uma única coluna de saldo, sem `stock_online`/`stock_loja` |
| REQ-3.2 | integração | Movimentar e conferir que a linha em `stock_movements` tem `type`, `quantity`, `balance_after`, `origin_type`, `origin_id`, `created_by` |
| REQ-3.3 | integração | Forçar erro no `INSERT` da movimentação → `variants.stock_quantity` permanece no valor anterior |
| REQ-3.4 | integração | Saída de 5 com saldo 3 e `continueSelling=false` → 409 `saldo_insuficiente` e saldo continua 3 |
| REQ-3.5 | integração | `UPDATE stock_movements SET quantity=99 WHERE id=1` no psql → erro do banco; `DELETE` idem |
| REQ-3.6 | integração | 150 movimentações → `GET .../movements?variantId=X` devolve 100 na página 1, mais recente primeiro |
| REQ-3.7 | integração | `DEBUG=pg` em `GET /api/admin/stock` com 50 variações: exatamente 2 consultas (dados + contagem) |
| REQ-4.1 | integração | Confirmar entrada de 10 un. → saldo sobe 10 e existe movimentação `entrada` com `balance_after` correto |
| REQ-4.2 | integração | Entrada com custo 140 sobre variação de custo 120 → `variants.cost=140` e `previous_unit_cost=120` na movimentação |
| REQ-4.3 | integração | Entrada com um item de quantidade 0 → 400 `quantidade_invalida` e nenhum saldo alterado |
| REQ-4.4 | integração | Confirmar duas vezes com a mesma `Idempotency-Key` → segunda responde 200 `applied:false` e o saldo subiu só uma vez |
| REQ-4.5 | integração | `SELECT confirmed_by FROM stock_entries WHERE id=…` traz o id da usuária da sessão |
| REQ-5.1 | integração | Abrir inventário com 5 variações → 5 linhas em `inventory_items` com `system_quantity` igual ao saldo do momento |
| REQ-5.2 | integração | Contar 8 onde o sistema tinha 10 → ao fechar, existe movimentação `ajuste` de −2 com `reason` citando o inventário |
| REQ-5.3 | integração | `POST /movements` com `type:"ajuste"` e sem `reason` → 400 `motivo_obrigatorio` |
| REQ-5.4 | integração | Lançar contagem em inventário fechado → 409 |
| REQ-5.5 | integração | Fechamento devolve `divergenciaPecas` e `divergenciaCusto` conferidos contra cálculo manual do cenário de teste |
| REQ-6.1 | integração | Zerar o saldo de uma variação publicada → o SKU aparece em `rupturas` |
| REQ-6.2 | integração | `last_exit_at` de 120 dias atrás com limite 90 → a peça aparece em `paradas` com `diasParado ≈ 120` |
| REQ-6.3 | integração | `DEBUG=pg` em `GET /api/admin/stock/alerts`: exatamente 1 consulta |
| REQ-6.4 | integração | `GET /api/admin/stock/alerts` sem sessão → 401 |
| REQ-6.5 | integração | Dar entrada na variação em ruptura → ela some de `rupturas` na consulta seguinte |

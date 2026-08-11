# VIVI NOSRALLA — Loja Virtual

Regras deste repositório para agentes (Claude Code e Codex). Complementa o harness
global da Sintetiza em `~/.claude/sintetiza/harness.md` — **onde divergirem, este
arquivo prevalece.**

`AGENTS.md` na raiz é um espelho deste arquivo (symlink), lido nativamente pelo Codex CLI.

## Contexto

Loja de roupas e acessórios femininos da **Viviane Nosralla** (Monte Alto — SP).
Fork do `whitelabellojavirtual`, rebrandado a partir do brandbook oficial.
Cliente real, e-commerce transacional: erro de preço, de estoque ou de pagamento
tem consequência financeira direta.

**Single-tenant.** A regra #8 do harness (isolamento multi-tenant) não se aplica —
o equivalente aqui é **ownership de carrinho e de pedido** (ver Invariantes).

## Plane

| Campo | Valor |
|---|---|
| Workspace | `sintetizaai` |
| Projeto | `VIVI — Vivi Nosralla` |
| Project ID | `3244eb33-5e26-463d-ab0e-90807c6150ea` |
| Prefixo das tasks | `VIVI-NNN` |

Fluxo: `/iniciar-task VIVI-NNN` → `/qa-test VIVI-NNN` → PR → `/fechar-task VIVI-NNN`.
Branch `feature/VIVI-NNN-descricao`, PR com título `VIVI-NNN: descrição`.

### Specs (SDD)

Os 11 Epics do Plane têm spec versionada em `.sintetiza/specs/<epic-slug>/`
(`requirements.md` · `design.md` · `tasks.md`):

`catalogo-estoque-unificado` · `checkout-pagamentos-frete` · `clientes-indicadores` ·
`consignado` · `financeiro-conciliacao` · `fiscal-nfce` · `ia-assistente-vendas` ·
`ia-estudio-visual` · `implantacao-golive` · `loja-virtual-marca` · `pdv-etiquetas`

Os critérios EARS do `requirements.md` são a **definição de pronto** — não o resumo
em prosa da task. A **Estratégia de teste** do `design.md` define como verificar cada
critério; use-a, não invente procedimento. Divergência entre spec e repo se **relata**,
não se contorna. Planos de task ficam em `.sintetiza/specs/<epic>/plans/VIVI-NNN.md`.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 · Vite 7 · TypeScript · Tailwind CSS v4 · wouter · TanStack Query |
| Back-end | Express 5 · Drizzle ORM · PostgreSQL · ES Modules (`"type": "module"`) |
| Pagamento | MercadoPago / Asaas atrás de um gateway próprio (mock no ambiente local) |
| Frete | SmartEnvios (mock local) + zonas/taxas próprias no banco |

## Comandos

```bash
npm run dev      # API + front (tsx server/index.ts) — PORT do .env (5300 local; default 5000)
npm run check    # tsc — ÚNICA verificação automatizada do repo (ver "Verificação")
npm run build    # tsx script/build.ts → dist/index.cjs
npm run seed     # recria o catálogo (32 produtos); -- --keep preserva o existente
npm run db:push  # drizzle-kit push
```

Migrations SQL são aplicadas em ordem: `for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done`.

## Arquitetura

```
client/src/
  pages/store/       StorePage · ProductDetailPage · CartPage · CheckoutPage · OrderConfirmationPage
  pages/admin/       20 telas (produtos, pedidos, cupons, bundles, assinaturas, relatórios…)
  pages/institucional/  Sobre · Contato · Trocas · Privacidade · GuiaMedidas
  context/           CartContext · AdminAuthContext (JWT)
  locales/           pt.json · en.json · es.json
server/
  routes.ts          todas as rotas da API (~1800 linhas)
  storage.ts         camada de dados (Drizzle) — toda query passa por aqui
  auth.ts            JWT + bcrypt
  gateway/           abstração de pagamento: escolhe mercadopago|asaas por config
  {asaas,mercadopago,smartenvios}/   client · service · config · types (+ mcp.ts)
shared/
  schema.ts          24 tabelas Drizzle — fonte única do modelo de dados
  pagamento.ts       regra de preço/desconto compartilhada front↔back
  bundle-pricing.ts  precificação de combos
script/              catalogo.ts (catálogo-semente) · seed.ts · build.ts
migrations/          001…013, numeradas e sequenciais
setup/               Docker, PM2 (ecosystem.config.cjs), install/update/migrate.sh
```

## Convenções do projeto

1. **Variantes: `option1` = Tamanho, `option2` = Cor.** Vale no schema, no seed, no
   admin e na importação CSV/XLSX. Inverter quebra filtro, grade e baixa de estoque.
2. **Preço e desconto vêm de `shared/pagamento.ts`** (`PIX_DESCONTO = 0.05`,
   `descontoPix()`) e de `shared/bundle-pricing.ts`. Front-end e back-end usam a
   **mesma** função — nunca recalcule desconto no componente. Um bug já corrigido
   aqui foi exibir 5% no PIX e não cobrar.
3. **Baixa de estoque é por variante**: `storage.decrementStock(productId, qty, variantId)`.
   Baixar só no produto deixa tamanho esgotado à venda.
4. **Migrations nunca são editadas depois de aplicadas** — crie a próxima no número
   seguinte, idempotente (`IF NOT EXISTS`). O schema em `shared/schema.ts` e as
   migrations precisam terminar iguais: divergência entre os dois já derrubou todo
   o checkout com 500 (`orders.subscription_id`, corrigido em `012`).
5. **Toda query passa por `server/storage.ts`.** Não escreva Drizzle solto em `routes.ts`.
6. **Busca ignora caixa e acento** (`unaccent`, migration `013`). Ao mexer em busca,
   preserve isso — "trico" precisa achar "Tricô".
7. **Validação com zod na borda** — payloads de API e webhooks validados antes de
   tocar em lógica de negócio.
8. **Identidade visual** (`client/src/index.css`, bloco `@theme`): `vn-olive-500`
   `#878f79` é a cor da marca, mas reprova WCAG AA sobre branco (3.38:1) — **texto e
   botões usam `vn-olive-600`**; o oliva puro fica para superfícies e elementos não
   textuais. Títulos em Playfair Display, corpo em Quicksand. Os SVGs de
   `client/public/brand/` foram vetorizados do brandbook: **nunca recomponha a marca
   com webfont**.

## Invariantes (property-based — ver `~/.claude/sintetiza/invariantes.md`)

Adaptados a este repo. Task que toca uma dessas áreas precisa cobrir a invariante:

- **INV-A · Ownership** (substitui o INV-1 multi-tenant): nenhuma requisição altera
  ou lê carrinho ou pedido de outro. Os IDs de carrinho são seriais — por isso as
  rotas são `/api/cart/:sessionId/item/:itemId` e a checagem é pelo `sessionId`, não
  pelo id do item. Cubra os quatro verbos, não só o GET.
- **INV-B · PII e LGPD**: `GET /api/orders/:numero` é público. Não pode devolver CPF,
  telefone nem endereço; e-mail vai mascarado; o número do pedido é longo o bastante
  para não ser enumerável, com rate limit por IP. Log de corpo de requisição só em
  rotas de catálogo — nunca em checkout, pedido ou cliente.
- **INV-C · Dinheiro**: para todo carrinho, `total = subtotal − descontos + frete`,
  nunca negativo; quantidade sofre clamp; variante é validada contra o produto. O
  desconto exibido é o desconto cobrado.
- **INV-D · Webhook idempotente**: MercadoPago, Asaas e SmartEnvios reentregam. O
  mesmo evento N vezes produz o mesmo efeito que uma vez — inclusive fora de ordem.
- **INV-E · Migrations idempotentes**: aplicar todas N vezes dá o mesmo schema.

## Verificação — leia antes de dizer "pronto"

⚠️ **Este repo não tem infraestrutura de teste**: sem `vitest`, sem `eslint`, sem
script `npm test`, zero arquivos de teste. A regra 12 do harness ("build + lint +
testes passam") hoje se resolve com:

```bash
npm run check    # tsc, precisa passar limpo
npm run build    # precisa gerar dist/index.cjs
```

…mais **evidência manual** de cada critério: `curl` na rota com a resposta colada,
`psql` conferindo o efeito no banco, ou o passo na UI com o resultado. Presumir não
conta; cole comando e saída.

Task que exija teste automatizado deve **pedir autorização ao dev antes de instalar**
`vitest`/`fast-check` (dependência nova é decisão do dono do repo, regra 3 do harness).
Instalados, propriedades vão para `tests/properties/<area>.prop.test.ts`.

## Estado atual e pendências de go-live

O `.env` não é versionado. Sem `ADMIN_EMAIL`/`ADMIN_PASSWORD` nenhum admin é criado
(use "Primeiro acesso" em `/admin/login`); em produção, ausência de `JWT_SECRET`
**derruba o boot de propósito** — não reintroduza segredo de fallback.

Pagamento e frete estão em **modo mock** local (`MP_MOCK`, `ASAAS_MOCK`,
`SMARTENVIOS_MOCK`): nenhuma cobrança real acontece no ambiente de desenvolvimento.

Pendente para o go-live (`.sintetiza/specs/implantacao-golive/`):

- [ ] Fotos de produto de estúdio em 3:4 (as atuais em `uploads/produtos/` são
      provisórias, capturadas do Instagram em 523×697) — troca pelo admin, sem código
- [ ] Conferir peças, preços e grades reais com a cliente
- [ ] Credenciais de produção do gateway de pagamento e do frete
- [ ] SMTP real para confirmação de pedido
- [ ] CNPJ e endereço completo no rodapé e na política de privacidade

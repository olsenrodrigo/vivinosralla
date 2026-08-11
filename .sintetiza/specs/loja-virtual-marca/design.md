# Design — Loja Virtual com Conceito de Marca

**Requisitos cobertos:** REQ-1 … REQ-7 · **Spec:** ./requirements.md

## Visão arquitetural

O repositório já traz a base whitelabel adaptada para a marca: `client/index.html` está com o
título, as fontes (Cormorant Garamond + Quicksand) e o `theme-color` da Vivi Nosralla;
`client/src/lib/marca.ts` centraliza WhatsApp, Instagram, paleta e formatação de preço;
`client/src/components/brand/` tem `HeroSection`, `CollectionsGrid`, `NewArrivals`, `AboutTeaser`,
`SocialProof` e `WhatsAppCta`; `client/src/pages/store/` tem vitrine, PDP, carrinho e checkout.

O que este epic faz é **fechar as lacunas de catálogo de moda e de descoberta**:

| Camada | O que é novo | O que é alterado |
|---|---|---|
| Banco | `collections`, `collection_products`, `lookbooks`, `lookbook_items`; colunas `measurements`, `composition`, `collection_id` em `products` | — |
| API pública | `GET /sitemap.xml`, `GET /robots.txt`, `GET /llms.txt`, `GET /feed/catalogo.json`, `GET /api/store/collections`, `GET /api/store/lookbooks` | `GET /api/store/products` ganha `size`, `color`, `minPrice`, `maxPrice`; `GET /api/store/products/:slug` passa a devolver medidas e composição |
| API admin | `POST/PUT/DELETE /api/admin/collections`, `/api/admin/lookbooks` | — |
| Front | `pages/store/CollectionPage.tsx`, `pages/store/LookbookPage.tsx`, `lib/seo.ts`, `lib/consent.ts` | `Home.tsx`, `StorePage.tsx`, `ProductDetailPage.tsx`, `CookieConsent.tsx`, `lib/analytics.ts` |

O `server/static.ts` já intercepta rotas não-API em produção; `sitemap.xml`, `robots.txt` e
`llms.txt` são registrados **antes** dele em `server/routes.ts`, como as demais rotas de API.

## Modelo de dados

Migration nova: `migrations/012_collections_lookbooks.sql`, idempotente (`IF NOT EXISTS`),
seguindo o padrão das 11 migrations existentes.

| Entidade | Campos | Atende |
|---|---|---|
| `collections` | `id serial pk`, `name text not null`, `slug text unique not null`, `description text`, `season text`, `cover_image_url text`, `sort_order int default 0`, `active bool default true`, `created_at` | REQ-4.1, REQ-4.2 |
| `collection_products` | `id serial pk`, `collection_id int not null`, `product_id int not null`, `sort_order int default 0`, unique(`collection_id`,`product_id`) | REQ-4.3, REQ-4.4 |
| `lookbooks` | `id serial pk`, `collection_id int`, `title text not null`, `slug text unique not null`, `image_url text not null`, `active bool default true`, `sort_order int default 0` | REQ-4.3 |
| `lookbook_items` | `id serial pk`, `lookbook_id int not null`, `product_id int not null`, `variant_id int`, `sort_order int default 0` | REQ-4.3, REQ-4.4 |
| `products` (alter) | `+ composition text`, `+ measurements jsonb`, `+ collection_id int` | REQ-3.1, REQ-3.2 |
| `store_settings` (alter) | `+ consent_log_enabled bool default true` | REQ-7.2 |
| `consent_events` | `id serial pk`, `visitor_id text not null`, `decision text not null` (`granted`/`denied`), `policy_version text not null`, `created_at` | REQ-7.2, REQ-7.3 |

`consent_events.visitor_id` é um UUID de primeira visita guardado em `localStorage`. **Não guarda IP
nem user-agent** — o registro existe para provar o aceite, não para identificar a pessoa.

Índices: `idx_collection_products_collection`, `idx_lookbook_items_lookbook`,
`idx_products_collection`. Os índices de filtro de moda (`variants.option1`, `variants.option2`)
já existem em `migrations/011_fashion_indexes.sql` — conferir cobertura antes de criar novos.

## Contratos de API

### GET /api/store/products — atende REQ-2.1 … REQ-2.7

- **Request (query):** `category?: string`, `size?: string`, `color?: string`, `minPrice?: number`,
  `maxPrice?: number`, `collection?: string`, `sort?: "recentes"|"preco_asc"|"preco_desc"`,
  `limit?: number (default 24, max 60)`, `offset?: number (default 0)`.
  Validado com zod (`z.coerce.number().positive()` para preços) antes de tocar em `storage`.
- **200:** `{ products: ProductCard[], total: number, limit: number, offset: number }`
- **400:** parâmetro com tipo inválido → `{"error":"parametro_invalido","field":"<campo>"}` (REQ-2.5)
- **Autorização:** pública
- **Nota de implementação:** os filtros `size`/`color` viram `EXISTS (SELECT 1 FROM variants v WHERE
  v.product_id = p.id AND v.active AND v.option1 = $1 …)` dentro da mesma query — proibido consultar
  variantes por peça em laço (harness #6, REQ-2.4).

### GET /api/store/products/:slug — atende REQ-3.1, REQ-3.4, REQ-3.5

- **200:** `{ product: {…, composition, measurements}, images: ProductImage[], variants: Variant[], collection?: {slug,name} }`
- **404:** slug inexistente ou `published = false` → `{"error":"nao_encontrado"}` (REQ-3.4)
- **Autorização:** pública

### GET /api/store/collections · GET /api/store/collections/:slug — atende REQ-4.4

- **200:** coleções com `active = true`; a versão `:slug` inclui as peças com `published = true`, na ordem de `collection_products.sort_order`
- **404:** coleção inativa ou inexistente

### POST /api/admin/collections — atende REQ-4.1, REQ-4.2, REQ-4.5, REQ-4.6

- **Request:** `{ name: string(3..120), slug: string(/^[a-z0-9-]+$/), description?, season?, coverImageUrl?, sortOrder? }`
- **201:** `{ id, slug }`
- **400:** payload fora do schema → `{"error":"payload_invalido","fields":[…]}` (REQ-4.6)
- **401:** sem sessão administrativa (REQ-4.5)
- **409:** slug duplicado → `{"error":"slug_duplicado"}` (REQ-4.2)
- **Autorização:** `requireAdmin` (`server/auth.ts`), papéis `admin` e `operator`

### PUT /api/admin/lookbooks/:id/items — atende REQ-4.3

- **Request:** `{ items: [{ productId: number, variantId?: number, sortOrder: number }] }`
- **200:** substitui o conjunto de itens em uma transação
- **400 / 401:** idem acima

### GET /sitemap.xml — atende REQ-5.2, REQ-5.5
`Content-Type: application/xml`. Uma `<url>` por peça `published = true` e por coleção `active = true`,
com `<lastmod>` = `updated_at`. Cache HTTP de 1 hora (`Cache-Control: public, max-age=3600`).

### GET /robots.txt — atende REQ-5.3
`Content-Type: text/plain`. `Disallow: /admin`, `Disallow: /api`, `Sitemap: <origin>/sitemap.xml`.

### GET /llms.txt — atende REQ-6.1
`Content-Type: text/plain`. Nome da marca, cidade, categorias, e os caminhos `/loja`,
`/feed/catalogo.json`, `/guia-de-medidas`.

### GET /feed/catalogo.json — atende REQ-6.2, REQ-6.3
`[{ slug, nome, preco, precoPromocional, tamanhos: string[], cores: string[], composicao, url, imagem }]`
— só `published = true`. Cache de 1 hora.

### PUT /api/admin/settings — atende REQ-7.7
Já existe (`server/routes.ts:1109`). Ganha validação: chaves de `analyticsConfig` fora de
`ANALYTICS_CONFIG_KEYS` (`shared/schema.ts:69`) → HTTP 400.

## Fluxos

**Consentimento e disparo de evento (REQ-7)**

1. Primeira visita: `lib/consent.ts` gera `visitor_id` (UUID v4, `localStorage`) e devolve estado `unknown`.
2. `CookieConsent.tsx` renderiza o banner. Nenhum script de terceiro foi injetado até aqui.
3. Aceite → `POST /api/consent {visitorId, decision:"granted", policyVersion}` grava em `consent_events`
   e só então `lib/analytics.ts` injeta os `<script>` de GA4/Meta/TikTok cujos IDs estão em `analytics_config`.
4. Recusa → grava `denied`; `analytics.ts` entra em modo *no-op*: `track()` retorna sem efeito.
5. `track("add_to_cart" | "purchase", payload)` monta o payload a partir do item/pedido. Uma função
   `sanitize()` remove as chaves `nome`, `email`, `telefone`, `cpf` antes do envio (REQ-7.6).

**Falha parcial:** se `POST /api/consent` falhar, o front mantém o estado `unknown` em memória e
**não** injeta script — a decisão default é não rastrear.

**Seleção de variação na PDP (REQ-3.2, REQ-3.3, REQ-3.5)**

A PDP recebe todas as variações de uma vez. A seleção é resolvida no cliente: escolher cor filtra os
tamanhos com variação ativa; escolher tamanho resolve a variação; `stock_quantity = 0` +
`continue_selling_out_of_stock = false` desabilita o botão. Sem ida ao servidor por clique.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| `collections` como entidade nova | Reutilizar `categories` com `parent_id` fixo | Categoria é taxonomia permanente e coleção é temporal; misturar as duas quebra o filtro de navegação e a curva ABC por coleção do epic `clientes-indicadores` |
| `measurements` em JSONB no produto | Tabela `product_measurements` normalizada | A tabela de medidas é sempre lida inteira e nunca filtrada por campo; normalizar acrescenta join sem ganho de consulta |
| Filtros de moda resolvidos em SQL com `EXISTS` | Carregar peças e filtrar em memória no Node | Catálogo cresce por coleção; filtrar em memória vira varredura completa e viola a regra #6 do harness |
| Sitemap gerado sob demanda com cache HTTP de 1 h | Arquivo estático regerado por cron | Catálogo de moda muda toda semana; cron desatualiza e acrescenta um ponto de falha operacional |
| Consentimento *opt-in* estrito | *Opt-out* (carrega e para se recusar) | LGPD art. 7º e 8º: o tratamento só é lícito após o consentimento; opt-out já rastreou antes de perguntar |
| `visitor_id` anônimo em `consent_events` | Guardar IP + user-agent como prova | IP é dado pessoal (art. 5º, I); a prova do aceite não precisa dele |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Fotos das peças chegam sem padrão de proporção e a grade da vitrine fica irregular | Vitrine com aparência amadora, contradizendo a promessa de conceito de marca | `sharp` (já em `package.json`) normaliza para 3:4 no upload; a PDP usa `aspect-ratio` fixo |
| Catálogo inicial pequeno deixa os filtros vazios e a vitrine parecendo quebrada | Percepção de loja sem produto no go-live | Filtro só é renderizado quando existe ao menos uma peça com aquele valor (facetas vêm de `listFilterFacets`, `server/storage.ts:211`) |
| Bloquear rastreio até o aceite reduz o volume medido no GA4 | Relatórios de funil subestimam o tráfego | Documentar a taxa de aceite no painel; a decisão é regulatória, não negociável |
| `sitemap.xml` interceptado pelo fallback SPA de `server/static.ts` | Google recebe HTML no lugar de XML | Registrar as rotas de arquivo antes de `serveStatic()` e cobrir com teste de `Content-Type` |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | `curl -s localhost:5003/ \| grep -c 'data-secao="hero"\|data-secao="colecoes"\|data-secao="novidades"\|data-secao="prova-social"'` retorna 4 |
| REQ-1.2 | manual | DevTools em 390×844: `document.body.scrollWidth <= window.innerWidth` é `true` na home |
| REQ-1.3 | integração | Seed com 12 peças `featured`; `GET /api/store/featured` retorna 8, ordenadas por `created_at` decrescente |
| REQ-1.4 | integração | Base sem peça publicada; `curl -s localhost:5003/` responde 200 e a home não contém `data-secao="novidades"` |
| REQ-1.5 | manual | Clicar no botão de WhatsApp abre `wa.me/5516991737463` com `?text=` preenchido |
| REQ-2.1 | integração | `GET /api/store/products?size=M` → toda peça retornada tem variação ativa `option1='M'` com saldo positivo |
| REQ-2.2 | integração | `GET /api/store/products?color=Oliva` → toda peça retornada tem variação ativa naquela cor |
| REQ-2.3 | integração | `GET /api/store/products?minPrice=200&maxPrice=400` → todo preço retornado está em [200,400] |
| REQ-2.4 | integração | `DEBUG=pg` no teste combinado `size=M&color=Oliva`: exatamente 2 consultas (listagem + contagem) |
| REQ-2.5 | integração | `GET /api/store/products?minPrice=abc` → 400 com `field:"minPrice"` |
| REQ-2.6 | integração | `GET /api/store/products?size=XPP` → 200 com `products: []` e `total: 0` |
| REQ-2.7 | integração | Seed com 40 peças; `GET /api/store/products` retorna 24 |
| REQ-2.8 | manual | Listagem em desktop: passar o mouse sobre um card exibe a grade; os itens conferem com os `option1` distintos das variações ativas da peça no banco |
| REQ-2.9 | manual | Zerar o saldo de uma variação (`UPDATE product_variants SET stock_quantity=0`): o tamanho continua na grade, riscado/esmaecido, e o clique nele não navega |
| REQ-2.10 | manual | Clicar em "40" no card leva a `/produto/<slug>` com o tamanho 40 já selecionado e o carrinho inalterado (contador segue igual) |
| REQ-2.11 | manual | Tirar o ponteiro do card: a grade some e a capa volta |
| REQ-2.12 | manual | Navegar por `Tab` até o card: a grade aparece sem uso de mouse e `Enter` sobre um tamanho leva à PDP |
| REQ-2.13 | manual | DevTools com emulação de toque (`pointer: coarse`) em 390×844: a grade não aparece e o toque na foto abre a PDP |
| REQ-2.14 | manual | Peça com 2+ fotos: o hover troca para a segunda imagem do catálogo e a saída do ponteiro restaura a capa |
| REQ-3.1 | integração | `GET /api/store/products/<slug>` → 200 e o corpo tem `composition`, `measurements`, `images[]`, `variants[]` |
| REQ-3.2 | manual | PDP com grade P/M/G × Oliva/Vinho: selecionar Vinho deixa visíveis só os tamanhos com variação Vinho ativa |
| REQ-3.3 | manual | Variação com saldo 0 e `continueSellingOutOfStock=false`: botão desabilitado e rótulo "Esgotado" |
| REQ-3.4 | integração | `GET /api/store/products/rascunho-x` (peça `published=false`) → 404 `{"error":"nao_encontrado"}` |
| REQ-3.5 | manual | Selecionar variação com `imageUrl` troca a imagem principal exibida |
| REQ-4.1 | integração | `POST /api/admin/collections` autenticado → 201 com `id` |
| REQ-4.2 | integração | Repetir o POST com o mesmo slug → 409 `{"error":"slug_duplicado"}` e `SELECT count(*) FROM collections WHERE slug=…` continua 1 |
| REQ-4.3 | integração | `PUT /api/admin/lookbooks/1/items` com 3 itens; `GET /api/store/lookbooks/<slug>` devolve na mesma ordem |
| REQ-4.4 | integração | Despublicar uma peça do lookbook; ela some da resposta pública e permanece no `GET` admin |
| REQ-4.5 | integração | `POST /api/admin/collections` sem cookie de sessão → 401 e nenhuma linha criada |
| REQ-4.6 | integração | `POST /api/admin/collections -d '{"name":"x"}'` → 400 com `fields` listando `slug` |
| REQ-5.1 | integração | Para `/`, `/loja` e uma PDP: `curl -s <rota> \| grep -c '<title>\|name="description"\|rel="canonical"\|property="og:title"'` retorna 4 |
| REQ-5.2 | integração | `curl -sI localhost:5003/sitemap.xml` → 200 e `Content-Type: application/xml`; o corpo contém a URL de cada peça publicada |
| REQ-5.3 | integração | `curl -s localhost:5003/robots.txt` contém `Disallow: /admin` e a linha `Sitemap:` |
| REQ-5.4 | integração | Extrair o `<script type="application/ld+json">` da PDP e validar contra o schema `Product` — `offers.price` e `offers.availability` presentes |
| REQ-5.5 | integração | Despublicar uma peça e reconsultar `/sitemap.xml` após o cache expirar: a URL sumiu |
| REQ-6.1 | integração | `curl -sI localhost:5003/llms.txt` → 200 e `Content-Type: text/plain` |
| REQ-6.2 | integração | `GET /feed/catalogo.json` → todo item tem `slug`, `nome`, `preco`, `tamanhos`, `cores`, `url` |
| REQ-6.3 | integração | Despublicar peça; o `slug` dela não aparece mais no feed |
| REQ-7.1 | manual | Sessão limpa: aba Network não registra requisição para `googletagmanager.com`, `connect.facebook.net` nem `analytics.tiktok.com` |
| REQ-7.2 | integração | Aceitar o banner → `SELECT decision FROM consent_events WHERE visitor_id=…` é `granted` e os scripts aparecem no DOM |
| REQ-7.3 | integração | Recusar → `decision='denied'` e nenhuma tag de rastreio no DOM durante a sessão |
| REQ-7.4 | manual | Com consentimento: adicionar ao carrinho enfileira `add_to_cart` em `window.dataLayer` com `item_id`, `item_name`, `price`, `quantity` |
| REQ-7.5 | manual | Concluir um pedido: `purchase` em `dataLayer` com `transaction_id`, `value`, `currency` |
| REQ-7.6 | unitário | `sanitize({nome,email,telefone,cpf,value})` devolve objeto só com `value` |
| REQ-7.7 | integração | `PUT /api/admin/settings -d '{"analyticsConfig":{"metaCapiToken":"x"}}'` → 400 e o registro segue inalterado |

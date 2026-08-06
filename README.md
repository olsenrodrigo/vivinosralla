# VIVI NOSRALLA — Loja Virtual

Loja de roupas e acessórios femininos da **Viviane Nosralla** (Monte Alto — SP).
Fork do `whitelabellojavirtual`, rebrandado a partir do brandbook oficial em
`../insumos/ID VISUAL VIVI NOSRALLA +.pdf`.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 · Vite 7 · TypeScript · Tailwind CSS v4 · wouter · TanStack Query |
| Back-end | Express 5 · Drizzle ORM · PostgreSQL |
| Pagamento | MercadoPago / Asaas (em **modo mock** no ambiente local) |
| Frete | SmartEnvios (mock local) + zonas/taxas próprias |

## Rodando localmente

```bash
npm install
createdb vivinosralla_dev
for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
npm run seed      # popula categorias, 32 produtos, variantes, cupom e frete
npm run dev       # http://localhost:5300
```

O `.env` local já vem apontando para `postgresql://olsenrodrigo@localhost:5432/vivinosralla_dev`
na porta **5300**, com pagamento e frete em mock (nenhuma cobrança real).

### Admin

`http://localhost:5300/admin` — credenciais em `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

O fork trazia credenciais padrão de outro cliente e um `JWT_SECRET` fixo como
fallback. Ambos foram removidos: sem `ADMIN_EMAIL`/`ADMIN_PASSWORD` no `.env`
nenhum admin é criado (use o "Primeiro acesso" da tela de login), e em produção
a ausência de `JWT_SECRET` derruba o boot em vez de usar segredo previsível.

## Identidade visual

Extraída do brandbook e materializada em `client/src/index.css` (`@theme`).

| Token | Valor | Uso |
|---|---|---|
| `vn-olive-500` | `#878f79` | **cor principal** do brandbook — superfícies, ícones, bordas |
| `vn-olive-600` | `#6d7561` | botões e links (contraste AA sobre fundo claro) |
| `vn-ice` | `#f1f1e7` | cor secundária — seções alternadas |
| `vn-sand` | `#e4dcc9` | areia do brandbook — hero e banners |
| `vn-wine` | `#6b2336` | ação/ênfase — badges de desconto, alertas |
| `vn-ink` | `#34372e` | texto forte |

**Importante:** `#878f79` puro sobre branco tem contraste 3.38:1 e reprova no
WCAG AA para texto. Por isso texto e botões usam `vn-olive-600`; o oliva oficial
fica para superfícies grandes e elementos não-textuais.

### Tipografia

- **Quicksand** — fonte secundária oficial do brandbook, usada em todo o corpo e UI.
- **Playfair Display** — substitui a **Dream Avenue** (display serif licenciada, sem
  versão web) nos títulos. Foi escolhida no lugar da Cormorant Garamond porque esta
  desenha os diacríticos muito altos e destacados — em português (`você`, `ê`, `ã`)
  o acento lê como sujeira na tela.

### Logomarca

Os SVGs em `client/public/brand/` foram **vetorizados do PDF do brandbook** — a
marca nunca é recomposta com webfont.

| Arquivo | Uso |
|---|---|
| `logo-vn-{oliva,gelo,vinho}.svg` | lockup completo (monograma + assinatura) — cabeçalho |
| `icone-vn-{oliva,gelo,vinho}.svg` | só o monograma "vn" — rodapé |
| `app-icon.svg` / `favicon.svg` | monograma gelo sobre quadrado oliva — favicon e PWA |

Os PNGs (`favicon-*.png`, `apple-touch-icon.png`, `icon-*.png`, `og-image.png`)
são gerados a partir desses SVGs.

## Catálogo

`script/catalogo.ts` define categorias, cores e os 32 produtos; `script/seed.ts`
grava tudo no banco. Convenção de variantes: **`option1` = Tamanho**,
**`option2` = Cor**.

```bash
npm run seed            # limpa o catálogo e recria
npm run seed -- --keep  # mantém o existente
```

### ⚠️ Fotos de produto

As imagens em `uploads/produtos/` foram capturadas do Instagram da marca
(@vivianenosralla) para tirar a loja do zero. São **provisórias**: 523×697 e
enquadramento de rede social. Antes do go-live devem ser substituídas por fotos
de estúdio em 3:4 (recomendado 1200×1600). A troca é feita pelo admin, em
`/admin/produtos`, sem mexer em código.

## Filtros de moda

Adicionados sobre a base whitelabel:

- `GET /api/store/products` aceita `size`, `color` (CSV), `min_price`, `max_price`, `sort`.
- `GET /api/store/filters` devolve tamanhos, cores e faixa de preço disponíveis.
- Índices em `migrations/011_fashion_indexes.sql`.
- Busca ignora caixa e acento (`unaccent`, `migrations/013`): "vestido" acha
  "Vestido", "trico" acha "Tricô".

## Correções sobre a base herdada

A revisão final encontrou defeitos que vinham do whitelabel e não do rebrand.
Ficam registrados porque valem para os outros forks da mesma base:

| Problema | Efeito | Correção |
|---|---|---|
| `orders.subscription_id` no schema, ausente nas migrations | **todo checkout falhava com 500** | `migrations/012` |
| `PUT /api/cart/item/:id` sem checagem de dono | qualquer um alterava carrinho alheio (id é serial) | rota movida para `/api/cart/:sessionId/item/:itemId` |
| `GET /api/orders/:n` público com CPF, telefone e endereço; número com 4 dígitos | enumerável em minutos | PII removida do payload, e-mail mascarado, número com ~1 bi de combinações, 20 req/min por IP |
| Quantidade e variante sem validação no carrinho | subtotal negativo; grade de outro produto | clamp + variante validada contra o produto |
| Desconto de 5% no PIX exibido mas não cobrado | oferta não cumprida | `shared/pagamento.ts` usado pelos dois lados |
| Baixa de estoque só no produto, não na variante | tamanho esgotado seguia à venda | `decrementStock` recebe `variantId` |
| Log despejava o corpo de toda rota `/api` | CPF/telefone/endereço em log (LGPD) | só rotas de catálogo logam corpo |
| `tsconfig` sem `target` (assumia ES5) e sem `script/**` | erros TS2802 crônicos; seed nunca checado | `target: ES2022` + `script/**` no include |

## Antes do go-live

- [ ] Trocar as fotos de produto por fotos de estúdio
- [ ] Conferir peças, preços e grades reais com a cliente
- [ ] Credenciais de produção do gateway de pagamento e do frete
- [ ] SMTP real para confirmação de pedido
- [ ] CNPJ e endereço completo no rodapé e na política de privacidade
- [ ] Licenciar a webfont Dream Avenue, caso a cliente queira a fonte original nos títulos

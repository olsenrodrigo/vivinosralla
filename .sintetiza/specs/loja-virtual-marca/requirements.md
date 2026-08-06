# Requisitos — Loja Virtual com Conceito de Marca

**Projeto:** VIVI · **Plane:** módulo "Loja Virtual com Conceito de Marca" · **Origem:** pré-projeto Viviane Nosralla, Bloco A (A1, A2, A4)
**Status:** rascunho

## Contexto

A Viviane Nosralla vende 100% por atendimento direto: o público construído no Instagram
(@vivianenosralla) só converte por DM, com pedido digitado à mão. Não existe vitrine própria
funcionando 24 horas, nem página de produto com a informação que a cliente de moda pede antes de
comprar (medida, composição, caimento). Quando esta entrega existir, o tráfego do Instagram encontra
uma vitrine navegável no celular, com catálogo de moda de verdade — grade de tamanho e cor, estoque
por variação, várias fotos por peça — e a marca passa a ser encontrável no Google e nas respostas
das engines de IA.

## Glossário

| Termo | Definição |
|---|---|
| Peça | Produto de vestuário cadastrado; corresponde a uma linha em `products` |
| Grade | Conjunto de variações de uma peça combinando tamanho e cor; cada combinação é uma linha em `variants` |
| Variação | Combinação específica de tamanho e cor, com SKU, código de barras, preço e saldo próprios |
| Coleção | Agrupamento editorial de peças lançado em uma estação (ex.: "Alta Verão 26") |
| Lookbook | Composição visual de 2 ou mais peças apresentada como um look, com link para cada peça |
| PDP | *Product Detail Page* — página de uma peça individual |
| GEO | *Generative Engine Optimization* — otimização para que a marca seja citada nas respostas de ChatGPT, Perplexity e Google AI |
| Consentimento de rastreio | Aceite explícito da visitante para carregar scripts de analytics e pixels, exigido pela LGPD |

## Fora de escopo

- Produção de fotografia de produto (as fotos são fornecidas pela cliente; a geração assistida está no epic `ia-estudio-visual`)
- Gestão de mídia paga e produção de conteúdo editorial
- Aplicativo mobile nativo — a vitrine é responsiva e instalável como PWA
- Tradução para inglês e espanhol — a operação é Brasil, o site é pt-BR

---

## REQ-1 — Vitrine da marca na home

**Como** visitante que chegou de um story do Instagram, **quero** entender em segundos o que a marca
vende e navegar até uma peça, **para** comprar sem precisar mandar mensagem.

**Critérios de aceite**

- **REQ-1.1** — QUANDO a home é requisitada, O SISTEMA DEVE responder HTTP 200 com o hero da marca, a grade de coleções ativas, a lista de novidades e o bloco de prova social renderizados no HTML entregue
- **REQ-1.2** — QUANDO a home é renderizada em viewport de 390 px de largura, O SISTEMA DEVE exibir a chamada principal e o primeiro botão de ação sem exigir rolagem horizontal (`document.body.scrollWidth <= window.innerWidth`)
- **REQ-1.3** — QUANDO existem peças marcadas como `featured = true` e `published = true`, O SISTEMA DEVE listar no máximo 8 delas no bloco de novidades, ordenadas por `created_at` decrescente
- **REQ-1.4** — SE não existe nenhuma peça publicada, ENTÃO O SISTEMA DEVE renderizar a home sem o bloco de novidades e sem lançar erro no console do navegador
- **REQ-1.5** — QUANDO a visitante aciona o botão de WhatsApp, O SISTEMA DEVE abrir `https://wa.me/5516991737463` com mensagem pré-preenchida

## REQ-2 — Página de coleção com filtros de moda

**Como** cliente navegando pelo catálogo, **quero** filtrar por tamanho, cor, categoria e faixa de
preço, **para** ver só o que serve em mim e cabe no meu orçamento.

**Critérios de aceite**

- **REQ-2.1** — QUANDO `GET /api/store/products` recebe o parâmetro `size`, O SISTEMA DEVE retornar apenas peças que possuem ao menos uma variação ativa com aquele tamanho e `stock_quantity > 0`
- **REQ-2.2** — QUANDO `GET /api/store/products` recebe o parâmetro `color`, O SISTEMA DEVE retornar apenas peças com ao menos uma variação ativa naquela cor
- **REQ-2.3** — QUANDO `GET /api/store/products` recebe `minPrice` e `maxPrice`, O SISTEMA DEVE retornar apenas peças cujo preço efetivo está no intervalo fechado informado
- **REQ-2.4** — QUANDO dois ou mais filtros são combinados, O SISTEMA DEVE aplicá-los em conjunção (E lógico) na mesma consulta SQL, sem consulta adicional por peça
- **REQ-2.5** — SE um parâmetro de filtro chega com tipo inválido (ex.: `minPrice=abc`), ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"parametro_invalido","field":"minPrice"}` e não executar a consulta
- **REQ-2.6** — QUANDO nenhum resultado atende aos filtros, O SISTEMA DEVE responder HTTP 200 com `products: []` e `total: 0`
- **REQ-2.7** — QUANDO a listagem é requisitada sem `limit`, O SISTEMA DEVE retornar no máximo 24 peças por página

## REQ-3 — Página de produto com informação de moda

**Como** cliente, **quero** ver medidas, composição e as cores disponíveis antes de comprar,
**para** escolher o tamanho certo e não precisar trocar.

**Critérios de aceite**

- **REQ-3.1** — QUANDO a PDP de uma peça publicada é requisitada, O SISTEMA DEVE responder HTTP 200 com título, descrição, composição, tabela de medidas por tamanho, preço, todas as imagens ordenadas por `position` e a lista de variações ativas
- **REQ-3.2** — QUANDO a cliente seleciona uma cor, O SISTEMA DEVE atualizar a lista de tamanhos disponíveis para conter apenas os tamanhos com variação ativa naquela cor
- **REQ-3.3** — QUANDO a cliente seleciona uma variação com `stock_quantity = 0` e `continue_selling_out_of_stock = false`, O SISTEMA DEVE desabilitar o botão de adicionar ao carrinho e exibir o rótulo "Esgotado"
- **REQ-3.4** — SE o slug requisitado não existe ou pertence a peça com `published = false`, ENTÃO O SISTEMA DEVE responder HTTP 404 com `{"error":"nao_encontrado"}`, sem revelar se a peça existe em rascunho
- **REQ-3.5** — QUANDO a peça tem variação com `image_url` preenchida, O SISTEMA DEVE trocar a imagem principal exibida ao selecionar aquela variação

## REQ-4 — Lookbooks e coleções

**Como** administradora, **quero** montar coleções e lookbooks, **para** apresentar as peças como
looks e não como itens soltos de catálogo.

**Critérios de aceite**

- **REQ-4.1** — QUANDO a administradora cria uma coleção com nome e slug únicos, O SISTEMA DEVE persistir a coleção e responder HTTP 201 com o `id` gerado
- **REQ-4.2** — SE o slug informado já existe, ENTÃO O SISTEMA DEVE responder HTTP 409 com `{"error":"slug_duplicado"}` e não criar registro
- **REQ-4.3** — QUANDO a administradora associa peças a um lookbook, O SISTEMA DEVE persistir a ordem informada e exibir as peças nessa ordem na vitrine pública
- **REQ-4.4** — QUANDO a vitrine renderiza um lookbook, O SISTEMA DEVE exibir apenas as peças associadas que estão com `published = true`
- **REQ-4.5** — SE uma requisição de escrita em coleção ou lookbook chega sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não alterar dado nenhum
- **REQ-4.6** — SE o payload de criação de coleção não passa na validação de schema, ENTÃO O SISTEMA DEVE responder HTTP 400 com a lista de campos inválidos e não tocar no banco

## REQ-5 — SEO técnico

**Como** marca, **quero** que as peças sejam indexadas pelo Google, **para** captar busca por produto
sem depender só do Instagram.

**Critérios de aceite**

- **REQ-5.1** — QUANDO qualquer rota pública é entregue, O SISTEMA DEVE incluir `<title>`, `<meta name="description">`, `<link rel="canonical">` e as tags Open Graph correspondentes àquela rota
- **REQ-5.2** — QUANDO `GET /sitemap.xml` é requisitado, O SISTEMA DEVE responder HTTP 200 com `Content-Type: application/xml` contendo a URL de cada peça publicada e de cada coleção ativa
- **REQ-5.3** — QUANDO `GET /robots.txt` é requisitado, O SISTEMA DEVE responder HTTP 200 apontando o sitemap e bloqueando `/admin`
- **REQ-5.4** — QUANDO uma PDP é entregue, O SISTEMA DEVE incluir um bloco JSON-LD do tipo `Product` com `name`, `image`, `description`, `sku`, `brand` e `offers` contendo `price`, `priceCurrency` e `availability`
- **REQ-5.5** — QUANDO uma peça passa a `published = false`, O SISTEMA DEVE removê-la do `sitemap.xml` na requisição seguinte

## REQ-6 — GEO: presença nas engines de IA

**Como** marca, **quero** ser citada quando alguém pergunta a uma IA onde comprar determinada peça,
**para** aparecer no canal de busca que está substituindo o buscador tradicional.

**Critérios de aceite**

- **REQ-6.1** — QUANDO `GET /llms.txt` é requisitado, O SISTEMA DEVE responder HTTP 200 com `Content-Type: text/plain` descrevendo a marca, a cidade de operação e os caminhos do catálogo
- **REQ-6.2** — QUANDO `GET /feed/catalogo.json` é requisitado, O SISTEMA DEVE responder HTTP 200 com um array de peças publicadas contendo `slug`, `nome`, `preco`, `tamanhos`, `cores`, `composicao` e `url`
- **REQ-6.3** — SE uma peça está com `published = false`, ENTÃO O SISTEMA DEVE omiti-la do feed de catálogo

## REQ-7 — Analytics e pixels com consentimento

**Como** operação, **quero** medir o funil de venda, **para** saber de onde vem a conversão — sem
carregar rastreio antes do aceite da visitante.

**Critérios de aceite**

- **REQ-7.1** — ENQUANTO a visitante não registrou consentimento de rastreio, O SISTEMA DEVE não injetar os scripts de GA4, Meta Pixel nem TikTok Pixel no documento
- **REQ-7.2** — QUANDO a visitante aceita o consentimento, O SISTEMA DEVE injetar os scripts cujos IDs estão configurados em `store_settings.analytics_config` e persistir o aceite com data e hora
- **REQ-7.3** — QUANDO a visitante recusa o consentimento, O SISTEMA DEVE registrar a recusa e não injetar script de rastreio nenhum durante a sessão
- **REQ-7.4** — QUANDO um item é adicionado ao carrinho e há consentimento, O SISTEMA DEVE emitir o evento `add_to_cart` para GA4 com `item_id`, `item_name`, `price` e `quantity`
- **REQ-7.5** — QUANDO um pedido é confirmado e há consentimento, O SISTEMA DEVE emitir o evento `purchase` com `transaction_id`, `value` e `currency`
- **REQ-7.6** — O SISTEMA DEVE não enviar nome, e-mail, telefone ou CPF da cliente como parâmetro de evento de analytics
- **REQ-7.7** — SE o campo `analyticsConfig` recebido no admin contém uma chave fora de `ANALYTICS_CONFIG_KEYS`, ENTÃO O SISTEMA DEVE responder HTTP 400 e não persistir a configuração

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Vitrine em pt-BR apenas; a infraestrutura i18n existente (`client/src/locales/`) fica no repositório mas sem tradução ativa | O pré-projeto define operação em Monte Alto/SP com envio para o Brasil; traduzir sem operação internacional é custo sem retorno |
| 2 | Coleção é entidade nova (`collections`), separada de `categories` | `categories` é taxonomia permanente (vestidos, tricô); coleção é temporal (Alta Verão 26). Reaproveitar `categories` obrigaria a filtrar por convenção de nome |
| 3 | Medidas por tamanho ficam em coluna JSONB no produto, não em tabela normalizada | A tabela de medidas é lida sempre inteira e nunca consultada por campo; normalizar só acrescentaria join |
| 4 | Gate de consentimento com padrão *opt-in* (nada carrega antes do aceite) | LGPD art. 7º; o componente `client/src/components/CookieConsent.tsx` já existe e será a base |
| 5 | Limite de 24 peças por página na vitrine | Duas telas de rolagem em celular; evita listagem sem paginação em catálogo que vai crescer por coleção |

## Perguntas em aberto

Nenhuma. As lacunas de negócio deste epic (limites de listagem, idioma, formato de medidas) foram
decididas acima por serem escolhas técnicas dentro da alçada do arquiteto.

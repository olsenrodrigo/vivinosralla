# Design — Provador Virtual

**Requisitos cobertos:** REQ-1 … REQ-6 · **Spec:** ./requirements.md

## Visão arquitetural

O provador é **uma fila assíncrona pública com LGPD embutida no desenho**: tudo que a titular envia
vive pouco, é acessível só por token, nunca cruza para o catálogo e sai do disco por expurgo
verificável. A geração reaproveita o adaptador de imagem previsto para o estúdio — um provedor,
dois consumidores.

```
PDP ── "Provar em mim" ── modal: termo versionado + orientações de foto
 │
 ▼
POST /api/provador/:sessionId/foto ── sharp: EXIF fora · ≤1536px ──▶ uploads/provador/origem/  (fora do static)
 │ 201 {fotoToken, expiraEm}
 ▼
POST /api/provador/:sessionId/prova ──▶ tryon_generations (na_fila) ── 202 {provaToken}
                                              │  worker (FOR UPDATE SKIP LOCKED)
                                              ▼
                            ImageProvider.submeter({ modelo, prompt fixo,
                              referencias: [foto da cliente, foto da peça],
                              webhook: {url, secret}? })
                                              │  status = processando
                      webhook Higgsfield ─────┤───── polling (dev, mock, fallback)
                                              ▼
                    download + watermark "Simulação · IA" ──▶ uploads/provador/resultado/
                                              │  status = concluida
 PDP (polling 3 s) ◀── GET /api/provador/prova/:provaToken
 <img>            ◀── GET /api/provador/resultado/:provaToken   (private, no-store)
                                              ⋮
                    expurgo horário: foto 24 h · resultado 7 dias · DELETE imediato pela titular
```

Código novo:

- `server/estudio/` — `types.ts` (interface `ImageProvider` generalizada), `config.ts`
  (`HIGGSFIELD_*`, padrão de `server/mercadopago/config.ts`), `higgsfield.ts` (adaptador `fetch`),
  `mock.ts` (adaptador local)
- `server/provador/` — `service.ts` (regras), `queue.ts` (worker + polling + reset no boot),
  `purge.ts` (expurgo horário), `routes.ts` (`registerProvadorRoutes(app)`, chamado de
  `server/routes.ts` no padrão de `registerShippingRoutes`)
- Métodos de dados em `server/storage.ts` (convenção 5 do CLAUDE.md — nenhum Drizzle solto)
- `client/src/components/store/ProvadorVirtual.tsx` montado na `ProductDetailPage.tsx`

**Dependências:** nenhuma nova. `multer` já faz o upload (config em `server/routes.ts:93-107`).
`sharp` já está declarado no `package.json` mas **não é importado em nenhum módulo do repo hoje** —
este epic é o primeiro uso real; a task de upload precisa provar que o binário carrega no
`npm run build` e no boot da VPS, não só no `npm run check`.

## Generalização da interface `ImageProvider`

O design do `ia-estudio-visual` previu `ImageProvider.gerar(foto, preset, n)` — bloqueante, uma
imagem de origem, parametrizado por preset. O try-on não cabe nessa assinatura. A interface
generalizada, em `server/estudio/types.ts`:

```ts
export interface PedidoGeracao {
  modelo: string;                              // "seedream" (endpoint = modelo na REST)
  prompt: string;                              // montado pelo consumidor (preset → prompt no estúdio; template fixo no provador)
  referencias: { caminho: string }[];          // 1..N imagens locais já saneadas — estúdio: 1 · provador: 2
  n?: number;                                  // variações (estúdio usa; provador fixa 1)
  webhook?: { url: string; secret: string };   // conclusão assíncrona, quando o provedor suporta
}
export interface StatusJob {
  status: "na_fila" | "processando" | "concluida" | "falhou" | "recusada";
  imagens?: string[];                          // URLs de download no provedor
  custo?: number;
  erro?: string;
}
export interface ImageProvider {
  submeter(p: PedidoGeracao): Promise<{ jobId: string }>;
  consultar(jobId: string): Promise<StatusJob>;
}
```

O que precisou ser generalizado, explicitamente:

1. **`referencias[]` no lugar de foto única + preset** — o provador passa duas imagens (pessoa +
   peça); o preset do estúdio vira prompt montado pelo consumidor antes de chamar o adaptador.
2. **`submeter`/`consultar` no lugar de `gerar` bloqueante** — com `webhook` opcional. O worker do
   estúdio, que aguardava com timeout, passa a submeter e concluir por consulta ou webhook — mesmo
   contrato, dois estilos de conclusão.
3. **`modelo` como parâmetro do pedido** — configurável por consumidor (`tryon_model` aqui,
   escolha própria no estúdio), nunca hardcoded no adaptador.
4. **Credencial injetada na construção do adaptador** — a interface não lê `store_settings` nem
   `process.env`; o provador injeta a config de `server/estudio/config.ts`, e o estúdio, quando for
   implementado, injeta de onde decidir guardar a sua.

Nenhum **requisito** do `ia-estudio-visual` muda com isso — a assinatura antiga é detalhe do design
de lá, que passa a consumir a interface generalizada quando for implementado. As duas specs se
referenciam sem contradição: lá gera catálogo com aprovação de admin; aqui gera prova efêmera para
a consumidora.

### Adaptador Higgsfield (`server/estudio/higgsfield.ts`)

- `fetch` direto para `https://platform.higgsfield.ai`, sem SDK (decisão do dono do repo).
- Autenticação: header `Authorization` com `key_id:key_secret`
  (`HIGGSFIELD_KEY_ID` / `HIGGSFIELD_KEY_SECRET` no `.env`).
- Submissão informa `webhook: {url, secret}` quando `PUBLIC_URL` está definida — a URL é
  `${PUBLIC_URL}/api/provador/webhook/higgsfield`, o segredo é `HIGGSFIELD_WEBHOOK_SECRET`.
- Os caminhos exatos dos endpoints são conferidos contra a documentação oficial na task de
  implementação — o contrato interno do sistema é a interface, não a URL do provedor.
- **Allowlist de modelos do provador:** `seedream` — o único desta API que aceita ≥ 2
  imagens de referência. `soul_2` (moda/editorial) aceita só 1 referência: fica fora do provador,
  disponível para o estúdio.
- `server/estudio/config.ts`: `mock = env.HIGGSFIELD_MOCK === "1" || !keyId || !keySecret` — o
  mesmo padrão de `server/asaas/config.ts:36`.

### Mock (`server/estudio/mock.ts`)

Sem credencial ou com `HIGGSFIELD_MOCK=1`, `submeter` devolve um jobId local e `consultar` conclui
após ~2 s devolvendo uma composição local da foto da peça (nenhuma chamada de rede). A variável
`HIGGSFIELD_MOCK_SCENARIO` (`ok` | `erro` | `recusada` | `timeout`) força os caminhos tristes —
é o que torna REQ-4.1, REQ-4.2 e REQ-4.4 verificáveis sem gastar crédito.

## Modelo de dados

Migration nova: **a próxima livre na ordem do repositório no momento da implementação**, idempotente
(`IF NOT EXISTS`). *Nota de colisão:* o repo local está em `013`; a spec do estúdio cita `021` e a
de coleções cita `012`, ambas desatualizadas — número de migration é atribuído por ordem de chegada
na implementação e **nunca fixado em spec**. O schema espelhado em `shared/schema.ts` na mesma task
(convenção 4 do CLAUDE.md: divergência entre os dois já derrubou o checkout).

| Entidade | Campos | Atende |
|---|---|---|
| `tryon_photos` | `id serial pk`, `token text not null unique` (UUIDv4), `session_id text not null`, `file_path text not null`, `consent_version text not null`, `consented_at timestamptz not null`, `adult_declared boolean not null`, `expires_at timestamptz not null`, `purged_at timestamptz`, `created_at timestamptz default now()` | REQ-1.3, REQ-1.8, REQ-6.1, REQ-6.2 |
| `tryon_generations` | `id serial pk`, `token text not null unique` (UUIDv4), `photo_id int not null` → `tryon_photos`, `product_id int not null`, `variant_id int`, `garment_image_id int` (qual `product_images` alimentou a prova), `model text not null`, `status text not null default 'na_fila'` (`na_fila`/`processando`/`concluida`/`falhou`/`recusada`), `provider_job_id text`, `result_path text`, `provider_cost numeric(10,4)`, `error_message text`, `expires_at timestamptz`, `purged_at timestamptz`, `created_at`, `finished_at` | REQ-2.1, REQ-2.3 … REQ-2.6, REQ-4.1, REQ-4.2, REQ-4.4, REQ-5.4, REQ-5.7, REQ-6.3 |
| `store_settings` (alter) | `+ tryon_enabled bool not null default false`, `+ tryon_model text`, `+ tryon_monthly_limit int not null default 1000`, `+ tryon_session_daily_limit int not null default 8`, `+ tryon_timeout_seconds int not null default 180`, `+ tryon_photo_ttl_hours int not null default 24`, `+ tryon_result_ttl_hours int not null default 168` | REQ-2.5, REQ-4.2, REQ-5.2, REQ-5.4 … REQ-5.6, REQ-6.1, REQ-6.3 |
| `product_images` (alter) | `+ is_tryon_source boolean not null default false` — toggle "usar na prova virtual" na galeria do admin | REQ-2.3 |

Índices: `unique` nos dois `token`; `idx_tryon_generations_status` (fila e trava de concorrência);
`idx_tryon_generations_created` (contagem mensal, REQ-5.4); `idx_tryon_photos_expires` e
`idx_tryon_generations_expires` (expurgo).

Sem coluna de PII nas duas tabelas: **nenhum nome, e-mail ou telefone** — a titular é a sessão.

## Contratos de API

Rotas públicas (sem `requireAdmin`), todas sob rate limit por IP (REQ-5.1) no padrão do limitador
de consulta de pedido (`server/routes.ts:69-84`). Nenhuma loga corpo, caminho de arquivo ou token
(REQ-6.9). Com `tryon_enabled=false`, as rotas de escrita respondem 404 (REQ-5.6).

### POST /api/provador/:sessionId/foto — atende REQ-1.3 … REQ-1.8, REQ-5.1, REQ-5.6

- **Request:** `multipart/form-data`: `file`, `consentimento` (`"aceito"`), `maioridade` (`"sim"`),
  `termoVersao` (string). Validação zod dos campos; `multer` com limite de 10 MB e filtro
  jpg/jpeg/png/webp (sem gif — o filtro do catálogo aceita gif, o do provador não).
- **Pipeline:** `sharp` regrava o arquivo (`rotate()` para aplicar a orientação EXIF, `resize` a
  1536 px no maior lado, sem `withMetadata()` ⇒ EXIF/GPS descartados) em
  `uploads/provador/origem/<uuid>.jpg`; o arquivo original do multer é removido.
- **201:** `{ fotoToken, expiraEm }`
- **400:** `consentimento_ausente` (REQ-1.4) · `formato_invalido` (REQ-1.5)
- **413:** `arquivo_muito_grande` (REQ-1.6)
- **429:** `limite_de_provas` (REQ-5.1) · **404** com `tryon_enabled=false` (REQ-5.6)
- **Autorização:** pública; a foto nasce presa ao `sessionId` da URL

### POST /api/provador/:sessionId/prova — atende REQ-2.1, REQ-2.2, REQ-4.6, REQ-5.1 … REQ-5.4, REQ-5.6

- **Request:** `{ fotoToken: string, productId: number, variantId?: number }` (zod). `variantId`,
  quando presente, é validado contra o produto (INV-C by-the-book) e registra a cor provada.
- **202:** `{ provaToken }`
- **404:** `nao_encontrado` — fotoToken inexistente **ou de outra sessão**, resposta idêntica nos
  dois casos (REQ-2.2, INV-A); peça inexistente ou `published=false`; `tryon_enabled=false`
- **409:** `prova_em_andamento` (REQ-5.3) · **422:** `peca_sem_foto` (REQ-4.6)
- **429:** `limite_de_provas` (REQ-5.1) · `limite_diario_atingido` (REQ-5.2) ·
  `teto_de_provas_atingido` — `count(*) FROM tryon_generations WHERE created_at >= date_trunc('month', now())` (REQ-5.4)

### GET /api/provador/prova/:provaToken — atende REQ-3.1, REQ-3.6, REQ-3.7

- **200:** `{ status, resultadoUrl?, erro?, cor? }` — `resultadoUrl` só quando `concluida`
- **404:** token inexistente, expirado ou expurgado (REQ-3.6, REQ-6.5)
- A PDP consulta a cada 3 s enquanto `na_fila`/`processando`

### GET /api/provador/resultado/:provaToken — atende REQ-3.4, REQ-3.5, REQ-6.5, REQ-6.12

- **200:** bytes JPEG com a watermark, `Cache-Control: private, no-store` (REQ-3.5)
- **404:** após expurgo ou exclusão — e `uploads/provador/` é bloqueado no static público com um
  guard registrado **antes** de `express.static(uploadsDir)` (`server/routes.ts:165-168`), porque o
  static serve com `public, max-age=86400` e um cache intermediário reteria a foto após o expurgo
  (REQ-6.12)

### DELETE /api/provador/:sessionId/foto/:fotoToken — atende REQ-6.4, REQ-6.5

- **204:** remove do disco a foto e todos os `result_path` das provas dela; marca `purged_at` nas
  linhas (o registro fica para auditoria — sem PII, só datas e ids)
- **404:** token de outra sessão ou inexistente, resposta idêntica (INV-A nos quatro verbos: o
  DELETE também é checado pelo `sessionId`, não só pelo token)

### POST /api/provador/webhook/higgsfield — atende REQ-2.6 … REQ-2.8

- Valida o segredo do header contra `HIGGSFIELD_WEBHOOK_SECRET` em comparação de tempo constante;
  ausente/errado → **401** sem efeito (REQ-2.7)
- Payload validado com zod na borda (convenção 7); `provider_job_id` desconhecido → **200** sem
  efeito (o provedor reentrega; 4xx geraria tempestade de retry)
- Idempotência (REQ-2.8): a transição é
  `UPDATE tryon_generations SET status='concluida', … WHERE provider_job_id=$1 AND status IN ('na_fila','processando')`
  — segunda entrega não encontra linha para transicionar e vira no-op; download e watermark só
  acontecem quando o UPDATE afeta 1 linha

## Fluxos

**Prova com webhook (produção)**

1. Upload validado e saneado → `tryon_photos` com `expires_at = now() + ttl` → 201.
2. Solicitação de prova → checagens (sessão, peça, limites, concorrência) → `tryon_generations`
   `na_fila` → 202.
3. Worker retira com `FOR UPDATE SKIP LOCKED` (mesmo desenho da fila do estúdio), resolve a foto da
   peça — `is_tryon_source=true` → `variants.image_url` da cor → `is_main` → menor `position` —
   monta o prompt fixo e chama `submeter()` com as duas referências e o webhook. Grava
   `provider_job_id`, `status='processando'`.
4. Webhook chega → transição idempotente → download do resultado → `sharp` aplica a watermark
   "Simulação · IA" no canto e normaliza para 3:4 (proporção da vitrine) →
   `uploads/provador/resultado/<uuid>.jpg` → `concluida`, `expires_at = now() + ttl_resultado`,
   `provider_cost` se informado.
5. A PDP, que consultava o status, exibe o resultado rotulado.

**Prova com polling (dev, mock e fallback)**

Sem `PUBLIC_URL`, `submeter()` não informa webhook; um poller consulta `consultar(jobId)` a cada
10 s para provas `processando`. Com webhook configurado, o poller continua como rede de segurança:
prova `processando` com webhook atrasado é concluída pela consulta — o efeito é o mesmo (REQ-2.9).
Prova que estoura `tryon_timeout_seconds` → `falhou` por tempo esgotado (REQ-4.2).

**Expurgo (REQ-6.2, REQ-6.3)**

Rotina horária (`setInterval` com `unref()`, padrão do limpador de rate limit em
`server/routes.ts:70-73`): seleciona linhas com `expires_at < now()` e `purged_at is null`, apaga o
arquivo (`fs.unlink`, tolerante a já-removido), grava `purged_at`. O registro sem arquivo permanece
como evidência de expurgo. No boot, a mesma rotina roda uma vez — queda do processo não estica a
retenção.

**Exclusão pela titular (REQ-6.4)** — o DELETE executa imediatamente o que o expurgo faria, para a
foto e as provas derivadas.

**Reset de fila no boot** — provas `processando` há mais de 2× o timeout voltam a `na_fila` (mesma
mitigação da fila do estúdio); se a foto de origem já expirou nesse meio-tempo, a prova vai a
`falhou`.

**Troca de cor (REQ-3.8)** — o front guarda o `fotoToken` no estado da sessão; nova cor → novo
`POST /prova` com o mesmo token e o `variantId` da cor. Aceite não se repete: o termo cobre a
sessão de prova, não uma peça específica (e o texto do termo diz isso).

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Reusar `ImageProvider` de `server/estudio/`, generalizada | Cliente HTTP próprio do provador | Dois consumidores, um adaptador; o segundo cliente duplicaria auth, mock e tratamento de erro do mesmo provedor |
| Webhook + polling de segurança | Só polling; só webhook | Webhook dá latência mínima em produção; polling é o único caminho em dev sem URL pública e cobre webhook perdido — os dois convergem na mesma transição idempotente |
| Token UUIDv4 como capacidade + checagem de `sessionId` nas rotas de escrita | Id serial + checagem de sessão (padrão do carrinho) | A foto de corpo é mais sensível que a sacola: o token não-enumerável protege o GET (que precisa funcionar em `<img src>`), e a sessão protege escrita e exclusão |
| Arquivos do provador fora do static, servidos por rota com `no-store` | Servir por `/uploads` estático como o catálogo | O static manda `public, max-age=86400`; um proxy reteria a foto por até 24 h depois do expurgo — o expurgo viraria promessa falsa |
| Prova por peça + cor | Prova por variação completa (tamanho + cor) | O modelo generativo não representa numeração com fidelidade; prometer prova "do tamanho M" seria desonesto. Cor muda a imagem de referência, tamanho não |
| Watermark gravada no arquivo via `sharp` | Selo só como overlay de CSS | Overlay morre no clique-direito-salvar; a honestidade comercial precisa viajar com o arquivo |
| Prompt fixo no servidor | Campo de prompt para a cliente | Prompt livre em rota pública é injection + custo aberto; o provador faz uma única coisa |
| Registro de `tryon_photos`/`tryon_generations` sobrevive ao expurgo (sem arquivo) | Apagar a linha junto com o arquivo | A linha sem PII é a evidência de que o expurgo aconteceu e o lastro dos contadores de limite; apagá-la destruiria a prova de conformidade |
| Contadores de limite por contagem SQL com índice | Contador materializado | Mesmo racional do teto do estúdio: barato no volume esperado e não dessincroniza |
| Foto da peça: `is_tryon_source` → imagem da cor → principal | Sempre a imagem principal | A principal costuma ser foto editorial com modelo; still/cabide gera try-on melhor — a administradora marca a certa com um toggle, e o fallback mantém o recurso funcionando sem curadoria |
| `.jpg` como formato único de saída | Preservar o formato de entrada | Uma rota de resultado, um content-type, watermark uniforme |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Render com caimento irreal ou rosto distorcido | Cliente compra errado e devolve, ou se ofende com a própria imagem | Rótulo de simulação obrigatório (REQ-3.3, REQ-3.4), botão de refazer (REQ-4.3), guia de medidas continua sendo o canal de tamanho |
| Custo do provedor em rota pública | Torneira de dinheiro aberta por bot ou abuso | Três camadas: IP/hora, sessão/dia, teto mensal global (REQ-5.1 … REQ-5.4) + kill-switch `tryon_enabled` |
| Provedor usar imagens para treino | Violação da promessa da política de privacidade | Pergunta em aberto 2: cláusula contratual verificada antes do go-live; sem ela, o texto da política muda ou o recurso não liga |
| Backup do volume retendo fotos após expurgo | Retenção declarada de 24 h vira mentira no backup | Pergunta em aberto 1: excluir `uploads/provador/` da rotina de backup (recomendado) |
| Foto HEIC de iPhone | Upload recusado e cliente frustrada | Safari iOS converte HEIC→JPEG no upload web; o caso residual recebe `formato_invalido` com mensagem pedindo JPEG/PNG |
| `sharp` nunca importado no repo — binário nativo pode falhar na VPS | Upload quebrado só em produção | Task 3 exige evidência de `npm run build` + boot com um upload real no ambiente de deploy |
| Webhook público sem autenticação forte | Falso webhook concluindo prova com imagem alheia | Segredo em comparação de tempo constante (REQ-2.7) + a imagem baixada vem da URL informada pelo **provedor autenticado** na consulta, nunca do corpo do webhook |
| Fila presa após queda do processo | Prova nunca conclui, cliente espera para sempre | Reset no boot (provas `processando` > 2× timeout voltam a `na_fila`) + timeout do lado do cliente com mensagem de erro |
| Colisão de numeração de migrations entre specs | Duas specs pedindo o mesmo número quebram o deploy | Número decidido na implementação ("a próxima livre"), nunca fixado em spec — nota registrada no Modelo de dados |

## Estratégia de teste

O repo não tem infraestrutura de teste (ver CLAUDE.md — Verificação): "integração" abaixo significa
`curl` com resposta colada + `psql`/`ls` conferindo o efeito, salvo se `vitest`/`fast-check` forem
autorizados — nesse caso REQ-2.2, REQ-2.8 e REQ-6.9 são os candidatos a propriedade
(INV-A, INV-D, INV-B). Caminhos tristes do provedor usam `HIGGSFIELD_MOCK_SCENARIO`.

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | manual | Abrir a PDP, acionar "Provar em mim": o termo aparece antes do seletor de arquivo, com finalidade, provedor, prazos e direito de exclusão |
| REQ-1.2 | manual | O modal tem duas marcações independentes; o envio fica desabilitado com qualquer uma desmarcada |
| REQ-1.3 | integração | Upload válido → `SELECT consent_version, consented_at, file_path FROM tryon_photos` preenchidos; arquivo em `uploads/provador/origem/` com nome UUID |
| REQ-1.4 | integração | `curl -F file=@foto.jpg` sem `consentimento` → 400 `consentimento_ausente`; `ls uploads/provador/origem/` sem arquivo novo |
| REQ-1.5 | integração | Upload de `.gif` → 400 `formato_invalido` e nenhum arquivo persistido |
| REQ-1.6 | integração | Arquivo de 12 MB → 413 `arquivo_muito_grande` |
| REQ-1.7 | integração | Subir JPEG com EXIF/GPS → ler o arquivo gravado com one-liner `tsx` + `sharp(f).metadata()`: `exif` ausente e maior lado ≤ 1536 |
| REQ-1.8 | integração | Resposta 201 contém `fotoToken` UUIDv4 e `expiraEm`; nenhum campo `id` numérico |
| REQ-2.1 | integração | `POST /prova` com token da própria sessão → 202 `{provaToken}`; `status='na_fila'` no banco |
| REQ-2.2 | integração | Criar foto na sessão A, `POST /prova` com `sessionId` B → 404 `nao_encontrado`, corpo idêntico ao de token inexistente |
| REQ-2.3 | integração | Peça com imagem `is_tryon_source` → mock registra essa referência; desmarcar e repetir com cor que tem `image_url` → usa a da cor; sem ambas → usa a `is_main` (`garment_image_id` confere em cada caso) |
| REQ-2.4 | integração | Após o worker: `provider_job_id` preenchido e `status='processando'` |
| REQ-2.5 | integração | `tryon_model` fora da allowlist ou `NULL` → o adaptador chama `/v1/text2image/seedream`; conferir o eco de `input_params` na submissão, porque campo desconhecido é descartado em silêncio |
| REQ-2.6 | integração | Simular webhook com segredo correto → arquivo em `uploads/provador/resultado/`, `status='concluida'` |
| REQ-2.7 | integração | Webhook com segredo errado → 401; status no banco inalterado |
| REQ-2.8 | integração/propriedade | Entregar o mesmo webhook 3× (e uma vez após a conclusão) → 1 arquivo, 1 transição, `finished_at` inalterado |
| REQ-2.9 | integração | Sem `PUBLIC_URL`, com mock: a prova conclui pelo poller em até 15 s, mesmo estado final do fluxo com webhook |
| REQ-2.10 | integração | Sem `HIGGSFIELD_KEY_ID`: prova conclui com imagem local; capturar tráfego (`HIGGSFIELD_MOCK=1` + log do adaptador) prova zero chamadas externas |
| REQ-3.1 | integração | `GET /prova/:token` durante o processamento → 200 `{status:"processando"}` |
| REQ-3.2 | manual | A PDP mostra o estado de espera com a indicação "até 60 segundos" enquanto a prova roda |
| REQ-3.3 | manual | Resultado exibido com o rótulo "Simulação gerada por IA — o caimento real pode variar" visível sem hover/clique |
| REQ-3.4 | integração | Baixar `GET /resultado/:token` e abrir: a marca "Simulação · IA" está gravada nos pixels |
| REQ-3.5 | integração | `curl -I /api/provador/resultado/:token` → `Cache-Control: private, no-store` |
| REQ-3.6 | integração | Token UUID inexistente → 404 `nao_encontrado` |
| REQ-3.7 | integração | `GET /api/provador/prova/123` (id numérico) → 404; nenhuma resposta do provador contém `id` serial (inspecionar JSON das rotas públicas) |
| REQ-3.8 | manual | Concluir uma prova, trocar a cor na PDP → o CTA oferece nova prova sem reabrir o termo nem pedir arquivo |
| REQ-4.1 | integração | `HIGGSFIELD_MOCK_SCENARIO=erro` → `status='falhou'`, `error_message` preenchida; segunda prova na fila conclui normalmente |
| REQ-4.2 | integração | `HIGGSFIELD_MOCK_SCENARIO=timeout` com `tryon_timeout_seconds=5` → `falhou` com mensagem de tempo esgotado |
| REQ-4.3 | manual | Após falha, a PDP mostra o erro e o botão "Tentar de novo" dispara nova prova com o mesmo `fotoToken` |
| REQ-4.4 | integração | `HIGGSFIELD_MOCK_SCENARIO=recusada` → `status='recusada'`; a PDP exibe as orientações de foto |
| REQ-4.5 | manual | O modal de envio lista as orientações (corpo inteiro, uma pessoa, boa iluminação) antes do seletor de arquivo |
| REQ-4.6 | integração | Peça sem nenhuma `product_images` → `POST /prova` → 422 `peca_sem_foto`, nenhuma linha criada |
| REQ-5.1 | integração | Loop de 11 `POST /foto` do mesmo IP em 1 min → o 11º responde 429 `limite_de_provas` |
| REQ-5.2 | integração | `tryon_session_daily_limit=2` → a 3ª prova da sessão no dia responde 429 `limite_diario_atingido` |
| REQ-5.3 | integração | Com prova `processando` na sessão → novo `POST /prova` → 409 `prova_em_andamento` |
| REQ-5.4 | integração | `tryon_monthly_limit=2` com 2 provas no mês → a 3ª responde 429 `teto_de_provas_atingido` |
| REQ-5.5 | manual | `tryon_enabled=false` → a PDP não renderiza o botão do provador |
| REQ-5.6 | integração | `tryon_enabled=false` → `POST /foto` e `POST /prova` → 404 |
| REQ-5.7 | integração | Mock informando custo → `provider_cost` gravado na prova concluída |
| REQ-6.1 | integração | `SELECT expires_at - created_at FROM tryon_photos` ≈ `tryon_photo_ttl_hours` |
| REQ-6.2 | integração | Forçar `expires_at` no passado, disparar o expurgo → arquivo fora do disco (`ls`), `purged_at` preenchido |
| REQ-6.3 | integração | Mesmo procedimento para o resultado: arquivo removido, `purged_at` na prova |
| REQ-6.4 | integração | `DELETE /foto/:token` → 204; `ls` sem a foto nem os resultados derivados |
| REQ-6.5 | integração | Após expurgo/exclusão: `GET /prova/:token` e `GET /resultado/:token` → 404 |
| REQ-6.6 | integração | `SELECT count(*) FROM product_images` antes e depois de prova concluída → inalterado; nenhuma URL `uploads/provador/` em `product_images` |
| REQ-6.7 | integração | Varrer as rotas admin (`grep -n "admin" server/routes.ts` + curl nas de imagem): nenhuma devolve caminho `uploads/provador/` |
| REQ-6.8 | integração | Mock captura o pedido: contém 2 referências + prompt fixo; nenhum campo de sessão, pedido ou cadastro |
| REQ-6.9 | integração/propriedade | Rodar upload+prova com stdout capturado → o log não contém token, nome de arquivo nem corpo de requisição do provador |
| REQ-6.10 | integração | Forçar erro do adaptador real com credencial fake → o log não contém `HIGGSFIELD_KEY_SECRET` |
| REQ-6.11 | manual | `/privacidade` contém a seção do provador: provedor, finalidade, prazos, transferência internacional, canal de exclusão |
| REQ-6.12 | integração | `curl /uploads/provador/origem/<arquivo-existente>.jpg` → 404, mesmo com o arquivo no disco |

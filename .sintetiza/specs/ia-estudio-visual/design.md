# Design — Estúdio Visual IA

**Requisitos cobertos:** REQ-1 … REQ-4 · **Spec:** ./requirements.md

## Visão arquitetural

O Estúdio Visual é uma **fila com aprovação humana no fim**. A geração é lenta e cara; a publicação
é uma decisão editorial. Separar as duas coisas é o desenho inteiro.

```
Admin ─→ POST /api/admin/estudio/geracoes ─→ 202 {id}
                                              │
                                        (fila interna)
                                              │
                                   ImageProvider.gerar(foto, preset, n)
                                              │
                        studio_variants (status='pendente', url em uploads/)
                                              │
                          Admin revisa ─→ aprovar ─→ product_images
                                       └─ descartar ─→ status='descartada'
```

`multer` já está configurado para upload em `uploads/` (`server/routes.ts:1223`) e `sharp` já é
dependência — o redimensionamento e a normalização de proporção reaproveitam o mesmo caminho usado
no upload de foto de produto.

Nova pasta: `server/estudio/` com `types.ts` (interface `ImageProvider`), `index.ts` (registry),
`<provedor>.ts`, `service.ts`, `queue.ts`.

## Modelo de dados

Migration nova: `migrations/021_estudio_visual.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `studio_presets` | `id serial pk`, `name text not null`, `background text not null`, `pose text`, `framing text`, `extra_prompt text`, `active bool default true`, `created_at` | REQ-2.1, REQ-2.5 |
| `studio_generations` | `id serial pk`, `product_id int`, `source_image_url text not null`, `preset_id int`, `preset_snapshot jsonb not null`, `variant_count int not null default 2 check (variant_count between 1 and 4)`, `status text not null default 'na_fila'` (`na_fila`/`processando`/`concluida`/`falhou`), `provider text`, `provider_cost numeric(10,4)`, `error_message text`, `requested_by int not null`, `created_at`, `finished_at` | REQ-1.1 … REQ-1.3, REQ-1.7, REQ-2.2, REQ-2.4, REQ-3.1, REQ-3.2, REQ-3.6 |
| `studio_variants` | `id serial pk`, `generation_id int not null`, `url text not null`, `position int not null default 0`, `status text not null default 'pendente'` (`pendente`/`aprovada`/`descartada`), `product_image_id int`, `reviewed_by int`, `reviewed_at timestamptz` | REQ-1.2, REQ-4.2 … REQ-4.7 |
| `store_settings` (alter) | `+ studio_provider text`, `+ studio_api_key_encrypted bytea`, `+ studio_monthly_limit int default 1500`, `+ studio_timeout_seconds int default 120` | REQ-3.2, REQ-3.4, REQ-3.5 |

`preset_snapshot` guarda a cópia dos parâmetros no momento da geração — é o que garante REQ-2.4
sem versionar a tabela de presets.

Índices: `idx_studio_generations_status` em `status` (fila); `idx_studio_generations_created` em
`created_at` (contagem mensal, REQ-3.4); `idx_studio_variants_generation` em `generation_id`.

A chave de API do provedor é cifrada com o mesmo utilitário do certificado fiscal
(AES-256-GCM, chave derivada de variável de ambiente) e nunca aparece em resposta nem em log (REQ-3.5).

## Contratos de API

Todas as rotas exigem `requireAdmin` (REQ-1.6, REQ-4.6).

### POST /api/admin/estudio/geracoes — atende REQ-1.1 … REQ-1.7, REQ-2.2, REQ-2.3, REQ-3.4

- **Request:** `multipart/form-data` com `file` (ou `sourceImageUrl` de imagem já enviada),
  `presetId`, `variantCount?` (1..4), `productId?`
- **202:** `{ generationId, status: "na_fila" }`
- **400:** `formato_invalido` (REQ-1.4), `preset_inexistente` (REQ-2.3)
- **401:** sem sessão — verificado antes de qualquer chamada ao provedor (REQ-1.6)
- **413:** `arquivo_muito_grande` acima de 10 MB, limite aplicado no `multer` (REQ-1.5)
- **429:** `teto_de_geracoes_atingido` quando a contagem do mês corrente atinge `studio_monthly_limit`
  (REQ-3.4) — verificado com `count(*) FROM studio_generations WHERE created_at >= date_trunc('month', now())`
- `variantCount` acima de 4 é reduzido a 4 pela constraint e pela validação zod (REQ-1.3)

### GET /api/admin/estudio/geracoes/:id — atende REQ-1.2, REQ-4.1

- **200:** `{ id, status, sourceImageUrl, presetSnapshot, variants: [{id, url, status}], error? }`
- A tela faz *polling* a cada 5 s enquanto `status` for `na_fila` ou `processando`

### POST /api/admin/estudio/geracoes/:id/reprocessar — atende REQ-3.3

- **202:** cria nova geração reaproveitando `source_image_url` e `preset_snapshot`, sem novo upload

### POST /api/admin/estudio/variantes/:id/aprovar — atende REQ-4.2, REQ-4.3, REQ-4.6

- **Request:** `{ productId: number, asMain?: boolean, altText?: string }`
- **201:** `{ productImageId }`
- Transação: insere em `product_images` → grava `studio_variants.product_image_id`, `status='aprovada'`,
  `reviewed_by`, `reviewed_at`. Com `asMain: true`, zera `is_main` das demais imagens da peça e
  marca a nova (REQ-4.3)

### POST /api/admin/estudio/variantes/:id/descartar — atende REQ-4.4

- **200:** `status='descartada'`, `reviewed_by`, `reviewed_at`

### CRUD /api/admin/estudio/presets — atende REQ-2.1, REQ-2.5

- `DELETE` com gerações vinculadas → `active = false` em vez de remover (REQ-2.5)

## Fluxos

**Geração**

1. Upload validado (formato e tamanho) → `sharp` normaliza para no máximo 2048 px no maior lado e
   grava em `uploads/estudio/origem/`.
2. `studio_generations` criada com `status='na_fila'` e `preset_snapshot` copiado. Resposta 202.
3. Worker retira da fila:
   ```sql
   UPDATE studio_generations SET status='processando'
    WHERE id IN (SELECT id FROM studio_generations WHERE status='na_fila'
                  ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
   RETURNING *;
   ```
   `SKIP LOCKED` impede que dois workers peguem a mesma geração.
4. `ImageProvider.gerar()` com timeout de `studio_timeout_seconds`. Sucesso → as imagens são baixadas,
   normalizadas por `sharp` para 3:4 (a mesma proporção da vitrine) e gravadas em
   `uploads/estudio/saida/`; uma linha em `studio_variants` por imagem; `status='concluida'`.
5. Erro ou timeout → `status='falhou'` com `error_message`; a fila continua com as demais (REQ-3.1, REQ-3.2).

**Aprovação**

A tela mostra a foto de origem à esquerda e as variações à direita, no mesmo tamanho (REQ-4.1).
Aprovar insere em `product_images`; descartar apenas marca. Nenhuma variação chega à loja sem passar
por aqui, porque a vitrine lê `product_images` e não `studio_variants` (REQ-4.5) — é uma separação
de tabelas, não uma regra de filtro que alguém possa esquecer numa consulta nova.

**Remoção da galeria (REQ-4.7):** apagar a imagem da peça remove a linha de `product_images` e zera
`studio_variants.product_image_id`, mantendo a variação e seu histórico.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Variação e imagem de produto em tabelas separadas | Gerar direto em `product_images` com flag `aprovada` | Separar torna impossível uma consulta nova da vitrine exibir imagem não aprovada por esquecer o filtro |
| `preset_snapshot` copiado na geração | Referência ao preset com versionamento | Snapshot resolve REQ-2.4 com uma coluna, sem tabela de versões |
| Fila com `FOR UPDATE SKIP LOCKED` | Flag `processando` sem trava | Flag sem trava permite dois workers na mesma geração e custo dobrado no provedor |
| Resposta 202 com *polling* | Requisição síncrona ou WebSocket | Síncrona estoura timeout de proxy; WebSocket é infraestrutura a mais para uma tela usada algumas vezes por coleção |
| Teto mensal verificado por contagem, sem contador materializado | Coluna de contador incrementada por geração | Contagem com índice em `created_at` é barata no volume esperado e não dessincroniza |
| Imagens em `uploads/`, no mesmo volume dos produtos | Bucket de objeto externo | O deploy é uma VPS com volume local já incluído no backup; um bucket acrescentaria credencial e rotina de cópia |
| Normalização para 3:4 na entrada da galeria | Aceitar a proporção que o provedor devolver | Grade da vitrine assume proporção fixa; imagem fora do padrão quebra o layout da coleção |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Imagem gerada com caimento irreal da peça | Cliente recebe algo diferente do que viu e devolve | Aprovação humana obrigatória (REQ-4.2) e orientação, no manual de operação, de usar a geração para composição e ambiente — a foto real da peça permanece na galeria |
| Custo do provedor acima do previsto na mensalidade | Margem do contrato de sustentação corroída | Teto mensal configurável (REQ-3.4) e `provider_cost` registrado por geração para acompanhamento |
| Provedor mudando de API ou saindo do ar | Módulo inteiro parado | Interface `ImageProvider` com adaptador isolado; trocar de provedor não toca em fila, aprovação nem galeria |
| Volume de imagens enchendo o disco da VPS | Servidor sem espaço, aplicação cai | Variações descartadas removidas do disco por rotina mensal, mantendo o registro no banco; monitoramento de disco no epic `implantacao-golive` |
| Fila travada com geração em `processando` após queda do processo | Geração nunca conclui e o teto do mês consome à toa | Ao subir, o servidor devolve a `na_fila` toda geração em `processando` há mais de 2× o timeout |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | `POST /estudio/geracoes` → 202 com `generationId` e `status='na_fila'` no banco |
| REQ-1.2 | integração | Provedor *fake* devolvendo 2 imagens → 2 linhas em `studio_variants` com URL preenchida |
| REQ-1.3 | integração | `variantCount: 7` → validação recusa com 400; `variantCount: 4` → 4 variações |
| REQ-1.4 | integração | Subir um `.gif` → 400 `formato_invalido` e nenhuma geração criada |
| REQ-1.5 | integração | Arquivo de 12 MB → 413 `arquivo_muito_grande` |
| REQ-1.6 | integração | `POST` sem sessão → 401 e o *fake* do provedor não recebe chamada |
| REQ-1.7 | integração | `SELECT requested_by, created_at FROM studio_generations WHERE id=…` preenchidos |
| REQ-2.1 | integração | Criar preset → aparece em `GET /estudio/presets` |
| REQ-2.2 | integração | Geração com preset → `preset_id` e `preset_snapshot` gravados |
| REQ-2.3 | integração | `presetId: 9999` → 400 `preset_inexistente` |
| REQ-2.4 | integração | Editar o preset → o `preset_snapshot` da geração anterior permanece com os valores antigos |
| REQ-2.5 | integração | `DELETE` de preset com geração vinculada → `active=false` e a linha continua no banco |
| REQ-3.1 | integração | *Fake* retornando erro → `status='falhou'` com `error_message`; outra geração na fila conclui normalmente |
| REQ-3.2 | integração | *Fake* com atraso maior que o timeout → `status='falhou'` e `error_message` citando tempo esgotado |
| REQ-3.3 | integração | `POST /reprocessar` → nova geração com o mesmo `source_image_url`, sem upload |
| REQ-3.4 | integração | Teto em 2 com 2 gerações no mês → a terceira responde 429 `teto_de_geracoes_atingido` |
| REQ-3.5 | unitário | Executar a geração com logger capturado: a saída não contém a chave de API |
| REQ-3.6 | integração | *Fake* informando custo → `provider_cost` gravado |
| REQ-4.1 | manual | A tela exibe a foto de origem e as variações lado a lado, no mesmo tamanho |
| REQ-4.2 | integração | Aprovar variação → linha em `product_images`, `studio_variants.status='aprovada'` e `reviewed_by` preenchido |
| REQ-4.3 | integração | Aprovar com `asMain: true` → a nova imagem tem `is_main=true` e a anterior `false` |
| REQ-4.4 | integração | Descartar → `status='descartada'` e a imagem não aparece em `GET /api/store/products/:slug` |
| REQ-4.5 | integração | Com 3 variações pendentes, a resposta pública da peça não contém nenhuma URL de `uploads/estudio/saida/` |
| REQ-4.6 | integração | `POST /aprovar` sem sessão → 401 |
| REQ-4.7 | integração | Remover a imagem da galeria → `product_images` perde a linha e `studio_variants` mantém a variação com `product_image_id` nulo |

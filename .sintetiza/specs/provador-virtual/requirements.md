# Requisitos — Provador Virtual

**Projeto:** VIVI · **Plane:** módulo "Provador Virtual" (a criar) · **Origem:** referência de mercado do dono do repo — PDP da Carol Bassi; lacuna declarada no epic `ia-estudio-visual` ("prova virtual da peça no corpo da cliente" está fora de escopo lá e é exatamente este epic)
**Status:** rascunho

## Contexto

A cliente que navega a PDP não sabe como a peça cai **nela** — a foto de catálogo mostra a peça em
manequim ou modelo. O Provador Virtual deixa a cliente enviar uma foto de corpo inteiro na página da
peça e ver a peça vestida nela, gerada por IA. O que muda: menos dúvida antes de comprar e menos
troca por expectativa errada — desde que a imagem seja **rotulada como simulação**, porque cliente
que compra achando que é foto real devolve. A foto de corpo de uma pessoa identificável é dado
pessoal sensível na prática, e a cliente é uma consumidora anônima, não uma usuária logada: LGPD é
requisito de primeira classe deste epic (REQ-1 e REQ-6), com o mesmo rigor que o INV-B dá ao pedido.

Este epic consome a mesma interface `ImageProvider` prevista no design do `ia-estudio-visual`
(`server/estudio/`) — é outro consumidor do mesmo adaptador, não um segundo cliente HTTP. As
generalizações necessárias na interface estão no `design.md`.

## Glossário

| Termo | Definição |
|---|---|
| Prova | Uma geração de imagem da cliente vestindo a peça; corresponde a uma linha em `tryon_generations` |
| Foto da cliente | Foto de corpo inteiro enviada pela consumidora na PDP (no estúdio, "foto de origem" é a foto **da peça** — aqui os termos são distintos de propósito) |
| Foto da peça | Imagem da galeria do produto usada como referência de vestuário na geração |
| Fonte de prova | Imagem da galeria marcada pela administradora como a melhor referência da peça para o provador (ideal: still/cabide com a peça inteira visível) |
| Token | Identificador UUIDv4 (122 bits aleatórios) que dá acesso a uma foto ou prova; é a única chave exposta em rota pública |
| Termo de consentimento | Texto específico do provador, versionado, aceito antes do upload — não é o banner de cookies |
| Sessão | A mesma sessão anônima da sacola (`sessionId` do `CartContext`) |
| Titular | A pessoa da foto, no sentido da LGPD — dona dos direitos de acesso e exclusão |
| Expurgo | Remoção automática e verificável do arquivo do disco após o prazo de retenção |
| Simulação | A imagem gerada — nunca apresentada como foto real |
| Provedor | Higgsfield, acessado pela REST API (`https://platform.higgsfield.ai`) |
| Mock | Modo local sem chamada externa (`HIGGSFIELD_MOCK=1` ou credencial ausente), no padrão `MP_MOCK`/`ASAAS_MOCK`/`SMARTENVIOS_MOCK` |

## Fora de escopo

- Geração de imagem de catálogo (manequim/modelo virtual, presets de marca) — é o epic `ia-estudio-visual`; este epic cobre exatamente o item que lá está fora de escopo, e os dois se complementam sem sobreposição
- Recomendação de tamanho a partir de medidas do corpo
- Conta de cliente, login ou histórico de provas entre dispositivos — a titular é anônima e exerce seus direitos pelo token da sessão
- Prova em vídeo ou em movimento
- Compartilhamento social integrado do resultado
- Prova no PDV físico

---

## REQ-1 — Consentimento específico e envio da foto da cliente

**Como** cliente na página da peça, **quero** entender exatamente o que acontece com a minha foto
antes de enviá-la, **para** decidir com clareza — e o sistema só pode tratá-la depois do meu aceite.

**Critérios de aceite**

- **REQ-1.1** — QUANDO a cliente aciona "Provar em mim" na PDP de uma peça publicada, O SISTEMA DEVE exibir o termo de consentimento específico do provador — finalidade, provedor de IA, prazos de retenção e direito de exclusão — antes de permitir a seleção de arquivo
- **REQ-1.2** — QUANDO o termo é exibido, O SISTEMA DEVE exigir duas marcações independentes: o aceite do tratamento da foto e a declaração de que a titular tem 18 anos ou mais e é a pessoa que aparece na foto
- **REQ-1.3** — QUANDO o upload chega com as duas marcações e arquivo válido, O SISTEMA DEVE gravar a foto em `uploads/provador/origem/` com nome UUIDv4 e registrar a versão do termo aceito e a data/hora do aceite
- **REQ-1.4** — SE o upload chega sem qualquer uma das duas marcações, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"consentimento_ausente"}` e não persistir o arquivo
- **REQ-1.5** — SE o arquivo não é JPEG, PNG ou WebP, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"formato_invalido"}` e não persistir o arquivo
- **REQ-1.6** — SE o arquivo excede 10 MB, ENTÃO O SISTEMA DEVE responder HTTP 413 `{"error":"arquivo_muito_grande"}`
- **REQ-1.7** — QUANDO a foto é aceita, O SISTEMA DEVE regravá-la sem nenhum metadado EXIF (inclusive GPS) e redimensionada para no máximo 1536 px no maior lado
- **REQ-1.8** — QUANDO a foto é gravada, O SISTEMA DEVE responder HTTP 201 com o token UUIDv4 da foto e o momento de expiração — nenhum id serial na resposta

## REQ-2 — Geração da prova

**Como** cliente, **quero** ver a peça vestida em mim a partir da minha foto, **para** avaliar o
caimento antes de comprar.

**Critérios de aceite**

- **REQ-2.1** — QUANDO uma prova é solicitada com token de foto válido da própria sessão e peça publicada, O SISTEMA DEVE criar a prova com status `na_fila` e responder HTTP 202 com o token da prova
- **REQ-2.2** — SE o token de foto pertence a outra sessão ou não existe, ENTÃO O SISTEMA DEVE responder HTTP 404 `{"error":"nao_encontrado"}` sem revelar se a foto existe (INV-A)
- **REQ-2.3** — QUANDO a prova é processada, O SISTEMA DEVE enviar ao provedor a foto da cliente e a foto da peça escolhida nesta ordem de preferência: imagem marcada como fonte de prova → imagem da variação da cor selecionada → imagem principal da peça
- **REQ-2.4** — QUANDO o provedor aceita o job, O SISTEMA DEVE registrar o identificador do job do provedor e mudar o status para `processando`
- **REQ-2.5** — ONDE `store_settings.tryon_model` está configurado com um modelo da lista permitida, O SISTEMA DEVE usar esse modelo na chamada ao provedor; sem configuração, DEVE usar `seedream`
- **REQ-2.6** — QUANDO o webhook de conclusão chega com o segredo correto, O SISTEMA DEVE baixar a imagem do provedor, gravá-la com a marca de simulação e mudar o status para `concluida`
- **REQ-2.7** — SE o webhook chega com segredo ausente ou incorreto, ENTÃO O SISTEMA DEVE responder HTTP 401 e não alterar estado nenhum
- **REQ-2.8** — QUANDO o mesmo webhook é entregue N vezes, O SISTEMA DEVE produzir o mesmo efeito de uma entrega única, inclusive fora de ordem (INV-D)
- **REQ-2.9** — ONDE o webhook não está configurado ou não chegou, O SISTEMA DEVE concluir a prova por consulta periódica ao provedor (polling), com o mesmo efeito final do webhook
- **REQ-2.10** — ONDE `HIGGSFIELD_MOCK=1` ou a credencial do provedor está ausente, O SISTEMA DEVE operar em modo mock, concluindo a prova com imagem local e sem nenhuma chamada de rede externa

## REQ-3 — Espera, resultado e honestidade comercial

**Como** cliente, **quero** acompanhar a prova e ver o resultado na própria página da peça, **para**
não perder o contexto de compra — e **como** marca, **quero** que o resultado esteja rotulado como
simulação, **para** que ninguém compre achando que é foto real.

**Critérios de aceite**

- **REQ-3.1** — ENQUANTO a prova está em `na_fila` ou `processando`, QUANDO o status é consultado pelo token, O SISTEMA DEVE responder HTTP 200 com o status atual
- **REQ-3.2** — ENQUANTO a prova não conclui, O SISTEMA DEVE exibir na PDP o estado de espera com a indicação de que a prova leva até 60 segundos
- **REQ-3.3** — QUANDO a prova conclui, O SISTEMA DEVE exibir o resultado na PDP com o rótulo "Simulação gerada por IA — o caimento real pode variar" visível sem nenhuma interação adicional
- **REQ-3.4** — O SISTEMA DEVE gravar no próprio arquivo de resultado uma marca visual de simulação, presente também quando a imagem é baixada ou compartilhada
- **REQ-3.5** — QUANDO o arquivo de resultado é servido, O SISTEMA DEVE responder com `Cache-Control: private, no-store`
- **REQ-3.6** — SE o token consultado não existe ou já expirou, ENTÃO O SISTEMA DEVE responder HTTP 404 `{"error":"nao_encontrado"}`
- **REQ-3.7** — O SISTEMA DEVE expor foto e prova em rota pública apenas por token UUIDv4 — nenhuma rota pública do provador aceita ou devolve id serial
- **REQ-3.8** — QUANDO a cliente troca a cor da peça com foto ainda válida na sessão, O SISTEMA DEVE oferecer nova prova sem exigir novo upload nem novo aceite

## REQ-4 — Falhas do provedor e da foto

**Como** cliente, **quero** saber o que deu errado e como corrigir, **para** não abandonar a página
achando que a loja quebrou.

**Critérios de aceite**

- **REQ-4.1** — SE o provedor retorna erro, ENTÃO O SISTEMA DEVE marcar a prova como `falhou`, persistir a mensagem do provedor e continuar processando as demais provas da fila
- **REQ-4.2** — SE a prova não conclui em `tryon_timeout_seconds` (padrão 180), ENTÃO O SISTEMA DEVE marcá-la como `falhou` por tempo esgotado
- **REQ-4.3** — QUANDO uma prova falha, O SISTEMA DEVE exibir na PDP mensagem de erro com ação de tentar de novo reaproveitando a mesma foto, sem novo upload
- **REQ-4.4** — SE o provedor recusa a entrada por moderação de conteúdo (sem pessoa, mais de uma pessoa, conteúdo impróprio), ENTÃO O SISTEMA DEVE marcar a prova como `recusada` e exibir a orientação: foto de corpo inteiro, uma única pessoa, fundo liso
- **REQ-4.5** — QUANDO o modal de envio é exibido, O SISTEMA DEVE apresentar as orientações de foto (corpo inteiro, uma única pessoa, boa iluminação) antes da seleção do arquivo
- **REQ-4.6** — SE a peça não tem nenhuma imagem na galeria, ENTÃO O SISTEMA DEVE responder HTTP 422 `{"error":"peca_sem_foto"}` e não criar a prova

## REQ-5 — Limites de uso e teto de custo

**Como** dono da operação, **quero** limites por IP, por sessão e globais, **para** que uma rota
pública que gasta dinheiro por chamada não vire torneira aberta — ao contrário do estúdio, que é
admin, aqui qualquer visitante dispara custo.

**Critérios de aceite**

- **REQ-5.1** — SE um IP excede 10 requisições de upload ou de prova em 60 minutos, ENTÃO O SISTEMA DEVE responder HTTP 429 `{"error":"limite_de_provas"}`
- **REQ-5.2** — SE uma sessão excede `tryon_session_daily_limit` (padrão 8) provas no mesmo dia, ENTÃO O SISTEMA DEVE responder HTTP 429 `{"error":"limite_diario_atingido"}`
- **REQ-5.3** — SE a sessão já tem prova em `na_fila` ou `processando`, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"prova_em_andamento"}` à nova solicitação
- **REQ-5.4** — QUANDO a contagem de provas do mês corrente atinge `tryon_monthly_limit` (padrão 1000), O SISTEMA DEVE recusar novas provas com HTTP 429 `{"error":"teto_de_provas_atingido"}`
- **REQ-5.5** — ONDE `tryon_enabled = false`, O SISTEMA DEVE não renderizar o botão do provador na PDP
- **REQ-5.6** — ONDE `tryon_enabled = false`, O SISTEMA DEVE responder HTTP 404 nas rotas de criação de foto e de prova
- **REQ-5.7** — QUANDO uma prova conclui, O SISTEMA DEVE registrar o custo informado pelo provedor, quando ele for informado

## REQ-6 — Retenção, expurgo e direitos da titular (LGPD)

**Como** titular, **quero** que minha foto viva o mínimo necessário, possa ser apagada por mim e
nunca apareça fora da minha sessão de prova, **para** confiar meu corpo a uma loja sem virar dado
de catálogo, de admin nem de treino de modelo.

**Critérios de aceite**

- **REQ-6.1** — QUANDO a foto da cliente é gravada, O SISTEMA DEVE registrar sua expiração em `tryon_photo_ttl_hours` (padrão 24) à frente do momento do upload
- **REQ-6.2** — QUANDO a expiração da foto passa, a rotina de expurgo (executada a cada hora) DEVE remover o arquivo do disco e registrar o momento do expurgo no banco
- **REQ-6.3** — QUANDO a expiração do resultado passa (`tryon_result_ttl_hours`, padrão 168), a rotina de expurgo DEVE remover o arquivo do disco e registrar o momento do expurgo
- **REQ-6.4** — QUANDO a titular aciona "apagar minha foto", O SISTEMA DEVE remover do disco a foto e todos os resultados gerados a partir dela e responder HTTP 204
- **REQ-6.5** — QUANDO um arquivo foi expurgado ou apagado, a consulta seguinte pelo token DEVE responder HTTP 404
- **REQ-6.6** — O SISTEMA DEVE não inserir foto da cliente nem resultado de prova em `product_images` — a foto nunca entra no catálogo
- **REQ-6.7** — O SISTEMA DEVE não expor foto da cliente nem resultado de prova em nenhuma rota administrativa
- **REQ-6.8** — O SISTEMA DEVE enviar ao provedor apenas a foto saneada da cliente, a foto da peça e o prompt fixo — nenhum dado cadastral, de pedido ou de sessão
- **REQ-6.9** — O SISTEMA DEVE não gravar em log corpo de requisição, caminho de arquivo nem token das rotas do provador (extensão do INV-B: log de corpo só em catálogo)
- **REQ-6.10** — O SISTEMA DEVE não gravar em log a credencial do provedor
- **REQ-6.11** — QUANDO a página `/privacidade` é renderizada, O SISTEMA DEVE conter a seção do provador virtual informando o provedor, a finalidade, os prazos de retenção, a transferência internacional de dados e o canal de exclusão
- **REQ-6.12** — O SISTEMA DEVE não servir `uploads/provador/` pelo static público `/uploads` — todo acesso a arquivo do provador passa por rota que valida o token

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Provedor Higgsfield via REST com `fetch` direto, sem SDK | Decisão do dono do repo; nenhuma dependência nova — o repo já integra MercadoPago, Asaas e SmartEnvios com cliente próprio |
| 2 | Modelo de geração configurável (`tryon_model`), padrão **`seedream`**, allowlist de modelos que aceitam ≥ 2 imagens de referência | O try-on exige foto da pessoa + foto da peça. **Corrigido em 2026-08-11 contra a API real:** na REST do Higgsfield o *endpoint é o modelo* (`/v1/text2image/<modelo>`), e só `seedream` preserva duas referências — `soul` tem um slot único e descarta o excedente **em silêncio**. `nano_banana_pro` e `gpt_image_2` existem no app do provedor, não nesta API |
| 3 | Consentimento específico e versionado em modal próprio, não no banner de cookies | LGPD exige finalidade específica; o `CookieConsent.tsx` cobre analytics, não tratamento de foto de corpo |
| 4 | Menoridade tratada por declaração obrigatória de maioridade no termo | Verificação documental de idade é desproporcional para uma prova de roupa; a declaração + proibição nos termos é o tratamento praticável |
| 5 | Prova é por peça + cor, não por tamanho | Tamanho não muda o render de forma confiável; cor muda a foto de referência. A grade de tamanhos continua no fluxo normal da PDP |
| 6 | Retenção curta: foto da cliente 24 h, resultado 7 dias, configuráveis | A foto de origem não deve sobreviver à sessão de prova; 24 h cobre a sessão de compra sem virar acervo. O resultado dura o ciclo de decisão |
| 7 | Token UUIDv4 como única chave pública; arquivos fora do static | IDs seriais são enumeráveis (mesma razão do INV-A do carrinho); static público com cache de 24 h reteria a foto depois do expurgo |
| 8 | Titular anônima exerce direitos pelo token da sessão, sem cadastro | Exigir conta para apagar a própria foto seria barreira ao direito da LGPD, não proteção |
| 9 | Prompt fixo montado no servidor; a cliente não digita texto | Elimina prompt injection e custo de abuso criativo; o provador faz uma coisa só |
| 10 | Watermark de simulação gravada no arquivo, além do rótulo na tela | Imagem baixada ou compartilhada fora da loja continua honesta |
| 11 | `tryon_enabled` nasce `false` | O recurso só liga quando credencial de produção, política de privacidade e textos legais estiverem no ar |
| 12 | EXIF (inclusive GPS) removido no ingresso, foto reduzida a 1536 px | Minimização de dados: o provedor recebe o mínimo necessário para gerar |
| 13 | Limites assumidos: 10/h por IP, 8/dia por sessão, 1000/mês global | Teto de custo operável no padrão do estúdio (`studio_monthly_limit`); valores revisáveis em configuração sem deploy |

## Perguntas em aberto

Para o dono do repo decidir — nenhuma bloqueia a implementação das tasks 1–7:

1. **Backup do volume**: `uploads/` é backupeado; manter `uploads/provador/` **fora** da rotina de backup (recomendado — cópia de foto de corpo sobrevivendo ao expurgo contradiz a retenção declarada) ou aceitar que o backup retém até a rotação?
2. **Termos do Higgsfield sobre treino de modelo**: confirmar na contratação a cláusula de não uso das imagens para treinamento e refleti-la no texto da política de privacidade (REQ-6.11). Se o plano contratado não garantir isso, o texto precisa dizer o contrário — e o dono decide se o recurso vai ao ar assim.
3. **Valores finais dos limites e TTLs**: 10/h, 8/dia, 1000/mês, 24 h/7 dias foram assumidos; revisar contra o custo real por geração no plano contratado.
4. **Modelo padrão**: ~~`nano_banana_pro` assumido~~ — **resolvido em 2026-08-11**: piloto com peça real (`vn-03`) e foto de pessoa validou `seedream`, único multi-referência da API REST. Rever se o provedor expuser `nano_banana_pro` na REST, que rendeu resultado equivalente pelo app.
5. **Texto final do termo de consentimento e da seção de privacidade**: redação jurídica é do dono/advogado; a spec fixa o conteúdo mínimo, não a redação.

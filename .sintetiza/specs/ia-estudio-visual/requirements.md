# Requisitos — Estúdio Visual IA

**Projeto:** VIVI · **Plane:** módulo "Estúdio Visual IA" · **Origem:** pré-projeto Viviane Nosralla, Bloco C2
**Status:** rascunho

## Contexto

Cada coleção nova exige produção fotográfica para a loja virtual e para o Instagram — custo e tempo
que atrasam a peça chegando à vitrine. O Estúdio Visual gera, a partir da foto da peça no cabide ou
em still, visualizações em manequim ou modelo virtual, com variações de fundo, pose e enquadramento.
A imagem gerada passa por aprovação humana antes de ir para a loja: a marca é curadoria, e imagem
publicada sem revisão contradiz exatamente o que a vitrine promete.

## Glossário

| Termo | Definição |
|---|---|
| Foto de origem | Imagem da peça enviada pela operação, no cabide ou em still |
| Geração | Pedido de criação de imagem enviado ao provedor, com uma foto de origem e um preset |
| Preset | Conjunto salvo de parâmetros de fundo, pose e enquadramento alinhados ao conceito da marca |
| Variação | Cada imagem produzida por uma geração |
| Aprovação | Decisão humana de publicar ou descartar uma variação |
| Galeria do produto | Conjunto de imagens exibidas na página da peça (`product_images`) |

## Fora de escopo

- Prova virtual da peça no corpo da cliente
- Edição manual de imagem dentro do sistema
- Geração de vídeo
- Publicação automática no Instagram

---

## REQ-1 — Geração a partir da foto da peça

**Como** administradora, **quero** gerar imagens da peça em manequim, **para** publicar a coleção sem
produção fotográfica.

**Critérios de aceite**

- **REQ-1.1** — QUANDO uma geração é solicitada com uma foto de origem e um preset, O SISTEMA DEVE registrá-la com status `na_fila` e responder HTTP 202 com o identificador da geração
- **REQ-1.2** — QUANDO a geração é processada, O SISTEMA DEVE persistir cada variação produzida com a URL da imagem e vinculá-la à geração
- **REQ-1.3** — QUANDO o número de variações é informado, O SISTEMA DEVE produzir esse número, limitado a no máximo 4 por geração
- **REQ-1.4** — SE a foto de origem não é JPEG, PNG ou WebP, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"formato_invalido"}` e não criar a geração
- **REQ-1.5** — SE a foto de origem excede 10 MB, ENTÃO O SISTEMA DEVE responder HTTP 413 `{"error":"arquivo_muito_grande"}`
- **REQ-1.6** — SE a geração é solicitada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não enviar nada ao provedor
- **REQ-1.7** — QUANDO uma geração é criada, O SISTEMA DEVE registrar a usuária solicitante e o momento da solicitação

## REQ-2 — Presets da marca

**Como** administradora, **quero** presets alinhados ao conceito da marca, **para** que as imagens
saiam consistentes entre coleções.

**Critérios de aceite**

- **REQ-2.1** — QUANDO um preset é salvo com nome, descrição de fundo, pose e enquadramento, O SISTEMA DEVE persisti-lo e disponibilizá-lo na tela de geração
- **REQ-2.2** — QUANDO uma geração usa um preset, O SISTEMA DEVE registrar qual preset foi usado
- **REQ-2.3** — SE o preset referenciado não existe, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"preset_inexistente"}`
- **REQ-2.4** — SE um preset é editado, ENTÃO O SISTEMA DEVE preservar o registro do preset usado nas gerações anteriores
- **REQ-2.5** — SE um preset é excluído com gerações vinculadas, ENTÃO O SISTEMA DEVE marcá-lo como inativo em vez de removê-lo

## REQ-3 — Falha e custo do provedor

**Como** operação, **quero** que a falha do provedor não trave o trabalho, **para** continuar
cadastrando peça enquanto a geração não volta.

**Critérios de aceite**

- **REQ-3.1** — SE o provedor retorna erro, ENTÃO O SISTEMA DEVE marcar a geração como `falhou`, persistir a mensagem do provedor e não bloquear outras gerações
- **REQ-3.2** — SE o provedor não responde no tempo limite configurado, ENTÃO O SISTEMA DEVE marcar a geração como `falhou` por tempo esgotado
- **REQ-3.3** — QUANDO uma geração falha, O SISTEMA DEVE permitir reenviá-la sem exigir novo upload da foto de origem
- **REQ-3.4** — QUANDO o número de gerações do mês atinge o teto configurado, O SISTEMA DEVE recusar novas gerações com HTTP 429 `{"error":"teto_de_geracoes_atingido"}`
- **REQ-3.5** — O SISTEMA DEVE não gravar em log a chave de API do provedor
- **REQ-3.6** — QUANDO uma geração é concluída, O SISTEMA DEVE registrar o custo informado pelo provedor, quando ele for informado

## REQ-4 — Aprovação e publicação

**Como** administradora, **quero** aprovar a imagem antes de publicar, **para** que só entre na loja
o que está à altura da marca.

**Critérios de aceite**

- **REQ-4.1** — QUANDO as variações de uma geração são apresentadas, O SISTEMA DEVE exibi-las lado a lado com a foto de origem
- **REQ-4.2** — QUANDO uma variação é aprovada para uma peça, O SISTEMA DEVE inseri-la na galeria daquela peça e registrar quem aprovou
- **REQ-4.3** — QUANDO uma variação é aprovada como imagem principal, O SISTEMA DEVE torná-la a imagem principal e rebaixar a anterior
- **REQ-4.4** — SE uma variação é descartada, ENTÃO O SISTEMA DEVE marcá-la como descartada e não exibi-la na loja
- **REQ-4.5** — O SISTEMA DEVE não exibir na loja nenhuma variação que não tenha sido aprovada
- **REQ-4.6** — SE a aprovação é solicitada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401
- **REQ-4.7** — QUANDO uma variação aprovada é removida da galeria, O SISTEMA DEVE mantê-la no histórico da geração

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Provedor de geração acessado por interface `ImageProvider`, com um adaptador | O mercado de geração de imagem muda rápido; interface permite trocar sem tocar na tela nem no fluxo de aprovação |
| 2 | Processamento assíncrono com resposta 202 | Geração leva dezenas de segundos; requisição síncrona seguraria conexão e estouraria timeout de proxy |
| 3 | Aprovação humana obrigatória antes de publicar | A marca é curadoria; imagem gerada publicada direto contradiz a promessa da vitrine |
| 4 | Teto mensal de gerações configurável | A proposta inclui tokens de IA na mensalidade e prevê revisão acima de ~1.500 gerações/mês; o teto é o que torna esse limite operável |
| 5 | Máximo de 4 variações por geração | Além disso a escolha vira ruído e o custo por peça cresce sem ganho de qualidade |
| 6 | Imagens geradas armazenadas no mesmo diretório de uploads da plataforma | `uploads/products/` já é servido e incluído no backup; um segundo destino duplicaria a rotina de cópia |
| 7 | Preset excluído vira inativo | Geração antiga precisa continuar dizendo com que parâmetros foi feita |

## Perguntas em aberto

Duas definições operacionais, **não bloqueantes** para a especificação:

1. **Provedor de geração de imagem** a ser usado.
2. **Teto mensal de gerações** — assumido 1.500, alinhado à premissa da proposta comercial.

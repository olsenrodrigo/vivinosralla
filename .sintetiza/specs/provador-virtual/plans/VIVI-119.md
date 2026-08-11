# Plano — VIVI-119: Atualizar a política de privacidade com a seção do provador virtual

**Epic:** provador-virtual · **Atende:** REQ-6.11 · **Gerado em:** 2026-08-11 pela sessão principal (Opus 5)
**Engine de implementação:** Opus, inline — escopo restante é edição de texto em um arquivo; o dev
dispensou o pipeline planejador/executor no Passo 5 do `/iniciar-task`.

## Estado encontrado

A seção "Provador virtual" **já existia** em `client/src/pages/institucional/PrivacidadePage.tsx:11`,
introduzida no commit `2e254af` (VIVI-118), fora do escopo declarado daquela task. Auditando o texto
existente contra os cinco itens que o REQ-6.11 exige:

| Item exigido pelo REQ-6.11 | Estado antes desta task |
|---|---|
| Provedor | ❌ ausente — "um provedor de inteligência artificial parceiro", não nomeado |
| Finalidade | ✅ "tratada apenas para gerar a simulação daquela peça em você" |
| Prazos de retenção | ✅ 24 h (foto) / 7 dias (simulação) |
| Transferência internacional | ✅ "servidores fora do Brasil — exclusivamente para essa finalidade" |
| Canal de exclusão | ✅ botão "Apagar minha foto" na PDP + canal de privacidade da própria página |

Os prazos citados no texto batem com os defaults do schema e da migration:
`tryon_photo_ttl_hours = 24` e `tryon_result_ttl_hours = 168` (`shared/schema.ts:116-117`,
`migrations/014_provador_virtual.sql:77-78`).

Logo, o trabalho da task é **fechar o único item faltante**, não redigir a seção.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `client/src/pages/institucional/PrivacidadePage.tsx` | Nomeia o Higgsfield como provedor na seção do provador; atualiza a data de "Última atualização" |

## Passos

1. Na entrada `["Provador virtual", …]` do array `secoes`, trocar
   "é enviada a um provedor de inteligência artificial parceiro" por
   "é enviada ao **Higgsfield**, provedor de inteligência artificial parceiro".
   Nomear o provedor é literalmente o que o critério pede, e é a leitura da LGPD sobre
   transparência na transferência internacional (art. 33).
2. Atualizar "Última atualização" de 4 para 11 de agosto de 2026 — o conteúdo da política mudou de
   forma material (seção nova + provedor nomeado), e a data é uma declaração à titular.

## Decisões

| Decisão | Motivo |
|---|---|
| Provedor citado pela marca ("Higgsfield"), não pela razão social | O dev escolheu a forma curta no Passo 5. A razão social do contrato não está no repo; se o jurídico pedir, entra numa emenda junto com o CNPJ da loja, já pendente no go-live |
| Nome do provedor fixo no texto, não lido de configuração | A `ImageProvider` é generalizada (VIVI-112) e o provedor é trocável em código, mas trocar de provedor é mudança contratual que obriga revisão da política e nova data de atualização de qualquer jeito. Texto legal derivado de config daria a falsa impressão de que a troca é automática |
| Escopo restrito à seção do provador | Regra 15 do harness. A seção "Compartilhamento" cita "plataformas de tecnologia" genericamente e continua válida; o REQ-6.11 fala só da seção do provador |

## Riscos e armadilhas

- **A afirmação de não-treino não está contratualmente confirmada.** O texto (herdado da VIVI-118)
  afirma que a foto "não é usada para treinar modelos de inteligência artificial". A **pergunta em
  aberto 2** do `requirements.md` condiciona isso à cláusula do contrato com o Higgsfield: sem ela, o
  texto precisa dizer o contrário e o dono decide se o recurso vai ao ar. Não bloqueia a task —
  `tryon_enabled` nasce `false` (`shared/schema.ts:111`), nada está no ar — mas é **gate de go-live**.
- **Redação jurídica final é do dono/advogado** (pergunta em aberto 5). A spec fixa o conteúdo
  mínimo, não a redação; esta task entrega o conteúdo mínimo completo.

## Verificação

REQ-6.11 é `manual` na Estratégia de teste (`design.md:333`). Verificação:

1. `npm run check` — tsc limpo.
2. `npm run build` — gera `dist/index.cjs`.
3. `curl` na `/privacidade` servida e conferência dos cinco itens no texto renderizado
   (SPA: a checagem do conteúdo é feita no bundle/fonte que alimenta a rota).

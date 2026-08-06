# Design — Assistente de Vendas com CRM Integrado

**Requisitos cobertos:** REQ-1 … REQ-5 · **Spec:** ./requirements.md

## Visão arquitetural

O assistente é um **agente com ferramentas**, não um chatbot com respostas prontas. Todo dado que
ele afirma vem de uma chamada de ferramenta ao banco no momento da conversa; nada de catálogo é
embutido no prompt, porque preço e saldo mudam a cada venda.

```
WhatsApp ─→ POST /api/webhooks/whatsapp ─→ (200 imediato) ─→ fila em memória
                                                               │
                                              AssistenteService.processar(conversationId)
                                                               │
                                    ┌──────────────────────────┼─────────────────────────┐
                              buscarPecas()            consultarDisponibilidade()   perfilCliente()
                              criarPedido()            gerarLinkPagamento()         solicitarHumano()
                                    └──────────────────────────┴─────────────────────────┘
                                                               │
                                          Claude (Anthropic) ─→ resposta ─→ WhatsApp
```

`server/notify.ts` já implementa o envio por WhatsApp (usado em `server/routes.ts:1506`);
`store_settings.whatsapp_token` e `whatsapp_phone_id` (`shared/schema.ts:100`) já existem. O que
este epic acrescenta é o **recebimento** (webhook), a persistência de conversa e o laço do agente.

Nova pasta: `server/assistente/` com `webhook.ts`, `service.ts`, `tools.ts`, `prompt.ts`, `reguas.ts`.

O `templateabandonedMessageTemplate` e a régua manual de carrinho abandonado já existentes
(`server/routes.ts:1506`, `client/src/pages/admin/AbandonedCarts.tsx`) passam a ser o caminho de
disparo automático — a tela continua, agora como visão e não como acionamento único.

## Modelo de dados

Migration nova: `migrations/020_assistente.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `conversations` | `id serial pk`, `phone text not null unique`, `customer_id int`, `status text not null default 'bot'` (`bot`/`handoff`/`encerrada`), `last_inbound_at timestamptz`, `last_outbound_at timestamptz`, `summary text`, `created_at` | REQ-1.4, REQ-5.1 … REQ-5.5, REQ-1.6 |
| `messages` | `id serial pk`, `conversation_id int not null`, `direction text not null` (`in`/`out`), `wa_message_id text`, `body text`, `tool_calls jsonb`, `status text` (`enviada`/`falhou`), `attempts int default 0`, `created_at`, unique(`wa_message_id`) | REQ-1.3, REQ-1.4, REQ-1.5, REQ-5.2 |
| `optouts` | `id serial pk`, `phone text not null unique`, `reason text`, `created_at` | REQ-4.6, REQ-4.7 |
| `campaign_sends` | `id serial pk`, `type text not null` (`carrinho`/`rastreio`/`avaliacao`), `origin_type text not null`, `origin_id int not null`, `phone text not null`, `sent_at timestamptz default now()`, unique(`type`,`origin_type`,`origin_id`,`phone`) | REQ-4.2, REQ-4.3, REQ-4.5 |
| `store_settings` (alter) | `+ whatsapp_webhook_secret text`, `+ assistant_enabled bool default false`, `+ cart_recovery_hours int default 4`, `+ cart_recovery_second_hours int default 24`, `+ review_request_days int default 7`, `+ whatsapp_reserve_minutes int default 30` | REQ-1.2, REQ-3.2, REQ-4.1, REQ-4.5 |

`messages.wa_message_id UNIQUE` é o que garante REQ-1.3 no banco.
`campaign_sends` com `UNIQUE(type, origin_type, origin_id, phone)` é o que garante REQ-4.2 e REQ-4.5:
a mesma régua nunca dispara duas vezes para a mesma origem.

Índices: `idx_conversations_status` em `status` (fila de handoff, REQ-5.4);
`idx_messages_conversation_created` em (`conversation_id`,`created_at`);
`idx_conversations_customer` em `customer_id` (REQ-5.2).

## Contratos de API

### POST /api/webhooks/whatsapp — atende REQ-1.1 … REQ-1.4

- **Autenticação:** assinatura `X-Hub-Signature-256` (HMAC-SHA256 do corpo com
  `whatsapp_webhook_secret`), comparada em tempo constante. Divergente → 401 (REQ-1.2)
- **200 imediato**, antes de qualquer processamento; a mensagem entra numa fila em memória com
  processamento sequencial por conversa (REQ-1.1)
- **Idempotência:** `INSERT INTO messages (wa_message_id, …) ON CONFLICT DO NOTHING`; sem inserção,
  a mensagem é descartada (REQ-1.3)
- **GET** no mesmo caminho responde ao desafio de verificação da Meta

### GET /api/admin/conversas — atende REQ-5.4, REQ-5.6

- **Query:** `status?=bot|handoff`
- **200:** `[{ id, cliente, telefoneMascarado, status, ultimaMensagemEm, resumo }]`
- **401:** sem sessão (REQ-5.6)
- Telefone devolvido mascarado (`(16) 9****-7463`) na listagem

### POST /api/admin/conversas/:id/handoff · /devolver — atende REQ-5.3, REQ-5.5

- **200:** `{ status }` — `handoff` bloqueia a resposta automática; `devolver` retoma

### GET /api/admin/customers/:id/conversas — atende REQ-5.2

- **200:** `[{ conversationId, data, canal, resumo, mensagens: n }]`

## Ferramentas do agente

Cada ferramenta é uma função tipada, com validação zod na entrada, executada no servidor. O agente
não tem acesso ao banco fora delas.

| Ferramenta | Entrada | Retorno | Atende |
|---|---|---|---|
| `buscarPecas` | `{ termo?, categoria?, tamanho?, cor?, precoMax? }` | até 5 peças com nome, preço, tamanhos e cores **com saldo disponível** | REQ-2.1, REQ-2.4 |
| `detalharPeca` | `{ slug }` | composição, medidas por tamanho, cores, disponibilidade por variação | REQ-2.2, REQ-2.3 |
| `perfilCliente` | `{ }` — o telefone vem do contexto, **nunca do modelo** | tamanhos preferidos, últimas 5 compras, crédito disponível | REQ-2.5, REQ-2.7 |
| `recomendar` | `{ ocasiao?, categoria? }` | peças em destaque e mais vendidas quando não há histórico | REQ-2.6 |
| `criarPedido` | `{ itens: [{variantId, quantity}], entrega: {cep, numero, complemento?} }` | `{ orderNumber, total, linkPagamento, reservaAte }` | REQ-3.1, REQ-3.2, REQ-3.7 |
| `solicitarHumano` | `{ motivo }` | marca `conversations.status='handoff'` | REQ-5.3 |

**Isolamento por titular (REQ-2.7):** `perfilCliente` e `criarPedido` derivam o `customer_id` do
telefone da conversa, resolvido no servidor. O modelo não recebe nem consegue informar um
`customerId` — não existe parâmetro para isso. É a construção que torna o vazamento entre clientes
impossível por desenho, não por instrução no prompt.

**Campos nunca expostos (REQ-2.8):** as ferramentas selecionam colunas explicitamente e jamais
retornam `cost_per_item`, `variants.cost`, `markup`, `suggested_price` nem `internal_notes`.

**Preço e desconto (REQ-3.6):** `criarPedido` lê o preço vigente da variação no banco. Não há
parâmetro de preço nem de desconto na assinatura da ferramenta.

## Fluxos

**Atendimento**

1. Webhook → 200 → mensagem persistida → enfileirada.
2. `AssistenteService.processar()` carrega as últimas 20 mensagens da conversa, o perfil resolvido
   pelo telefone e o prompt de sistema (tom de voz da marca, o que pode e o que não pode).
3. Laço do agente com no máximo 6 chamadas de ferramenta por turno — teto que evita laço infinito
   e custo descontrolado.
4. Resposta enviada por `notify.ts`. Falha → nova tentativa em 5 s, 30 s e 120 s; após a terceira,
   `messages.status='falhou'` e log com `conversationId` apenas (REQ-1.5, REQ-5.7).
5. `conversations.summary` é atualizado a cada 10 mensagens, para a ficha da cliente e a fila de
   handoff terem contexto sem carregar o histórico inteiro.

**Janela de 24 horas (REQ-1.6)**

Antes de todo envio, `now() - conversations.last_inbound_at > 24h` decide entre texto livre e modelo
aprovado. Toda régua ativa cai nesse caminho por definição.

**Fechamento de pedido (REQ-3.1 … REQ-3.5)**

`criarPedido` chama o mesmo serviço do checkout: valida disponibilidade → reserva
(`whatsapp_reserve_minutes`) → cria `orders` com `channel='whatsapp'` → gera link via
`CobrancaService`. Variação indisponível na confirmação → a ferramenta retorna erro estruturado e o
agente informa, sem criar pedido (REQ-3.3). O webhook do Asaas, ao confirmar, dispara a mensagem de
confirmação na conversa (REQ-3.4); a expiração da reserva dispara o aviso único, controlado por
`campaign_sends` (REQ-3.5).

**Réguas (REQ-4)**

Job a cada 15 minutos. Para cada régua:

```
elegíveis = SELECT … WHERE <condição da régua>
              AND phone NOT IN (SELECT phone FROM optouts)              -- REQ-4.7
              AND NOT EXISTS (SELECT 1 FROM campaign_sends cs
                              WHERE cs.type=… AND cs.origin_id=… AND cs.phone=…)  -- REQ-4.2/4.5
```

Uma consulta por régua, sem laço de verificação por destinatária. `INSERT INTO campaign_sends`
acontece **antes** do envio: uma falha de envio não reenvia na rodada seguinte, o que é preferível a
enviar duas vezes para a cliente.

Detecção de opt-out: a mensagem recebida passa por uma verificação de expressões de descadastro
antes de ir ao agente; casando, grava `optouts` e responde a confirmação (REQ-4.6).

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Ferramentas de leitura direta no banco | RAG com embeddings do catálogo | Saldo e preço mudam a cada venda; índice vetorial responderia com dado velho — o erro que o módulo existe para eliminar |
| `customer_id` derivado do telefone no servidor | Passar `customerId` como parâmetro de ferramenta | Parâmetro controlado pelo modelo é a porta de IDOR entre clientes; sem o parâmetro, o vazamento é impossível por construção |
| Sem parâmetro de preço ou desconto em `criarPedido` | Permitir e validar limites | Validar depois ainda deixa o assistente prometer na conversa o que o sistema recusa |
| Webhook responde 200 antes de processar | Processar de forma síncrona | A Meta reentrega ao passar de alguns segundos; processar antes de responder gera duplicidade e custo dobrado de modelo |
| `campaign_sends` gravado antes do envio | Gravar após o sucesso | Duplicar mensagem para a cliente é pior que perder uma; a falha fica visível no log e no painel |
| Teto de 6 chamadas de ferramenta por turno | Laço livre até o modelo concluir | Limite de custo e de latência; acima disso a conversa vai para handoff |
| Opt-out verificado em consulta única na régua | Verificar dentro do laço de envio | Verificação em laço é N+1 e, mais grave, é o tipo de checagem que uma régua nova esquece |
| Conteúdo de mensagem nunca em log | Log completo para depuração | Conversa de venda contém dado pessoal e preferência; a depuração usa `conversationId` e a tabela `messages` |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Assistente afirmar disponibilidade que muda entre a resposta e a confirmação | Cliente decide comprar peça que acabou | `criarPedido` revalida a disponibilidade e reserva na mesma operação; a resposta de busca sempre reflete a consulta do momento |
| Custo de tokens crescendo com o volume de conversa | Mensalidade estourada, contra a premissa de tokens inclusos | Teto de 6 ferramentas por turno, contexto de 20 mensagens, resumo periódico; a proposta já prevê revisão acima de ~3.000 conversas/mês |
| Número do WhatsApp Business bloqueado por reclamação de spam | Canal de venda inteiro fora do ar | Consentimento verificado antes de toda mensagem ativa, teto de 2 mensagens por carrinho e opt-out imediato |
| Assistente respondendo por cima da atendente humana | Cliente recebe duas respostas divergentes | `status='handoff'` bloqueia o processamento automático; devolver é ação explícita |
| Alucinação de medida ou composição em peça sem cadastro | Troca por informação errada e desgaste com a cliente | REQ-2.3 exige recusa explícita; o prompt de sistema proíbe estimar e as ferramentas retornam `null` em vez de aproximar |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | `POST /api/webhooks/whatsapp` responde em ≤ 3 s medidos, com o processamento ainda pendente na fila |
| REQ-1.2 | integração | POST com assinatura inválida → 401 e `count(*)` de `messages` inalterado |
| REQ-1.3 | integração | Reenviar o mesmo `wa_message_id` → 200 e uma única linha em `messages` |
| REQ-1.4 | integração | Após o webhook → `conversations` e `messages` gravadas com o telefone da remetente |
| REQ-1.5 | integração | Notificador falhando 3 vezes → 3 tentativas registradas, `status='falhou'` e log só com `conversationId` |
| REQ-1.6 | unitário | `escolherModoEnvio(lastInbound: agora−25h)` devolve `template`; `agora−2h` devolve `livre` |
| REQ-1.7 | integração | POST com corpo fora do esquema da Meta → 400 e `count(*)` de `conversations` e `messages` inalterado |
| REQ-2.1 | integração | Variação com saldo 2 → `buscarPecas` a inclui; zerar o saldo e repetir → não aparece |
| REQ-2.2 | integração | `detalharPeca` devolve `composition` e `measurements` iguais aos do banco |
| REQ-2.3 | integração | Peça sem `measurements` → a ferramenta devolve `null` e a resposta do agente não contém número de medida |
| REQ-2.4 | integração | Cenário com saldo 0 → nenhuma resposta do agente afirma disponibilidade daquela variação |
| REQ-2.5 | integração | Cliente com histórico de tamanho M → `perfilCliente` devolve `preferredSizes` e as últimas compras |
| REQ-2.6 | integração | Telefone sem cadastro → `recomendar` devolve peças `featured` e mais vendidas |
| REQ-2.7 | unitário | A assinatura de `perfilCliente` não aceita `customerId`; o `customer_id` usado é o resolvido do telefone da conversa |
| REQ-2.8 | unitário | Retornos de `buscarPecas` e `detalharPeca` não contêm `cost`, `costPerItem`, `markup` nem `suggestedPrice` |
| REQ-2.9 | unitário | Chamar `buscarPecas({precoMax: "abc"})` devolve erro estruturado e o mock de banco não recebe consulta |
| REQ-3.1 | integração | `criarPedido` → pedido com `channel='whatsapp'` e `payment_links` vinculado |
| REQ-3.2 | integração | Após `criarPedido` → `stock_reservations` com `expires_at ≈ now + whatsapp_reserve_minutes` e o prazo citado na mensagem |
| REQ-3.3 | integração | Zerar o saldo entre a busca e a confirmação → a ferramenta devolve erro e `count(*)` de `orders` não muda |
| REQ-3.4 | integração | Webhook de pagamento → nova mensagem `out` na conversa confirmando |
| REQ-3.5 | integração | Expirar a reserva → 1 mensagem de aviso e 1 linha em `campaign_sends`; rodar o job de novo não envia outra |
| REQ-3.6 | unitário | A assinatura de `criarPedido` não tem parâmetro de preço nem de desconto; o total é recalculado do banco |
| REQ-3.7 | integração | Pedido com entrega e sem CEP → a ferramenta recusa e o agente pergunta o endereço |
| REQ-4.1 | integração | Carrinho parado há 5 h com consentimento → 1 mensagem com itens e link |
| REQ-4.2 | integração | Rodar o job 5 vezes → no máximo 2 linhas em `campaign_sends` para aquele carrinho |
| REQ-4.3 | integração | Converter o carrinho → o job seguinte não envia mais nada para ele |
| REQ-4.4 | integração | Mudar o pedido para `shipped` com rastreio → mensagem enviada com o código |
| REQ-4.5 | integração | Pedido entregue há 8 dias → 1 pedido de avaliação; repetir o job não envia outro |
| REQ-4.6 | integração | Mensagem "não quero mais receber" → linha em `optouts` e nenhuma mensagem ativa posterior para o telefone |
| REQ-4.7 | integração | Telefone sem `marketing_consent_at` → nenhuma régua o inclui |
| REQ-5.1 | integração | Telefone sem cadastro conversando → `customers` ganha 1 linha e `conversations.customer_id` é preenchido |
| REQ-5.2 | integração | `GET /api/admin/customers/:id/conversas` traz data, canal e resumo |
| REQ-5.3 | integração | Ferramenta `solicitarHumano` → `status='handoff'` e a mensagem seguinte da cliente não gera resposta automática |
| REQ-5.4 | integração | `GET /api/admin/conversas?status=handoff` lista a conversa |
| REQ-5.5 | integração | `POST /devolver` → `status='bot'` e a resposta automática volta |
| REQ-5.6 | integração | `GET /api/admin/conversas` sem sessão → 401 |
| REQ-5.7 | unitário | Processar uma conversa com logger capturado: a saída não contém o corpo da mensagem nem o telefone |

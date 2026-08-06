# Requisitos — Assistente de Vendas com CRM Integrado

**Projeto:** VIVI · **Plane:** módulo "Assistente de Vendas com CRM" · **Origem:** pré-projeto Viviane Nosralla, Bloco C1
**Status:** rascunho

## Contexto

Todo o público da marca está no Instagram e converte por DM, uma conversa de cada vez, no horário em
que alguém está disponível para responder. O gargalo não é demanda, é atendimento. Este epic coloca
no WhatsApp um assistente que consulta o catálogo e o estoque **de verdade** — responde sobre
tamanho, medida, composição e disponibilidade lendo o banco, não uma lista estática — recomenda
peças a partir do histórico da cliente, gera o link de pagamento e fecha o pedido dentro da conversa.
Cada conversa vira histórico na ficha da cliente.

## Glossário

| Termo | Definição |
|---|---|
| Assistente | Agente de IA que atende no WhatsApp em nome da marca |
| Ferramenta | Função que o assistente pode executar para consultar ou alterar dados do sistema |
| Conversa | Sequência de mensagens trocadas com um mesmo telefone |
| Handoff | Transferência da conversa para atendimento humano |
| Régua | Sequência automática de mensagens disparada por um evento de negócio |
| Janela de 24 horas | Período após a última mensagem da cliente em que a API do WhatsApp permite mensagem livre |
| Opt-out | Manifestação da cliente de que não quer mais receber mensagens |

## Fora de escopo

- Atendimento por DM do Instagram — o canal contratado é o WhatsApp
- Geração de imagem das peças — vive no epic `ia-estudio-visual`
- Cobrança de consignado por iniciativa do assistente — decisão do epic `consignado` é que a cobrança é humana
- Atendimento em idioma diferente do português

---

## REQ-1 — Canal WhatsApp

**Como** cliente, **quero** conversar com a marca no WhatsApp, **para** comprar no aplicativo que já
uso.

**Critérios de aceite**

- **REQ-1.1** — QUANDO o WhatsApp entrega uma mensagem no webhook, O SISTEMA DEVE responder HTTP 200 em até 3 segundos e processar a mensagem de forma assíncrona
- **REQ-1.2** — SE a assinatura do webhook não confere com o segredo configurado, ENTÃO O SISTEMA DEVE responder HTTP 401 e descartar a mensagem
- **REQ-1.3** — QUANDO a mesma mensagem é entregue mais de uma vez, O SISTEMA DEVE processá-la uma única vez
- **REQ-1.4** — QUANDO uma mensagem é recebida, O SISTEMA DEVE persistir a conversa e a mensagem vinculadas ao telefone da remetente
- **REQ-1.5** — SE o envio de uma resposta falha, ENTÃO O SISTEMA DEVE registrar a falha com o identificador da conversa e tentar novamente no máximo 3 vezes com intervalo crescente
- **REQ-1.6** — SE a última mensagem da cliente tem mais de 24 horas, ENTÃO O SISTEMA DEVE enviar apenas modelo de mensagem aprovado, e não texto livre
- **REQ-1.7** — SE o corpo do webhook não passa na validação de esquema, ENTÃO O SISTEMA DEVE responder HTTP 400 e não criar conversa nem mensagem

## REQ-2 — Consulta ao catálogo e ao estoque real

**Como** cliente, **quero** perguntar se tem no meu tamanho e receber a resposta certa, **para** não
combinar uma compra de peça que acabou.

**Critérios de aceite**

- **REQ-2.1** — QUANDO a cliente pergunta sobre disponibilidade de uma peça, O SISTEMA DEVE consultar o saldo disponível da variação no banco e responder com a disponibilidade apurada no momento da consulta
- **REQ-2.2** — QUANDO a cliente pergunta sobre medidas ou composição, O SISTEMA DEVE responder a partir dos campos cadastrados na peça
- **REQ-2.3** — SE a peça consultada não tem a informação cadastrada, ENTÃO O SISTEMA DEVE informar que não tem o dado e oferecer o contato humano, em vez de estimar
- **REQ-2.4** — O SISTEMA DEVE não afirmar disponibilidade de variação com saldo disponível igual a zero
- **REQ-2.5** — QUANDO a cliente pede recomendação, O SISTEMA DEVE considerar o histórico de compras e os tamanhos preferidos registrados na ficha dela
- **REQ-2.6** — SE a cliente não tem histórico, ENTÃO O SISTEMA DEVE recomendar a partir das peças em destaque e das mais vendidas
- **REQ-2.7** — O SISTEMA DEVE não expor a outra cliente nenhum dado pessoal, histórico ou pedido que não pertença ao telefone da conversa
- **REQ-2.8** — O SISTEMA DEVE não informar custo, markup nem margem de nenhuma peça
- **REQ-2.9** — SE a entrada de uma ferramenta não passa na validação de esquema, ENTÃO O SISTEMA DEVE devolver erro estruturado ao agente e não executar a consulta no banco

## REQ-3 — Fechamento do pedido na conversa

**Como** cliente, **quero** receber o link e pagar sem sair do WhatsApp, **para** comprar na hora em
que decidi.

**Critérios de aceite**

- **REQ-3.1** — QUANDO a cliente confirma as peças, O SISTEMA DEVE criar o pedido com canal `whatsapp` e gerar o link de pagamento correspondente
- **REQ-3.2** — QUANDO o pedido é criado pela conversa, O SISTEMA DEVE reservar o estoque das variações pelo prazo configurado e informar o prazo na mensagem
- **REQ-3.3** — SE alguma variação perde disponibilidade entre a recomendação e a confirmação, ENTÃO O SISTEMA DEVE informar a indisponibilidade e não criar o pedido
- **REQ-3.4** — QUANDO o pagamento é confirmado, O SISTEMA DEVE avisar a cliente na conversa
- **REQ-3.5** — SE a reserva expira sem pagamento, ENTÃO O SISTEMA DEVE liberar o estoque e informar a cliente uma única vez
- **REQ-3.6** — O SISTEMA DEVE não conceder desconto nem alterar preço por decisão do assistente
- **REQ-3.7** — QUANDO o pedido exige endereço de entrega, O SISTEMA DEVE coletar CEP, número e complemento antes de gerar o link

## REQ-4 — Réguas de carrinho abandonado e pós-venda

**Como** operação, **quero** recuperar carrinho e acompanhar o pós-venda automaticamente, **para**
não perder venda por esquecimento.

**Critérios de aceite**

- **REQ-4.1** — QUANDO um carrinho fica sem atividade pelo prazo configurado e há telefone com consentimento registrado, O SISTEMA DEVE enviar uma mensagem de recuperação com os itens e o link do carrinho
- **REQ-4.2** — O SISTEMA DEVE enviar no máximo 2 mensagens de recuperação por carrinho
- **REQ-4.3** — SE o carrinho é convertido em pedido, ENTÃO O SISTEMA DEVE interromper a régua de recuperação daquele carrinho
- **REQ-4.4** — QUANDO um pedido muda para enviado, O SISTEMA DEVE enviar o código de rastreio à cliente
- **REQ-4.5** — QUANDO um pedido é entregue há mais dias que o prazo configurado, O SISTEMA DEVE enviar uma solicitação de avaliação uma única vez
- **REQ-4.6** — SE a cliente responde com pedido de descadastro, ENTÃO O SISTEMA DEVE registrar o opt-out e não enviar mais mensagem ativa para aquele telefone
- **REQ-4.7** — SE não há consentimento registrado para o telefone, ENTÃO O SISTEMA DEVE não enviar mensagem ativa

## REQ-5 — Registro no CRM e handoff

**Como** vendedora, **quero** ver o que o assistente conversou e assumir quando precisar, **para**
que o atendimento humano continue de onde a máquina parou.

**Critérios de aceite**

- **REQ-5.1** — QUANDO uma conversa acontece, O SISTEMA DEVE vinculá-la à ficha da cliente identificada pelo telefone e criar a ficha se ela não existir
- **REQ-5.2** — QUANDO a ficha da cliente é aberta no painel, O SISTEMA DEVE listar as conversas dela com data, canal e resumo
- **REQ-5.3** — QUANDO a cliente pede atendimento humano, O SISTEMA DEVE marcar a conversa como em handoff e parar de responder automaticamente
- **REQ-5.4** — QUANDO uma conversa está em handoff, O SISTEMA DEVE sinalizá-la na fila de atendimento do painel
- **REQ-5.5** — QUANDO a atendente devolve a conversa ao assistente, O SISTEMA DEVE retomar as respostas automáticas
- **REQ-5.6** — SE a fila de atendimento é acessada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401
- **REQ-5.7** — O SISTEMA DEVE não gravar em log o conteúdo das mensagens nem o telefone da cliente

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Assistente com ferramentas de leitura no banco, sem base vetorial de catálogo | Disponibilidade e preço mudam a cada venda; índice vetorial fica defasado e responderia com saldo velho, que é exatamente o erro que o módulo existe para eliminar |
| 2 | O assistente nunca escreve preço nem desconto por conta própria | Preço vem do banco; assistente que negocia margem é risco comercial sem controle |
| 3 | Criação de pedido pelo assistente reusa `CobrancaService` e a reserva do checkout | Um caminho de pedido só; duplicar a lógica de reserva no agente criaria uma segunda fonte de erro de estoque |
| 4 | Handoff explícito, com bloqueio de resposta automática | Assistente respondendo por cima da atendente humana é a falha mais visível para a cliente |
| 5 | Opt-out em tabela própria, verificado antes de toda mensagem ativa | LGPD e política do WhatsApp Business; a verificação centralizada evita que uma régua nova esqueça a checagem |
| 6 | Mensagem ativa fora da janela de 24 h usa modelo aprovado | Exigência da API do WhatsApp Business; texto livre fora da janela é rejeitado pela plataforma |
| 7 | Conteúdo das mensagens fica no banco e nunca em log | Conversa de venda contém dado pessoal e preferência de compra |

## Perguntas em aberto

Três definições operacionais **não bloqueantes** para a especificação, necessárias antes da execução:

1. **Número do WhatsApp Business** a ser usado e se ele será o mesmo do atendimento atual — assumido que sim, `(16) 99173-7463`.
2. **Prazo de inatividade** que dispara a recuperação de carrinho — assumido 4 horas para a primeira mensagem e 24 horas para a segunda.
3. **Prazo pós-entrega** para pedir avaliação — assumido 7 dias.

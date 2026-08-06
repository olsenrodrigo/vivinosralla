# Requisitos — Base Única de Clientes e Painel de Indicadores

**Projeto:** VIVI · **Plane:** módulo "Base Única de Clientes e Indicadores" · **Origem:** pré-projeto Viviane Nosralla, Blocos B5 e B11
**Status:** rascunho

## Contexto

A cliente que compra na loja e a cliente que compra pela DM são a mesma pessoa, mas hoje são dois
registros que não se falam — quando existem. Ninguém sabe o ticket médio real, quais tamanhos a
cliente calça, quando é o aniversário dela, nem quanto de crédito de troca ela tem. E, no plano do
negócio, não existe visão de margem por peça, de giro nem de curva ABC: a decisão de repor ou
liquidar é tomada por intuição. Este epic entrega as duas camadas de consulta que fecham o sistema —
a ficha única da cliente e o painel que transforma o operacional em número.

## Glossário

| Termo | Definição |
|---|---|
| Ficha 360 | Visão consolidada de uma cliente com contato, preferências, crédito e histórico de compras dos dois canais |
| Canal | Origem da venda: `online`, `loja`, `consignado` ou `whatsapp` |
| Ticket médio | Valor total vendido dividido pelo número de vendas, no recorte consultado |
| Margem | Diferença entre preço de venda e custo, apurada por item vendido |
| Giro | Número de unidades vendidas de uma peça em um período dividido pelo saldo médio do período |
| Curva ABC | Classificação por participação no faturamento acumulado: A até 80%, B até 95%, C o restante |
| Titular | A pessoa a quem os dados pessoais se referem, na acepção da LGPD |

## Fora de escopo

- Programa de fidelidade e cashback (previsto como evolução de Fase 2)
- Segmentação automática e disparo de campanha de marketing
- Relatório contábil ou fiscal — o painel é gerencial
- Exportação de relatórios em PDF; a saída é tela e CSV

---

## REQ-1 — Cadastro único de cliente

**Como** operação, **quero** que a cliente do balcão e a cliente da loja virtual sejam o mesmo
registro, **para** ter um histórico só.

**Critérios de aceite**

- **REQ-1.1** — QUANDO uma cliente é cadastrada com CPF já existente na base, O SISTEMA DEVE reutilizar o registro existente e complementar os campos vazios com os dados informados
- **REQ-1.2** — QUANDO uma cliente é cadastrada sem CPF mas com telefone já existente na base, O SISTEMA DEVE reutilizar o registro existente
- **REQ-1.3** — QUANDO uma cliente é cadastrada com CPF e telefone que não existem na base, O SISTEMA DEVE criar um registro novo
- **REQ-1.4** — SE o CPF informado não passa na validação de dígito verificador, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"cpf_invalido"}` e não criar nem alterar registro
- **REQ-1.5** — SE o telefone informado não tem entre 10 e 11 dígitos após a remoção de máscara, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"telefone_invalido"}`
- **REQ-1.6** — QUANDO duas fichas de cliente são unificadas manualmente, O SISTEMA DEVE transferir pedidos, créditos e consignações para o registro mantido e marcar o outro como inativo
- **REQ-1.7** — SE uma rota de escrita de cliente é chamada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401

## REQ-2 — Ficha 360 da cliente

**Como** vendedora, **quero** abrir a ficha da cliente e ver tudo sobre ela, **para** atender com
contexto em vez de perguntar de novo.

**Critérios de aceite**

- **REQ-2.1** — QUANDO a ficha de uma cliente é requisitada, O SISTEMA DEVE retornar contato, data de nascimento, tamanhos preferidos, observações, saldo de crédito de troca e o histórico de compras de todos os canais em ordem cronológica decrescente
- **REQ-2.2** — QUANDO a ficha é requisitada, O SISTEMA DEVE retornar o total comprado, o número de compras e o ticket médio da cliente
- **REQ-2.3** — QUANDO a ficha é requisitada, O SISTEMA DEVE resolver o histórico e os agregados em no máximo 3 consultas, sem consulta por pedido
- **REQ-2.4** — QUANDO a administradora registra tamanhos preferidos e observações, O SISTEMA DEVE persisti-los e apresentá-los na ficha
- **REQ-2.5** — SE a ficha requisitada não existe, ENTÃO O SISTEMA DEVE responder HTTP 404
- **REQ-2.6** — SE a ficha é requisitada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não revelar se a cliente existe
- **REQ-2.7** — QUANDO clientes com aniversário no mês corrente são consultadas, O SISTEMA DEVE retorná-las ordenadas pelo dia do mês

## REQ-3 — LGPD: consentimento, exportação e exclusão

**Como** titular, **quero** saber o que a loja guarda sobre mim e poder pedir exclusão, **para**
exercer os direitos que a lei me dá.

**Critérios de aceite**

- **REQ-3.1** — QUANDO uma cliente é cadastrada, O SISTEMA DEVE registrar a base legal do tratamento e, quando houver consentimento para comunicação, a data e a origem do aceite
- **REQ-3.2** — QUANDO a exportação dos dados de uma cliente é solicitada, O SISTEMA DEVE gerar um arquivo com cadastro, endereços, pedidos, créditos e consignações daquela cliente
- **REQ-3.3** — QUANDO a exclusão de uma cliente é solicitada, O SISTEMA DEVE anonimizar nome, e-mail, telefone, CPF e endereços, preservando os valores e as datas dos pedidos
- **REQ-3.4** — QUANDO uma cliente é anonimizada, O SISTEMA DEVE registrar a data da anonimização e quem a executou
- **REQ-3.5** — SE a exclusão é solicitada para cliente com consignação em aberto, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"consignacao_em_aberto"}` e não anonimizar
- **REQ-3.6** — O SISTEMA DEVE não gravar em log nome, e-mail, telefone nem CPF de cliente em nenhuma rota deste epic
- **REQ-3.7** — SE a exportação ou a exclusão é solicitada por usuária de papel diferente de `admin`, ENTÃO O SISTEMA DEVE responder HTTP 403

## REQ-4 — Indicadores de venda

**Como** proprietária, **quero** ver quanto vendi, por onde e com que margem, **para** decidir com
número em vez de intuição.

**Critérios de aceite**

- **REQ-4.1** — QUANDO os indicadores são consultados para um intervalo de datas, O SISTEMA DEVE retornar faturamento, número de vendas, ticket médio e peças vendidas no intervalo
- **REQ-4.2** — QUANDO os indicadores são consultados, O SISTEMA DEVE quebrar o faturamento por canal
- **REQ-4.3** — QUANDO os indicadores são consultados, O SISTEMA DEVE retornar a margem absoluta e percentual do período, calculada como preço de venda menos custo por item vendido
- **REQ-4.4** — SE algum item vendido no período não tem custo registrado, ENTÃO O SISTEMA DEVE informar a quantidade de itens sem custo junto do resultado, em vez de tratar o custo como zero
- **REQ-4.5** — SE a data inicial informada é posterior à final, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"periodo_invalido"}`
- **REQ-4.6** — QUANDO o intervalo consultado excede 366 dias, O SISTEMA DEVE responder HTTP 400 `{"error":"periodo_muito_longo"}`
- **REQ-4.7** — SE os indicadores são consultados sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401

## REQ-5 — Indicadores de produto

**Como** proprietária, **quero** saber o que gira, o que dá margem e o que está parado, **para**
repor e liquidar na hora certa.

**Critérios de aceite**

- **REQ-5.1** — QUANDO o ranking de produtos é consultado, O SISTEMA DEVE retornar as peças ordenadas por faturamento decrescente, com quantidade vendida, faturamento e margem de cada uma
- **REQ-5.2** — QUANDO a curva ABC é consultada, O SISTEMA DEVE classificar como A as peças que acumulam até 80% do faturamento, como B as que vão até 95% e como C as demais
- **REQ-5.3** — QUANDO o giro é consultado, O SISTEMA DEVE retornar por peça as unidades vendidas no período dividido pelo saldo médio do período
- **REQ-5.4** — QUANDO a margem por coleção é consultada, O SISTEMA DEVE agregar por coleção o faturamento, o custo e a margem percentual
- **REQ-5.5** — QUANDO qualquer indicador de produto é consultado, O SISTEMA DEVE resolvê-lo em uma única consulta agregada, sem consulta por peça
- **REQ-5.6** — QUANDO o desempenho do consignado é consultado, O SISTEMA DEVE retornar consignações abertas, devolvidas e convertidas no período e a taxa de conversão

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Deduplicação por CPF em primeiro lugar, telefone em segundo | CPF é único por pessoa; telefone é o único identificador disponível no atendimento por DM, onde o CPF costuma não ser informado |
| 2 | Exclusão LGPD por anonimização, não por `DELETE` | O pedido precisa continuar existindo para o faturamento e a apuração fiscal; a lei exige a eliminação do dado pessoal, não do registro comercial |
| 3 | Curva ABC calculada sob demanda, sem persistência | Classificação muda a cada venda; coluna materializada exigiria job de recálculo e ficaria defasada entre execuções |
| 4 | Saldo médio do giro aproximado pela média entre saldo inicial e final do período | O cálculo exato exigiria integrar o saldo dia a dia a partir de `stock_movements`; a aproximação é padrão de varejo e suficiente para decidir reposição |
| 5 | Itens sem custo aparecem como contagem separada, não entram na margem | Tratar custo ausente como zero infla a margem e leva a decisão de preço errada |
| 6 | Teto de 366 dias por consulta de indicador | Limita a varredura e cobre o comparativo ano a ano, que é o recorte usado na prática |
| 7 | Tamanhos preferidos como lista de texto na ficha, não como referência a variações | A preferência é "veste M em vestido, G em blusa" — texto estruturado por categoria, não vínculo a SKU |

## Perguntas em aberto

Nenhuma bloqueante. Uma confirmação de negócio antes de operar: se o consentimento de comunicação
por WhatsApp deve ser coletado no cadastro do balcão. Assumido que **sim**, com registro de data e
origem — é o que sustenta a régua de reativação do epic `ia-assistente-vendas`.

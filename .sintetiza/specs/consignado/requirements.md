# Requisitos — Consignado com Controle de Retorno

**Projeto:** VIVI · **Plane:** módulo "Consignado com Controle de Retorno" · **Origem:** pré-projeto Viviane Nosralla, Bloco B4
**Status:** rascunho

## Contexto

O consignado é a operação que hoje não existe em sistema nenhum e é onde a marca perde receita: a
peça sai com a cliente para provar em casa, ninguém registra o que saiu de forma estruturada, e o
que a cliente decide ficar nem sempre vira venda. Quando existe, o registro é um caderno. Este epic
transforma a saída condicional em um ciclo fechado — sai com romaneio, tem prazo, volta com
conferência item a item, e o que ficou vira venda com link de pagamento gerado na hora.

## Glossário

| Termo | Definição |
|---|---|
| Consignação | Saída condicional de uma ou mais peças para uma cliente, com data prevista de retorno |
| Romaneio | Documento que lista as peças que saíram, com SKU, descrição, preço e prazo |
| Retorno | Conferência da consignação em que cada peça é marcada como devolvida ou mantida |
| Peça mantida | Peça que a cliente decidiu ficar; converte em venda |
| Saldo da consignação | Soma dos preços das peças mantidas, a ser cobrada da cliente |
| Prazo vencido | Consignação cuja data prevista de retorno já passou e que ainda está em aberto |

## Fora de escopo

- Consignação para lojista revendedor (o consignado aqui é para a cliente final)
- Comissionamento diferenciado de peça consignada — a comissão segue a regra do PDV
- Cobrança automática recorrente do saldo em aberto; o disparo do link é acionado por pessoa

---

## REQ-1 — Saída condicional

**Como** vendedora, **quero** registrar as peças que a cliente está levando para provar, **para** que
o sistema saiba onde cada peça está.

**Critérios de aceite**

- **REQ-1.1** — QUANDO uma consignação é criada com cliente, itens e data prevista de retorno, O SISTEMA DEVE persistir a consignação com status `aberta` e registrar uma movimentação de estoque do tipo `consignacao_saida` para cada item
- **REQ-1.2** — QUANDO uma peça sai em consignação, O SISTEMA DEVE reduzir o saldo disponível para venda dela na mesma transação da criação da consignação
- **REQ-1.3** — SE algum item solicitado tem saldo disponível menor que a quantidade pedida, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"saldo_insuficiente","sku":"<sku>"}` e não criar a consignação nem movimentar item nenhum
- **REQ-1.4** — SE a consignação é criada sem cliente identificada, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"cliente_obrigatoria"}`
- **REQ-1.5** — SE a data prevista de retorno é anterior à data de criação, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"data_retorno_invalida"}`
- **REQ-1.6** — SE a requisição chega sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não criar consignação
- **REQ-1.7** — QUANDO a consignação é criada, O SISTEMA DEVE registrar a usuária responsável pela saída

## REQ-2 — Romaneio

**Como** vendedora, **quero** entregar à cliente a lista do que ela está levando, **para** que a
conferência no retorno não dependa de memória.

**Critérios de aceite**

- **REQ-2.1** — QUANDO o romaneio de uma consignação é solicitado, O SISTEMA DEVE gerar um documento contendo nome da cliente, data da saída, data prevista de retorno e, para cada item, SKU, descrição, tamanho, cor e preço
- **REQ-2.2** — QUANDO o romaneio é solicitado em formato de impressão, O SISTEMA DEVE responder com `Content-Type: application/pdf`
- **REQ-2.3** — QUANDO o envio por WhatsApp é acionado, O SISTEMA DEVE montar a mensagem com o resumo dos itens e o link do romaneio, e registrar o envio na consignação
- **REQ-2.4** — SE a cliente não tem telefone cadastrado, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"cliente_sem_telefone"}` e não tentar o envio
- **REQ-2.5** — SE o romaneio é solicitado para consignação inexistente, ENTÃO O SISTEMA DEVE responder HTTP 404

## REQ-3 — Retorno e conversão em venda

**Como** vendedora, **quero** conferir no retorno o que voltou e o que ficou, **para** que o que
ficou vire venda sem redigitar nada.

**Critérios de aceite**

- **REQ-3.1** — QUANDO o retorno é registrado com a decisão de cada item, O SISTEMA DEVE gerar movimentação `consignacao_retorno` de entrada para cada peça devolvida
- **REQ-3.2** — QUANDO existem peças mantidas no retorno, O SISTEMA DEVE criar uma venda com canal `consignado` contendo apenas as peças mantidas, e vinculá-la à consignação
- **REQ-3.3** — QUANDO a venda de consignação é criada, O SISTEMA DEVE consumir as peças mantidas do estoque sem gerar segunda saída, mantendo o saldo consistente com a saída já registrada
- **REQ-3.4** — QUANDO todas as peças voltam, O SISTEMA DEVE fechar a consignação com status `devolvida` e não criar venda
- **REQ-3.5** — QUANDO ao menos uma peça é mantida, O SISTEMA DEVE fechar a consignação com status `convertida` e registrar o saldo devido
- **REQ-3.6** — SE a soma das quantidades devolvidas e mantidas de um item difere da quantidade que saiu, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"conferencia_incompleta","sku":"<sku>"}` e não registrar o retorno
- **REQ-3.7** — SE o retorno é registrado em consignação já fechada, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"consignacao_ja_fechada"}`
- **REQ-3.8** — QUANDO o retorno é registrado, O SISTEMA DEVE registrar a usuária responsável pela conferência

## REQ-4 — Cobrança do saldo

**Como** vendedora, **quero** gerar o link de pagamento do que a cliente ficou, **para** receber na
hora, ainda na conversa.

**Critérios de aceite**

- **REQ-4.1** — QUANDO uma consignação é convertida, O SISTEMA DEVE oferecer a geração de link de cobrança com o valor do saldo devido
- **REQ-4.2** — QUANDO o link é gerado, O SISTEMA DEVE vinculá-lo à consignação de origem e à venda criada
- **REQ-4.3** — QUANDO o pagamento do link é confirmado, O SISTEMA DEVE marcar a venda como paga e registrar a baixa no contas a receber
- **REQ-4.4** — SE o saldo devido é zero, ENTÃO O SISTEMA DEVE não permitir a geração do link e responder HTTP 409 `{"error":"sem_saldo_a_cobrar"}`
- **REQ-4.5** — QUANDO a cliente paga parte do saldo na loja em outro meio, O SISTEMA DEVE permitir registrar o recebimento manual e reduzir o saldo em aberto pelo valor recebido

## REQ-5 — Painel de consignados

**Como** proprietária, **quero** ver o que está na rua e o que passou do prazo, **para** cobrar antes
de virar prejuízo.

**Critérios de aceite**

- **REQ-5.1** — QUANDO o painel de consignados é requisitado, O SISTEMA DEVE listar as consignações abertas com cliente, quantidade de peças, valor total, data de saída e data prevista de retorno
- **REQ-5.2** — QUANDO a data prevista de retorno de uma consignação aberta é anterior à data atual, O SISTEMA DEVE sinalizá-la como vencida e informar quantos dias de atraso
- **REQ-5.3** — QUANDO o painel é requisitado, O SISTEMA DEVE resolvê-lo em uma única consulta agregada, sem consulta por consignação
- **REQ-5.4** — QUANDO o painel é filtrado por cliente, O SISTEMA DEVE retornar apenas as consignações daquela cliente
- **REQ-5.5** — SE o painel é requisitado sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401
- **REQ-5.6** — O SISTEMA DEVE não gravar em log o telefone, o CPF nem o e-mail da cliente ao montar o painel ou o romaneio

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | A saída em consignação baixa o saldo de estoque imediatamente, com tipo de movimentação próprio | A peça não está na arara; mantê-la disponível venderia online algo que está na casa da cliente |
| 2 | A venda gerada na conversão não movimenta estoque de novo | A saída já ocorreu na consignação; movimentar duas vezes deixaria saldo negativo |
| 3 | Venda de conversão entra em `orders` com `channel = 'consignado'` | Mesmo motivo do PDV: faturamento por canal em uma consulta só |
| 4 | Consignação não tem prazo padrão automático; a data é sempre informada | Prazo varia por cliente e por peça; um default silencioso vira prazo que ninguém combinou |
| 5 | Romaneio em PDF gerado no servidor, sem biblioteca nova pesada | O documento é uma lista simples; HTML impresso pelo navegador cobriria, mas o envio por WhatsApp exige um arquivo estável |
| 6 | Painel não dispara cobrança automática por prazo vencido | A conversa de cobrança de consignado é relacional; automatizá-la sem pedido da cliente arrisca a relação com a compradora |

## Perguntas em aberto

Nenhuma bloqueante. Uma confirmação operacional: se a consignação vencida deve bloquear nova saída
para a mesma cliente. Assumido que **não bloqueia** — apenas sinaliza no painel e na tela de criação.

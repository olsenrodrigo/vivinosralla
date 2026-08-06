# Requisitos — Financeiro, Caixa e Conciliação Bancária

**Projeto:** VIVI · **Plane:** módulo "Financeiro, Caixa e Conciliação" · **Origem:** pré-projeto Viviane Nosralla, Blocos B6 e B7
**Status:** rascunho

## Contexto

Contas a pagar, contas a receber, caixa e conferência bancária vivem hoje em planilhas e cadernos, e
são reconstruídos manualmente todo mês. O sistema sabe o que vendeu, mas não sabe o que entrou; sabe
o que deve, mas só na memória de quem lançou. Este epic fecha o ciclo do dinheiro: todo recebimento
gerado por venda, consignado ou PDV nasce lançado; toda despesa tem vencimento e recorrência; o
caixa da loja abre, sangra e fecha com conferência; e os extratos do C6 e do Bradesco entram no
sistema para conciliar automaticamente o que bate — deixando visível só a divergência que precisa de
gente.

## Glossário

| Termo | Definição |
|---|---|
| Lançamento | Registro de uma obrigação a pagar ou a receber, com valor, vencimento e categoria |
| Baixa | Registro de que um lançamento foi efetivamente pago ou recebido, com data e meio |
| Recorrência | Regra que gera lançamentos futuros de um mesmo compromisso em intervalo fixo |
| Caixa | Sessão de operação do dinheiro físico da loja, entre a abertura e o fechamento |
| Sangria | Retirada de dinheiro do caixa durante o expediente |
| Suprimento | Entrada de dinheiro no caixa para troco |
| Extrato | Arquivo OFX ou CSV exportado do banco com as movimentações da conta |
| Conciliação | Associação entre uma linha do extrato e uma baixa do sistema |
| Divergência | Linha do extrato sem baixa correspondente, ou baixa sem linha correspondente |

## Fora de escopo

- Integração via API bancária ou agregador Open Finance — a premissa da proposta é importação de extrato
- Emissão de boleto próprio fora do Asaas
- Contabilidade, apuração de impostos e obrigações acessórias
- Crediário próprio com análise de risco (previsto como evolução de Fase 2)

---

## REQ-1 — Contas a pagar

**Como** proprietária, **quero** registrar o que devo e quando vence, **para** parar de descobrir
conta atrasada pelo aviso do fornecedor.

**Critérios de aceite**

- **REQ-1.1** — QUANDO um lançamento a pagar é criado com valor, vencimento, categoria e fornecedor, O SISTEMA DEVE persisti-lo com status `aberto`
- **REQ-1.2** — QUANDO um lançamento a pagar é criado com parcelamento em N vezes, O SISTEMA DEVE gerar N lançamentos com vencimentos mensais consecutivos e valor dividido, ajustando a diferença de arredondamento na última parcela
- **REQ-1.3** — QUANDO um lançamento a pagar é criado como recorrente, O SISTEMA DEVE gerar os lançamentos dos 12 meses seguintes e marcá-los com o identificador da regra de recorrência
- **REQ-1.4** — QUANDO a baixa de um lançamento é registrada, O SISTEMA DEVE gravar data de pagamento, valor pago e meio, e mudar o status para `pago`
- **REQ-1.5** — SE o valor informado é menor ou igual a zero, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"valor_invalido"}`
- **REQ-1.6** — SE a baixa é registrada em lançamento já baixado, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"lancamento_ja_baixado"}`
- **REQ-1.7** — QUANDO uma regra de recorrência é cancelada, O SISTEMA DEVE remover os lançamentos futuros ainda em aberto daquela regra e preservar os já baixados
- **REQ-1.8** — SE uma rota do financeiro é chamada por usuária de papel diferente de `admin`, ENTÃO O SISTEMA DEVE responder HTTP 403

## REQ-2 — Contas a receber

**Como** proprietária, **quero** que todo recebimento previsto nasça lançado, **para** saber quanto
tenho a receber sem somar pedidos à mão.

**Critérios de aceite**

- **REQ-2.1** — QUANDO um pedido é criado em qualquer canal, O SISTEMA DEVE gerar um lançamento a receber com o valor do pedido, a data prevista de recebimento e a referência ao pedido de origem
- **REQ-2.2** — QUANDO o webhook do gateway confirma o pagamento de um pedido, O SISTEMA DEVE baixar automaticamente o lançamento a receber correspondente com a data da confirmação
- **REQ-2.3** — QUANDO o mesmo evento de confirmação é processado mais de uma vez, O SISTEMA DEVE manter uma única baixa registrada
- **REQ-2.4** — QUANDO um pedido é cancelado ou estornado, O SISTEMA DEVE cancelar o lançamento a receber em aberto correspondente
- **REQ-2.5** — QUANDO um recebimento é registrado manualmente, O SISTEMA DEVE exigir data e meio, e recusar com HTTP 400 `{"error":"dados_da_baixa_incompletos"}` se algum faltar
- **REQ-2.6** — QUANDO a posição de contas a receber é consultada, O SISTEMA DEVE retornar total em aberto, total vencido e total recebido no período, em uma única consulta agregada
- **REQ-2.7** — SE a data prevista de recebimento é anterior à data do lançamento, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"data_prevista_invalida"}`
- **REQ-2.8** — O SISTEMA DEVE não gravar em log o nome, o CPF, o e-mail nem o telefone da cliente ao registrar baixa de recebimento

## REQ-3 — Controle de caixa

**Como** vendedora, **quero** abrir e fechar o caixa com conferência, **para** que a diferença
apareça no dia em que aconteceu, e não no fim do mês.

**Critérios de aceite**

- **REQ-3.1** — QUANDO o caixa é aberto com valor inicial informado, O SISTEMA DEVE criar uma sessão de caixa com status `aberto`, registrando a usuária e o horário
- **REQ-3.2** — SE a abertura é solicitada com outra sessão já aberta, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"caixa_ja_aberto"}` e não criar sessão
- **REQ-3.3** — QUANDO uma sangria ou um suprimento é registrado, O SISTEMA DEVE persistir valor, motivo, usuária e horário, vinculados à sessão aberta
- **REQ-3.4** — SE uma sangria de valor maior que o saldo em dinheiro da sessão é registrada, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"saldo_em_caixa_insuficiente"}`
- **REQ-3.5** — QUANDO o caixa é fechado com o valor contado informado, O SISTEMA DEVE calcular o saldo esperado como valor inicial mais recebimentos em dinheiro mais suprimentos menos sangrias, e persistir a diferença entre contado e esperado
- **REQ-3.6** — QUANDO o caixa é fechado, O SISTEMA DEVE impedir novo lançamento naquela sessão e responder HTTP 409 a tentativas posteriores
- **REQ-3.7** — QUANDO uma venda de PDV é fechada, O SISTEMA DEVE vinculá-la à sessão de caixa aberta e recusar a venda com HTTP 409 `{"error":"caixa_fechado"}` se não houver sessão aberta
- **REQ-3.8** — QUANDO o histórico de caixas é consultado, O SISTEMA DEVE retornar por sessão os valores inicial, esperado, contado e a diferença

## REQ-4 — Fluxo de caixa projetado

**Como** proprietária, **quero** ver o que entra e o que sai nas próximas semanas, **para** saber se
tenho dinheiro para o próximo pedido de mercadoria.

**Critérios de aceite**

- **REQ-4.1** — QUANDO a projeção é consultada para um intervalo, O SISTEMA DEVE retornar por dia o total previsto a receber, o total previsto a pagar e o saldo acumulado
- **REQ-4.2** — QUANDO a projeção é calculada, O SISTEMA DEVE partir do saldo atual em conta informado na configuração e acumular dia a dia
- **REQ-4.3** — QUANDO a projeção é calculada, O SISTEMA DEVE considerar apenas lançamentos com status `aberto`
- **REQ-4.4** — QUANDO o saldo acumulado de algum dia da projeção é negativo, O SISTEMA DEVE sinalizar esse dia como ruptura de caixa
- **REQ-4.5** — SE o intervalo solicitado excede 180 dias, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"periodo_muito_longo"}`
- **REQ-4.6** — QUANDO a projeção é consultada, O SISTEMA DEVE resolvê-la em uma única consulta agregada

## REQ-5 — Importação de extrato bancário

**Como** proprietária, **quero** subir o extrato do C6 e do Bradesco, **para** conferir o que o banco
confirma contra o que o sistema diz.

**Critérios de aceite**

- **REQ-5.1** — QUANDO um arquivo OFX é enviado, O SISTEMA DEVE extrair data, valor, descritor e identificador de cada transação e persisti-las vinculadas à conta bancária informada
- **REQ-5.2** — QUANDO um arquivo CSV é enviado com o mapeamento de colunas informado, O SISTEMA DEVE importar as transações usando esse mapeamento
- **REQ-5.3** — QUANDO uma transação já importada é reenviada, O SISTEMA DEVE identificá-la pela combinação de conta, data, valor e identificador do banco e não duplicá-la
- **REQ-5.4** — SE o arquivo enviado não é OFX nem CSV válido, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"arquivo_invalido"}` e não importar transação nenhuma
- **REQ-5.5** — SE o arquivo excede 5 MB, ENTÃO O SISTEMA DEVE responder HTTP 413 `{"error":"arquivo_muito_grande"}`
- **REQ-5.6** — QUANDO a importação termina, O SISTEMA DEVE retornar quantas transações foram importadas, quantas foram ignoradas por duplicidade e o período coberto
- **REQ-5.7** — SE a importação é solicitada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não persistir arquivo
- **REQ-5.8** — O SISTEMA DEVE não gravar em log o conteúdo do extrato importado nem o descritor das transações

## REQ-6 — Conciliação automática e divergências

**Como** proprietária, **quero** que o sistema case sozinho o que é óbvio, **para** eu olhar só o que
não bate.

**Critérios de aceite**

- **REQ-6.1** — QUANDO a conciliação automática é executada, O SISTEMA DEVE associar cada transação bancária a uma baixa não conciliada de mesmo valor e data dentro da tolerância configurada
- **REQ-6.2** — QUANDO mais de uma baixa é candidata para a mesma transação, O SISTEMA DEVE deixar a transação como pendente de decisão manual e não conciliar automaticamente
- **REQ-6.3** — QUANDO existe regra de descritor cadastrada que casa com a transação, O SISTEMA DEVE usá-la para restringir os candidatos antes de aplicar a regra de valor e data
- **REQ-6.4** — QUANDO a conciliação manual é confirmada pela usuária, O SISTEMA DEVE gravar o vínculo, quem confirmou e o horário
- **REQ-6.5** — QUANDO a visão de divergências é consultada, O SISTEMA DEVE listar as transações bancárias sem baixa correspondente e as baixas sem transação correspondente no período
- **REQ-6.6** — SE um vínculo de conciliação é desfeito, ENTÃO O SISTEMA DEVE devolver as duas pontas ao estado não conciliado e registrar quem desfez
- **REQ-6.7** — O SISTEMA DEVE não permitir que uma mesma transação bancária seja conciliada a mais de uma baixa
- **REQ-6.8** — QUANDO a conciliação automática é executada sobre N transações, O SISTEMA DEVE resolvê-la sem consulta por transação

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Plano de contas simples de dois níveis (grupo e categoria), sem contabilidade de partidas dobradas | A operação é uma loja de varejo; partidas dobradas exigiriam conhecimento contábil da usuária sem mudar nenhuma decisão de negócio |
| 2 | Recorrência gera 12 meses adiante, não infinitamente | Projeção de caixa não passa de 180 dias; gerar além disso enche a base com lançamentos que ninguém consulta |
| 3 | Tolerância padrão de conciliação: valor exato e data com folga de 3 dias | PIX cai no mesmo dia, cartão em D+1 a D+2, boleto em D+1; 3 dias cobre a operação sem casar coisa errada |
| 4 | Transação com mais de um candidato nunca é conciliada automaticamente | Conciliação errada é pior que conciliação ausente — some da lista de pendências e ninguém revisa |
| 5 | Saldo inicial da projeção informado na configuração, não lido do banco | Não há API bancária na premissa da proposta; ler o saldo exigiria integração fora do escopo |
| 6 | Financeiro restrito ao papel `admin` | Contas a pagar e extrato bancário são dados sensíveis do negócio; a vendedora de balcão não precisa de acesso |
| 7 | Venda de PDV exige caixa aberto; venda online não | O caixa controla dinheiro físico; venda online não passa pela gaveta |

## Perguntas em aberto

Uma confirmação de negócio antes da execução da task de conciliação: **quais contas bancárias
existem e em que formato cada banco exporta**. Assumido C6 e Bradesco em OFX, com CSV como
alternativa mapeável. Se algum dos dois exportar apenas em PDF, a task de importação muda de escopo
e precisa ser reavaliada.

# Requisitos — Operação de Loja: PDV e Etiquetas

**Projeto:** VIVI · **Plane:** módulo "Operação de Loja — PDV e Etiquetas" · **Origem:** pré-projeto Viviane Nosralla, Blocos B3 e B9
**Status:** rascunho

## Contexto

A venda física hoje não passa pelo mesmo lugar que a venda online: o sistema local registra o cupom,
o estoque é ajustado de memória e a comissão da vendedora é apurada à mão no fim do mês. Este epic
traz a venda de balcão para dentro do sistema único — leitura de código de barras, várias formas de
pagamento no mesmo cupom, desconto com alçada, comissão apurada por venda, troca e devolução com
crédito. E resolve o passo anterior à venda: a etiqueta de preço com código de barras, impressa na
Zebra GC420t que a loja já tem, direto do navegador.

## Glossário

| Termo | Definição |
|---|---|
| PDV | Ponto de venda — a tela de venda rápida usada no balcão da loja |
| Cupom | Uma venda física registrada, composta por itens, pagamentos e vendedora responsável |
| Alçada | Percentual máximo de desconto que um papel de usuária pode conceder sem aprovação |
| Comissão | Percentual sobre o valor líquido do cupom atribuído à vendedora identificada |
| Crédito de troca | Saldo em favor da cliente gerado por devolução, utilizável em compra futura |
| ZPL | *Zebra Programming Language* — linguagem de comandos aceita pela impressora Zebra GC420t |
| Browser Print | Agente local da Zebra que permite ao navegador enviar ZPL para a impressora conectada |
| Sangria | Retirada de dinheiro do caixa durante o expediente |

## Fora de escopo

- Emissão do cupom fiscal eletrônico (NFC-e) — vive no epic `fiscal-nfce`; o PDV expõe o gancho de emissão
- Abertura, sangria, suprimento e fechamento de caixa — vivem no epic `financeiro-conciliacao`; o PDV grava a venda vinculada ao caixa aberto
- Aplicativo de vendedora externa (previsto como evolução de Fase 2)
- Impressão de etiqueta em impressora que não seja a Zebra GC420t

---

## REQ-1 — Venda rápida com leitura de código de barras

**Como** vendedora, **quero** montar o cupom bipando as peças, **para** atender no balcão sem digitar
código.

**Critérios de aceite**

- **REQ-1.1** — QUANDO um código é lido no campo de busca do PDV, O SISTEMA DEVE localizar a variação por código de barras e, não encontrando, por SKU, e adicioná-la ao cupom com quantidade 1
- **REQ-1.2** — QUANDO a mesma variação é lida novamente no mesmo cupom, O SISTEMA DEVE incrementar a quantidade da linha existente em vez de criar uma segunda linha
- **REQ-1.3** — SE o código lido não corresponde a nenhuma variação ativa, ENTÃO O SISTEMA DEVE exibir "Código não encontrado" e não alterar o cupom
- **REQ-1.4** — SE a variação lida tem saldo disponível zero e não permite venda sem estoque, ENTÃO O SISTEMA DEVE exibir "Sem saldo" e não adicionar a linha
- **REQ-1.5** — QUANDO a busca é feita por texto com 3 ou mais caracteres, O SISTEMA DEVE retornar em até 10 resultados as variações cujo nome de peça, SKU ou código de barras contêm o termo
- **REQ-1.6** — QUANDO o cupom é finalizado, O SISTEMA DEVE registrar uma movimentação de saída por item na mesma transação da gravação da venda

## REQ-2 — Múltiplas formas de pagamento no mesmo cupom

**Como** vendedora, **quero** receber parte em dinheiro e parte em cartão, **para** fechar a venda do
jeito que a cliente pode pagar.

**Critérios de aceite**

- **REQ-2.1** — QUANDO a vendedora lança mais de uma forma de pagamento no cupom, O SISTEMA DEVE persistir cada uma com meio, valor e, quando cartão, o número de parcelas
- **REQ-2.2** — SE a soma dos pagamentos lançados é diferente do total do cupom, ENTÃO O SISTEMA DEVE recusar o fechamento com HTTP 400 `{"error":"pagamento_divergente","diferenca":<valor>}` e não gravar a venda
- **REQ-2.3** — QUANDO o pagamento em dinheiro é maior que o saldo devido, O SISTEMA DEVE calcular e exibir o troco antes da confirmação
- **REQ-2.4** — QUANDO um pagamento PIX é lançado com geração de cobrança, O SISTEMA DEVE criar a cobrança no Asaas e só permitir o fechamento após a confirmação do recebimento
- **REQ-2.5** — SE o meio de pagamento informado não está entre `dinheiro`, `pix`, `debito`, `credito` e `credito_troca`, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"meio_invalido"}`
- **REQ-2.6** — QUANDO a cliente usa crédito de troca, O SISTEMA DEVE debitar o valor do saldo de crédito dela e recusar com HTTP 409 `{"error":"credito_insuficiente"}` se o saldo for menor que o lançado

## REQ-3 — Desconto com alçada

**Como** proprietária, **quero** limitar quanto cada vendedora pode descontar, **para** proteger a
margem sem travar a negociação de balcão.

**Critérios de aceite**

- **REQ-3.1** — QUANDO um desconto é aplicado dentro da alçada do papel da usuária logada, O SISTEMA DEVE aceitá-lo e registrar o percentual e o valor no cupom
- **REQ-3.2** — SE o desconto solicitado excede a alçada do papel, ENTÃO O SISTEMA DEVE responder HTTP 403 `{"error":"desconto_acima_da_alcada","limite":<percentual>}` e não aplicar o desconto
- **REQ-3.3** — QUANDO um desconto acima da alçada é autorizado por usuária de papel `admin` mediante credencial, O SISTEMA DEVE aplicar o desconto e registrar quem autorizou
- **REQ-3.4** — O SISTEMA DEVE registrar em toda venda com desconto o percentual concedido, o valor absoluto e o identificador de quem concedeu
- **REQ-3.5** — SE o desconto solicitado é maior que 100% ou negativo, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"desconto_invalido"}`

## REQ-4 — Vendedora e comissão

**Como** proprietária, **quero** saber quem vendeu o quê, **para** apurar comissão sem planilha.

**Critérios de aceite**

- **REQ-4.1** — QUANDO um cupom é fechado, O SISTEMA DEVE exigir a identificação da vendedora e recusar com HTTP 400 `{"error":"vendedora_obrigatoria"}` se ela não for informada
- **REQ-4.2** — QUANDO o cupom é fechado, O SISTEMA DEVE calcular a comissão como o percentual configurado para a vendedora aplicado sobre o valor do cupom líquido de descontos, e persistir o valor calculado
- **REQ-4.3** — QUANDO uma venda é devolvida integralmente, O SISTEMA DEVE registrar o estorno da comissão correspondente
- **REQ-4.4** — QUANDO a apuração de comissões de um período é consultada, O SISTEMA DEVE retornar por vendedora o total vendido, o total devolvido e a comissão líquida, em uma única consulta agregada
- **REQ-4.5** — SE a consulta de apuração é feita por usuária de papel diferente de `admin`, ENTÃO O SISTEMA DEVE responder HTTP 403

## REQ-5 — Troca e devolução com crédito

**Como** vendedora, **quero** registrar troca e devolução, **para** devolver a peça ao estoque e dar
o crédito certo à cliente.

**Critérios de aceite**

- **REQ-5.1** — QUANDO uma devolução é registrada para itens de uma venda existente, O SISTEMA DEVE gerar movimentação de entrada de estoque para cada item devolvido
- **REQ-5.2** — QUANDO a devolução é concluída, O SISTEMA DEVE creditar o valor devolvido no saldo de crédito da cliente e registrar a origem do crédito
- **REQ-5.3** — SE a quantidade devolvida de um item excede a quantidade vendida menos a já devolvida, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"quantidade_maior_que_vendida","sku":"<sku>"}` e não registrar nada
- **REQ-5.4** — SE a devolução é solicitada para venda inexistente, ENTÃO O SISTEMA DEVE responder HTTP 404 `{"error":"venda_nao_encontrada"}`
- **REQ-5.5** — QUANDO uma troca é registrada, O SISTEMA DEVE dar entrada nos itens devolvidos, saída nos itens levados e cobrar ou creditar apenas a diferença
- **REQ-5.6** — O SISTEMA DEVE registrar em toda devolução o motivo informado e a usuária responsável

## REQ-6 — Etiqueta de preço na Zebra GC420t

**Como** administradora, **quero** imprimir a etiqueta da peça com código de barras, **para** que o
PDV consiga bipar e a cliente veja o preço na arara.

**Critérios de aceite**

- **REQ-6.1** — QUANDO a etiqueta de uma variação é solicitada, O SISTEMA DEVE gerar o comando ZPL contendo nome da peça, tamanho, cor, preço formatado em reais e o código de barras da variação
- **REQ-6.2** — QUANDO o nome da peça excede a largura da etiqueta, O SISTEMA DEVE truncar o texto no limite de caracteres da linha em vez de gerar ZPL que estoure o campo
- **REQ-6.3** — QUANDO a impressão em lote é solicitada para uma entrada de mercadoria, O SISTEMA DEVE gerar uma etiqueta por unidade recebida de cada variação da entrada
- **REQ-6.4** — SE a variação solicitada não tem código de barras, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"sem_codigo_de_barras","sku":"<sku>"}` e não gerar ZPL
- **REQ-6.5** — SE o agente Zebra Browser Print não está disponível no navegador, ENTÃO O SISTEMA DEVE exibir instrução de instalação e oferecer o download do arquivo ZPL, sem travar a tela
- **REQ-6.6** — SE a requisição de geração de etiqueta chega sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401
- **REQ-6.7** — QUANDO o preço da variação muda, O SISTEMA DEVE gerar a etiqueta seguinte com o preço atual, sem cache de conteúdo

## REQ-7 — Venda física no mesmo lugar da venda online

**Como** operação, **quero** que a venda de balcão apareça junto com a venda online, **para** ter um
único faturamento e um único histórico da cliente.

**Critérios de aceite**

- **REQ-7.1** — QUANDO um cupom é fechado, O SISTEMA DEVE registrá-lo com canal `loja` e torná-lo visível na mesma listagem de vendas dos pedidos online
- **REQ-7.2** — QUANDO o cupom é vinculado a uma cliente cadastrada, O SISTEMA DEVE acrescentá-lo ao histórico de compras dela
- **REQ-7.3** — QUANDO o cupom é fechado sem identificar a cliente, O SISTEMA DEVE registrá-lo como venda avulsa e não criar cadastro
- **REQ-7.4** — SE uma rota do PDV é chamada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não gravar venda
- **REQ-7.5** — O SISTEMA DEVE não gravar em log o CPF, o telefone nem o e-mail da cliente identificada no cupom

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Venda de PDV grava em `orders` com `channel = "loja"`, não em tabela separada | O epic de indicadores precisa de faturamento por canal em uma consulta; duas tabelas obrigariam `UNION` em todo relatório. A coluna `channel` já existe (`migrations/009_order_channel.sql`) |
| 2 | Alçada de desconto por papel (`admin`, `operator`, `viewer`), não por usuária | A operação tem poucas pessoas; alçada individual acrescenta cadastro sem mudar a decisão de negócio |
| 3 | Percentual de comissão configurado por usuária em `admin_users` | Vendedora nova costuma entrar com percentual diferente; papel único não representaria isso |
| 4 | Crédito de troca em tabela de lançamentos, não em coluna de saldo na cliente | Saldo em coluna não responde "de onde veio esse crédito", que é a primeira pergunta no balcão |
| 5 | Impressão via Zebra Browser Print no navegador, sem serviço de impressão no servidor | A impressora é USB, ligada no computador da loja; um serviço no servidor exigiria túnel até a máquina local |
| 6 | Etiqueta em layout único de 40 × 25 mm | É o formato de etiqueta de arara já usado pela loja com a GC420t; múltiplos layouts sem demanda é over-engineering |
| 7 | PIX no PDV gera cobrança Asaas e aguarda confirmação antes de fechar o cupom | Fechar antes da confirmação repete o problema atual de conferir comprovante à mão |

## Perguntas em aberto

Duas confirmações operacionais, não bloqueantes para a especificação:

1. **Percentual de alçada por papel.** Assumido: `operator` até 10%, `admin` sem limite. Ajustável por configuração.
2. **Percentual de comissão padrão.** Assumido: 3% sobre o valor líquido. Configurável por vendedora.

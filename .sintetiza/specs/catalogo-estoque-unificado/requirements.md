# Requisitos — Catálogo e Estoque Unificado

**Projeto:** VIVI · **Plane:** módulo "Catálogo e Estoque Unificado" · **Origem:** pré-projeto Viviane Nosralla, Blocos B1 e B2
**Status:** rascunho

## Contexto

O sistema de gestão atual roda só no computador da loja e não conversa com nada. O saldo de estoque
que a vendedora vê na arara não é o mesmo que a loja virtual mostraria — e vender online uma peça
que acabou de sair da arara é o erro operacional mais caro do varejo de moda. Este epic estabelece a
fundação de que todos os outros dependem: **uma ficha de peça que serve para vender, precificar e
faturar**, e **um único saldo por variação**, movimentado por eventos rastreáveis, seja a origem a
loja física, a loja virtual ou o consignado.

## Glossário

| Termo | Definição |
|---|---|
| Variação | Combinação de tamanho e cor de uma peça, com SKU, código de barras, preço e saldo próprios (`variants`) |
| SKU | Código interno único de uma variação, usado na etiqueta, no PDV e no inventário |
| Movimentação | Registro imutável de alteração de saldo, com tipo, quantidade, origem e responsável |
| Entrada por nota | Movimentação de entrada gerada a partir do recebimento de mercadoria de um fornecedor |
| Ajuste | Movimentação manual de correção de saldo, sempre com motivo obrigatório |
| Inventário | Contagem física de um conjunto de variações que gera ajustes pela diferença apurada |
| Ruptura | Situação em que o saldo disponível de uma variação chega a zero |
| Peça parada | Peça sem nenhuma saída em um número configurável de dias |
| Markup | Multiplicador aplicado sobre o custo para chegar ao preço sugerido |
| Curva ABC | Classificação das peças por participação no faturamento acumulado (A ≥ 80%, B até 95%, C o restante) |

## Fora de escopo

- Painel gráfico de indicadores e curva ABC apresentada ao usuário — vive no epic `clientes-indicadores`
- Reserva de estoque durante o pagamento — vive no epic `checkout-pagamentos-frete`
- Etiqueta física impressa — vive no epic `pdv-etiquetas`
- Integração com o ERP atual para sincronização contínua; a migração é uma carga única no epic `implantacao-golive`

> **Cobertura Sintetiza — LGPD não se aplica a este epic.** Nenhuma entidade aqui guarda dado pessoal
> de cliente: `products`, `variants`, `suppliers`, `stock_movements` e `inventories` tratam de peça,
> custo e saldo. O único campo de pessoa é `created_by`, que referencia a usuária administrativa
> responsável pela movimentação — dado de auditoria interna, não de titular. Os critérios de
> autorização (REQ-1.6, REQ-6.4) e de validação de borda (REQ-1.4, REQ-1.5, REQ-2.6, REQ-4.3,
> REQ-5.3) estão presentes.

---

## REQ-1 — Ficha completa da peça

**Como** administradora, **quero** cadastrar a peça com custo, markup, fornecedor, composição e NCM,
**para** precificar com margem conhecida e faturar sem consultar outra planilha.

**Critérios de aceite**

- **REQ-1.1** — QUANDO uma peça é criada com custo e markup informados, O SISTEMA DEVE calcular e persistir o preço sugerido como `custo × markup`, arredondado a duas casas
- **REQ-1.2** — QUANDO a administradora informa um preço de venda diferente do sugerido, O SISTEMA DEVE persistir o preço informado e calcular a margem percentual efetiva sobre o custo
- **REQ-1.3** — QUANDO a peça é salva, O SISTEMA DEVE persistir composição, tabela de medidas por tamanho, fornecedor, NCM, coleção e estação
- **REQ-1.4** — SE o NCM informado não tem 8 dígitos numéricos, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"ncm_invalido"}` e não salvar a peça
- **REQ-1.5** — SE o custo informado é negativo, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"custo_invalido"}`
- **REQ-1.6** — SE uma requisição de escrita em produto chega sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não alterar dado nenhum
- **REQ-1.7** — QUANDO a peça é salva sem custo informado, O SISTEMA DEVE persistir a peça e apresentar a margem como indisponível, sem bloquear o cadastro

## REQ-2 — Grade de tamanho e cor com SKU e código de barras

**Como** administradora, **quero** gerar a grade completa de uma peça de uma vez, **para** não
cadastrar 15 variações à mão a cada modelo novo.

**Critérios de aceite**

- **REQ-2.1** — QUANDO a administradora informa a lista de tamanhos e a lista de cores de uma peça, O SISTEMA DEVE criar uma variação para cada combinação ainda inexistente e não duplicar as já existentes
- **REQ-2.2** — QUANDO uma variação é criada sem SKU informado, O SISTEMA DEVE gerar um SKU único no formato `<prefixo-da-peça>-<tamanho>-<cor>` normalizado em maiúsculas e sem acento
- **REQ-2.3** — SE o SKU gerado ou informado já existe em outra variação, ENTÃO O SISTEMA DEVE responder HTTP 409 com `{"error":"sku_duplicado","sku":"<sku>"}` e não criar a variação
- **REQ-2.4** — QUANDO uma variação é criada sem código de barras, O SISTEMA DEVE gerar um código EAN-13 com dígito verificador válido
- **REQ-2.5** — QUANDO uma variação é desativada, O SISTEMA DEVE mantê-la no banco com `active = false` e removê-la das opções de compra da loja virtual
- **REQ-2.6** — SE a lista de tamanhos ou de cores chega vazia, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"grade_vazia"}`

## REQ-3 — Saldo único de estoque

**Como** operação, **quero** um único saldo por variação, **para** que a arara e a loja virtual nunca
discordem sobre o que existe.

**Critérios de aceite**

- **REQ-3.1** — O SISTEMA DEVE manter o saldo de cada variação em uma única linha de `variants`, sem coluna separada por canal
- **REQ-3.2** — QUANDO qualquer operação altera o saldo de uma variação, O SISTEMA DEVE registrar uma movimentação com tipo, quantidade, saldo resultante, origem, identificador da origem e responsável
- **REQ-3.3** — QUANDO uma movimentação é registrada, O SISTEMA DEVE atualizar o saldo e gravar a movimentação na mesma transação
- **REQ-3.4** — SE uma movimentação de saída deixaria o saldo negativo e a variação não permite venda sem estoque, ENTÃO O SISTEMA DEVE recusar com HTTP 409 `{"error":"saldo_insuficiente","sku":"<sku>"}` e não alterar saldo nenhum
- **REQ-3.5** — O SISTEMA DEVE não permitir alteração nem exclusão de movimentação já registrada
- **REQ-3.6** — QUANDO o extrato de uma variação é consultado, O SISTEMA DEVE retornar as movimentações em ordem cronológica decrescente, com paginação de no máximo 100 registros por página
- **REQ-3.7** — QUANDO a listagem de estoque de N variações é requisitada, O SISTEMA DEVE resolvê-la em uma única consulta agregada, sem consulta por variação

## REQ-4 — Entrada de mercadoria

**Como** administradora, **quero** dar entrada no recebimento de uma remessa do fornecedor, **para**
que o saldo suba com rastro de quem, quando e por qual custo.

**Critérios de aceite**

- **REQ-4.1** — QUANDO uma entrada é confirmada com itens e quantidades, O SISTEMA DEVE registrar uma movimentação de entrada por item e somar as quantidades aos saldos correspondentes
- **REQ-4.2** — QUANDO a entrada informa custo unitário diferente do custo atual da variação, O SISTEMA DEVE atualizar o custo da variação para o valor informado e preservar o custo anterior no registro da movimentação
- **REQ-4.3** — SE a entrada contém item com quantidade menor ou igual a zero, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"quantidade_invalida","sku":"<sku>"}` e não aplicar nenhum item da entrada
- **REQ-4.4** — SE a mesma entrada é confirmada duas vezes com o mesmo identificador de idempotência, ENTÃO O SISTEMA DEVE aplicar o efeito uma única vez e responder HTTP 200 na segunda
- **REQ-4.5** — QUANDO uma entrada é confirmada, O SISTEMA DEVE registrar o identificador da usuária que a confirmou

## REQ-5 — Inventário e ajuste

**Como** administradora, **quero** conferir a contagem física contra o sistema, **para** corrigir o
saldo com histórico em vez de sobrescrever número.

**Critérios de aceite**

- **REQ-5.1** — QUANDO um inventário é aberto para um conjunto de variações, O SISTEMA DEVE registrar o saldo do sistema no momento da abertura para cada variação incluída
- **REQ-5.2** — QUANDO a contagem física é lançada e o inventário é fechado, O SISTEMA DEVE gerar uma movimentação de ajuste para cada variação cuja contagem difere do saldo registrado na abertura
- **REQ-5.3** — SE um ajuste manual é lançado sem motivo preenchido, ENTÃO O SISTEMA DEVE responder HTTP 400 com `{"error":"motivo_obrigatorio"}` e não alterar saldo
- **REQ-5.4** — QUANDO um inventário é fechado, O SISTEMA DEVE impedir novo lançamento de contagem nele e responder HTTP 409 a tentativas posteriores
- **REQ-5.5** — QUANDO o inventário é fechado, O SISTEMA DEVE apresentar a divergência total em peças e o valor da divergência a custo

## REQ-6 — Alertas de ruptura e de peça parada

**Como** administradora, **quero** ser avisada do que acabou e do que não gira, **para** repor a
tempo e liquidar o que está parado.

**Critérios de aceite**

- **REQ-6.1** — QUANDO o saldo disponível de uma variação de peça publicada chega a zero, O SISTEMA DEVE incluí-la na lista de rupturas
- **REQ-6.2** — QUANDO uma peça publicada não tem movimentação de saída há mais dias do que o limite configurado, O SISTEMA DEVE incluí-la na lista de peças paradas com a data da última saída
- **REQ-6.3** — QUANDO a lista de alertas é requisitada, O SISTEMA DEVE resolvê-la em uma única consulta agregada
- **REQ-6.4** — SE a lista de alertas é requisitada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401
- **REQ-6.5** — QUANDO uma variação em ruptura recebe entrada, O SISTEMA DEVE removê-la da lista de rupturas na consulta seguinte

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Saldo permanece em `variants.stock_quantity` e a movimentação é o histórico, não a fonte do saldo | Recalcular saldo somando movimentações a cada leitura de vitrine é caro e desnecessário; a consistência é garantida por escrever saldo e movimentação na mesma transação |
| 2 | Movimentação é imutável — correção se faz com movimentação contrária | Histórico editável não é rastro; a auditoria de inventário exige que o passado não mude |
| 3 | Código de barras gerado internamente em EAN-13 com prefixo de uso interno | A marca não tem faixa GS1 licenciada; EAN-13 interno é lido por qualquer leitor e pela Zebra, e não conflita com produto de terceiro no PDV |
| 4 | Custo por variação, não por peça | Grade de moda tem custo diferente por tamanho em algumas peças (tecido); custo só na peça obrigaria média e distorceria a margem |
| 5 | Limite de dias de "peça parada" configurável, com 90 dias como valor inicial | Uma estação de moda dura cerca de três meses; peça sem saída em uma estação inteira é candidata a liquidação |
| 6 | Curva ABC calculada sob demanda no epic de indicadores, não persistida no produto | Classificação muda a cada venda; coluna persistida ficaria defasada e exigiria job de recálculo |

## Perguntas em aberto

Nenhuma. A definição de peça parada (90 dias) e o prefixo do SKU foram assumidos acima e podem ser
ajustados por configuração sem alterar código.

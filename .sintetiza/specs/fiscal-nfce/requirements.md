# Requisitos — Cupom Fiscal NFC-e

**Projeto:** VIVI · **Plane:** módulo "Cupom Fiscal NFC-e" · **Origem:** pré-projeto Viviane Nosralla, Bloco B10
**Status:** rascunho

## Contexto

A venda de balcão precisa sair com documento fiscal. Hoje isso é feito fora do sistema, o que
significa redigitar itens e valores em outro programa a cada venda. Este epic acopla a emissão de
NFC-e ao fechamento do cupom no PDV, por meio de um provedor homologado, com o certificado digital
A1 da empresa guardado no servidor. Inclui o que a operação real exige e que costuma ser esquecido:
cancelamento dentro do prazo legal, contingência quando a SEFAZ está fora do ar, e o envio do DANFE
para a cliente por e-mail ou WhatsApp.

## Glossário

| Termo | Definição |
|---|---|
| NFC-e | Nota Fiscal de Consumidor Eletrônica, modelo 65, usada na venda presencial ao consumidor final |
| SEFAZ | Secretaria da Fazenda estadual, autoridade que autoriza a emissão |
| Provedor homologado | Serviço de terceiro que assina, transmite e mantém a comunicação com a SEFAZ |
| Certificado A1 | Certificado digital em arquivo, com senha, usado para assinar o documento fiscal |
| DANFE | Representação impressa ou digital do documento fiscal autorizado |
| Contingência | Modo de operação quando a SEFAZ está indisponível: a venda é emitida offline e transmitida depois |
| Chave de acesso | Identificador de 44 dígitos do documento fiscal autorizado |
| CFOP | Código Fiscal de Operações e Prestações, que classifica a natureza da operação |

## Fora de escopo

- Emissão de NF-e modelo 55 para venda interestadual (previsto como evolução de Fase 2)
- Parametrização tributária junto à contabilidade e credenciamento na SEFAZ — responsabilidade da contratante, conforme premissa da proposta
- Emissão de documento fiscal para venda da loja virtual com entrega — a NFC-e é da venda presencial
- Escrituração fiscal e obrigações acessórias

---

## REQ-1 — Configuração fiscal e certificado

**Como** operação, **quero** configurar os dados fiscais uma vez, **para** que toda venda saia com a
tributação certa sem digitação.

**Critérios de aceite**

- **REQ-1.1** — QUANDO os dados fiscais da empresa são salvos, O SISTEMA DEVE persistir CNPJ, inscrição estadual, regime tributário, CFOP padrão e série da NFC-e
- **REQ-1.2** — QUANDO o certificado A1 é enviado, O SISTEMA DEVE armazená-lo cifrado em repouso e persistir apenas a data de validade em texto legível
- **REQ-1.3** — SE a senha do certificado não abre o arquivo enviado, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"certificado_ou_senha_invalidos"}` e não armazenar o arquivo
- **REQ-1.4** — O SISTEMA DEVE não retornar o conteúdo do certificado nem a senha em nenhuma resposta de API
- **REQ-1.5** — O SISTEMA DEVE não gravar em log a senha do certificado, o conteúdo dele nem o token do provedor
- **REQ-1.6** — QUANDO a validade do certificado está a 30 dias ou menos de expirar, O SISTEMA DEVE exibir alerta no painel administrativo
- **REQ-1.7** — SE a configuração fiscal é alterada por usuária de papel diferente de `admin`, ENTÃO O SISTEMA DEVE responder HTTP 403

## REQ-2 — Emissão na venda física

**Como** vendedora, **quero** que o cupom fiscal saia junto com a venda, **para** não digitar a venda
duas vezes.

**Critérios de aceite**

- **REQ-2.1** — QUANDO uma venda de PDV é fechada e a emissão fiscal está habilitada, O SISTEMA DEVE enviar a NFC-e ao provedor com os itens, valores, formas de pagamento e, quando informado, o CPF da consumidora
- **REQ-2.2** — QUANDO o provedor retorna autorização, O SISTEMA DEVE persistir chave de acesso, número, série, protocolo, data de autorização e a URL do DANFE, vinculados à venda
- **REQ-2.3** — SE o provedor rejeita a emissão, ENTÃO O SISTEMA DEVE persistir o código e a mensagem de rejeição, manter a venda registrada e exibir a rejeição para a operação
- **REQ-2.4** — SE a emissão falha, ENTÃO O SISTEMA DEVE não desfazer a venda nem devolver o estoque
- **REQ-2.5** — QUANDO um item vendido não tem NCM cadastrado, O SISTEMA DEVE bloquear a emissão daquela venda e responder HTTP 409 `{"error":"item_sem_ncm","sku":"<sku>"}`
- **REQ-2.6** — QUANDO a mesma venda é submetida à emissão mais de uma vez, O SISTEMA DEVE emitir uma única NFC-e e retornar a existente nas chamadas seguintes
- **REQ-2.7** — SE a requisição de emissão chega sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401

## REQ-3 — Cancelamento

**Como** vendedora, **quero** cancelar um cupom emitido por engano, **para** não deixar documento
indevido na apuração.

**Critérios de aceite**

- **REQ-3.1** — QUANDO o cancelamento de uma NFC-e autorizada é solicitado com justificativa, O SISTEMA DEVE enviar o pedido ao provedor e persistir o protocolo de cancelamento retornado
- **REQ-3.2** — SE a justificativa tem menos de 15 caracteres, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"justificativa_invalida"}` e não enviar o pedido
- **REQ-3.3** — SE a NFC-e foi autorizada há mais tempo que o prazo legal de cancelamento, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"prazo_de_cancelamento_expirado"}`
- **REQ-3.4** — QUANDO o cancelamento é confirmado, O SISTEMA DEVE marcar o documento como cancelado e mantê-lo no histórico com a justificativa
- **REQ-3.5** — SE o cancelamento é solicitado para documento já cancelado, ENTÃO O SISTEMA DEVE responder HTTP 409 `{"error":"documento_ja_cancelado"}`
- **REQ-3.6** — QUANDO um cancelamento é registrado, O SISTEMA DEVE registrar quem solicitou

## REQ-4 — Contingência offline

**Como** vendedora, **quero** continuar vendendo quando a SEFAZ cai, **para** não parar a loja.

**Critérios de aceite**

- **REQ-4.1** — SE o provedor ou a SEFAZ não respondem em até 10 segundos, ENTÃO O SISTEMA DEVE registrar o documento em contingência e permitir que a venda seja concluída
- **REQ-4.2** — QUANDO um documento fica em contingência, O SISTEMA DEVE marcá-lo com status `contingencia` e registrar o horário da tentativa
- **REQ-4.3** — QUANDO existem documentos em contingência, O SISTEMA DEVE tentar a transmissão automaticamente a cada 10 minutos
- **REQ-4.4** — QUANDO uma transmissão em contingência é autorizada, O SISTEMA DEVE atualizar o documento com chave, protocolo e data de autorização
- **REQ-4.5** — QUANDO existem documentos em contingência há mais de 24 horas, O SISTEMA DEVE exibir alerta no painel administrativo
- **REQ-4.6** — QUANDO a retransmissão é executada, O SISTEMA DEVE processar os documentos pendentes sem emitir duplicidade para um mesmo cupom

## REQ-5 — Envio do DANFE

**Como** cliente, **quero** receber meu cupom no WhatsApp ou no e-mail, **para** não depender do
papel.

**Critérios de aceite**

- **REQ-5.1** — QUANDO uma NFC-e é autorizada e a cliente tem e-mail cadastrado, O SISTEMA DEVE enviar o DANFE por e-mail e registrar o envio
- **REQ-5.2** — QUANDO o envio por WhatsApp é acionado, O SISTEMA DEVE enviar o link do DANFE ao telefone da cliente e registrar o envio
- **REQ-5.3** — SE a cliente não tem e-mail nem telefone, ENTÃO O SISTEMA DEVE concluir a emissão sem enviar e registrar que não havia canal de envio
- **REQ-5.4** — SE o envio falha, ENTÃO O SISTEMA DEVE registrar a falha e não alterar o status do documento fiscal
- **REQ-5.5** — O SISTEMA DEVE não gravar em log o e-mail nem o telefone da destinatária ao registrar o envio

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Emissão por provedor homologado, com adaptador atrás de uma interface `NotaFiscalProvider` | Falar direto com a SEFAZ exigiria assinatura XML, esquemas por estado e manutenção contínua de layout — custo desproporcional para uma loja |
| 2 | Certificado A1 cifrado em repouso com chave derivada de variável de ambiente | Arquivo de certificado em disco puro é credencial exposta; a chave fora do banco impede que um dump de banco baste para assinar em nome da empresa |
| 3 | Falha de emissão não desfaz a venda | A peça já saiu com a cliente; desfazer a venda por problema fiscal criaria divergência de estoque e de caixa |
| 4 | Contingência automática por timeout, sem intervenção da vendedora | A alternativa é o balcão parar; a decisão fiscal correta é emitir em contingência e transmitir depois |
| 5 | Retransmissão a cada 10 minutos com trava de concorrência | Sem trava, duas execuções simultâneas transmitiriam o mesmo cupom duas vezes |
| 6 | NCM obrigatório para emitir, verificado antes do envio | Rejeição da SEFAZ por NCM ausente acontece com o cupom já fechado e a cliente esperando; verificar antes transforma isso em cadastro pendente |
| 7 | Prazo de cancelamento lido da configuração, com 30 minutos como valor inicial | O prazo de cancelamento de NFC-e varia por estado; fixar em código obrigaria deploy para acompanhar mudança de legislação |

## Perguntas em aberto

Três definições dependem da contabilidade da cliente e **não bloqueiam a especificação**, mas
bloqueiam a execução da task de configuração:

1. **Provedor homologado** a ser contratado (a proposta prevê custo de terceiro de R$ 50–120/mês).
2. **Regime tributário e CFOP** aplicáveis à operação.
3. **Série e numeração inicial** da NFC-e, para não colidir com documentos já emitidos.

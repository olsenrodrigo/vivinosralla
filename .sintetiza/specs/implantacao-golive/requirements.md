# Requisitos — Implantação e Go-Live

**Projeto:** VIVI · **Plane:** módulo "Implantação e Go-Live" · **Origem:** pré-projeto Viviane Nosralla, Bloco D (D1–D4)
**Status:** rascunho

## Contexto

O sistema atual da loja é local e offline; a operação inteira migra de uma vez. Este epic cobre o que
transforma código pronto em loja funcionando: infraestrutura com domínio, SSL e backup testado;
carga dos produtos, clientes e estoque do sistema atual; verificação ponta a ponta dos fluxos que não
podem falhar no primeiro dia; e treinamento da equipe com documentação de operação. É o bloco que a
proposta absorve como cortesia, mas é também o que decide se o go-live é um evento ou um incidente.

## Glossário

| Termo | Definição |
|---|---|
| Ambiente de produção | Instalação que atende o público, com o domínio da marca |
| Ambiente de homologação | Instalação idêntica, com dados de teste, usada para validar antes de publicar |
| Backup | Cópia do banco de dados e dos arquivos de upload, armazenada fora do servidor de aplicação |
| Restauração testada | Backup efetivamente restaurado em ambiente separado, com verificação do resultado |
| Carga inicial | Importação única de produtos, clientes e estoque vindos do sistema atual |
| Fluxo crítico | Caminho de uso cuja falha impede a operação de vender ou receber |
| Go-live | Momento em que o domínio passa a apontar para o ambiente de produção |

## Fora de escopo

- Sincronização contínua com o sistema atual após a carga inicial
- Registro do domínio, que é responsabilidade da contratante conforme a premissa da proposta
- Credenciamento na SEFAZ e parametrização tributária
- Migração de histórico financeiro; a carga inicial cobre produtos, clientes e estoque

---

## REQ-1 — Infraestrutura de produção

**Como** operação, **quero** o sistema no ar com domínio próprio e HTTPS, **para** vender sem aviso
de site inseguro.

**Critérios de aceite**

- **REQ-1.1** — QUANDO o domínio da marca é acessado por HTTPS, O SISTEMA DEVE responder HTTP 200 com certificado válido para aquele domínio
- **REQ-1.2** — QUANDO o domínio é acessado por HTTP, O SISTEMA DEVE redirecionar para HTTPS com status 301
- **REQ-1.3** — O SISTEMA DEVE responder com o cabeçalho `Strict-Transport-Security` em toda resposta de produção
- **REQ-1.4** — QUANDO o processo da aplicação é interrompido, O SISTEMA DEVE reiniciá-lo automaticamente e voltar a responder em até 60 segundos
- **REQ-1.5** — QUANDO o servidor é reiniciado, O SISTEMA DEVE subir a aplicação e o banco de dados sem intervenção manual
- **REQ-1.6** — O SISTEMA DEVE manter um ambiente de homologação acessível apenas por autenticação, com `robots.txt` bloqueando indexação
- **REQ-1.7** — O SISTEMA DEVE não expor no repositório nem em log nenhuma variável de ambiente com segredo

## REQ-2 — Backup e restauração

**Como** proprietária, **quero** ter certeza de que os dados voltam, **para** não perder a operação
por uma falha de servidor.

**Critérios de aceite**

- **REQ-2.1** — O SISTEMA DEVE gerar diariamente um backup completo do banco de dados e dos arquivos de upload
- **REQ-2.2** — QUANDO um backup é gerado, O SISTEMA DEVE armazená-lo fora do servidor de aplicação
- **REQ-2.3** — O SISTEMA DEVE reter os backups dos últimos 30 dias
- **REQ-2.4** — SE a geração do backup falha, ENTÃO O SISTEMA DEVE registrar a falha e notificar o responsável técnico
- **REQ-2.5** — QUANDO a restauração é executada em ambiente de verificação, O SISTEMA DEVE resultar em uma base que responde às consultas de produto, pedido e cliente com as mesmas contagens do momento do backup

## REQ-3 — Carga inicial de dados

**Como** operação, **quero** começar com o catálogo e os clientes que já existem, **para** não
recadastrar tudo à mão.

**Critérios de aceite**

- **REQ-3.1** — QUANDO a planilha de produtos é importada, O SISTEMA DEVE criar as peças com nome, preço, custo, categoria e as variações de tamanho e cor informadas
- **REQ-3.2** — QUANDO o estoque inicial é importado, O SISTEMA DEVE registrar uma movimentação de entrada por variação com origem identificada como migração
- **REQ-3.3** — QUANDO a base de clientes é importada, O SISTEMA DEVE aplicar a mesma regra de deduplicação por CPF e telefone usada no cadastro corrente
- **REQ-3.4** — SE uma linha da planilha não passa na validação, ENTÃO O SISTEMA DEVE registrá-la no relatório de erros com o motivo e importar as demais linhas válidas
- **REQ-3.5** — QUANDO a importação termina, O SISTEMA DEVE apresentar quantas linhas foram importadas, quantas foram atualizadas e quantas falharam
- **REQ-3.6** — QUANDO a carga inicial de clientes é feita, O SISTEMA DEVE registrar a base legal do tratamento dos dados importados
- **REQ-3.7** — SE a mesma planilha é importada duas vezes, ENTÃO O SISTEMA DEVE atualizar os registros existentes em vez de duplicá-los
- **REQ-3.8** — SE a importação é solicitada sem sessão administrativa válida, ENTÃO O SISTEMA DEVE responder HTTP 401 e não importar linha nenhuma
- **REQ-3.9** — SE o arquivo enviado não está em formato CSV nem XLSX, ENTÃO O SISTEMA DEVE responder HTTP 400 `{"error":"formato_invalido"}` e não importar linha nenhuma

## REQ-4 — Verificação ponta a ponta

**Como** responsável técnico, **quero** provar que os fluxos críticos funcionam antes do go-live,
**para** não descobrir problema com a cliente na loja.

**Critérios de aceite**

- **REQ-4.1** — QUANDO o roteiro de verificação é executado em produção antes do go-live, O SISTEMA DEVE concluir com evidência registrada para cada fluxo crítico: compra online com PIX, venda no PDV, consignação com retorno, emissão de NFC-e e importação de extrato
- **REQ-4.2** — QUANDO a compra online de verificação é concluída, O SISTEMA DEVE ter registrado pedido, baixa de estoque, confirmação de pagamento e lançamento no contas a receber
- **REQ-4.3** — QUANDO a venda de verificação no PDV é concluída, O SISTEMA DEVE ter registrado a venda, a movimentação de estoque e o vínculo com a sessão de caixa
- **REQ-4.4** — SE algum fluxo crítico falha na verificação, ENTÃO O SISTEMA DEVE ter o defeito registrado como impedimento de go-live antes da virada
- **REQ-4.5** — QUANDO a verificação termina, O SISTEMA DEVE ter os dados de teste removidos da base de produção
- **REQ-4.6** — QUANDO o webhook de pagamento é testado em produção, O SISTEMA DEVE confirmar o recebimento do evento com a URL de produção configurada no provedor

## REQ-5 — Treinamento e documentação

**Como** equipe da loja, **quero** saber operar o sistema, **para** não depender de suporte para o
uso diário.

**Critérios de aceite**

- **REQ-5.1** — QUANDO o manual de operação é entregue, O SISTEMA DEVE tê-lo disponível dentro do painel administrativo, cobrindo cadastro de peça, venda no PDV, consignado, caixa, conciliação e emissão fiscal
- **REQ-5.2** — QUANDO uma pessoa nova é cadastrada como usuária, O SISTEMA DEVE exigir troca de senha no primeiro acesso
- **REQ-5.3** — QUANDO o treinamento é concluído, O SISTEMA DEVE ter cada pessoa da equipe com usuária própria e papel atribuído
- **REQ-5.4** — O SISTEMA DEVE não ter nenhuma credencial compartilhada entre pessoas
- **REQ-5.5** — QUANDO o go-live acontece, O SISTEMA DEVE ter registrado quem é o contato de suporte e por qual canal

---

## Decisões assumidas

| # | Decisão | Motivo |
|---|---|---|
| 1 | Deploy em VPS com Docker Compose, reaproveitando os scripts de `setup/` já existentes no repositório | O repositório já traz `install.sh`, `setup.sh` e `update.sh` documentados no README; reescrever a implantação seria refazer trabalho pronto |
| 2 | Backup fora do servidor de aplicação, em armazenamento de objeto | Backup no mesmo disco não protege contra perda do servidor, que é o cenário que o backup existe para cobrir |
| 3 | Restauração testada uma vez, antes do go-live, e não apenas configurada | Backup nunca restaurado é backup não comprovado |
| 4 | Homologação com o mesmo código de produção e dados de teste | Validar em ambiente diferente do de produção não prova nada sobre produção |
| 5 | Carga inicial por planilha padronizada, com o importador existente estendido | A premissa da proposta prevê que pode não haver exportação do sistema atual; a planilha é o caminho garantido |
| 6 | Dados de verificação removidos da produção após o roteiro | Pedido de teste no faturamento distorce o primeiro relatório e confunde a apuração |
| 7 | Manual dentro do painel, não em arquivo separado | `docs/manual.html` já existe no repositório como base; dentro do painel ele é encontrado quando a dúvida aparece |

## Perguntas em aberto

Três definições de responsabilidade da contratante, **necessárias antes da execução**:

1. **Domínio** a ser usado e acesso ao registrador para apontar o DNS.
2. **Formato de exportação** disponível no sistema atual, ou confirmação de que a carga será por planilha.
3. **Quantas pessoas** terão usuária e com qual papel cada uma.

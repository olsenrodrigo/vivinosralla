# Design — Implantação e Go-Live

**Requisitos cobertos:** REQ-1 … REQ-5 · **Spec:** ./requirements.md

## Visão arquitetural

A implantação reaproveita o que o repositório já traz: `setup/install.sh` (Node, PostgreSQL, Nginx,
PM2, Certbot), `setup/setup.sh` (banco, `.env`, build, PM2, Nginx, HTTPS) e `setup/update.sh`
(pull, deps, migrations, rebuild, restart), documentados no `README.md`. O epic **não reescreve**
esses scripts — configura, verifica e acrescenta o que falta: backup externo, ambiente de
homologação e o roteiro de verificação.

```
VPS Ubuntu
├── Nginx (Certbot / Let's Encrypt) ─→ :5003 app produção     vivinosralla.com.br
│                                    ─→ :5004 app homologação  homolog.<dominio> (Basic Auth)
├── PostgreSQL 16
├── PM2 (restart automático + startup no boot)
└── cron 03:00 ─→ backup.sh ─→ pg_dump + tar de uploads/ ─→ armazenamento externo
```

**Segredos (REQ-1.7):** `.env` fora do controle de versão (`.gitignore` já cobre); nenhuma chave em
`docker-compose.yml` nem em script. Verificação por varredura do repositório antes do go-live.

## Modelo de dados

Não há migration de negócio neste epic. Duas tabelas de apoio operacional em
`migrations/022_operacao.sql`:

| Entidade | Campos | Atende |
|---|---|---|
| `backup_runs` | `id serial pk`, `started_at timestamptz not null`, `finished_at timestamptz`, `status text not null` (`ok`/`falhou`), `size_bytes bigint`, `destination text`, `error text` | REQ-2.1, REQ-2.4 |
| `migration_reports` | `id serial pk`, `kind text not null` (`produtos`/`clientes`/`estoque`), `filename text`, `imported int`, `updated int`, `failed int`, `errors jsonb`, `created_by int`, `created_at` | REQ-3.4, REQ-3.5 |

`admin_users.must_change_password` (`shared/schema.ts:31`) já existe e atende REQ-5.2 — a task
verifica o comportamento em vez de recriá-lo.

## Contratos e artefatos

### Infraestrutura (REQ-1)

| Item | Como é entregue | Atende |
|---|---|---|
| Certificado TLS | Certbot no `install.sh`, com renovação automática por timer | REQ-1.1 |
| Redirecionamento 301 | Bloco `server` do Nginx na porta 80 com `return 301 https://$host$request_uri` | REQ-1.2 |
| HSTS | `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` no Nginx | REQ-1.3 |
| Restart automático | PM2 com `--restart-delay` e `pm2 startup` habilitado no boot | REQ-1.4, REQ-1.5 |
| Homologação | Segunda instância na porta 5004, com banco próprio, `auth_basic` no Nginx e `robots.txt` com `Disallow: /` | REQ-1.6 |
| Segredos | `.env` fora do git; varredura `git grep -nE "(SECRET\|TOKEN\|PASSWORD)=" -- ':!*.example'` sem resultado | REQ-1.7 |

### Backup (REQ-2)

`setup/backup.sh`, agendado às 03:00:

```
pg_dump --format=custom  → dump.pgc
tar -czf uploads.tar.gz uploads/
envia ambos para o destino externo com data no nome
apaga remotos com mais de 30 dias                       (REQ-2.3)
INSERT INTO backup_runs (...)                            (REQ-2.1)
falha em qualquer passo → status='falhou' + notificação  (REQ-2.4)
```

`setup/restore-check.sh` restaura o dump mais recente em um banco descartável e compara
`count(*)` de `products`, `orders` e `customers` com os valores do momento do backup (REQ-2.5).

### Carga inicial (REQ-3)

O importador de produtos já existe (`server/routes.ts:1264`, com template em `:1366`) e aceita
CSV/XLSX com variantes por linha repetida — documentado em `LOJA_VIRTUAL.md`. Ele é estendido para:

- gravar `cost_per_item`, `ncm_code`, `composition` e `measurements` (colunas do epic `catalogo-estoque-unificado`);
- gerar movimentação de entrada com `origin_type='migracao'` ao importar estoque (REQ-3.2);
- produzir `migration_reports` com linhas importadas, atualizadas e falhas (REQ-3.4, REQ-3.5);
- idempotência pelo `Handle`/slug — reimportar atualiza, não duplica (REQ-3.7).

O importador de clientes é novo e chama o mesmo `ClienteService.resolver()` do epic
`clientes-indicadores` (REQ-3.3), gravando `legal_basis` em cada registro criado (REQ-3.6).

### Roteiro de verificação (REQ-4)

Documento executável em `.sintetiza/specs/implantacao-golive/roteiro-verificacao.md`, com cinco
fluxos e evidência exigida por passo:

| Fluxo | Evidência | Atende |
|---|---|---|
| Compra online com PIX | número do pedido, `stock_movements` da saída, webhook recebido, `fin_settlements` da baixa | REQ-4.2 |
| Venda no PDV | número da venda, movimentação de estoque, `orders.cash_session_id` preenchido | REQ-4.3 |
| Consignação com retorno | consignação criada, romaneio gerado, retorno com peça mantida convertido em venda | REQ-4.1 |
| Emissão de NFC-e | chave de acesso e protocolo em ambiente de homologação fiscal | REQ-4.1 |
| Importação de extrato | transações importadas e ao menos uma conciliação automática | REQ-4.1 |

Falha em qualquer fluxo vira work item de impedimento no Plane, com o go-live suspenso até a
resolução (REQ-4.4). Ao fim, `setup/limpar-dados-de-teste.sql` remove os registros de verificação
identificados por marcação própria (REQ-4.5).

O webhook de produção é testado com um pagamento real de valor mínimo, estornado em seguida
(REQ-4.6) — é a única forma de provar que a URL configurada no painel do Asaas está correta.

### Treinamento (REQ-5)

- Manual em `/admin/manual`, construído a partir de `docs/manual.html`, atualizado com PDV,
  consignado, caixa, conciliação e fiscal (REQ-5.1).
- Uma usuária por pessoa, com papel atribuído; `must_change_password = true` na criação (REQ-5.2 … REQ-5.4).
- Contato de suporte e canal registrados na tela de configurações (REQ-5.5).

## Fluxos

**Sequência do go-live**

1. Homologação no ar com o código candidato e a carga inicial aplicada.
2. Roteiro de verificação executado em homologação. Falha → correção antes de seguir.
3. Backup da base de homologação restaurado em ambiente descartável (REQ-2.5).
4. Produção provisionada; carga inicial definitiva aplicada com o estoque contado no dia.
5. Webhooks (Asaas, WhatsApp) reapontados para a URL de produção e testados (REQ-4.6).
6. DNS apontado para produção; propagação acompanhada.
7. Roteiro de verificação repetido em produção; dados de teste removidos (REQ-4.5).
8. Treinamento com a equipe; usuárias criadas; manual publicado.
9. Acompanhamento de 30 dias, conforme a proposta.

**Ordem deliberada:** a carga definitiva vem depois da verificação em homologação e antes da virada
de DNS — o estoque precisa refletir a contagem do dia da virada, não a de duas semanas antes.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Reuso dos scripts de `setup/` | Nova esteira de deploy com CI/CD | Os scripts já existem, estão documentados e funcionam; construir esteira nova consome horas do bloco sem entregar nada à cliente |
| Homologação como segunda instância na mesma VPS | Servidor separado | O custo de um segundo servidor não se justifica no porte da operação; bancos separados dão o isolamento que importa |
| Backup em armazenamento externo | Backup no próprio disco com retenção | Perda do servidor é o cenário coberto pelo backup; cópia no mesmo disco não cobre nada |
| Restauração efetivamente testada antes do go-live | Confiar no script de backup | Backup nunca restaurado é hipótese, não garantia |
| Webhook testado com pagamento real de valor mínimo | Testar só em sandbox | Sandbox não prova que a URL de produção está configurada no painel do provedor — que é a falha mais comum de go-live |
| Dados de verificação removidos por script identificado | Deixar e filtrar nos relatórios | Filtro é esquecido; o primeiro relatório da cliente sai com venda de teste dentro |
| Manual dentro do painel | PDF entregue por e-mail | PDF some; o manual precisa estar onde a dúvida aparece |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Exportação do sistema atual indisponível ou incompleta | Carga inicial manual consome muito mais que as 5 h previstas | Planilha padronizada fornecida logo no início do projeto, para a equipe preencher em paralelo ao desenvolvimento |
| Estoque contado desatualizado no dia da virada | Loja abre vendendo o que não tem | Inventário de abertura executado no dia do go-live, usando o módulo de inventário do epic `catalogo-estoque-unificado` |
| DNS propagando lentamente e loja fora do ar por horas | Perda de venda e desgaste no dia mais visível do projeto | TTL do domínio reduzido para 300 s com 24 h de antecedência |
| Certificado A1 ou provedor fiscal não contratados na data | Go-live sem emissão de cupom fiscal | Dependência sinalizada nas perguntas em aberto do epic `fiscal-nfce`; a loja pode entrar no ar sem NFC-e, com a emissão habilitada depois |
| Equipe treinada em fluxo que muda depois do treinamento | Retrabalho de treinamento e insegurança no uso | Treinamento realizado sobre o código já congelado para o go-live, não sobre versão intermediária |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | manual | `curl -sI https://<dominio>` → 200 e `openssl s_client -connect <dominio>:443` mostra certificado válido para o domínio |
| REQ-1.2 | manual | `curl -sI http://<dominio>` → 301 com `Location: https://<dominio>` |
| REQ-1.3 | manual | `curl -sI https://<dominio> \| grep -i strict-transport-security` retorna a linha |
| REQ-1.4 | manual | `pm2 stop app && sleep 60 && curl -sI https://<dominio>` → 200 |
| REQ-1.5 | manual | `sudo reboot`; após subir, `curl -sI https://<dominio>` → 200 sem comando manual |
| REQ-1.6 | manual | `curl -sI https://homolog.<dominio>` → 401 sem credencial; `curl -s https://homolog.<dominio>/robots.txt` contém `Disallow: /` |
| REQ-1.7 | manual | `git grep -nE "(SECRET\|TOKEN\|PASSWORD\|KEY)=" -- ':!*.example'` sem resultado; log da aplicação sem valor de segredo |
| REQ-2.1 | manual | No dia seguinte à configuração, `SELECT * FROM backup_runs ORDER BY id DESC LIMIT 1` traz execução `ok` do dia |
| REQ-2.2 | manual | Listagem do destino externo mostra os arquivos do dia |
| REQ-2.3 | manual | Após simular 31 dias de execuções, o destino tem no máximo 30 conjuntos |
| REQ-2.4 | manual | Apontar o destino para caminho inválido e rodar → `status='falhou'` e notificação recebida |
| REQ-2.5 | manual | `setup/restore-check.sh` → `count(*)` de `products`, `orders` e `customers` iguais aos do momento do backup |
| REQ-3.1 | integração | Importar planilha de 20 peças com grade → 20 peças e as variações informadas criadas |
| REQ-3.2 | integração | Importar estoque → uma movimentação `entrada` por variação com `origin_type='migracao'` |
| REQ-3.3 | integração | Planilha com CPF já existente → nenhum cliente duplicado; `matchedBy` registrado no relatório |
| REQ-3.4 | integração | Planilha com 3 linhas inválidas → as demais importadas e as 3 no relatório com motivo |
| REQ-3.5 | integração | Resposta e `migration_reports` trazem importadas, atualizadas e falhas conferidas contra a planilha |
| REQ-3.6 | integração | `SELECT legal_basis FROM customers WHERE id IN (importados)` preenchido |
| REQ-3.7 | integração | Reimportar a mesma planilha → `imported: 0`, `updated: n`, sem duplicatas |
| REQ-3.8 | integração | `POST` de importação sem sessão → 401 e `count(*)` de `products` inalterado |
| REQ-3.9 | integração | Subir um `.pdf` → 400 `formato_invalido` e nenhuma linha importada |
| REQ-4.1 | manual | Roteiro executado com evidência registrada para os 5 fluxos |
| REQ-4.2 | manual | Após a compra de verificação: pedido, `stock_movements`, webhook e `fin_settlements` conferidos |
| REQ-4.3 | manual | Após a venda de verificação: `orders` com `channel='loja'`, movimentação e `cash_session_id` conferidos |
| REQ-4.4 | manual | Falha registrada como work item de impedimento no Plane, com o go-live suspenso |
| REQ-4.5 | manual | Após a limpeza, os registros de verificação não aparecem em `GET /api/admin/reports/vendas` |
| REQ-4.6 | manual | Pagamento real de valor mínimo em produção → webhook recebido e pedido confirmado; estorno em seguida |
| REQ-5.1 | manual | `/admin/manual` responde com as seções de PDV, consignado, caixa, conciliação e fiscal |
| REQ-5.2 | integração | Criar usuária → primeiro login exige troca de senha antes de acessar o painel |
| REQ-5.3 | manual | `GET /api/admin/users` lista uma usuária por pessoa da equipe, com papel |
| REQ-5.4 | manual | Nenhuma usuária com nome genérico de setor; conferência na listagem com a equipe |
| REQ-5.5 | manual | Tela de configurações mostra contato e canal de suporte preenchidos |

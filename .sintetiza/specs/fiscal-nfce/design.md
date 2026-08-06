# Design — Cupom Fiscal NFC-e

**Requisitos cobertos:** REQ-1 … REQ-5 · **Spec:** ./requirements.md

## Visão arquitetural

A emissão fiscal é um **acoplamento assíncrono e não bloqueante** ao fechamento do cupom no PDV.
A venda é a verdade comercial; o documento fiscal é uma consequência dela que pode falhar, ficar
pendente e ser reprocessada — sem nunca desfazer a venda (REQ-2.4).

```
POST /pdv/vendas ─→ (venda commitada) ─→ FiscalService.emitir(orderId)
                                            ├─ valida NCM de todo item        → 409 item_sem_ncm
                                            ├─ monta payload
                                            └─ NotaFiscalProvider.emitir()
                                                 ├─ autorizado    → fiscal_documents.status='autorizado'
                                                 ├─ rejeitado     → status='rejeitado' + motivo
                                                 └─ timeout 10 s  → status='contingencia'
                                                                     └─ job 10 min ─→ retransmite
```

`NotaFiscalProvider` segue o mesmo padrão de `PaymentGateway` (`server/gateway/types.ts:33`): uma
interface, um adaptador por provedor, um registry. É a estrutura que o repositório já usa para
pagamento e frete, e a que permite trocar de provedor sem tocar no PDV.

Nova pasta: `server/fiscal/` com `types.ts`, `index.ts` (registry), `<provedor>.ts` (adaptador),
`service.ts` (orquestração), `certificado.ts` (cifra e leitura do A1).

## Modelo de dados

Migration nova: `migrations/019_fiscal.sql`, idempotente.

| Entidade | Campos | Atende |
|---|---|---|
| `fiscal_settings` | `id serial pk`, `cnpj text not null`, `ie text not null`, `tax_regime text not null`, `default_cfop text not null`, `nfce_series text not null`, `next_number int not null default 1`, `provider text not null`, `provider_token_encrypted bytea`, `environment text not null default 'homologacao'`, `cancel_window_minutes int not null default 30`, `enabled bool default false`, `updated_at` | REQ-1.1, REQ-3.3 |
| `fiscal_certificates` | `id serial pk`, `filename text not null`, `content_encrypted bytea not null`, `password_encrypted bytea not null`, `valid_from date`, `valid_until date not null`, `uploaded_by int`, `created_at` | REQ-1.2, REQ-1.6 |
| `fiscal_documents` | `id serial pk`, `order_id int not null unique`, `model text not null default '65'`, `series text`, `number int`, `access_key text unique`, `protocol text`, `authorized_at timestamptz`, `danfe_url text`, `status text not null default 'pendente'` (`pendente`/`contingencia`/`autorizado`/`rejeitado`/`cancelado`), `rejection_code text`, `rejection_message text`, `attempts int default 0`, `last_attempt_at timestamptz`, `cancel_protocol text`, `cancel_reason text`, `cancelled_by int`, `cancelled_at timestamptz`, `created_at` | REQ-2.2 … REQ-2.6, REQ-3.1 … REQ-3.6, REQ-4.1 … REQ-4.6 |
| `fiscal_deliveries` | `id serial pk`, `document_id int not null`, `channel text not null` (`email`/`whatsapp`/`nenhum`), `status text not null` (`enviado`/`falhou`/`sem_canal`), `error text`, `created_at` | REQ-5.1 … REQ-5.4 |

`order_id UNIQUE` em `fiscal_documents` é o que garante REQ-2.6 no banco: uma venda tem no máximo um
documento fiscal.

Índice: `idx_fiscal_documents_status_attempt` em (`status`,`last_attempt_at`) — é o índice do job de
retransmissão (REQ-4.3).

**Cifra (REQ-1.2, REQ-1.4, REQ-1.5):** AES-256-GCM do `node:crypto`, com chave derivada por
`scrypt` de `FISCAL_ENCRYPTION_KEY` (variável de ambiente, nunca em banco nem em commit). O
`GET /api/admin/fiscal/settings` devolve `providerToken: null` e `certificate: {validUntil, filename}`
— jamais conteúdo ou senha.

## Contratos de API

Todas as rotas de configuração exigem `requireRole(["admin"])` (REQ-1.7). Emissão e cancelamento
aceitam `admin` e `operator`.

### PUT /api/admin/fiscal/settings — atende REQ-1.1, REQ-1.7

- **Request:** `{ cnpj, ie, taxRegime, defaultCfop, nfceSeries, nextNumber, provider, providerToken?, environment, cancelWindowMinutes?, enabled }`
- **200:** configuração salva, com `providerToken` mascarado na resposta (REQ-1.4)
- **403:** papel diferente de `admin`

### POST /api/admin/fiscal/certificate — atende REQ-1.2 … REQ-1.5

- **Request:** `multipart/form-data` com `file` (.pfx/.p12) e `password`
- **201:** `{ validFrom, validUntil, filename }`
- **400:** `certificado_ou_senha_invalidos` (REQ-1.3) — abre o PKCS#12 antes de persistir; falhando,
  nada é gravado e o buffer é descartado
- Validade extraída do certificado, não informada pela usuária

### GET /api/admin/fiscal/alerts — atende REQ-1.6, REQ-4.5

- **200:** `{ certificadoExpiraEm: number|null, documentosEmContingencia: number, contingenciaMaisAntigaHoras: number|null }`

### POST /api/admin/fiscal/emitir — atende REQ-2.1 … REQ-2.7

- **Request:** `{ orderId: number, customerCpf?: string }`
- **201:** `{ documentId, status, accessKey?, danfeUrl?, rejectionMessage? }`
- **200:** quando já existe documento para a venda — retorna o existente (REQ-2.6)
- **401:** sem sessão (REQ-2.7)
- **409:** `item_sem_ncm` com o SKU (REQ-2.5) — verificado **antes** de chamar o provedor
- Rejeição do provedor → 201 com `status: "rejeitado"` e a mensagem; a venda permanece intacta
  (REQ-2.3, REQ-2.4)

### POST /api/admin/fiscal/documentos/:id/cancelar — atende REQ-3.1 … REQ-3.6

- **Request:** `{ reason: string(15..255) }`
- **200:** `{ cancelProtocol, cancelledAt }`
- **400:** `justificativa_invalida` (REQ-3.2)
- **409:** `prazo_de_cancelamento_expirado` quando `now() - authorized_at > cancel_window_minutes`
  (REQ-3.3); `documento_ja_cancelado` (REQ-3.5)

### POST /api/admin/fiscal/documentos/:id/enviar — atende REQ-5.1 … REQ-5.5

- **Request:** `{ channel: "email"|"whatsapp" }`
- **200:** `{ sent: true }`; grava em `fiscal_deliveries`
- Falha do canal → 200 com `{ sent: false }`, registro `falhou` e **status do documento inalterado**
  (REQ-5.4)

## Fluxos

**Emissão no fechamento do cupom**

O `POST /api/admin/pdv/vendas` (epic `pdv-etiquetas`) commita a venda e **depois** chama
`FiscalService.emitir()`. A resposta da venda inclui o resultado fiscal, mas o sucesso da venda não
depende dele — o front exibe a venda como concluída e o documento fiscal com o próprio status.

```
emitir(orderId):
  doc = SELECT … WHERE order_id = $1
  if doc exists → return doc                                   (REQ-2.6)
  itens = SELECT … JOIN products p WHERE p.ncm_code IS NULL     → 409 item_sem_ncm (REQ-2.5)
  INSERT fiscal_documents (order_id, status='pendente')         -- UNIQUE protege corrida
  payload = montar(order, itens, pagamentos, cpf?)
  try provider.emitir(payload, certificado, timeout=10s)
    autorizado → UPDATE status='autorizado', access_key, protocol, danfe_url, authorized_at
                 → enfileira envio do DANFE                     (REQ-5.1)
    rejeitado  → UPDATE status='rejeitado', rejection_code, rejection_message   (REQ-2.3)
  catch timeout/rede
    → UPDATE status='contingencia', last_attempt_at = now()     (REQ-4.1, REQ-4.2)
```

**Retransmissão de contingência (REQ-4.3, REQ-4.4, REQ-4.6)**

Job a cada 10 minutos no processo do servidor:

```sql
UPDATE fiscal_documents
   SET status = 'transmitindo', attempts = attempts + 1, last_attempt_at = now()
 WHERE id IN (SELECT id FROM fiscal_documents
               WHERE status = 'contingencia'
               ORDER BY created_at
               FOR UPDATE SKIP LOCKED
               LIMIT 20)
RETURNING id;
```

`FOR UPDATE SKIP LOCKED` é o que impede duas execuções do job de transmitirem o mesmo cupom
(REQ-4.6). Cada id retornado é transmitido; sucesso vira `autorizado`, falha volta a `contingencia`.

**Numeração**

`fiscal_settings.next_number` é incrementado com `UPDATE … SET next_number = next_number + 1
RETURNING next_number` dentro da transação de criação do documento — atômico, sem sequência
separada, e permite ajustar o ponto de partida na configuração inicial.

## Decisões

| Decisão | Alternativas descartadas | Motivo |
|---|---|---|
| Provedor homologado atrás de interface | Comunicação direta com a SEFAZ | Assinatura XML, esquemas por UF e mudanças de layout são manutenção contínua que não é o negócio da loja nem cabe nas 12h do módulo |
| Emissão depois do commit da venda | Emissão dentro da transação da venda | Chamada de rede dentro de transação segura conexão do banco; e rollback por erro fiscal criaria divergência de estoque |
| `order_id UNIQUE` para idempotência | Verificar existência antes de emitir | `SELECT` prévio não é atômico; dois cliques no botão emitiriam duas notas |
| Certificado cifrado com chave em variável de ambiente | Arquivo em disco protegido por permissão | Dump de banco ou acesso ao volume bastaria para assinar em nome da empresa; a chave fora do banco quebra essa cadeia |
| NCM verificado antes do envio | Deixar a SEFAZ rejeitar | A rejeição chega com a cliente no balcão esperando; a verificação prévia transforma o problema em pendência de cadastro |
| Contingência automática por timeout de 10 s | Botão manual de contingência | Decidir modo fiscal sob pressão do balcão é fonte de erro; 10 s é limite perceptível e seguro |
| `FOR UPDATE SKIP LOCKED` na fila de retransmissão | Flag `processando` no registro | Flag sem trava não impede corrida; `SKIP LOCKED` é a construção do Postgres feita exatamente para fila |
| Prazo de cancelamento configurável | 30 min fixos em código | O prazo varia por UF e por norma; configuração evita deploy a cada mudança de legislação |

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Provedor ainda não contratado quando a task começar | Task bloqueada com o cronograma correndo | As perguntas em aberto do `requirements.md` marcam isso; a interface e os testes contra um adaptador *fake* podem ser construídos antes da contratação |
| Parametrização fiscal errada gerando notas com tributação indevida | Passivo fiscal para a cliente | Ambiente de homologação como padrão (`environment='homologacao'`); a virada para produção é passo explícito do go-live, após validação da contabilidade |
| Certificado A1 expirando sem ninguém perceber | Loja para de emitir do dia para a noite | Alerta a partir de 30 dias no painel (REQ-1.6), reforçado no checklist de operação |
| Contingência acumulando por dias sem ninguém olhar | Documentos não transmitidos e risco de autuação | Alerta de contingência acima de 24 h (REQ-4.5) no mesmo painel |
| `next_number` divergindo da numeração já usada pela cliente em outro sistema | Rejeição em série por número duplicado | Numeração inicial e série confirmadas com a contabilidade antes da virada para produção (pergunta em aberto 3) |

## Estratégia de teste

| Critério | Tipo | Como verificar |
|---|---|---|
| REQ-1.1 | integração | `PUT /fiscal/settings` → `SELECT cnpj, ie, tax_regime, default_cfop, nfce_series FROM fiscal_settings` preenchidos |
| REQ-1.2 | integração | Subir `.pfx` válido → `content_encrypted` é `bytea` não legível e `valid_until` bate com a validade do certificado |
| REQ-1.3 | integração | Subir com senha errada → 400 `certificado_ou_senha_invalidos` e `count(*)` de `fiscal_certificates` inalterado |
| REQ-1.4 | integração | `GET /fiscal/settings` → o JSON não contém `providerToken` nem conteúdo/senha do certificado |
| REQ-1.5 | unitário | Executar upload e emissão com logger capturado: a saída não contém a senha, o conteúdo do certificado nem o token |
| REQ-1.6 | integração | Certificado com validade em 20 dias → `GET /fiscal/alerts` traz `certificadoExpiraEm: 20` |
| REQ-1.7 | integração | `PUT /fiscal/settings` com sessão `operator` → 403 |
| REQ-2.1 | integração | Adaptador *fake* registra o payload recebido: contém itens, valores, formas de pagamento e o CPF quando informado |
| REQ-2.2 | integração | *Fake* retorna autorização → `access_key`, `number`, `series`, `protocol`, `authorized_at` e `danfe_url` gravados |
| REQ-2.3 | integração | *Fake* retorna rejeição 999 → `status='rejeitado'` com código e mensagem; a venda continua em `orders` |
| REQ-2.4 | integração | Após falha de emissão, `orders` e `stock_movements` da venda permanecem inalterados |
| REQ-2.5 | integração | Item sem `ncm_code` → 409 `item_sem_ncm` com o SKU e o *fake* não recebe chamada |
| REQ-2.6 | integração | Chamar `/emitir` duas vezes para a mesma venda → 1 linha em `fiscal_documents`; a segunda resposta é 200 com o mesmo documento |
| REQ-2.7 | integração | `POST /fiscal/emitir` sem sessão → 401 |
| REQ-3.1 | integração | Cancelar documento autorizado com justificativa de 20 caracteres → `cancel_protocol` gravado |
| REQ-3.2 | integração | Justificativa de 10 caracteres → 400 `justificativa_invalida` e o *fake* não recebe chamada |
| REQ-3.3 | integração | Documento autorizado há 40 min com janela de 30 → 409 `prazo_de_cancelamento_expirado` |
| REQ-3.4 | integração | Após cancelar → `status='cancelado'`, `cancel_reason` preservado e o documento continua listado |
| REQ-3.5 | integração | Cancelar de novo → 409 `documento_ja_cancelado` |
| REQ-3.6 | integração | `SELECT cancelled_by, cancelled_at FROM fiscal_documents WHERE id=…` preenchidos |
| REQ-4.1 | integração | *Fake* com atraso de 12 s → resposta em ≤ 11 s, `status='contingencia'` e a venda concluída |
| REQ-4.2 | integração | `SELECT status, last_attempt_at FROM fiscal_documents WHERE id=…` traz `contingencia` e o horário |
| REQ-4.3 | integração | Rodar o job com o *fake* respondendo → documento passa a `autorizado` |
| REQ-4.4 | integração | Após a retransmissão → `access_key`, `protocol` e `authorized_at` preenchidos |
| REQ-4.5 | integração | Documento em contingência há 30 h → `GET /fiscal/alerts` traz `contingenciaMaisAntigaHoras: 30` |
| REQ-4.6 | integração | Duas execuções simultâneas do job sobre a mesma fila → o *fake* recebe uma chamada por documento, nunca duas |
| REQ-5.1 | integração | Autorização com cliente que tem e-mail → linha em `fiscal_deliveries` com `channel='email'`, `status='enviado'` |
| REQ-5.2 | integração | `POST /enviar {channel:"whatsapp"}` → notificador recebe o link do DANFE e o envio é registrado |
| REQ-5.3 | integração | Cliente sem e-mail e sem telefone → documento autorizado e `fiscal_deliveries` com `status='sem_canal'` |
| REQ-5.4 | integração | Notificador falhando → `status='falhou'` e `fiscal_documents.status` continua `autorizado` |
| REQ-5.5 | unitário | Registrar envio com logger capturado: a saída não contém e-mail nem telefone |

# Conector MercadoPago

Integração portável com a API do **MercadoPago** (PIX, boleto, cartão, estornos,
busca de pagamentos, webhooks). Mesmo padrão do conector Asaas: framework-agnostic,
com **modo mock** para desenvolver sem conta e um **servidor MCP** para agentes de IA.

Conector portável: copie a pasta `server/mercadopago/` para qualquer projeto Node.

## Arquivos

| Arquivo | Papel |
|---|---|
| `config.ts` | `loadConfig(env)` → `MPConfig`. Lê tudo de env vars. |
| `types.ts` | Tipos da API v1 (pagamentos, refunds, meios, webhook…). |
| `client.ts` | HTTP client (Bearer + `X-Idempotency-Key`), normaliza `{message,cause[]}`. |
| `service.ts` | Operações de alto nível, com fallback mock + validação de webhook. |
| `index.ts` | Re-exports. |
| `mcp.ts` | Servidor MCP stdio (9 ferramentas). |

## Variáveis de ambiente

```
MP_ACCESS_TOKEN=      # vazio = MOCK. Sandbox começa com TEST-
MP_ENV=sandbox        # sandbox | production (default: derivado do prefixo do token)
MP_MOCK=              # 1 força mock mesmo com token
MP_USER_AGENT=LojaVirtual
MP_WEBHOOK_SECRET=    # segredo do painel (assinatura x-signature)
MP_MAX_INSTALLMENTS=12
```

O MercadoPago **não tem host separado de sandbox**: o ambiente é definido pelo
prefixo do token (`TEST-...` = teste). A base é sempre `https://api.mercadopago.com`.

## Endpoints usados

- `POST /v1/payments` (criar — PIX/boleto/cartão) com `X-Idempotency-Key`
- `GET /v1/payments/{id}` (consultar), `GET /v1/payments/search` (buscar)
- `POST /v1/payments/{id}/refunds` (estorno total/parcial), `GET .../refunds`
- `GET /v1/payment_methods` (meios disponíveis)

## Cartão (importante)

A **tokenização do cartão é client-side** no MercadoPago (SDK MP.js gera o `token`).
Este conector recebe o `token` pronto e cria o pagamento — não coleta o número do
cartão no servidor. PIX e boleto não precisam de token.

## Webhook

O MP assina a notificação com o header `x-signature: ts=<unix>,v1=<hmac>` +
`x-request-id`. O manifesto assinado é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
e o hash é `HMAC-SHA256(manifesto, MP_WEBHOOK_SECRET)` em hex. `validateWebhookSignature`
faz essa verificação em tempo constante.

## MCP

```
npm run mcp:mercadopago
```
Ferramentas: `mercadopago_config`, `mercadopago_create_payment`, `mercadopago_get_payment`,
`mercadopago_search_payments`, `mercadopago_pix_qrcode`, `mercadopago_boleto`,
`mercadopago_refund`, `mercadopago_payment_methods`, `mercadopago_validate_webhook`.

## Teste no sandbox

Use um **access token de teste** (`TEST-...`) do seu app no painel de desenvolvedores.
Cartões de teste do MP (ex.: Mastercard `5031 4332 1540 6351`, CVV `123`, val. futura)
com nome do titular controlando o resultado: `APRO` (aprovado), `OTHE` (recusado),
`CONT` (pendente). CPF de teste: `12345678909`.

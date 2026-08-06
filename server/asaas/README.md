# Conector Asaas

Integração portável com o gateway de pagamento **Asaas** (PIX, boleto, cartão,
assinaturas, links de pagamento, estornos, webhooks). Construído no mesmo padrão
do conector SmartEnvios: framework-agnostic, com **modo mock** para desenvolver
sem conta e um **servidor MCP** para agentes de IA.

Conector portável: copie a pasta `server/asaas/` para qualquer projeto Node do template.

## Arquivos

| Arquivo | Papel |
|---|---|
| `config.ts` | `loadConfig(env)` → `AsaasConfig`. Lê tudo de env vars. |
| `types.ts` | Tipos da API v3 (clientes, cobranças, assinaturas, webhooks…). |
| `client.ts` | HTTP client (header `access_token` + `User-Agent`), normaliza `{errors[]}`. |
| `service.ts` | Operações de alto nível, com fallback mock. |
| `index.ts` | Re-exports. |
| `mcp.ts` | Servidor MCP stdio (13 ferramentas). |

No checkout deste projeto o Asaas é um **provider de gateway**
(`server/gateway/asaas.ts`) que reutiliza este conector. Ative-o definindo
`PAYMENT_GATEWAY=asaas` no `.env` (default = `mercadopago`). O webhook fica em
`POST /api/webhooks/asaas`. **Cartão** continua no MercadoPago (o front tokeniza
no MP); via Asaas o checkout cobre **PIX e boleto**.

## Variáveis de ambiente

```
PAYMENT_GATEWAY=asaas     # ativa o Asaas no checkout (default: mercadopago)
ASAAS_API_KEY=            # vazio = MOCK. Sandbox começa com $aact_hmlg_
ASAAS_ENV=sandbox         # sandbox | production
ASAAS_MOCK=               # 1 força mock mesmo com chave
ASAAS_USER_AGENT=LojaVirtual
ASAAS_WEBHOOK_TOKEN=      # segredo do header asaas-access-token (gere forte)
ASAAS_WEBHOOK_URL=        # URL pública do /api/webhooks/asaas
```

## Fluxo de pagamento

1. Cliente finaliza o pedido → `POST /api/checkout`. Com `PAYMENT_GATEWAY=asaas`,
   o dispatch chama `asaasGateway.createPayment` (`server/gateway/asaas.ts`).
2. O provider garante o cliente Asaas (`ensureCustomer` dedup por CPF), cria a
   cobrança e devolve `pixQrCode`/`pixQrCodeBase64` (PIX) ou `boletoUrl`/`boletoBarcode`
   (boleto); grava uma `payment_transactions` com `gateway: "asaas"`.
3. Asaas notifica `POST /api/webhooks/asaas` (valida `asaas-access-token`, responde
   200 rápido). Ao confirmar, o pedido vira `confirmed` e (se `SMARTENVIOS_AUTO_LABEL=1`)
   gera a etiqueta SmartEnvios.

## Segurança

- Chave da API **só no `.env`** — nunca vai ao navegador.
- Dados de cartão trafegam do front → backend → Asaas, **sem persistir nem logar**.
- Webhook autenticado por segredo compartilhado (`timingSafeEqual`).

## MCP

```
npm run mcp:asaas
```
Ferramentas: `asaas_config`, `asaas_create_payment`, `asaas_get_payment`,
`asaas_pix_qrcode`, `asaas_boleto_linha`, `asaas_refund`, `asaas_create_subscription`,
`asaas_cancel_subscription`, `asaas_create_payment_link`, `asaas_balance`,
`asaas_statement`, `asaas_list_webhooks`, `asaas_register_webhook`.

## Teste no sandbox

O sandbox não confirma pagamento por API — use o botão **"CONFIRMAR PAGAMENTO"** na
UI web do sandbox, que dispara os webhooks reais. Para o webhook alcançar o
localhost, use um túnel (ex: cloudflared) apontando pro `/api/webhooks/asaas` e
registre a URL com `POST /api/admin/payments/register-webhook`.

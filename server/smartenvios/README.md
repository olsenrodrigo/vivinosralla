# Conector SmartEnvios

Conector **portátil** (sem dependências de framework) para a API SmartEnvios —
cotação de frete, criação de pedido (Declaração de Conteúdo), geração de etiqueta
e rastreio. Feito para o **PuraFlora (piloto)** e para ser **copiado no motor do
whitelabellojavirtual** (basta copiar esta pasta para `server/smartenvios`).

## Estrutura

```
server/smartenvios/
├── config.ts     # lê env → SmartEnviosConfig (token, ambiente, remetente, regras)
├── types.ts      # tipos do domínio (camelCase)
├── client.ts     # cliente HTTP (header token)
├── service.ts    # quoteFreight · priceQuotes · createOrder · generateLabel · track  (+ modo mock)
├── index.ts      # exports
└── mcp.ts        # servidor MCP (stdio) expondo as operações como ferramentas
```

## Configuração (variáveis de ambiente)

Veja `.env.example`. Principais:

| Variável | Descrição |
|----------|-----------|
| `SMARTENVIOS_TOKEN` | Token do painel. **Vazio = modo mock** (cotações/etiquetas simuladas). |
| `SMARTENVIOS_ENV` | `sandbox` (padrão) ou `production`. |
| `SENDER_*` | Dados do remetente/origem (CEP, CNPJ, endereço, telefone, e-mail, complemento). |
| `FREE_SHIPPING_ABOVE` | Frete grátis a partir deste subtotal (R$). |
| `SHIPPING_DISCOUNT_PERCENT` | Desconto % no frete. |
| `DOCUMENT_MODE` | `nfe` (pedido exige NF-e) ou `dc` (Declaração de Conteúdo). |
| `LABEL_DOCUMENT_TYPE` | `label_integrated_danfe` (padrão) ou `label_separate_danfe`. |

### Documento fiscal (NF-e × DC)

Contas que **exigem NF-e** (`DOCUMENT_MODE=nfe`): crie o pedido com a **chave da NF-e**
(`createOrder({ ..., nfeKey })`) ou anexe o XML depois (`uploadNfe(cfg, orderId, xml)`).
A etiqueta sai com a **DANFE integrada**. Contas com Declaração de Conteúdo (`dc`) dispensam a NF-e.

MCP tem o **configurador**: `smartenvios_set_document_mode`, `smartenvios_nfe_upload`,
`smartenvios_update_order` (vincular `nfe_key`), além de `quote/create_order/generate_label/track`.

## Uso como módulo (checkout / webhook / admin)

```ts
import { loadConfig } from "./server/smartenvios";
import { quoteFreight, priceQuotes, createOrder, generateLabel } from "./server/smartenvios";

const cfg = loadConfig(process.env);

// 1) Cotar no checkout
const services = await quoteFreight(cfg, { zipFrom: cfg.sender.zipcode, zipTo, volumes });
const options = priceQuotes(cfg, services, subtotal); // aplica frete grátis/desconto

// 2) Após o pagamento: criar pedido + etiqueta
const order = await createOrder(cfg, { recipient, items, quoteServiceId });
const label = await generateLabel(cfg, { orderIds: [order.orderId!], type: "pdf" });
// label.url → PDF da etiqueta; order.trackingCode → rastreio
```

## API HTTP (PuraFlora — plugin Vite)

Servida server-side (o token nunca vai ao navegador):

- `GET  /api/shipping/config` — info pública (ambiente, mock, frete grátis).
- `POST /api/shipping/quote` — `{ zipTo, subtotal, volumes[] }` → opções priced.
- `POST /api/shipping/order` — cria pedido (DC) + gera etiqueta.

Em produção, o mesmo `makeHandler` pode ser montado num Express/serverless.

## Servidor MCP

```bash
npm run mcp      # tsx server/smartenvios/mcp.ts (stdio)
```

Ferramentas: `smartenvios_config`, `smartenvios_quote`, `smartenvios_create_order`,
`smartenvios_generate_label`, `smartenvios_track`.

Registro no Claude (`.mcp.json` / config do cliente):

```json
{
  "mcpServers": {
    "smartenvios": {
      "command": "npx",
      "args": ["tsx", "server/smartenvios/mcp.ts"],
      "cwd": "/Users/olsenrodrigo/Sites/PURAFLORA/codigo",
      "env": {
        "SMARTENVIOS_TOKEN": "seu_token_sandbox",
        "SMARTENVIOS_ENV": "sandbox",
        "SENDER_ZIPCODE": "14170763",
        "SENDER_DOCUMENT": "00000000000000"
      }
    }
  }
}
```

## Fluxo SmartEnvios (referência)

`POST /quote/freight` → `POST /dc-create` → (`POST /nfe-upload` opcional/DC) →
`POST /labels` → `POST /freight-order/tracking`. Auth: header `token`.
Base: `api.smartenvios.com/v1` (prod) · `sandbox.api.smartenvios.com` (homolog.).

> **Nota de produção:** no piloto o `subtotal`/`volumes` são calculados no cliente.
> No motor definitivo (whitelabel), recalcule-os no servidor a partir dos dados
> autoritativos do pedido antes de cotar/gerar etiqueta.

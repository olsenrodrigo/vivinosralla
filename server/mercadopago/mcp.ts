#!/usr/bin/env -S npx tsx
// Servidor MCP do conector MercadoPago (transporte stdio).
// Expõe as operações do gateway como ferramentas para o Claude/agentes:
//   mercadopago_config, mercadopago_create_payment, mercadopago_get_payment,
//   mercadopago_search_payments, mercadopago_pix_qrcode, mercadopago_boleto,
//   mercadopago_refund, mercadopago_payment_methods, mercadopago_validate_webhook
//
// Registro no Claude (ex.: claude_desktop_config.json / .mcp.json):
//   "mercadopago": {
//     "command": "npx",
//     "args": ["tsx", "server/mercadopago/mcp.ts"],
//     "cwd": "/caminho/para/o/projeto",
//     "env": { "MP_ACCESS_TOKEN": "TEST-...", "MP_ENV": "sandbox" }
//   }
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config";
import {
  createPayment,
  getPayment,
  searchPayments,
  refundPayment,
  listRefunds,
  cancelPayment,
  getPaymentMethods,
  createTestCardToken,
  extractPixData,
  extractBoletoData,
  validateWebhookSignature,
} from "./service";
import type { MPAddress, PaymentInput } from "./types";

// carrega .env (não-fatal) se existir
function loadDotEnv() {
  const p = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadDotEnv();

const cfg = loadConfig(process.env);

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (err: unknown) => ({
  isError: true,
  content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
});

const server = new McpServer({ name: "mercadopago", version: "1.0.0" });

server.tool("mercadopago_config", "Mostra a configuração atual do conector (sem expor o token)", async () =>
  ok({ env: cfg.env, mock: cfg.mock, baseUrl: cfg.baseUrl, maxInstallments: cfg.maxInstallments })
);

server.tool(
  "mercadopago_create_payment",
  "Cria um pagamento (PIX, boleto ou cartão). Para PIX use paymentMethodId 'pix'; boleto 'bolbradesco' (exige endereço do pagador); cartão informe o token (gerado no front/test_card_token) + a bandeira.",
  {
    amount: z.number().positive(),
    paymentMethodId: z.string().describe("pix | bolbradesco | visa | master | …"),
    payerEmail: z.string(),
    cpf: z.string().describe("CPF/CNPJ do pagador (só dígitos ou formatado)"),
    payerFirstName: z.string().optional(),
    payerLastName: z.string().optional(),
    description: z.string().optional(),
    externalReference: z.string().optional(),
    token: z.string().optional().describe("Token do cartão (obrigatório p/ cartão)"),
    installments: z.number().int().positive().optional(),
    expirationMinutes: z.number().int().positive().optional().describe("Expiração do PIX/boleto em minutos"),
    // Endereço do pagador — obrigatório para boleto (bolbradesco).
    zipCode: z.string().optional(),
    streetName: z.string().optional(),
    streetNumber: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    federalUnit: z.string().optional().describe("UF (2 letras)"),
  },
  async (args) => {
    try {
      const digits = args.cpf.replace(/\D/g, "");
      const address: MPAddress | undefined =
        args.zipCode && args.streetName && args.streetNumber
          ? {
              zip_code: args.zipCode.replace(/\D/g, ""),
              street_name: args.streetName,
              street_number: args.streetNumber,
              neighborhood: args.neighborhood,
              city: args.city,
              federal_unit: args.federalUnit,
            }
          : undefined;
      const input: PaymentInput = {
        transaction_amount: args.amount,
        description: args.description,
        payment_method_id: args.paymentMethodId,
        payer: {
          email: args.payerEmail,
          first_name: args.payerFirstName,
          last_name: args.payerLastName,
          identification: { type: digits.length > 11 ? "CNPJ" : "CPF", number: digits },
          address,
        },
        external_reference: args.externalReference,
        token: args.token,
        installments: args.installments,
        capture: args.token ? true : undefined,
        date_of_expiration: args.expirationMinutes
          ? new Date(Date.now() + args.expirationMinutes * 60000).toISOString()
          : undefined,
      };
      const payment = await createPayment(cfg, input);
      const extra =
        args.paymentMethodId === "pix"
          ? { pix: extractPixData(payment) }
          : args.paymentMethodId === "bolbradesco"
            ? { boleto: extractBoletoData(payment) }
            : {};
      return ok({ payment, ...extra });
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "mercadopago_get_payment",
  "Consulta um pagamento pelo id",
  { paymentId: z.string() },
  async ({ paymentId }) => {
    try {
      return ok(await getPayment(cfg, paymentId));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "mercadopago_search_payments",
  "Busca pagamentos (por external_reference e/ou status)",
  {
    externalReference: z.string().optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(10),
  },
  async ({ externalReference, status, limit }) => {
    try {
      return ok(await searchPayments(cfg, { external_reference: externalReference, status, limit }));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "mercadopago_pix_qrcode",
  "Obtém o QR Code PIX (copia-e-cola + imagem base64) de um pagamento",
  { paymentId: z.string() },
  async ({ paymentId }) => {
    try {
      const payment = await getPayment(cfg, paymentId);
      return ok(extractPixData(payment));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "mercadopago_boleto",
  "Obtém a URL e a linha digitável/código de barras do boleto de um pagamento",
  { paymentId: z.string() },
  async ({ paymentId }) => {
    try {
      const payment = await getPayment(cfg, paymentId);
      return ok(extractBoletoData(payment));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "mercadopago_refund",
  "Estorna um pagamento (total se omitir amount, ou parcial)",
  { paymentId: z.string(), amount: z.number().positive().optional() },
  async ({ paymentId, amount }) => {
    try {
      return ok(await refundPayment(cfg, paymentId, amount));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool("mercadopago_payment_methods", "Lista os meios de pagamento disponíveis na conta", async () => {
  try {
    return ok(await getPaymentMethods(cfg));
  } catch (err) {
    return fail(err);
  }
});

server.tool(
  "mercadopago_validate_webhook",
  "Valida a assinatura (x-signature) de uma notificação de webhook do MercadoPago",
  {
    xSignature: z.string().describe("Header x-signature (ts=...,v1=...)"),
    xRequestId: z.string().optional().describe("Header x-request-id (pode faltar)"),
    dataId: z.string().optional().describe("data.id da notificação (query ou body; pode faltar)"),
  },
  async ({ xSignature, xRequestId, dataId }) => {
    const valid = validateWebhookSignature(cfg, { xSignature, xRequestId, dataId });
    return ok({ valid, hasSecret: Boolean(cfg.webhookSecret) });
  }
);

server.tool(
  "mercadopago_list_refunds",
  "Lista os estornos de um pagamento",
  { paymentId: z.string() },
  async ({ paymentId }) => {
    try {
      return ok(await listRefunds(cfg, paymentId));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "mercadopago_cancel_payment",
  "Cancela um pagamento pendente/autorizado (ex.: PIX/boleto não pago)",
  { paymentId: z.string() },
  async ({ paymentId }) => {
    try {
      return ok(await cancelPayment(cfg, paymentId));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "mercadopago_test_card_token",
  "[sandbox] Tokeniza um cartão de TESTE para testar o fluxo de cartão de ponta a ponta. O nome do titular controla o resultado (APRO=aprovado, OTHE/FUND/SECU=recusado, CONT=pendente).",
  {
    cardNumber: z.string().describe("Ex.: 5031433215406351 (Mastercard teste)"),
    securityCode: z.string().default("123"),
    expirationMonth: z.string().default("11"),
    expirationYear: z.string().default("2030"),
    holderName: z.string().default("APRO"),
    cpf: z.string().default("12345678909"),
  },
  async (args) => {
    try {
      return ok(await createTestCardToken(cfg, args));
    } catch (err) {
      return fail(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error(`[mercadopago-mcp] pronto (${cfg.env}${cfg.mock ? ", mock" : ""})`);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env -S npx tsx
// Servidor MCP do conector Asaas (transporte stdio).
// Expõe as operações do gateway como ferramentas para o Claude/agentes:
//   asaas_config, asaas_create_payment, asaas_get_payment, asaas_pix_qrcode,
//   asaas_refund, asaas_create_subscription, asaas_create_payment_link,
//   asaas_balance, asaas_statement, asaas_register_webhook
//
// Registro no Claude (ex.: claude_desktop_config.json / .mcp.json):
//   "asaas": {
//     "command": "npx",
//     "args": ["tsx", "server/asaas/mcp.ts"],
//     "cwd": "/caminho/para/codigo",
//     "env": { "ASAAS_API_KEY": "...", "ASAAS_ENV": "sandbox" }
//   }
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config";
import {
  ensureCustomer,
  createPayment,
  getPayment,
  getPixQrCode,
  getBoletoIdentification,
  refundPayment,
  createSubscription,
  cancelSubscription,
  createPaymentLink,
  getBalance,
  listFinancialTransactions,
  registerWebhook,
  listWebhooks,
} from "./service";

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
  content: [
    {
      type: "text" as const,
      text: err instanceof Error ? err.message : String(err),
    },
  ],
});

const server = new McpServer({ name: "asaas", version: "1.0.0" });

server.tool("asaas_config", "Mostra a configuração atual do conector (sem expor a chave)", async () =>
  ok({
    env: cfg.env,
    mock: cfg.mock,
    baseUrl: cfg.baseUrl,
    webhookUrl: cfg.webhookUrl || null,
    autoLabel: cfg.autoLabel,
  })
);

server.tool(
  "asaas_create_payment",
  "Cria uma cobrança (PIX, BOLETO ou CREDIT_CARD) para um cliente",
  {
    customerName: z.string(),
    cpfCnpj: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"]),
    value: z.number().positive(),
    dueDate: z.string().describe("YYYY-MM-DD"),
    description: z.string().optional(),
    externalReference: z.string().optional(),
  },
  async (args) => {
    try {
      const customer = await ensureCustomer(cfg, {
        name: args.customerName,
        cpfCnpj: args.cpfCnpj,
        email: args.email,
        mobilePhone: args.phone,
        externalReference: args.phone?.replace(/\D/g, ""),
      });
      const payment = await createPayment(cfg, {
        customer: customer.id,
        billingType: args.billingType,
        value: args.value,
        dueDate: args.dueDate,
        description: args.description,
        externalReference: args.externalReference,
      });
      return ok({ customer, payment });
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "asaas_get_payment",
  "Consulta uma cobrança pelo id (pay_xxx)",
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
  "asaas_pix_qrcode",
  "Obtém o QR Code PIX (imagem base64 + copia-e-cola) de uma cobrança",
  { paymentId: z.string() },
  async ({ paymentId }) => {
    try {
      const qr = await getPixQrCode(cfg, paymentId);
      return ok({ payload: qr.payload, expirationDate: qr.expirationDate });
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "asaas_boleto_linha",
  "Obtém a linha digitável/código de barras do boleto de uma cobrança",
  { paymentId: z.string() },
  async ({ paymentId }) => {
    try {
      return ok(await getBoletoIdentification(cfg, paymentId));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "asaas_refund",
  "Estorna uma cobrança (total ou parcial)",
  {
    paymentId: z.string(),
    value: z.number().positive().optional().describe("Omitir para estorno total"),
    description: z.string().optional(),
  },
  async ({ paymentId, value, description }) => {
    try {
      return ok(await refundPayment(cfg, paymentId, value, description));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "asaas_create_subscription",
  "Cria uma assinatura recorrente para um cliente",
  {
    customerName: z.string(),
    cpfCnpj: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]),
    value: z.number().positive(),
    nextDueDate: z.string().describe("YYYY-MM-DD da primeira cobrança"),
    cycle: z
      .enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"])
      .default("MONTHLY"),
    description: z.string().optional(),
  },
  async (args) => {
    try {
      const customer = await ensureCustomer(cfg, {
        name: args.customerName,
        cpfCnpj: args.cpfCnpj,
        email: args.email,
        mobilePhone: args.phone,
      });
      const subscription = await createSubscription(cfg, {
        customer: customer.id,
        billingType: args.billingType,
        value: args.value,
        nextDueDate: args.nextDueDate,
        cycle: args.cycle,
        description: args.description,
      });
      return ok({ customer, subscription });
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "asaas_cancel_subscription",
  "Cancela uma assinatura (sub_xxx)",
  { subscriptionId: z.string() },
  async ({ subscriptionId }) => {
    try {
      await cancelSubscription(cfg, subscriptionId);
      return ok({ cancelled: true, subscriptionId });
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "asaas_create_payment_link",
  "Cria um link de pagamento público",
  {
    name: z.string(),
    billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"]).default("UNDEFINED"),
    chargeType: z.enum(["DETACHED", "RECURRENT", "INSTALLMENT"]).default("DETACHED"),
    value: z.number().positive().optional(),
    description: z.string().optional(),
    dueDateLimitDays: z.number().int().positive().optional(),
    maxInstallmentCount: z.number().int().positive().optional(),
  },
  async (args) => {
    try {
      return ok(await createPaymentLink(cfg, args));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool("asaas_balance", "Consulta o saldo da conta Asaas", async () => {
  try {
    return ok(await getBalance(cfg));
  } catch (err) {
    return fail(err);
  }
});

server.tool(
  "asaas_statement",
  "Lista as últimas movimentações financeiras (extrato)",
  { limit: z.number().int().min(1).max(100).default(10) },
  async ({ limit }) => {
    try {
      return ok(await listFinancialTransactions(cfg, limit));
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool("asaas_list_webhooks", "Lista os webhooks registrados na conta", async () => {
  try {
    return ok(await listWebhooks(cfg));
  } catch (err) {
    return fail(err);
  }
});

server.tool(
  "asaas_register_webhook",
  "Registra/atualiza o webhook desta aplicação no Asaas (usa ASAAS_WEBHOOK_URL/TOKEN)",
  { url: z.string().url().optional().describe("Sobrescreve ASAAS_WEBHOOK_URL") },
  async ({ url }) => {
    try {
      return ok(await registerWebhook(cfg, url ? { url } : undefined));
    } catch (err) {
      return fail(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});

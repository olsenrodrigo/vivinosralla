#!/usr/bin/env -S npx tsx
// Servidor MCP do conector SmartEnvios (transporte stdio).
// Expõe as operações como ferramentas para o Claude/agentes:
//   smartenvios_config, smartenvios_quote, smartenvios_create_order,
//   smartenvios_generate_label, smartenvios_track
//
// Registro no Claude (ex.: claude_desktop_config.json / .mcp.json):
//   "smartenvios": {
//     "command": "npx",
//     "args": ["tsx", "server/smartenvios/mcp.ts"],
//     "cwd": "/caminho/para/codigo",
//     "env": { "SMARTENVIOS_TOKEN": "...", "SMARTENVIOS_ENV": "sandbox",
//              "SENDER_ZIPCODE": "...", "SENDER_DOCUMENT": "..." }
//   }
import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config";
import {
  quoteFreight,
  priceQuotes,
  createOrder,
  generateLabel,
  track,
  uploadNfe,
  updateOrder,
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

let cfg = loadConfig(process.env);
const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const server = new McpServer({ name: "smartenvios", version: "1.0.0" });

const volumeSchema = z.object({
  weight: z.number().describe("Peso em kg"),
  height: z.number().describe("Altura em cm"),
  width: z.number().describe("Largura em cm"),
  length: z.number().describe("Comprimento em cm"),
  quantity: z.number().default(1),
  price: z.number().optional().describe("Valor declarado em R$"),
});

server.tool(
  "smartenvios_config",
  "Mostra a configuração atual do conector (ambiente, modo do documento NF-e/DC, mock e CEP de origem). Não expõe o token.",
  {},
  async () =>
    ok({
      env: cfg.env,
      mock: cfg.mock,
      senderZip: cfg.sender.zipcode,
      senderDoc: cfg.sender.document,
      document: cfg.document,
      rules: cfg.rules,
    })
);

server.tool(
  "smartenvios_set_document_mode",
  "Configurador: define, nesta sessão, o modo do documento fiscal ('nfe' exige NF-e; 'dc' usa Declaração de Conteúdo) e o tipo de DANFE na etiqueta. Para persistir, ajuste DOCUMENT_MODE/LABEL_DOCUMENT_TYPE no .env.",
  {
    mode: z.enum(["nfe", "dc"]).optional(),
    labelType: z
      .enum(["label_integrated_danfe", "label_separate_danfe"])
      .optional(),
  },
  async ({ mode, labelType }) => {
    cfg = {
      ...cfg,
      document: {
        mode: mode ?? cfg.document.mode,
        labelType: labelType ?? cfg.document.labelType,
      },
    };
    return ok({ document: cfg.document });
  }
);

server.tool(
  "smartenvios_nfe_upload",
  "Vincula uma NF-e (XML) a um pedido existente. Envie o XML em base64 ou texto.",
  {
    freightOrderId: z.string().describe("UUID do pedido"),
    xmlBase64: z.string().optional().describe("XML da NF-e em base64"),
    xml: z.string().optional().describe("XML da NF-e como texto"),
    filename: z.string().optional(),
  },
  async ({ freightOrderId, xmlBase64, xml, filename }) => {
    const content = xmlBase64
      ? Buffer.from(xmlBase64, "base64")
      : (xml ?? "");
    return ok(await uploadNfe(cfg, freightOrderId, content, filename));
  }
);

server.tool(
  "smartenvios_update_order",
  "Atualiza um pedido (PATCH) — ex.: vincular a chave da NF-e (nfe_key) ou ajustar dados. identifier = UUID, tracking, número ou external_order_id.",
  {
    identifier: z.string(),
    nfeKey: z.string().optional().describe("Chave da NF-e (44 dígitos)"),
    patch: z
      .record(z.any())
      .optional()
      .describe("Campos adicionais para atualizar"),
  },
  async ({ identifier, nfeKey, patch }) => {
    const body: Record<string, unknown> = { ...(patch || {}) };
    if (nfeKey) body.nfe_key = nfeKey;
    return ok(await updateOrder(cfg, identifier, body));
  }
);

server.tool(
  "smartenvios_quote",
  "Cota o frete para um CEP de destino a partir dos volumes. Retorna as opções com preço/prazo já com as regras de frete grátis/desconto aplicadas.",
  {
    zipTo: z.string().describe("CEP de destino"),
    volumes: z.array(volumeSchema).min(1),
    subtotal: z.number().default(0).describe("Subtotal do pedido (R$) para regra de frete grátis"),
    document: z.string().optional().describe("CPF/CNPJ do destinatário"),
  },
  async ({ zipTo, volumes, subtotal, document }) => {
    const services = await quoteFreight(cfg, {
      zipFrom: cfg.sender.zipcode,
      zipTo,
      volumes,
      totalPrice: subtotal,
      document,
    });
    return ok({
      mock: cfg.mock,
      options: priceQuotes(cfg, services, subtotal),
      invalid: services.filter((s) => !s.isValid),
    });
  }
);

server.tool(
  "smartenvios_create_order",
  "Cria um pedido de frete (Declaração de Conteúdo) com destinatário e itens. Usa o remetente configurado.",
  {
    recipient: z.object({
      name: z.string(),
      document: z.string().optional(),
      zipcode: z.string(),
      street: z.string(),
      number: z.string(),
      neighborhood: z.string(),
      complement: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }),
    items: z
      .array(
        z.object({
          description: z.string(),
          amount: z.number(),
          unitPrice: z.number().optional(),
          totalPrice: z.number().optional(),
          weight: z.number(),
          height: z.number(),
          width: z.number(),
          length: z.number(),
          sku: z.array(z.string()).optional(),
        })
      )
      .min(1),
    quoteServiceId: z.string().optional(),
    preferenceBy: z.enum(["QUOTE_VALUE", "DELIVERY_TIME", "SERVICE_NAME"]).optional(),
    externalOrderId: z.string().optional(),
    nfeKey: z.string().optional(),
    observation: z.string().optional(),
  },
  async (args) => ok(await createOrder(cfg, args))
);

server.tool(
  "smartenvios_generate_label",
  "Gera a etiqueta de postagem (PDF/ZPL/Base64) para um ou mais pedidos por order_id, tracking_code ou chave de NF-e.",
  {
    orderIds: z.array(z.string()).optional(),
    trackingCodes: z.array(z.string()).optional(),
    nfeKeys: z.array(z.string()).optional(),
    type: z.enum(["pdf", "zpl", "base64"]).default("pdf"),
    documentType: z
      .enum(["label_integrated_danfe", "label_separate_danfe"])
      .optional(),
    mergeLabels: z.boolean().optional(),
  },
  async (args) => ok(await generateLabel(cfg, args))
);

server.tool(
  "smartenvios_track",
  "Consulta os eventos de rastreio de um pedido pelo código de rastreio.",
  { trackingCode: z.string() },
  async ({ trackingCode }) => ok(await track(cfg, trackingCode))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error(
    `[smartenvios-mcp] pronto (${cfg.env}${cfg.mock ? ", mock" : ""})`
  );
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Integração SmartEnvios com o motor da loja (cotação, etiqueta, webhook).
// O conector portátil vive em ./smartenvios (copiado do piloto PuraFlora).
import type { Express } from "express";
import { storage } from "./storage";
import { requireAdmin } from "./auth";
import {
  loadConfig,
  quoteFreight,
  priceQuotes,
  createOrder,
  generateLabel,
  type SmartEnviosConfig,
  type OrderItem,
  type Volume,
} from "./smartenvios";

const cfg = (): SmartEnviosConfig => loadConfig(process.env);

// Monta os volumes para cotação a partir dos itens do carrinho (usa dims do produto).
async function buildVolumes(items: any[]): Promise<Volume[]> {
  return Promise.all(
    items.map(async (it) => {
      let weightG = 300;
      let height = 12;
      let width = 8;
      let length = 8;
      if (it.productId) {
        const p = await storage.getProductById(Number(it.productId));
        if (p) {
          weightG = p.weightG || weightG;
          height = Number(p.heightCm) || height;
          width = Number(p.widthCm) || width;
          length = Number(p.depthCm) || length;
        }
      }
      return {
        weight: weightG / 1000,
        height,
        width,
        length,
        quantity: Number(it.quantity) || 1,
        price: Number(it.unitPrice) || undefined,
      };
    })
  );
}

// Monta os itens do pedido SmartEnvios usando peso/dimensões do produto quando houver.
async function buildItems(items: any[]): Promise<OrderItem[]> {
  return Promise.all(
    items.map(async (it) => {
      let weightG = 300;
      let height = 12;
      let width = 8;
      let length = 8;
      if (it.productId) {
        const p = await storage.getProductById(Number(it.productId));
        if (p) {
          weightG = p.weightG || weightG;
          height = Number(p.heightCm) || height;
          width = Number(p.widthCm) || width;
          length = Number(p.depthCm) || length;
        }
      }
      return {
        description: it.productTitle || it.variantTitle || "Item",
        amount: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || undefined,
        totalPrice: Number(it.totalPrice) || undefined,
        weight: weightG / 1000,
        height,
        width,
        length,
      };
    })
  );
}

/**
 * Cria o pedido na SmartEnvios a partir de um pedido da loja e gera a etiqueta.
 * Salva o código de rastreio no pedido. Reutilizado pelo admin e pelo webhook.
 */
export async function createLabelForOrder(orderId: number, nfeKey?: string) {
  const c = cfg();
  const order = await storage.getOrderById(orderId);
  if (!order) throw new Error("Pedido não encontrado");
  const items = await storage.getOrderItems(orderId);

  const seOrder = await createOrder(c, {
    preferenceBy: "QUOTE_VALUE",
    externalOrderId: order.orderNumber,
    nfeKey,
    recipient: {
      name: order.shippingRecipient || order.customerName,
      document: order.customerCpf || "",
      zipcode: order.shippingCep || "",
      street: order.shippingLogradouro || "",
      number: order.shippingNumero || "",
      complement: order.shippingComplemento || "",
      neighborhood: order.shippingBairro || "",
      phone: order.customerPhone || "",
      email: order.customerEmail || "",
    },
    items: await buildItems(items),
  });

  const label = await generateLabel(c, {
    ...(seOrder.orderId
      ? { orderIds: [seOrder.orderId] }
      : seOrder.trackingCode
        ? { trackingCodes: [seOrder.trackingCode] }
        : {}),
    type: "pdf",
  });

  if (seOrder.trackingCode) {
    await storage.updateOrderTracking(
      orderId,
      "SmartEnvios",
      order.shippingService || "SmartEnvios",
      seOrder.trackingCode
    );
  }
  return { order: seOrder, label };
}

export function registerShippingRoutes(app: Express) {
  // Cotação de frete (usada no checkout — token fica no servidor)
  app.post("/api/shipping/quote", async (req, res) => {
    try {
      const c = cfg();
      const { zipTo, subtotal = 0, volumes, items, document } = req.body || {};
      if (String(zipTo || "").replace(/\D/g, "").length !== 8) {
        return res.status(400).json({ error: "CEP de destino inválido" });
      }
      let vols: Volume[] = Array.isArray(volumes) ? volumes : [];
      if (!vols.length && Array.isArray(items)) vols = await buildVolumes(items);
      if (!vols.length) return res.status(400).json({ error: "Sem itens para cotar" });
      const services = await quoteFreight(c, {
        zipFrom: c.sender.zipcode,
        zipTo,
        volumes: vols,
        totalPrice: Number(subtotal),
        document,
      });
      return res.json({
        mock: c.mock,
        freeShippingAbove: c.rules.freeShippingAbove,
        options: priceQuotes(c, services, Number(subtotal)),
      });
    } catch (e: any) {
      return res.status(e?.status >= 400 ? e.status : 500).json({ error: e?.message });
    }
  });

  // Gerar etiqueta de um pedido (admin)
  app.post("/api/admin/orders/:id/label", requireAdmin, async (req, res) => {
    try {
      const result = await createLabelForOrder(Number(req.params.id), req.body?.nfeKey);
      return res.json(result);
    } catch (e: any) {
      return res.status(e?.status >= 400 ? e.status : 500).json({ error: e?.message });
    }
  });

  // Config pública (checkout mostra frete grátis etc.)
  app.get("/api/shipping/config", (_req, res) => {
    const c = cfg();
    return res.json({
      mock: c.mock,
      env: c.env,
      freeShippingAbove: c.rules.freeShippingAbove,
    });
  });
}

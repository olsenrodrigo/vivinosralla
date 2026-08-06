import type { PaymentGateway, PaymentRequest, PaymentResponse } from "./types";

export const mercadoPagoGateway: PaymentGateway = {
  id: "mercadopago",
  name: "MercadoPago",

  async createPayment(request: PaymentRequest, config: Record<string, string>): Promise<PaymentResponse> {
    const accessToken = config.accessToken;
    const baseUrl = "https://api.mercadopago.com";

    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 30);

    let body: any = {
      transaction_amount: request.amount,
      description: request.description,
      external_reference: `ORDER-${request.orderNumber}`,
      payer: {
        email: request.customerEmail,
        first_name: request.customerName.split(" ")[0],
        last_name: request.customerName.split(" ").slice(1).join(" ") || request.customerName,
        identification: { type: "CPF", number: request.customerCpf.replace(/\D/g, "") },
      },
    };

    if (request.method === "pix") {
      body.payment_method_id = "pix";
      body.date_of_expiration = expiration.toISOString();
    } else if (request.method === "boleto") {
      body.payment_method_id = "bolbradesco";
      const boletoExp = new Date();
      boletoExp.setDate(boletoExp.getDate() + 3);
      body.date_of_expiration = boletoExp.toISOString();
    } else if (request.method === "credit_card" && request.cardToken) {
      body.payment_method_id = "visa"; // determined by token at runtime
      body.token = request.cardToken;
      body.installments = request.installments ?? 1;
      body.capture = true;
    }

    try {
      const resp = await fetch(`${baseUrl}/v1/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-Idempotency-Key": `order-${request.orderNumber}-${Date.now()}`,
        },
        body: JSON.stringify(body),
      });

      const result = await resp.json() as any;

      if (!resp.ok) {
        return { success: false, error: result.message || "Erro no pagamento" };
      }

      const out: PaymentResponse = {
        success: true,
        transactionId: String(result.id),
        status: result.status,
      };

      if (request.method === "pix" && result.point_of_interaction?.transaction_data) {
        out.pixQrCode = result.point_of_interaction.transaction_data.qr_code;
        out.pixQrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
        out.pixExpiration = expiration;
      }

      if (request.method === "boleto" && result.transaction_details) {
        out.boletoUrl = result.transaction_details.external_resource_url;
        out.boletoBarcode = result.barcode?.content;
      }

      return out;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getPaymentStatus(transactionId: string, config: Record<string, string>): Promise<string> {
    const accessToken = config.accessToken;
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${transactionId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const result = await resp.json() as any;
    return result.status ?? "unknown";
  },
};

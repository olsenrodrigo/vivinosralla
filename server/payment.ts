// MercadoPago Payment Integration
// Docs: https://www.mercadopago.com.br/developers/en/docs/checkout-api
import { randomBytes } from "node:crypto";

interface PaymentData {
  amount: number;
  orderId: number;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  customerCpf: string;
  method: "pix" | "credit_card" | "debit_card" | "boleto";
  description: string;
  cardToken?: string;
  installments?: number;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  status?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiration?: Date;
  boletoUrl?: string;
  boletoBarcode?: string;
  error?: string;
}

export async function createPayment(data: PaymentData, accessToken: string): Promise<PaymentResult> {
  const baseUrl = "https://api.mercadopago.com";

  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 30);

  let body: any = {
    transaction_amount: data.amount,
    description: data.description,
    external_reference: `ORDER-${data.orderNumber}`,
    payer: {
      email: data.customerEmail,
      first_name: data.customerName.split(" ")[0],
      last_name: data.customerName.split(" ").slice(1).join(" ") || data.customerName,
      identification: { type: "CPF", number: data.customerCpf.replace(/\D/g, "") },
    },
  };

  if (data.method === "pix") {
    body.payment_method_id = "pix";
    body.date_of_expiration = expiration.toISOString();
  } else if (data.method === "boleto") {
    body.payment_method_id = "bolbradesco";
    const boletoExp = new Date();
    boletoExp.setDate(boletoExp.getDate() + 3);
    body.date_of_expiration = boletoExp.toISOString();
  } else if (data.method === "credit_card" && data.cardToken) {
    body.payment_method_id = "visa"; // will be determined by token
    body.token = data.cardToken;
    body.installments = data.installments ?? 1;
    body.capture = true;
  }

  try {
    const resp = await fetch(`${baseUrl}/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": `order-${data.orderNumber}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });

    const result = await resp.json() as any;

    if (!resp.ok) {
      return { success: false, error: result.message || "Erro no pagamento" };
    }

    const out: PaymentResult = {
      success: true,
      transactionId: String(result.id),
      status: result.status,
    };

    if (data.method === "pix" && result.point_of_interaction?.transaction_data) {
      out.pixQrCode = result.point_of_interaction.transaction_data.qr_code;
      out.pixQrCodeBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
      out.pixExpiration = expiration;
    }

    if (data.method === "boleto" && result.transaction_details) {
      out.boletoUrl = result.transaction_details.external_resource_url;
      out.boletoBarcode = result.barcode?.content;
    }

    return out;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPaymentStatus(transactionId: string, accessToken: string): Promise<string> {
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${transactionId}`, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  const result = await resp.json() as any;
  return result.status ?? "unknown";
}

/**
 * Número do pedido. A parte aleatória é o que protege a consulta pública em
 * `GET /api/orders/:orderNumber` — com 4 dígitos eram só 10 mil combinações por
 * dia, enumeráveis em minutos. Agora são 6 caracteres de um alfabeto de 32
 * (~1 bilhão de combinações) sorteados por CSPRNG.
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  // Crockford base32 sem I, L, O e U: evita confusão ao ditar por telefone.
  const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(6);
  let rand = "";
  for (const b of bytes) rand += ALFABETO[b % ALFABETO.length];
  return `PD${y}${m}${d}-${rand}`;
}

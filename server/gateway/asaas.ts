// Provider de pagamento Asaas — implementa a interface PaymentGateway do app
// reutilizando o conector portável em `server/asaas/`.
//
// PIX e boleto: dados exibidos no site (QR / linha digitável).
// Cartão: checkout HOSPEDADO — a cobrança gera uma invoiceUrl (redirectUrl) e o
// cliente paga o cartão na página do Asaas (o cartão não passa pelo servidor).
// O Asaas não tem tokenização client-side por chave pública (como o MP.js).
import type { PaymentGateway, PaymentRequest, PaymentResponse } from "./types";
import {
  loadConfig,
  ensureCustomer,
  createPayment as asaasCreatePayment,
  getPayment,
  getPixQrCode,
  getBoletoIdentification,
  type BillingType,
} from "../asaas";

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** Normaliza o status do Asaas para o vocabulário do app (estilo MercadoPago). */
export function mapAsaasStatus(status: string): string {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "approved";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
      return "refunded";
    case "OVERDUE":
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
      return "pending";
    default:
      return status.toLowerCase();
  }
}

const METHOD_MAP: Record<PaymentRequest["method"], BillingType | null> = {
  pix: "PIX",
  boleto: "BOLETO",
  credit_card: "CREDIT_CARD",
  debit_card: null,
};

export const asaasGateway: PaymentGateway = {
  id: "asaas",
  name: "Asaas",

  async createPayment(request: PaymentRequest, _config: Record<string, string>): Promise<PaymentResponse> {
    const cfg = loadConfig(process.env);
    const billingType = METHOD_MAP[request.method];
    if (!billingType) {
      return { success: false, error: `Método não suportado pelo Asaas: ${request.method}` };
    }

    try {
      const customer = await ensureCustomer(cfg, {
        name: request.customerName,
        cpfCnpj: request.customerCpf,
        email: request.customerEmail,
        mobilePhone: request.customerPhone,
        postalCode: request.customerCep,
        addressNumber: request.customerAddressNumber,
        externalReference: (request.customerPhone || "").replace(/\D/g, "") || undefined,
      });

      const payment = await asaasCreatePayment(cfg, {
        customer: customer.id,
        billingType,
        value: request.amount,
        dueDate: billingType === "BOLETO" ? inDays(3) : today(),
        description: request.description,
        externalReference: request.orderNumber,
      });

      const out: PaymentResponse = {
        success: true,
        transactionId: payment.id,
        status: mapAsaasStatus(payment.status),
      };

      if (billingType === "PIX") {
        const qr = await getPixQrCode(cfg, payment.id);
        out.pixQrCode = qr.payload; // copia-e-cola
        out.pixQrCodeBase64 = qr.encodedImage; // PNG base64
        if (qr.expirationDate) out.pixExpiration = new Date(qr.expirationDate);
      } else if (billingType === "BOLETO") {
        out.boletoUrl = payment.bankSlipUrl;
        try {
          const ident = await getBoletoIdentification(cfg, payment.id);
          out.boletoBarcode = ident.identificationField;
        } catch {
          /* linha digitável pode não estar pronta imediatamente — não bloqueia */
        }
      } else if (billingType === "CREDIT_CARD") {
        // Checkout hospedado: o cliente paga o cartão na página do Asaas (invoiceUrl).
        out.redirectUrl = payment.invoiceUrl;
      }
      return out;
    } catch (err: any) {
      return { success: false, error: err?.message || "Erro ao criar cobrança no Asaas" };
    }
  },

  async getPaymentStatus(transactionId: string, _config: Record<string, string>): Promise<string> {
    const cfg = loadConfig(process.env);
    const payment = await getPayment(cfg, transactionId);
    return mapAsaasStatus(payment.status);
  },

  getWebhookSecret(_config: Record<string, string>): string | undefined {
    return loadConfig(process.env).webhookToken || undefined;
  },
};

export interface PaymentRequest {
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
  // Opcionais usados por alguns gateways (ex.: Asaas exige telefone/endereço do
  // cliente). O provider que não precisa simplesmente ignora.
  customerPhone?: string;
  customerCep?: string;
  customerAddressNumber?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiration?: Date;
  boletoUrl?: string;
  boletoBarcode?: string;
  redirectUrl?: string;
  error?: string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  createPayment(request: PaymentRequest, config: Record<string, string>): Promise<PaymentResponse>;
  getPaymentStatus(transactionId: string, config: Record<string, string>): Promise<string>;
  getWebhookSecret?(config: Record<string, string>): string | undefined;
}

export interface GatewayConfig {
  enabled: boolean;
  config: Record<string, string>;
}

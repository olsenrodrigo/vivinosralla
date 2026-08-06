// Tipos da API MercadoPago (v1) usados pelo conector.

/** Status de um pagamento no MercadoPago. */
export type MPPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

/** Status que significam "dinheiro recebido". */
export const PAID_STATUSES: MPPaymentStatus[] = ["approved", "authorized"];

/** payment_method_id mais comuns no Brasil. */
export type BrPaymentMethod = "pix" | "bolbradesco" | (string & {});

export interface MPIdentification {
  type: string; // "CPF" | "CNPJ"
  number: string;
}

export interface MPAddress {
  zip_code: string;
  street_name: string;
  street_number: string;
  neighborhood?: string;
  city?: string;
  federal_unit?: string; // UF
}

export interface MPPayer {
  email: string;
  first_name?: string;
  last_name?: string;
  identification?: MPIdentification;
  address?: MPAddress; // obrigatório para boleto
}

export interface PaymentInput {
  transaction_amount: number;
  description?: string;
  payment_method_id: string; // "pix" | "bolbradesco" | "master"/"visa"… (cartão via token)
  payer: MPPayer;
  token?: string; // token do cartão (gerado no front pelo SDK do MP)
  installments?: number;
  date_of_expiration?: string; // ISO — PIX/boleto
  external_reference?: string;
  notification_url?: string;
  capture?: boolean;
  statement_descriptor?: string;
}

export interface MPPointOfInteraction {
  transaction_data?: {
    qr_code?: string; // copia-e-cola PIX
    qr_code_base64?: string; // imagem PNG base64
    ticket_url?: string;
  };
}

export interface MPPayment {
  id: number | string;
  status: MPPaymentStatus;
  status_detail?: string;
  transaction_amount: number;
  /** Total já estornado. Estorno PARCIAL não muda o status (fica approved). */
  transaction_amount_refunded?: number;
  currency_id?: string;
  description?: string;
  date_created?: string;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  payment_method_id?: string;
  payment_type_id?: string;
  installments?: number;
  external_reference?: string;
  payer?: MPPayer;
  point_of_interaction?: MPPointOfInteraction;
  transaction_details?: {
    external_resource_url?: string; // URL do boleto
    net_received_amount?: number;
  };
  barcode?: { content?: string }; // linha do boleto
  refunds?: MPRefund[];
}

export interface MPRefund {
  id: number | string;
  payment_id?: number | string;
  amount: number;
  status?: string;
  date_created?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  payment_type_id: string; // "credit_card" | "ticket" | "bank_transfer"…
  status: string;
  thumbnail?: string;
  min_allowed_amount?: number;
  max_allowed_amount?: number;
}

export interface CardTokenInput {
  cardNumber: string;
  securityCode: string;
  expirationMonth: string;
  expirationYear: string;
  holderName: string;
  cpf: string;
}

export interface MPCardToken {
  id: string;
  first_six_digits?: string;
  last_four_digits?: string;
  expiration_month?: number;
  expiration_year?: number;
}

export interface MPSearchResult<T> {
  paging?: { total: number; limit: number; offset: number };
  results: T[];
}

/** Corpo da notificação de webhook (v1/IPN e Webhooks). */
export interface WebhookNotification {
  id?: number | string;
  type?: string; // "payment" (Webhooks) — em IPN vem como topic na querystring
  topic?: string;
  action?: string; // "payment.created" | "payment.updated"
  live_mode?: boolean;
  date_created?: string;
  data?: { id?: string };
}

/** Dados necessários para validar a assinatura x-signature do webhook. */
export interface WebhookSignatureInput {
  xSignature: string | undefined; // header "x-signature": "ts=...,v1=..."
  xRequestId: string | undefined; // header "x-request-id"
  dataId: string | undefined; // query "data.id" (ou body data.id)
}

// Tipos da API Asaas v3 usados pelo conector.

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "REFUND_IN_PROGRESS"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS";

/** Status que significam "dinheiro recebido". */
export const PAID_STATUSES: AsaasPaymentStatus[] = [
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
];

export type SubscriptionCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

export interface CustomerInput {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string; // bairro
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasCustomer {
  id: string; // cus_xxx
  name: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
  deleted?: boolean;
}

export interface CreditCardInput {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone?: string;
  mobilePhone?: string;
}

export interface DiscountInput {
  value: number;
  dueDateLimitDays: number;
  type: "FIXED" | "PERCENTAGE";
}

export interface PaymentInput {
  customer: string; // cus_xxx
  billingType: BillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  totalValue?: number;
  discount?: DiscountInput;
  fine?: { value: number; type: "FIXED" | "PERCENTAGE" };
  interest?: { value: number };
  creditCard?: CreditCardInput;
  creditCardHolderInfo?: CreditCardHolderInfo;
  creditCardToken?: string;
  remoteIp?: string;
}

export interface AsaasPayment {
  id: string; // pay_xxx
  customer: string;
  subscription?: string; // sub_xxx quando gerado por assinatura
  installment?: string;
  billingType: BillingType;
  status: AsaasPaymentStatus;
  value: number;
  netValue?: number;
  dueDate: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
  deleted?: boolean;
  dateCreated?: string;
}

export interface PixQrCode {
  encodedImage: string; // PNG base64
  payload: string; // copia-e-cola
  expirationDate?: string;
}

export interface BoletoIdentification {
  identificationField: string; // linha digitável
  nossoNumero?: string;
  barCode?: string;
}

export interface SubscriptionInput {
  customer: string;
  billingType: BillingType;
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle: SubscriptionCycle;
  description?: string;
  externalReference?: string;
  maxPayments?: number;
  endDate?: string;
  creditCard?: CreditCardInput;
  creditCardHolderInfo?: CreditCardHolderInfo;
  creditCardToken?: string;
  remoteIp?: string;
}

export interface AsaasSubscription {
  id: string; // sub_xxx
  customer: string;
  billingType: BillingType;
  value: number;
  nextDueDate: string;
  cycle: SubscriptionCycle;
  description?: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  deleted?: boolean;
}

export interface PaymentLinkInput {
  name: string;
  billingType: BillingType | "UNDEFINED";
  chargeType: "DETACHED" | "RECURRENT" | "INSTALLMENT";
  value?: number;
  description?: string;
  dueDateLimitDays?: number;
  subscriptionCycle?: SubscriptionCycle;
  maxInstallmentCount?: number;
  externalReference?: string;
  endDate?: string;
}

export interface AsaasPaymentLink {
  id: string; // paylnk_xxx
  url: string;
  name: string;
  active: boolean;
  value?: number;
}

export interface AsaasBalance {
  balance: number;
}

export interface FinancialTransaction {
  id: string;
  value: number;
  balance: number;
  type: string;
  date: string;
  description?: string;
  paymentId?: string;
}

export interface WebhookConfigInput {
  name: string;
  url: string;
  email?: string;
  enabled?: boolean;
  interrupted?: boolean;
  apiVersion?: number;
  authToken: string;
  sendType?: "SEQUENTIALLY" | "NON_SEQUENTIALLY";
  events: string[];
}

export interface AsaasWebhookConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  interrupted: boolean;
  events: string[];
}

/** Payload de um evento entregue no webhook. */
export interface WebhookEvent {
  id: string; // evt_xxx
  event: string; // PAYMENT_CONFIRMED etc.
  dateCreated?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
}

/** Eventos de pagamento assinados por padrão no registro do webhook. */
export const DEFAULT_WEBHOOK_EVENTS = [
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_RESTORED",
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_AWAITING_RISK_ANALYSIS",
  "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
];

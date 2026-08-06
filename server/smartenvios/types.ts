// Tipos do domínio (camelCase) para o conector SmartEnvios.
// O mapeamento para o payload da API (snake_case) fica em service.ts.

export interface Volume {
  weight: number; // kg
  height: number; // cm
  length: number; // cm
  width: number; // cm
  quantity: number;
  price?: number; // valor declarado (R$)
  sku?: string[];
}

export interface QuoteInput {
  zipFrom: string;
  zipTo: string;
  volumes: Volume[];
  totalPrice?: number;
  document?: string; // CPF/CNPJ do destinatário
  extraDays?: number;
}

export interface QuoteService {
  id: string; // quote_service_id
  base: string;
  serviceCode: number;
  service: string; // ex.: "Jadlog Package", "PAC"
  value: number; // R$
  days: number; // dias úteis
  isValid: boolean;
  errors: string[];
}

/** Cotação após aplicar as regras da loja (frete grátis/desconto). */
export interface PricedQuote extends QuoteService {
  finalValue: number; // valor cobrado do cliente após regras
  free: boolean;
  discountApplied: number; // R$ de desconto
}

export interface Address {
  name: string;
  document?: string;
  zipcode: string;
  street: string;
  number: string;
  neighborhood: string;
  complement?: string;
  phone?: string;
  email?: string;
}

export interface OrderItem {
  description: string;
  amount: number;
  unitPrice?: number;
  totalPrice?: number;
  weight: number; // kg
  height: number;
  width: number;
  length: number;
  sku?: string[];
}

export interface CreateOrderInput {
  quoteServiceId?: string;
  preferenceBy?: "QUOTE_VALUE" | "DELIVERY_TIME" | "SERVICE_NAME";
  externalOrderId?: string;
  externalOrigin?: string;
  recipient: Address;
  items: OrderItem[];
  observation?: string;
  /** Chave da NF-e (opcional; se ausente vai como Declaração de Conteúdo). */
  nfeKey?: string;
  /** Agendar coleta no remetente (padrão true). Use false em testes. */
  pickup?: boolean;
  /** Entrega no destinatário (padrão true). */
  delivery?: boolean;
}

export interface CreateOrderResult {
  orderId?: string;
  orderNumber?: string | number;
  trackingCode?: string;
  statusCode?: number;
  statusName?: string;
  raw: unknown;
}

export type LabelType = "pdf" | "zpl" | "base64";

export interface GenerateLabelInput {
  orderIds?: string[];
  trackingCodes?: string[];
  nfeKeys?: string[];
  type?: LabelType;
  documentType?: "label_integrated_danfe" | "label_separate_danfe";
  mergeLabels?: boolean;
}

export interface LabelVolume {
  barcode: string;
}

export interface LabelTicket {
  freightOrderId: string;
  trackingCode: string;
  publicTracking?: string;
  volumes: LabelVolume[];
}

export interface GenerateLabelResult {
  url?: string;
  tickets: LabelTicket[];
  raw: unknown;
}

export interface TrackingEvent {
  status?: string;
  date?: string;
  observation?: string;
  type?: string;
}

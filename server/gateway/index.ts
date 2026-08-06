import { mercadoPagoGateway } from "./mercadopago";
import { asaasGateway } from "./asaas";
import type { PaymentGateway } from "./types";

const gateways: Map<string, PaymentGateway> = new Map([
  ["mercadopago", mercadoPagoGateway],
  ["asaas", asaasGateway],
]);

export function getGateway(id: string): PaymentGateway | undefined {
  return gateways.get(id);
}

export function listGateways(): PaymentGateway[] {
  return Array.from(gateways.values());
}

export { mercadoPagoGateway, asaasGateway };
export type { PaymentGateway, PaymentRequest, PaymentResponse } from "./types";

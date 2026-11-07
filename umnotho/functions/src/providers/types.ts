import type { PlanDefinition } from '../plans';

export interface Quote {
  amountUsdt: number;
  rateZarPerUsdt: number;
}

export interface CheckoutRequest {
  paymentId: string;
  ownerId: string;
  plan: PlanDefinition;
  amountUsdt: number;
  rateZarPerUsdt: number;
}

export interface CheckoutSession {
  provider: string;
  providerLabel: string;
  providerPaymentId: string;
  address?: string;
  network: string;
  checkoutUrl?: string;
}

export interface WebhookEvent {
  paymentId: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  providerStatus?: string;
  providerPaymentId?: string;
  txHash?: string;
  /** Optional on-chain amount, enforced when the provider supplies it. */
  amountUsdt?: number;
}

export interface PaymentProvider {
  id: string;
  label: string;
  sandbox: boolean;
  ttlMinutes: number;
  quote(amountZar: number): Promise<Quote>;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  parseWebhook(rawBody: Buffer | string, signature: string): WebhookEvent;
  /** Optional reconciliation lookup used by the scheduled sweep. */
  fetchPaymentStatus?(providerPaymentId: string, paymentId: string): Promise<WebhookEvent | null>;
}

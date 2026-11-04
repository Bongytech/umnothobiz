import type { PlanDefinition } from '../plans';

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
  status: 'paid' | 'failed' | 'expired';
  txHash?: string;
  /** Optional on-chain amount, enforced when the provider supplies it. */
  amountUsdt?: number;
}

export interface PaymentProvider {
  id: string;
  label: string;
  sandbox: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  parseWebhook(rawBody: Buffer | string, signature: string): WebhookEvent;
}

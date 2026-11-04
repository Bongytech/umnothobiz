export type CryptoPlan = 'basic' | 'biz';
export type CryptoPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface CryptoCheckout {
  paymentId: string;
  plan: CryptoPlan;
  planName: string;
  amountZar: number;
  amountUsdt: number;
  rateZarPerUsdt: number;
  provider: string;
  providerLabel: string;
  status: CryptoPaymentStatus;
  providerStatus: string | null;
  address: string | null;
  network: string;
  checkoutUrl: string | null;
  reference: string;
  createdAt: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  txHash: string | null;
  sandbox: boolean;
}

export function formatUsdt(value: number): string {
  return `${value.toFixed(2)} USDT`;
}

export function formatZar(value: number): string {
  return `R ${value.toFixed(2)}`;
}

export function checkoutIsExpired(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now;
}

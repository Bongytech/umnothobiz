import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'expired',
];

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Quotes USDT from a ZAR price. Rounds up to two decimals so the merchant
 * never receives less than the ZAR price because of rounding.
 */
export function quoteUsdt(amountZar: number, zarPerUsdt: number): number {
  if (!Number.isFinite(amountZar) || amountZar <= 0) {
    throw new Error('amountZar must be a positive number');
  }
  if (!Number.isFinite(zarPerUsdt) || zarPerUsdt <= 0) {
    throw new Error('zarPerUsdt must be a positive number');
  }

  return Math.ceil((amountZar / zarPerUsdt) * 100) / 100;
}

export function paymentExpiry(nowMs = Date.now(), ttlMinutes = 30): Date {
  return new Date(nowMs + ttlMinutes * 60_000);
}

export function isExpired(expiresAt: Date, nowMs = Date.now()): boolean {
  return expiresAt.getTime() <= nowMs;
}

export function signSandboxPayload(rawBody: Buffer | string, secret: string): string {
  if (!secret) throw new Error('A webhook secret is required');
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySandboxSignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature) return false;

  const expected = Buffer.from(signSandboxPayload(rawBody, secret), 'utf8');
  const received = Buffer.from(signature.trim(), 'utf8');

  return expected.length === received.length && timingSafeEqual(expected, received);
}

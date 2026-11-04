import { createHmac, timingSafeEqual } from 'node:crypto';
import { quoteUsdt } from '../core';
import type { PaymentStatus } from '../core';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  Quote,
  WebhookEvent,
} from './types';

const DEFAULT_API_URL = 'https://api.nowpayments.io/v1';
const DEFAULT_PAY_CURRENCY = 'usdttrc20';
const DEFAULT_APP_URL = 'https://umnothobiz.web.app';

/** Recursively sort object keys, matching NOWPayments IPN guidance. */
export function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObject((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

export function signNowPaymentsPayload(rawBody: string, ipnSecret: string): string {
  return createHmac('sha512', ipnSecret)
    .update(JSON.stringify(sortObject(JSON.parse(rawBody))))
    .digest('hex');
}

function verifyNowPaymentsSignature(
  rawBody: string,
  signature: string,
  ipnSecret: string,
): boolean {
  if (!signature || !ipnSecret) return false;
  const expected = Buffer.from(signNowPaymentsPayload(rawBody, ipnSecret), 'utf8');
  const received = Buffer.from(signature.trim(), 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Maps the provider's status onto our payment state. Only `finished` is
 * treated as paid; `partially_paid` stays pending so a later top-up can
 * complete the invoice.
 */
export function mapNowPaymentsStatus(value: unknown): PaymentStatus | 'pending' {
  switch (value) {
    case 'finished':
      return 'paid';
    case 'failed':
    case 'refunded':
    case 'cancelled':
      return 'failed';
    case 'expired':
      return 'expired';
    case 'partially_paid':
    case 'waiting':
    case 'confirming':
    case 'confirmed':
    case 'sending':
      return 'pending';
    default:
      return 'pending';
  }
}

function apiUrl(): string {
  return process.env.NOWPAYMENTS_API_URL || DEFAULT_API_URL;
}

function payCurrency(): string {
  return process.env.NOWPAYMENTS_PAY_CURRENCY || DEFAULT_PAY_CURRENCY;
}

function apiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error('NOWPAYMENTS_API_KEY is not configured');
  return key;
}

function ipnSecret(): string {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) throw new Error('NOWPAYMENTS_IPN_SECRET is not configured');
  return secret;
}

export class NowPaymentsProvider implements PaymentProvider {
  readonly id = 'nowpayments';
  readonly label = 'NOWPayments';
  readonly sandbox = false;
  readonly ttlMinutes = 10;

  async quote(amountZar: number): Promise<Quote> {
    const url = `${apiUrl()}/estimate?amount=${encodeURIComponent(String(amountZar))}&currency_from=zar&currency_to=${encodeURIComponent(payCurrency())}`;
    const response = await fetch(url, {
      headers: { 'x-api-key': apiKey() },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`NOWPayments estimate failed (HTTP ${response.status})`);
    }

    const body = (await response.json()) as {
      estimated_amount?: number | string;
      estimatedAmount?: number | string;
    };
    const estimated = Number(body.estimated_amount ?? body.estimatedAmount);

    if (!Number.isFinite(estimated) || estimated <= 0) {
      throw new Error('NOWPayments estimate did not return a valid USDT amount');
    }

    return {
      amountUsdt: quoteUsdt(amountZar, amountZar / estimated),
      rateZarPerUsdt: amountZar / estimated,
    };
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const webhookUrl = process.env.CRYPTO_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('CRYPTO_WEBHOOK_URL is not configured');
    }

    const appUrl = process.env.APP_URL || DEFAULT_APP_URL;
    const response = await fetch(`${apiUrl()}/invoice`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
      },
      body: JSON.stringify({
        price_amount: request.plan.amountZar,
        price_currency: 'zar',
        pay_currency: payCurrency(),
        order_id: request.paymentId,
        order_description: `Umnotho ${request.plan.name} subscription`,
        ipn_callback_url: webhookUrl,
        success_url: `${appUrl}/profile?payment=success`,
        cancel_url: `${appUrl}/pricing?payment=cancelled`,
        is_fixed_rate: true,
        is_fee_paid_by_user: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const body = (await response.json().catch(() => ({}))) as {
      id?: string | number;
      invoice_url?: string;
      message?: string;
    };

    if (!response.ok || !body.invoice_url) {
      throw new Error(
        `NOWPayments invoice failed (HTTP ${response.status}): ${String(body.message ?? 'no invoice URL')}`,
      );
    }

    return {
      provider: this.id,
      providerLabel: this.label,
      providerPaymentId: String(body.id ?? ''),
      checkoutUrl: body.invoice_url,
      network: 'NOWPayments hosted checkout',
    };
  }

  parseWebhook(rawBody: Buffer | string, signature: string): WebhookEvent {
    const body = rawBody.toString();

    if (!verifyNowPaymentsSignature(body, signature, ipnSecret())) {
      throw new Error('Invalid NOWPayments webhook signature');
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    const orderId = payload.order_id;
    if (typeof orderId !== 'string' || orderId.length === 0) {
      throw new Error('NOWPayments webhook is missing order_id');
    }

    const actual = Number(payload.actually_paid ?? payload.pay_amount);

    return {
      paymentId: orderId,
      status: mapNowPaymentsStatus(payload.payment_status),
      providerStatus: typeof payload.payment_status === 'string' ? payload.payment_status : undefined,
      providerPaymentId:
        typeof payload.payment_id === 'number' || typeof payload.payment_id === 'string'
          ? String(payload.payment_id)
          : undefined,
      amountUsdt: Number.isFinite(actual) && actual > 0 ? actual : undefined,
      txHash: typeof payload.payin_hash === 'string' ? payload.payin_hash : undefined,
    };
  }
}

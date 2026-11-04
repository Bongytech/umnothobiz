import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLANS } from '../plans';
import {
  NowPaymentsProvider,
  mapNowPaymentsStatus,
  signNowPaymentsPayload,
  sortObject,
} from './nowpayments';

const IPN_SECRET = 'test-ipn-secret';

describe('NOWPayments status mapping', () => {
  it('only treats finished as paid', () => {
    expect(mapNowPaymentsStatus('finished')).toBe('paid');
    expect(mapNowPaymentsStatus('partially_paid')).toBe('pending');
    expect(mapNowPaymentsStatus('confirming')).toBe('pending');
    expect(mapNowPaymentsStatus('failed')).toBe('failed');
    expect(mapNowPaymentsStatus('expired')).toBe('expired');
    expect(mapNowPaymentsStatus('something_new')).toBe('pending');
  });
});

describe('NOWPayments IPN verification', () => {
  beforeEach(() => {
    process.env.NOWPAYMENTS_IPN_SECRET = IPN_SECRET;
  });

  afterEach(() => {
    delete process.env.NOWPAYMENTS_IPN_SECRET;
  });

  it('sorts nested keys before signing', () => {
    expect(sortObject({ b: 1, a: { d: 2, c: 3 } })).toEqual({ a: { c: 3, d: 2 }, b: 1 });
  });

  it('accepts a correctly signed finished payment', () => {
    const body = JSON.stringify({
      payment_status: 'finished',
      order_id: 'payment-1',
      payment_id: 123,
      actually_paid: 2.65,
      payin_hash: '0xabc',
    });
    const signature = signNowPaymentsPayload(body, IPN_SECRET);
    const event = new NowPaymentsProvider().parseWebhook(body, signature);

    expect(event).toMatchObject({
      paymentId: 'payment-1',
      status: 'paid',
      providerStatus: 'finished',
      providerPaymentId: '123',
      amountUsdt: 2.65,
      txHash: '0xabc',
    });
  });

  it('rejects a tampered body or missing order id', () => {
    const body = JSON.stringify({ payment_status: 'finished', order_id: 'payment-1' });
    const signature = signNowPaymentsPayload(body, IPN_SECRET);
    const provider = new NowPaymentsProvider();

    expect(() =>
      provider.parseWebhook(body.replace('payment-1', 'payment-2'), signature),
    ).toThrow();
    expect(() =>
      provider.parseWebhook(JSON.stringify({ payment_status: 'finished' }), signature),
    ).toThrow();
  });
});

describe('NOWPayments checkout API', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NOWPAYMENTS_API_KEY = 'test-key';
    process.env.NOWPAYMENTS_API_URL = 'https://api.example.test/v1';
    process.env.NOWPAYMENTS_PAY_CURRENCY = 'usdttrc20';
    process.env.CRYPTO_WEBHOOK_URL = 'https://example.test/cryptoWebhook';
    process.env.APP_URL = 'https://example.test';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('requests an estimate and creates a hosted invoice', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes('/estimate')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ estimated_amount: 2.65 }),
        };
      }
      if (target.includes('/invoice')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'inv-1', invoice_url: 'https://nowpayments.io/payment/inv-1' }),
        };
      }
      throw new Error(`Unexpected URL ${target}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = new NowPaymentsProvider();
    const quote = await provider.quote(PLANS.basic.amountZar);
    expect(quote.amountUsdt).toBe(2.65);

    const session = await provider.createCheckout({
      paymentId: 'payment-1',
      ownerId: 'user-1',
      plan: PLANS.basic,
      amountUsdt: quote.amountUsdt,
      rateZarPerUsdt: quote.rateZarPerUsdt,
    });

    expect(session.checkoutUrl).toBe('https://nowpayments.io/payment/inv-1');
    expect(session.providerPaymentId).toBe('inv-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

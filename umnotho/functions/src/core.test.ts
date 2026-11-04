import { describe, expect, it } from 'vitest';
import {
  isPaymentStatus,
  paymentExpiry,
  quoteUsdt,
  signSandboxPayload,
  verifySandboxSignature,
} from './core';

describe('quoteUsdt', () => {
  it('converts ZAR prices and rounds up to two decimals', () => {
    expect(quoteUsdt(49, 18.5)).toBe(2.65);
    expect(quoteUsdt(97, 18.5)).toBe(5.25);
    expect(quoteUsdt(100, 20)).toBe(5);
  });

  it('rejects invalid amounts and rates', () => {
    expect(() => quoteUsdt(0, 18.5)).toThrow();
    expect(() => quoteUsdt(49, 0)).toThrow();
    expect(() => quoteUsdt(49, Number.NaN)).toThrow();
  });
});

describe('paymentExpiry', () => {
  it('defaults to a 30 minute window', () => {
    const start = new Date('2026-01-01T00:00:00.000Z').getTime();
    expect(paymentExpiry(start).toISOString()).toBe('2026-01-01T00:30:00.000Z');
  });
});

describe('payment statuses', () => {
  it('accepts known statuses only', () => {
    expect(isPaymentStatus('paid')).toBe(true);
    expect(isPaymentStatus('pending')).toBe(true);
    expect(isPaymentStatus('refunded')).toBe(false);
    expect(isPaymentStatus(1)).toBe(false);
  });
});

describe('sandbox webhook signatures', () => {
  const body = JSON.stringify({ paymentId: 'pay_1', status: 'paid' });
  const secret = 'local-test-secret';

  it('verifies a correctly signed payload', () => {
    const signature = signSandboxPayload(body, secret);
    expect(verifySandboxSignature(body, signature, secret)).toBe(true);
  });

  it('rejects a tampered payload, wrong secret, or empty signature', () => {
    const signature = signSandboxPayload(body, secret);
    expect(verifySandboxSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifySandboxSignature(body, signature, 'other-secret')).toBe(false);
    expect(verifySandboxSignature(body, '', secret)).toBe(false);
  });
});

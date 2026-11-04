import { describe, expect, it } from 'vitest';
import { checkoutIsExpired, formatUsdt, formatZar } from './crypto';

describe('crypto checkout formatting', () => {
  it('formats USDT and ZAR amounts', () => {
    expect(formatUsdt(2.65)).toBe('2.65 USDT');
    expect(formatZar(49)).toBe('R 49.00');
  });

  it('detects expired checkout timestamps', () => {
    const now = new Date('2026-01-01T00:00:00.000Z').getTime();
    expect(checkoutIsExpired('2025-12-31T23:59:00.000Z', now)).toBe(true);
    expect(checkoutIsExpired('2026-01-01T00:30:00.000Z', now)).toBe(false);
    expect(checkoutIsExpired(null, now)).toBe(false);
  });
});

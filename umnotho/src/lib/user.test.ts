import { describe, expect, it } from 'vitest';
import { displayNameFor } from './user';

describe('displayNameFor', () => {
  it('prefers the auth display name', () => {
    expect(displayNameFor({ displayName: 'Naledi', email: 'naledi@example.com' })).toBe('Naledi');
  });

  it('falls back to the email local part and then to Trader', () => {
    expect(displayNameFor({ displayName: null, email: 'thabo@example.com' })).toBe('thabo');
    expect(displayNameFor(null)).toBe('Trader');
  });

  it('truncates names to the 60 character limit used by the rules', () => {
    expect(displayNameFor({ displayName: 'x'.repeat(80), email: null })).toHaveLength(60);
  });
});

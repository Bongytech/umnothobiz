import { describe, expect, it } from 'vitest';
import {
  EMPTY_LISTING,
  parseRandValue,
  validateListing,
  validateMessage,
  validateOffer,
} from './validation';

describe('parseRandValue', () => {
  it('accepts plain and formatted rand amounts', () => {
    expect(parseRandValue('1500')).toBe(1500);
    expect(parseRandValue('R 1,500.00')).toBe(1500);
    expect(parseRandValue('R250')).toBe(250);
    expect(parseRandValue(99.5)).toBe(99.5);
  });

  it('rejects zero, negative, malformed, and oversized amounts', () => {
    expect(parseRandValue('0')).toBeNull();
    expect(parseRandValue('-5')).toBeNull();
    expect(parseRandValue('R0.00')).toBeNull();
    expect(parseRandValue('free')).toBeNull();
    expect(parseRandValue('')).toBeNull();
    expect(parseRandValue(10_000_001)).toBeNull();
  });
});

describe('validateListing', () => {
  const valid = {
    ...EMPTY_LISTING,
    name: 'Mountain bike',
    description: 'A reliable bike with new tyres and a lock.',
    estimatedValue: '1500',
    city: 'Cape Town',
  };

  it('accepts a complete listing', () => {
    expect(validateListing(valid)).toEqual({});
  });

  it('reports every missing field', () => {
    const errors = validateListing(EMPTY_LISTING);
    expect(Object.keys(errors).sort()).toEqual(
      ['city', 'description', 'estimatedValue', 'name'].sort(),
    );
  });

  it('rejects an overly short description', () => {
    expect(validateListing({ ...valid, description: 'Too short' }).description).toBeDefined();
  });
});

describe('message and offer validation', () => {
  it('requires non-empty messages and offers', () => {
    expect(validateMessage('   ')).toBeTruthy();
    expect(validateMessage('Is this still available?')).toBeNull();
    expect(validateOffer('R200')).toBeTruthy();
    expect(validateOffer('Two days of garden work plus R200')).toBeNull();
  });
});

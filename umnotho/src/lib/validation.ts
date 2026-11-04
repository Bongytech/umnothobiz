import type { ListingType } from './types';

export interface ListingDraft {
  name: string;
  description: string;
  estimatedValue: string;
  city: string;
  type: ListingType;
  isBusinessBid: boolean;
}

export type ListingErrors = Partial<Record<keyof ListingDraft, string>>;

export const EMPTY_LISTING: ListingDraft = {
  name: '',
  description: '',
  estimatedValue: '',
  city: '',
  type: 'goods',
  isBusinessBid: false,
};

/**
 * Accepts values such as "1500", "R1 500", "R 1,500.00" and returns a number.
 * Returns null when the value is not a positive, reasonably sized amount.
 */
export function parseRandValue(value: string | number): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 && value <= 10_000_000 ? value : null;
  }

  const cleaned = value
    .trim()
    .replace(/^R\s?/i, '')
    .replace(/[\s,]/g, '');

  // The pattern is intentionally bounded to 8 integer digits and 2 decimals.
  // eslint-disable-next-line security/detect-unsafe-regex
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 10_000_000 ? parsed : null;
}

export function formatRand(value: number): string {
  return `R ${Math.round(value).toLocaleString('en-ZA')}`;
}

export function validateListing(draft: ListingDraft): ListingErrors {
  const errors: ListingErrors = {};
  const name = draft.name.trim();
  const description = draft.description.trim();
  const city = draft.city.trim();

  if (name.length < 3) errors.name = 'Give the listing a name of at least 3 characters.';
  else if (name.length > 80) errors.name = 'Keep the listing name under 80 characters.';

  if (description.length < 10) {
    errors.description = 'Add at least 10 characters describing what you are offering.';
  } else if (description.length > 1000) {
    errors.description = 'Keep the description under 1,000 characters.';
  }

  if (parseRandValue(draft.estimatedValue) === null) {
    errors.estimatedValue = 'Enter a value between R1 and R10,000,000.';
  }

  if (city.length < 2) errors.city = 'Enter the city or town where the trade happens.';
  else if (city.length > 60) errors.city = 'Keep the city name under 60 characters.';

  if (draft.type !== 'goods' && draft.type !== 'service') {
    errors.type = 'Choose goods or a service.';
  }

  return errors;
}

export function validateMessage(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed.length === 0) return 'Write a short message first.';
  if (trimmed.length > 1000) return 'Keep messages under 1,000 characters.';
  return null;
}

export function validateOffer(offer: string): string | null {
  const trimmed = offer.trim();
  if (trimmed.length < 5) return 'Describe what you are offering (at least 5 characters).';
  if (trimmed.length > 1000) return 'Keep your offer under 1,000 characters.';
  return null;
}

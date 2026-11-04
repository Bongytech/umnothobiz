export const PLAN_IDS = ['basic', 'biz'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanDefinition {
  id: PlanId;
  name: string;
  amountZar: number;
  durationDays: number;
}

/**
 * Server-side plan catalogue. The browser may ask for a plan by id, but it can
 * never supply the price, currency, or duration.
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    amountZar: 49,
    durationDays: 30,
  },
  biz: {
    id: 'biz',
    name: 'Biz',
    amountZar: 97,
    durationDays: 30,
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value);
}

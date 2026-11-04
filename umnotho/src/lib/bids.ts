import type { Bid, BidRole, BidStatus } from './types';

export const BID_STATUSES: readonly BidStatus[] = [
  'Pending',
  'In Negotiation',
  'Completed',
  'Declined',
];

const OWNER_TRANSITIONS: Record<BidStatus, readonly BidStatus[]> = {
  Pending: ['In Negotiation', 'Completed', 'Declined'],
  'In Negotiation': ['Completed', 'Declined'],
  Completed: [],
  Declined: [],
};

const BIDDER_TRANSITIONS: Record<BidStatus, readonly BidStatus[]> = {
  Pending: ['Declined'],
  'In Negotiation': ['Declined'],
  Completed: [],
  Declined: [],
};

export function roleForBid(bid: Pick<Bid, 'ownerId' | 'bidderId'>, userId: string): BidRole | null {
  if (bid.ownerId === userId) return 'owner';
  if (bid.bidderId === userId) return 'bidder';
  return null;
}

export function canTransition(
  current: BidStatus,
  next: BidStatus,
  role: BidRole | null,
): boolean {
  if (!role) return false;
  const allowed = role === 'owner' ? OWNER_TRANSITIONS[current] : BIDDER_TRANSITIONS[current];
  return allowed.includes(next);
}

export function canMessage(bid: Pick<Bid, 'status'>, userId: string, bidWithParties: Pick<Bid, 'ownerId' | 'bidderId'>): boolean {
  if (!roleForBid(bidWithParties, userId)) return false;
  return bid.status !== 'Completed' && bid.status !== 'Declined';
}

export function isOpenBid(status: BidStatus): boolean {
  return status === 'Pending' || status === 'In Negotiation';
}

export function statusStyles(status: BidStatus): string {
  switch (status) {
    case 'Completed':
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'Declined':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'In Negotiation':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default:
      return 'bg-umnotho/10 text-umnotho border-umnotho/20';
  }
}

import { describe, expect, it } from 'vitest';
import { canTransition, isOpenBid, roleForBid } from './bids';

describe('roleForBid', () => {
  const bid = { ownerId: 'owner', bidderId: 'bidder' };

  it('identifies the owner and the bidder', () => {
    expect(roleForBid(bid, 'owner')).toBe('owner');
    expect(roleForBid(bid, 'bidder')).toBe('bidder');
  });

  it('rejects outsiders', () => {
    expect(roleForBid(bid, 'stranger')).toBeNull();
  });
});

describe('canTransition', () => {
  it('lets the owner accept, negotiate, and decline an open offer', () => {
    expect(canTransition('Pending', 'In Negotiation', 'owner')).toBe(true);
    expect(canTransition('Pending', 'Completed', 'owner')).toBe(true);
    expect(canTransition('Pending', 'Declined', 'owner')).toBe(true);
  });

  it('does not let the owner reopen a closed offer', () => {
    expect(canTransition('Completed', 'Pending', 'owner')).toBe(false);
    expect(canTransition('Declined', 'In Negotiation', 'owner')).toBe(false);
  });

  it('only lets the bidder withdraw', () => {
    expect(canTransition('Pending', 'Declined', 'bidder')).toBe(true);
    expect(canTransition('Pending', 'Completed', 'bidder')).toBe(false);
  });

  it('rejects transitions from outsiders', () => {
    expect(canTransition('Pending', 'Completed', null)).toBe(false);
  });
});

describe('isOpenBid', () => {
  it('treats pending and negotiating offers as open', () => {
    expect(isOpenBid('Pending')).toBe(true);
    expect(isOpenBid('In Negotiation')).toBe(true);
    expect(isOpenBid('Completed')).toBe(false);
    expect(isOpenBid('Declined')).toBe(false);
  });
});

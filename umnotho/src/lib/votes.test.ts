import { describe, expect, it } from 'vitest';
import { canVote, summarizeVotes, withVote } from './votes';

describe('summarizeVotes', () => {
  it('counts up and down votes and returns a net score', () => {
    expect(summarizeVotes({ a: 'up', b: 'up', c: 'down' })).toEqual({ up: 2, down: 1, score: 1 });
  });

  it('handles missing vote maps', () => {
    expect(summarizeVotes(undefined)).toEqual({ up: 0, down: 0, score: 0 });
    expect(summarizeVotes(null)).toEqual({ up: 0, down: 0, score: 0 });
  });
});

describe('canVote', () => {
  it('allows one vote from a signed-in non-owner', () => {
    expect(canVote('owner', 'visitor', {})).toBe(true);
  });

  it('blocks owners, signed-out visitors, and repeat voters', () => {
    expect(canVote('owner', 'owner', {})).toBe(false);
    expect(canVote('owner', null, {})).toBe(false);
    expect(canVote('owner', 'visitor', { visitor: 'up' })).toBe(false);
  });
});

describe('withVote', () => {
  it('adds a vote without mutating the existing map', () => {
    const original = { a: 'up' as const };
    const updated = withVote(original, 'b', 'down');
    expect(updated).toEqual({ a: 'up', b: 'down' });
    expect(original).toEqual({ a: 'up' });
  });
});

import type { VoteMap, VoteType } from './types';

export interface VoteSummary {
  up: number;
  down: number;
  score: number;
}

export function summarizeVotes(votes: VoteMap | null | undefined): VoteSummary {
  let up = 0;
  let down = 0;

  for (const vote of Object.values(votes ?? {})) {
    if (vote === 'up') up += 1;
    else if (vote === 'down') down += 1;
  }

  return { up, down, score: up - down };
}

export function canVote(
  ownerId: string,
  userId: string | null | undefined,
  votes: VoteMap | null | undefined,
): boolean {
  if (!userId || userId === ownerId) return false;
  return !(userId in (votes ?? {}));
}

export function withVote(votes: VoteMap | null | undefined, userId: string, vote: VoteType): VoteMap {
  return { ...(votes ?? {}), [userId]: vote };
}

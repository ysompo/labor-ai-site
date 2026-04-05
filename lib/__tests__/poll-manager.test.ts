/**
 * Tests for lib/poll-manager.ts
 *
 * @vercel/kv is mocked with an in-memory Map so no real network calls are made.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock @vercel/kv ───────────────────────────────────────────────────────────
// vi.hoisted ensures the store is initialised before the vi.mock factory runs.

const mockStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => { mockStore.set(key, value); }),
    del: vi.fn(async (key: string) => { mockStore.delete(key); }),
  },
}));

// ── Import after mock is registered ──────────────────────────────────────────

import {
  createPoll,
  getPoll,
  recordVote,
  closePoll,
  deletePoll,
  formatPollMessage,
  formatVoteTally,
  type Poll,
} from '../poll-manager';

// ── Helpers ───────────────────────────────────────────────────────────────────

const GROUP = 'group-123';
const OPTIONS = [
  { date: '2025-06-10', time: '10:00' },
  { date: '2025-06-11', time: '14:00' },
  { date: '2025-06-12', time: '09:00' },
];

beforeEach(() => mockStore.clear());

// ── createPoll ────────────────────────────────────────────────────────────────

describe('createPoll', () => {
  it('returns a poll with the correct structure', async () => {
    const poll = await createPoll(GROUP, OPTIONS, 'Team meeting');
    expect(poll.groupId).toBe(GROUP);
    expect(poll.status).toBe('open');
    expect(poll.topic).toBe('Team meeting');
    expect(poll.votes).toEqual({});
  });

  it('assigns 1-based indices to options', async () => {
    const poll = await createPoll(GROUP, OPTIONS);
    expect(poll.options.map(o => o.index)).toEqual([1, 2, 3]);
  });

  it('preserves date and time in options', async () => {
    const poll = await createPoll(GROUP, OPTIONS);
    expect(poll.options[0]).toMatchObject({ index: 1, date: '2025-06-10', time: '10:00' });
    expect(poll.options[2]).toMatchObject({ index: 3, date: '2025-06-12', time: '09:00' });
  });

  it('stores the poll in KV so getPoll can retrieve it', async () => {
    await createPoll(GROUP, OPTIONS);
    const retrieved = await getPoll(GROUP);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.groupId).toBe(GROUP);
  });

  it('replaces an existing poll for the same group', async () => {
    await createPoll(GROUP, OPTIONS, 'First');
    await createPoll(GROUP, [OPTIONS[0]], 'Second');
    const poll = await getPoll(GROUP);
    expect(poll!.topic).toBe('Second');
    expect(poll!.options).toHaveLength(1);
  });
});

// ── getPoll ───────────────────────────────────────────────────────────────────

describe('getPoll', () => {
  it('returns null when no poll exists', async () => {
    expect(await getPoll('nonexistent')).toBeNull();
  });
});

// ── recordVote ────────────────────────────────────────────────────────────────

describe('recordVote', () => {
  it('stores the chosen option indices for a participant', async () => {
    await createPoll(GROUP, OPTIONS);
    const updated = await recordVote(GROUP, '+972501234567', [1, 3]);
    expect(updated!.votes['+972501234567']).toEqual([1, 3]);
  });

  it('replaces previous votes from the same phone number', async () => {
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+972501234567', [1]);
    const updated = await recordVote(GROUP, '+972501234567', [2, 3]);
    expect(updated!.votes['+972501234567']).toEqual([2, 3]);
  });

  it('filters out option indices that do not exist in the poll', async () => {
    await createPoll(GROUP, OPTIONS); // indices 1, 2, 3
    const updated = await recordVote(GROUP, '+972501234567', [1, 99]);
    expect(updated!.votes['+972501234567']).toEqual([1]); // 99 filtered out
  });

  it('returns null when no poll exists for the group', async () => {
    expect(await recordVote('nonexistent', '+972501234567', [1])).toBeNull();
  });

  it('returns null when the poll is closed', async () => {
    await createPoll(GROUP, OPTIONS);
    await closePoll(GROUP, '+972509999999');
    expect(await recordVote(GROUP, '+972501234567', [1])).toBeNull();
  });

  it('persists multiple voters independently', async () => {
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+1', [1]);
    await recordVote(GROUP, '+2', [2, 3]);
    const poll = await getPoll(GROUP);
    expect(poll!.votes['+1']).toEqual([1]);
    expect(poll!.votes['+2']).toEqual([2, 3]);
  });
});

// ── closePoll — winner detection ──────────────────────────────────────────────

describe('closePoll — winner detection', () => {
  it('identifies the option with the most votes as the winner', async () => {
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+1', [1]);
    await recordVote(GROUP, '+2', [2]);
    await recordVote(GROUP, '+3', [2]); // option 2 has 2 votes
    const result = await closePoll(GROUP, '+1');
    expect(result!.winningOption.index).toBe(2);
  });

  it('sets poll status to "closed"', async () => {
    await createPoll(GROUP, OPTIONS);
    const result = await closePoll(GROUP, '+1');
    expect(result!.poll.status).toBe('closed');
  });

  it('uses the owner\'s first choice to break a tie', async () => {
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+owner', [1]);   // owner votes for option 1
    await recordVote(GROUP, '+other', [2]);   // tie: 1 vote each
    const result = await closePoll(GROUP, '+owner');
    expect(result!.winningOption.index).toBe(1); // owner's preference wins
  });

  it('falls back to the first tied option when the owner has not voted', async () => {
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+a', [1]);
    await recordVote(GROUP, '+b', [2]); // tie: options 1 and 2
    const result = await closePoll(GROUP, '+owner-who-did-not-vote');
    // Should return the first of the tied options (index 1)
    expect([1, 2]).toContain(result!.winningOption.index);
    expect(result!.winningOption.index).toBe(1);
  });

  it('breaks a three-way tie using the owner\'s vote', async () => {
    // 3-way tie at 1 vote each; owner only voted for option 3
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+a', [1]);
    await recordVote(GROUP, '+b', [2]);
    await recordVote(GROUP, '+c', [3]);
    await recordVote(GROUP, '+owner', [3]); // owner picks option 3
    const result = await closePoll(GROUP, '+owner');
    // Options 1, 2, 3 are tied; owner voted for 3 → option 3 wins
    expect(result!.winningOption.index).toBe(3);
  });

  it('returns null when no poll exists', async () => {
    expect(await closePoll('nonexistent', '+1')).toBeNull();
  });

  it('returns null when the poll is already closed', async () => {
    await createPoll(GROUP, OPTIONS);
    await closePoll(GROUP, '+1'); // close once
    expect(await closePoll(GROUP, '+1')).toBeNull(); // second close → null
  });

  it('handles a poll with zero votes (all options tied at 0)', async () => {
    await createPoll(GROUP, OPTIONS);
    const result = await closePoll(GROUP, '+owner');
    // Winner must be one of the options (first one when all tied)
    expect(result!.winningOption.index).toBe(1);
  });
});

// ── deletePoll ────────────────────────────────────────────────────────────────

describe('deletePoll', () => {
  it('removes the poll so getPoll returns null afterwards', async () => {
    await createPoll(GROUP, OPTIONS);
    await deletePoll(GROUP);
    expect(await getPoll(GROUP)).toBeNull();
  });
});

// ── formatPollMessage ─────────────────────────────────────────────────────────

describe('formatPollMessage', () => {
  it('includes all option numbers in the message', async () => {
    const poll = await createPoll(GROUP, OPTIONS);
    const msg = formatPollMessage(poll);
    expect(msg).toContain('1.');
    expect(msg).toContain('2.');
    expect(msg).toContain('3.');
  });

  it('includes each option\'s time', async () => {
    const poll = await createPoll(GROUP, OPTIONS);
    const msg = formatPollMessage(poll);
    expect(msg).toContain('10:00');
    expect(msg).toContain('14:00');
    expect(msg).toContain('09:00');
  });

  it('contains the instructions header', async () => {
    const poll = await createPoll(GROUP, OPTIONS);
    const msg = formatPollMessage(poll);
    expect(msg).toContain('When can everyone meet?');
  });
});

// ── formatVoteTally ───────────────────────────────────────────────────────────

describe('formatVoteTally', () => {
  it('shows 0 votes initially', async () => {
    const poll = await createPoll(GROUP, OPTIONS);
    const tally = formatVoteTally(poll);
    expect(tally).toContain('0 participant(s) responded');
  });

  it('reflects votes after recording them', async () => {
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+1', [1, 2]);
    await recordVote(GROUP, '+2', [1]);
    const poll = (await getPoll(GROUP))!;
    const tally = formatVoteTally(poll);
    // Option 1 has 2 votes
    expect(tally).toMatch(/1\..+2 vote/);
    // Option 2 has 1 vote
    expect(tally).toMatch(/2\..+1 vote/);
  });

  it('shows the correct number of respondents', async () => {
    await createPoll(GROUP, OPTIONS);
    await recordVote(GROUP, '+a', [1]);
    await recordVote(GROUP, '+b', [2]);
    const poll = (await getPoll(GROUP))!;
    expect(formatVoteTally(poll)).toContain('2 participant(s) responded');
  });
});

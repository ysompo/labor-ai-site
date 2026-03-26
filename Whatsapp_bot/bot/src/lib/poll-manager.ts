/**
 * Poll manager — stores and manages Doodle-style poll state in Vercel KV.
 *
 * Key schema:
 *   poll:{groupId}   →  Poll object
 */

import { kv } from "@vercel/kv";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PollOption {
  index: number;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
}

export interface Poll {
  groupId: string;
  options: PollOption[];
  votes: Record<string, number[]>;  // phoneNumber → chosen option indices (1-based)
  status: "open" | "closed";
  createdAt: string;
  topic?: string;
}

// ── Key helper ───────────────────────────────────────────────────────────────

function pollKey(groupId: string): string {
  return `poll:${groupId}`;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create (or replace) a poll for a group.
 */
export async function createPoll(
  groupId: string,
  options: Array<{ date: string; time: string }>,
  topic?: string
): Promise<Poll> {
  const poll: Poll = {
    groupId,
    options: options.map((o, i) => ({ index: i + 1, date: o.date, time: o.time })),
    votes: {},
    status: "open",
    createdAt: new Date().toISOString(),
    topic,
  };

  await kv.set(pollKey(groupId), poll, { ex: 7 * 24 * 60 * 60 }); // TTL: 7 days
  return poll;
}

/**
 * Get the current poll for a group. Returns null if none exists.
 */
export async function getPoll(groupId: string): Promise<Poll | null> {
  return kv.get<Poll>(pollKey(groupId));
}

/**
 * Record a participant's votes.
 * Replaces any previous votes from this phone number.
 * Only updates if the poll is open.
 * Returns the updated poll, or null if no open poll exists.
 */
export async function recordVote(
  groupId: string,
  phone: string,
  chosenIndices: number[]
): Promise<Poll | null> {
  const poll = await getPoll(groupId);
  if (!poll || poll.status !== "open") return null;

  // Validate indices are in range
  const validIndices = chosenIndices.filter((i) =>
    poll.options.some((o) => o.index === i)
  );

  poll.votes[phone] = validIndices;
  await kv.set(pollKey(groupId), poll, { ex: 7 * 24 * 60 * 60 });
  return poll;
}

/**
 * Close a poll and determine the winning option.
 * In case of a tie, the owner's first choice wins.
 * Returns { poll, winningOption }.
 */
export async function closePoll(
  groupId: string,
  ownerPhone: string
): Promise<{ poll: Poll; winningOption: PollOption } | null> {
  const poll = await getPoll(groupId);
  if (!poll || poll.status !== "open") return null;

  // Tally votes
  const tally: Record<number, number> = {};
  for (const option of poll.options) {
    tally[option.index] = 0;
  }
  for (const votes of Object.values(poll.votes)) {
    for (const idx of votes) {
      tally[idx] = (tally[idx] ?? 0) + 1;
    }
  }

  // Find the max vote count
  const maxVotes = Math.max(...Object.values(tally));

  // Get all options tied at max
  const tiedOptions = poll.options.filter(
    (o) => tally[o.index] === maxVotes
  );

  let winner: PollOption;
  if (tiedOptions.length === 1) {
    winner = tiedOptions[0];
  } else {
    // Owner's preference wins ties
    const ownerVotes = poll.votes[ownerPhone] ?? [];
    const ownerPick = tiedOptions.find((o) => ownerVotes.includes(o.index));
    winner = ownerPick ?? tiedOptions[0];
  }

  poll.status = "closed";
  await kv.set(pollKey(groupId), poll, { ex: 7 * 24 * 60 * 60 });

  return { poll, winningOption: winner };
}

/**
 * Delete a poll (e.g. after successfully scheduling).
 */
export async function deletePoll(groupId: string): Promise<void> {
  await kv.del(pollKey(groupId));
}

/**
 * Format a poll's options as the WhatsApp message text.
 */
export function formatPollMessage(poll: Poll): string {
  const header = "When can everyone meet?\nReply with the numbers you're available for (e.g. \"1,3\"):\n";

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const lines = poll.options.map((o) => {
    const d = new Date(`${o.date}T${o.time}:00+03:00`);
    const dayName = dayNames[d.getDay()];
    return `${o.index}. ${dayName} ${o.time}`;
  });

  return header + "\n" + lines.join("\n");
}

/**
 * Format the current vote tally as a human-readable string.
 */
export function formatVoteTally(poll: Poll): string {
  const tally: Record<number, number> = {};
  for (const option of poll.options) tally[option.index] = 0;
  for (const votes of Object.values(poll.votes)) {
    for (const idx of votes) tally[idx] = (tally[idx] ?? 0) + 1;
  }

  const totalVoters = Object.keys(poll.votes).length;
  const lines = poll.options.map(
    (o) => `${o.index}. ${o.date} ${o.time} - ${tally[o.index]} vote(s)`
  );
  return `Current votes (${totalVoters} participant(s) responded):\n${lines.join("\n")}`;
}

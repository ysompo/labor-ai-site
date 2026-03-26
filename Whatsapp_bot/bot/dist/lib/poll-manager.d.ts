/**
 * Poll manager — stores and manages Doodle-style poll state in Vercel KV.
 *
 * Key schema:
 *   poll:{groupId}   →  Poll object
 */
export interface PollOption {
    index: number;
    date: string;
    time: string;
}
export interface Poll {
    groupId: string;
    options: PollOption[];
    votes: Record<string, number[]>;
    status: "open" | "closed";
    createdAt: string;
    topic?: string;
}
/**
 * Create (or replace) a poll for a group.
 */
export declare function createPoll(groupId: string, options: Array<{
    date: string;
    time: string;
}>, topic?: string): Promise<Poll>;
/**
 * Get the current poll for a group. Returns null if none exists.
 */
export declare function getPoll(groupId: string): Promise<Poll | null>;
/**
 * Record a participant's votes.
 * Replaces any previous votes from this phone number.
 * Only updates if the poll is open.
 * Returns the updated poll, or null if no open poll exists.
 */
export declare function recordVote(groupId: string, phone: string, chosenIndices: number[]): Promise<Poll | null>;
/**
 * Close a poll and determine the winning option.
 * In case of a tie, the owner's first choice wins.
 * Returns { poll, winningOption }.
 */
export declare function closePoll(groupId: string, ownerPhone: string): Promise<{
    poll: Poll;
    winningOption: PollOption;
} | null>;
/**
 * Delete a poll (e.g. after successfully scheduling).
 */
export declare function deletePoll(groupId: string): Promise<void>;
/**
 * Format a poll's options as the WhatsApp message text.
 */
export declare function formatPollMessage(poll: Poll): string;
/**
 * Format the current vote tally as a human-readable string.
 */
export declare function formatVoteTally(poll: Poll): string;
//# sourceMappingURL=poll-manager.d.ts.map
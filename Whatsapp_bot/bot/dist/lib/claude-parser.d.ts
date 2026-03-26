/**
 * NLP parser — uses Anthropic Claude to extract structured scheduling data
 * from natural language requests in Hebrew or English.
 */
export interface ParsedMeeting {
    participants: string[] | "everyone";
    date: string | null;
    time: string | null;
    topic: string | null;
    meetingType: "zoom" | "inperson";
    location: string | null;
}
export interface ParsedPollTrigger {
    intent: "find_time";
    topic: string | null;
}
/**
 * Parse a natural language scheduling command.
 * @param text   The user's message text
 * @param today  ISO date string for today (YYYY-MM-DD) — used to resolve relative dates
 */
export declare function parseSchedulingCommand(text: string, today: string): Promise<ParsedMeeting>;
export type MessageIntent = "schedule_meeting" | "find_time" | "close_poll" | "transcribe" | "poll_vote" | "unknown";
/**
 * Detect the intent of an incoming text message.
 * Returns "poll_vote" if the message is purely numeric (e.g. "1,3").
 */
export declare function detectIntent(text: string): MessageIntent;
/**
 * Parse a poll-vote reply into an array of 1-based option indices.
 * e.g. "1, 3" → [1, 3]
 */
export declare function parsePollVote(text: string): number[];
//# sourceMappingURL=claude-parser.d.ts.map
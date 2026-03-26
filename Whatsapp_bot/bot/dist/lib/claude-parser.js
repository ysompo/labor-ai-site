"use strict";
/**
 * NLP parser — uses Anthropic Claude to extract structured scheduling data
 * from natural language requests in Hebrew or English.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSchedulingCommand = parseSchedulingCommand;
exports.detectIntent = detectIntent;
exports.parsePollVote = parsePollVote;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
// ── Client ───────────────────────────────────────────────────────────────────
function getClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error("ANTHROPIC_API_KEY is not set");
    return new sdk_1.default({ apiKey });
}
// ── Scheduling parser ────────────────────────────────────────────────────────
const SCHEDULING_SYSTEM_PROMPT = `You are a meeting scheduling assistant. Extract structured data from natural language scheduling requests in Hebrew or English.
Return JSON only, no explanation.
Format: { "participants": ["name1", "name2"] or "everyone", "date": "YYYY-MM-DD", "time": "HH:MM", "topic": "string or null", "meetingType": "zoom" | "inperson", "location": "string or null" }
If date is relative (e.g. "Thursday", "tomorrow"), resolve it relative to today's date which is provided.
If any field cannot be determined, set it to null.
For meetingType: if the message mentions a physical place (room, office, hospital, address, חדר, משרד, מיקום) and does NOT mention zoom — set meetingType to "inperson" and extract the location. Otherwise default to "zoom" and set location to null.`;
/**
 * Parse a natural language scheduling command.
 * @param text   The user's message text
 * @param today  ISO date string for today (YYYY-MM-DD) — used to resolve relative dates
 */
async function parseSchedulingCommand(text, today) {
    const client = getClient();
    const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        system: SCHEDULING_SYSTEM_PROMPT,
        messages: [
            {
                role: "user",
                content: `Today's date is ${today}.\n\nScheduling request: ${text}`,
            },
        ],
    });
    const raw = message.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("");
    // Strip any accidental markdown code fences
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        throw new Error(`Claude returned invalid JSON: ${cleaned}`);
    }
    return parsed;
}
// ── Intent detection (pure regex, no API cost) ──────────────────────────────
const SCHEDULE_PATTERNS = [
    /schedule/i,
    /book\s+(a\s+)?meeting/i,
    /set\s+up\s+(a\s+)?zoom/i,
    /create\s+(a\s+)?meeting/i,
    /zoom\s+with/i,
    /תזמן/,
    /תקבע\s+זום/,
    /תקבע\s+פגישה/,
    /קבע\s+פגישה/,
    /פגישת\s+זום/,
];
const FIND_TIME_PATTERNS = [
    /find\s+a\s+time/i,
    /when\s+can\s+we/i,
    /schedule\s+a\s+meeting\s+this/i,
    /מצא\s+זמן/,
    /מתי\s+נוכל/,
    /מתי\s+אפשר/,
];
const CLOSE_POLL_PATTERNS = [
    /close\s+poll/i,
    /schedule\s+it/i,
    /קבע\s+לפי\s+ההצבעה/,
    /סגור\s+סקר/,
];
const TRANSCRIBE_PATTERNS = [
    /transcribe/i,
    /תתמלל/,
];
/**
 * Detect the intent of an incoming text message.
 * Returns "poll_vote" if the message is purely numeric (e.g. "1,3").
 */
function detectIntent(text) {
    const t = text.trim();
    if (CLOSE_POLL_PATTERNS.some((p) => p.test(t)))
        return "close_poll";
    if (SCHEDULE_PATTERNS.some((p) => p.test(t)))
        return "schedule_meeting";
    if (FIND_TIME_PATTERNS.some((p) => p.test(t)))
        return "find_time";
    if (TRANSCRIBE_PATTERNS.some((p) => p.test(t)))
        return "transcribe";
    // Pure vote reply: only digits, commas, spaces
    if (/^[\d,\s]+$/.test(t) && t.length <= 20)
        return "poll_vote";
    return "unknown";
}
/**
 * Parse a poll-vote reply into an array of 1-based option indices.
 * e.g. "1, 3" → [1, 3]
 */
function parsePollVote(text) {
    return text
        .split(/[\s,]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n) && n > 0);
}
//# sourceMappingURL=claude-parser.js.map
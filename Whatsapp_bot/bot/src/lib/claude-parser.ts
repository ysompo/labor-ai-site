/**
 * NLP parser — uses Anthropic Claude to extract structured scheduling data
 * from natural language requests in Hebrew or English.
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedMeeting {
  participants: string[] | "everyone";
  date: string | null;   // YYYY-MM-DD
  time: string | null;   // HH:MM (24-hour)
  topic: string | null;
  meetingType: "zoom" | "inperson";
  location: string | null;
}

export interface ParsedPollTrigger {
  intent: "find_time";
  topic: string | null;
}

// ── Client ───────────────────────────────────────────────────────────────────

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
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
export async function parseSchedulingCommand(
  text: string,
  today: string
): Promise<ParsedMeeting> {
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
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("");

  // Strip any accidental markdown code fences
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

  let parsed: ParsedMeeting;
  try {
    parsed = JSON.parse(cleaned) as ParsedMeeting;
  } catch {
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

const REMINDER_PATTERNS = [
  /remind\s+me/i,
  /reminder/i,
  /don'?t\s+forget/i,
  /תזכיר\s+לי/,
  /תזכורת/,
  /אל\s+תשכח/,
];

const BLOCK_ADD_PATTERNS = [
  /\bblock\b/i,
  /\badd\s+block\b/i,
  /\bunavailable\b/i,
  /חסום/,
  /חסימה\s+חדשה/,
  /לא\s+זמין\s+ב/,
];

const BLOCK_REMOVE_PATTERNS = [
  /\bremove\s+block\b/i,
  /\bdelete\s+block\b/i,
  /\bcancel\s+block\b/i,
  /הסר\s+חסימה/,
  /מחק\s+חסימה/,
];

const BLOCK_LIST_PATTERNS = [
  /\bshow\s+blocks?\b/i,
  /\blist\s+blocks?\b/i,
  /\bmy\s+blocks?\b/i,
  /הצג\s+חסימות/,
  /מה\s+החסימות/,
  /רשימת\s+חסימות/,
];

const HELP_PATTERNS = [
  /\bhelp\b/i,
  /\bcommands?\b/i,
  /what\s+can\s+you\s+do/i,
  /עזרה/,
  /פקודות/,
  /מה\s+אתה\s+יכול/,
];

const RENAME_PATTERNS = [
  /call\s+me\b/i,
  /my\s+name\s+is\b/i,
  /קרא\s+לי\b/,
  /השם\s+שלי\b/,
  /תקרא\s+לי\b/,
];

export type MessageIntent =
  | "schedule_meeting"
  | "find_time"
  | "close_poll"
  | "transcribe"
  | "reminder"
  | "poll_vote"
  | "block_add"
  | "block_remove"
  | "block_list"
  | "rename"
  | "help"
  | "unknown";

/**
 * Detect the intent of an incoming text message.
 * Returns "poll_vote" if the message is purely numeric (e.g. "1,3").
 */
export function detectIntent(text: string): MessageIntent {
  const t = text.trim();

  if (RENAME_PATTERNS.some((p) => p.test(t))) return "rename";
  if (CLOSE_POLL_PATTERNS.some((p) => p.test(t))) return "close_poll";
  if (BLOCK_REMOVE_PATTERNS.some((p) => p.test(t))) return "block_remove";
  if (BLOCK_LIST_PATTERNS.some((p) => p.test(t))) return "block_list";
  if (BLOCK_ADD_PATTERNS.some((p) => p.test(t))) return "block_add";
  if (REMINDER_PATTERNS.some((p) => p.test(t))) return "reminder";
  if (HELP_PATTERNS.some((p) => p.test(t))) return "help";
  if (SCHEDULE_PATTERNS.some((p) => p.test(t))) return "schedule_meeting";
  if (FIND_TIME_PATTERNS.some((p) => p.test(t))) return "find_time";
  if (TRANSCRIBE_PATTERNS.some((p) => p.test(t))) return "transcribe";

  // Pure vote reply: only digits, commas, spaces
  if (/^[\d,\s]+$/.test(t) && t.length <= 20) return "poll_vote";

  return "unknown";
}

// ── Block parser ──────────────────────────────────────────────────────────────

export interface ParsedBlock {
  type: "recurring" | "onetime";
  day?: string;      // "monday" | ... (for recurring)
  date?: string;     // YYYY-MM-DD (for onetime)
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  label?: string;
}

const BLOCK_SYSTEM_PROMPT = `You are a scheduling assistant. Parse a schedule block command in Hebrew or English.
Return JSON only, no explanation.
Format: { "type": "recurring" | "onetime", "day": "monday" (for recurring), "date": "YYYY-MM-DD" (for onetime), "startTime": "HH:MM", "endTime": "HH:MM", "label": "optional string or null" }
For recurring blocks, "day" must be one of: sunday, monday, tuesday, wednesday, thursday, friday, saturday.
For one-time blocks, "date" must be YYYY-MM-DD resolved relative to today's date provided.
Hebrew days: ראשון=sunday, שני=monday, שלישי=tuesday, רביעי=wednesday, חמישי=thursday, שישי=friday, שבת=saturday.
Use 24-hour HH:MM format.`;

export async function parseBlockCommand(text: string, today: string): Promise<ParsedBlock | null> {
  const client = getClient();
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 128,
      system: BLOCK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Today is ${today}. Block command: ${text}` }],
    });
    const raw = message.content.filter(c => c.type === "text").map(c => (c as {type:"text";text:string}).text).join("").trim();
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    return JSON.parse(cleaned) as ParsedBlock;
  } catch {
    return null;
  }
}

// ── Reminder parser ──────────────────────────────────────────────────────────

export interface ParsedReminder {
  title: string;       // What to be reminded about
  dueDate: string | null; // YYYY-MM-DD
}

/**
 * Parse a natural language reminder request using Claude.
 */
export async function parseReminderCommand(
  text: string,
  today: string
): Promise<ParsedReminder> {
  const client = getClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 128,
    system: `Extract a reminder from a natural language request in Hebrew or English.
Return JSON only, no explanation.
Format: { "title": "string", "dueDate": "YYYY-MM-DD or null" }
If the date is relative (e.g. "tomorrow", "מחר"), resolve it relative to today's date which is provided.
The title should be a short action phrase (e.g. "Call Dr. Cohen", "Buy milk").`,
    messages: [
      {
        role: "user",
        content: `Today's date is ${today}.\n\nReminder request: ${text}`,
      },
    ],
  });

  const raw = message.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("");

  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

  try {
    return JSON.parse(cleaned) as ParsedReminder;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned}`);
  }
}

/**
 * Parse a poll-vote reply into an array of 1-based option indices.
 * e.g. "1, 3" → [1, 3]
 */
export function parsePollVote(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n > 0);
}

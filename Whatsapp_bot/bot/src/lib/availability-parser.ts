/**
 * availability-parser.ts
 *
 * Uses Claude API to parse free-text availability responses (Hebrew or English)
 * into structured AvailabilityWindow[] objects.
 *
 * Example inputs:
 *   "I'm free Tuesday afternoon and Thursday morning except before 9"
 *   "זמין ביום שלישי אחרי 14:00 ורביעי כל היום"
 *   "can do anytime Monday or Wednesday after 3pm, not Friday"
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AvailabilityWindow {
  day: string;      // "monday" | "tuesday" | ... (lowercase)
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a scheduling assistant. Parse a person's free-text availability message in Hebrew or English and return structured JSON.

Output ONLY a JSON object in this exact format — no explanation, no markdown:
{
  "windows": [
    { "day": "monday", "startTime": "09:00", "endTime": "17:00" },
    ...
  ],
  "unclear": false
}

Rules:
- "day" must be one of: sunday, monday, tuesday, wednesday, thursday, friday, saturday
- Use 24-hour HH:MM format for times
- If a person says "morning" assume 08:00–12:00
- If a person says "afternoon" (אחה"צ / אחר הצהריים) assume 12:00–17:00
- If a person says "evening" (ערב) assume 17:00–21:00
- If a person says "all day" or "כל היום" assume 08:00–20:00
- If a person says "after X" treat as X–20:00
- If a person says "before X" treat as 08:00–X
- If a person says "between X and Y" treat as X–Y
- If the message contains only times without a day name (e.g. "09:00–12:00", "14:00 and 16:00", "after 10"), use the default day specified in the user message ("If they do not specify a day, assume they mean X")
- If a person lists two times with "and" (e.g. "09:00 and 12:00"), treat each as a 1-hour window: 09:00–10:00 and 12:00–13:00
- If the message is completely unclear (e.g. just "ok" or "sure"), set "unclear": true and return empty windows
- Do NOT include days the person explicitly says they are NOT available
- Hebrew day names: ראשון=sunday, שני=monday, שלישי=tuesday, רביעי=wednesday, חמישי=thursday, שישי=friday, שבת=saturday`;

// ── Parser ────────────────────────────────────────────────────────────────────

const DAY_NAMES_EN = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function dayNameOf(dateStr: string): string {
  return DAY_NAMES_EN[new Date(`${dateStr}T12:00:00+03:00`).getDay()];
}

function humanDateEn(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Jerusalem" });
}

export async function parseAvailability(
  message: string,
  today: string, // YYYY-MM-DD, used as context (day of week)
  meetingRange?: { start: string; end: string }
): Promise<{ windows: AvailabilityWindow[]; unclear: boolean }> {
  let rangeContext = "";
  if (meetingRange) {
    const startDay = dayNameOf(meetingRange.start);
    const endDay   = dayNameOf(meetingRange.end);
    const sameDay  = meetingRange.start === meetingRange.end;
    rangeContext = sameDay
      ? ` The person is being asked about availability on ${startDay}, ${humanDateEn(meetingRange.start)}. If they do not specify a day, assume they mean ${startDay}.`
      : ` The person is being asked about availability from ${startDay} ${humanDateEn(meetingRange.start)} to ${endDay} ${humanDateEn(meetingRange.end)}. If they do not specify a day, assume they mean ${startDay} (the first day of the range).`;
  }
  const userPrompt = `Today is ${today}.${rangeContext} Parse this availability message:\n"${message}"`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT,
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== "object") {
      return { windows: [], unclear: true };
    }

    const windows: AvailabilityWindow[] = (parsed.windows ?? []).filter(
      (w: unknown) =>
        typeof w === "object" &&
        w !== null &&
        "day" in w && "startTime" in w && "endTime" in w
    );

    return { windows, unclear: !!parsed.unclear };
  } catch {
    return { windows: [], unclear: true };
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

const DAY_HEBREW: Record<string, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
};

export function formatWindowsHebrew(windows: AvailabilityWindow[]): string {
  if (windows.length === 0) return "לא נמצאו זמנים פנויים";
  return windows
    .map(w => `יום ${DAY_HEBREW[w.day] ?? w.day} ${w.startTime}–${w.endTime}`)
    .join("\n");
}

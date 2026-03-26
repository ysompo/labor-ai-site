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
- If the message is completely unclear (e.g. just "ok" or "sure"), set "unclear": true and return empty windows
- Do NOT include days the person explicitly says they are NOT available
- Hebrew day names: ראשון=sunday, שני=monday, שלישי=tuesday, רביעי=wednesday, חמישי=thursday, שישי=friday, שבת=saturday`;

// ── Parser ────────────────────────────────────────────────────────────────────

export async function parseAvailability(
  message: string,
  today: string // YYYY-MM-DD, used as context (day of week)
): Promise<{ windows: AvailabilityWindow[]; unclear: boolean }> {
  const userPrompt = `Today is ${today}. Parse this availability message:\n"${message}"`;

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

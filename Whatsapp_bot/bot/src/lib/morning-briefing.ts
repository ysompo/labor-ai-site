/**
 * Morning briefing: sends the bot owner a daily agenda at 08:00 (Sun–Thu, Israel time).
 * Called from a 1-minute setInterval in index.ts.
 */

import { getTodayEvents } from "./google-calendar";
import { sendDM } from "../whatsapp";

// Track the last date we already sent the briefing (in YYYY-MM-DD Israel time)
let lastBriefingDate = "";

/** Returns the current date/hour in Israel timezone as { date, hour, dayOfWeek } */
function israelNow(): { date: string; hour: number; dayOfWeek: number } {
  const nowIL = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" });
  // sv-SE format: "YYYY-MM-DD HH:MM:SS"
  const date = nowIL.slice(0, 10);
  const hour = parseInt(nowIL.slice(11, 13), 10);
  // Day of week in Israel timezone
  const dayOfWeek = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  ).getDay(); // 0=Sun, 6=Sat
  return { date, hour, dayOfWeek };
}

/**
 * Called every minute from index.ts.
 * Fires the briefing DM at 08:00 Sun–Thu, once per day.
 */
export async function checkAndSendMorningBriefing(): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE?.split(",")[0]?.trim();
  if (!ownerPhone) return;

  const { date, hour, dayOfWeek } = israelNow();

  // Only Sun(0)–Thu(4), only at 08:xx, only once per day
  if (dayOfWeek >= 5) return; // Fri or Sat
  if (hour !== 8) return;
  if (lastBriefingDate === date) return;

  // Mark as sent before the async work so a slow calendar API doesn't double-fire
  lastBriefingDate = date;

  try {
    const events = await getTodayEvents();
    const msg = formatBriefingMessage(events, date);
    await sendDM(ownerPhone, msg);
    console.log(`[labi] Morning briefing sent for ${date}`);
  } catch (err) {
    console.error("[labi] Morning briefing error:", err instanceof Error ? err.message : err);
    // Reset so it retries next minute if it failed
    lastBriefingDate = "";
  }
}

function formatBriefingMessage(events: Awaited<ReturnType<typeof getTodayEvents>>, date: string): string {
  const dayName = hebrewDayName(date);
  const header = `☀️ בוקר טוב! ${dayName}`;

  if (events.length === 0) {
    return `${header}\n\nאין פגישות היום. יום פנוי!`;
  }

  const lines = events.map((e, i) => {
    if (e.isAllDay) return `${i + 1}. ${e.title} — כל היום`;
    return `${i + 1}. ${e.title} — ${e.startTime}–${e.endTime}`;
  });

  return `${header}\n\nהפגישות שלך היום:\n${lines.join("\n")}`;
}

const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function hebrewDayName(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00+03:00`);
  return `יום ${DAYS_HE[d.getDay()]}`;
}

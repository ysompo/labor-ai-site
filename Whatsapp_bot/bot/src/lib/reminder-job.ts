/**
 * reminder-job.ts
 *
 * Runs every 30 minutes to:
 * 1. Find all open scheduling polls where some participants haven't responded yet
 * 2. If it's been > 4 hours since the last reminder (or since creation), send a nudge
 * 3. If all participants have responded but the owner hasn't picked yet, remind owner
 */

import { kv } from "@vercel/kv";
import { sendDM } from "../whatsapp";
import {
  type SchedulingPoll,
  pendingParticipants,
  updatePoll,
} from "./scheduling-poll";

const REMINDER_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const REMINDER_CUTOFF_HOUR = 20; // don't send reminders after 20:00 Israel time

function isWithinReminderHours(): boolean {
  const hour = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    hour12: false,
  });
  return Number(hour) < REMINDER_CUTOFF_HOUR;
}

export async function runAvailabilityReminders(): Promise<void> {
  if (!isWithinReminderHours()) {
    console.log("[labi] reminder-job: outside reminder hours (after 20:00 IL), skipping");
    return;
  }
  console.log("[labi] reminder-job: scanning for open polls...");

  // Scan all poll keys (Vercel KV scan)
  let cursor = 0;
  const pollKeys: string[] = [];

  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: "poll:*", count: 100 });
    cursor = Number(nextCursor);
    pollKeys.push(...keys);
  } while (cursor !== 0);

  if (pollKeys.length === 0) {
    console.log("[labi] reminder-job: no open polls found");
    return;
  }

  const now = Date.now();

  for (const key of pollKeys) {
    try {
      const poll = await kv.get<SchedulingPoll>(key);
      if (!poll) continue;

      if (poll.status === "collecting") {
        await handleCollectingReminder(poll, now);
      } else if (poll.status === "proposing") {
        await handleProposingReminder(poll, now);
      }
    } catch (err) {
      console.error(`[labi] reminder-job: error for ${key}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function handleCollectingReminder(poll: SchedulingPoll, now: number): Promise<void> {
  const lastReminderMs = poll.reminderSentAt
    ? new Date(poll.reminderSentAt).getTime()
    : new Date(poll.createdAt).getTime();

  if (now - lastReminderMs < REMINDER_INTERVAL_MS) return;

  const pending = pendingParticipants(poll);
  if (pending.length === 0) return;

  // Send nudge to each non-responding participant
  for (const phone of pending) {
    try {
      await sendDM(
        phone,
        `תזכורת: לאבי מחכה לזמינות שלך לפגישה *${poll.topic}* 📅\n\nציין ימים ושעות שנוחים לך השבוע.`
      );
    } catch (err) {
      console.error(`[labi] reminder-job: failed to nudge ${phone}: ${err}`);
    }
  }

  poll.reminderSentAt = new Date().toISOString();
  await updatePoll(poll);
  console.log(`[labi] reminder-job: sent nudge to ${pending.length} participants for poll ${poll.id}`);
}

async function handleProposingReminder(poll: SchedulingPoll, now: number): Promise<void> {
  const lastReminderMs = poll.reminderSentAt
    ? new Date(poll.reminderSentAt).getTime()
    : new Date(poll.updatedAt).getTime();

  if (now - lastReminderMs < REMINDER_INTERVAL_MS) return;

  const organizer = poll.requestedBy;
  if (!organizer) return;

  const count = poll.candidates?.length ?? 0;
  if (count === 0) return;

  try {
    await sendDM(
      organizer,
      `תזכורת: ממתין לבחירתך לפגישה *${poll.topic}* — יש ${count} זמנים זמינים. ענה במספר כדי לקבוע.`
    );
    poll.reminderSentAt = new Date().toISOString();
    await updatePoll(poll);
  } catch (err) {
    console.error(`[labi] reminder-job: failed to remind organizer: ${err}`);
  }
}

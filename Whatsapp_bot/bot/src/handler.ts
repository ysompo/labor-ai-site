/**
 * Message handler — routes incoming Baileys messages to the correct feature.
 *
 * Features handled:
 *   1. schedule_meeting  — parse + Zoom + Google Calendar + WhatsApp invites
 *   2. find_time         — smart scheduling: DM availability collection + intersection
 *   3. poll_vote / pick  — record availability reply or owner picks a slot
 *   4. audio             — Whisper transcription (+ auto-availability parsing in DM context)
 *   5. block_add/remove/list — manage personal unavailability blocks
 *   6. reminder          — create Google Task reminder
 *   7. help              — show command list
 *
 * Group messages: only processed when the message mentions "labi" or "לאבי"
 * (case-insensitive), is a direct reply to Labi's own message, or is a @mention.
 *
 * DM messages: if sender has an active DmConversationState, the message is
 * treated as an availability reply or owner slot-pick, bypassing intent detection.
 */

import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import OpenAI from "openai";
import { Readable } from "stream";
import { sendText } from "./whatsapp";
import {
  detectIntent,
  parsePollVote,
  parseSchedulingCommand,
  parseReminderCommand,
  parseBlockCommand,
} from "./lib/claude-parser";
import { parseAvailability } from "./lib/availability-parser";
import {
  findCandidateSlots,
  formatCandidatesHebrew,
  type CandidateSlot,
} from "./lib/availability-intersect";
import {
  createPoll,
  getPoll,
  updatePoll,
  deletePoll,
  recordAvailability,
  setDmState,
  getDmState,
  clearDmState,
  allResponded,
  pendingParticipants,
  formatCandidatesMessage,
  type CandidateOption,
} from "./lib/scheduling-poll";
import {
  getOwnerBlocks,
  addOwnerBlock,
  removeOwnerBlock,
  getParticipantBlocks,
  addParticipantBlock,
  removeParticipantBlock,
  formatBlocks,
} from "./lib/scheduler-blocks";
import { createZoomMeeting } from "./lib/zoom";
import {
  createCalendarEvent,
  createGoogleTask,
  getOwnerBusyRanges,
} from "./lib/google-calendar";
import {
  getContactsForChat,
  resolveNamesToPhones,
  upsertContact,
  setPreferredName,
} from "./lib/contacts";
import { getBotName, setBotName } from "./lib/bot-config";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the plain text from a WAMessage (conversation or extended text). */
function extractText(msg: WAMessage): string | null {
  return (
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    null
  );
}

/** Strip @s.whatsapp.net / @g.us suffix and :device suffix. */
function jidToPhone(jid: string): string {
  return jid.replace(/@.+$/, "").replace(/:\d+$/, "");
}

/** Format a local date+time string to ISO 8601 for calendar. */
function toLocalIso(date: string, time: string): string {
  return `${date}T${time.padStart(5, "0")}:00+03:00`;
}

/** Format as friendly human-readable string in Hebrew. */
const HEBREW_DAYS: Record<number, string> = {
  0: "ראשון", 1: "שני", 2: "שלישי", 3: "רביעי",
  4: "חמישי", 5: "שישי", 6: "שבת",
};
const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function friendlyDateHebrew(date: string, time: string): string {
  const d = new Date(`${date}T12:00:00+03:00`);
  return `${HEBREW_DAYS[d.getDay()]} ${d.getDate()} ${HEBREW_MONTHS[d.getMonth()]} בשעה ${time}`;
}

function friendlyDateTime(date: string, time: string): string {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const d = new Date(`${date}T12:00:00+03:00`);
  return `${dayNames[d.getDay()]} ${date} at ${time}`;
}

// ── Date-range helpers ────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  return Math.ceil(
    (new Date(`${end}T12:00:00+03:00`).getTime() - new Date(`${start}T12:00:00+03:00`).getTime())
    / (1000 * 60 * 60 * 24)
  ) + 1;
}

// ── Pending slot-pick (for week-range scheduling) ─────────────────────────────

interface PendingSlotPick {
  slots: { date: string; startTime: string; endTime: string }[];
  topic: string;
  meetingType: "zoom" | "inperson";
  location: string | null;
  participantPhones: string[];
  originalText: string;
  groupJid: string | null; // group to notify after pick; null if triggered from DM
}

import { kv } from "@vercel/kv";

async function setPendingSlots(jid: string, data: PendingSlotPick): Promise<void> {
  await kv.set(`pending-schedule:${jid}`, data, { ex: 60 * 60 }); // 1h TTL
}

async function getPendingSlots(jid: string): Promise<PendingSlotPick | null> {
  return kv.get<PendingSlotPick>(`pending-schedule:${jid}`);
}

async function clearPendingSlots(jid: string): Promise<void> {
  await kv.del(`pending-schedule:${jid}`);
}

/** Reject a promise after ms milliseconds. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/** Returns true if the text contains Hebrew characters. */
function isHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/** Pick a response string based on the language of the original message. */
function t(text: string, he: string, en: string): string {
  return isHebrew(text) ? he : en;
}

function todayJerusalem(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildCalendarLink(
  date: string,
  time: string,
  topic: string,
  description?: string,
  location?: string
): string {
  const dateStr = date.replace(/-/g, "");
  const [h, m] = time.split(":").map(Number);
  const endH = h + 1 < 24 ? h + 1 : 23;
  const startStr = `${dateStr}T${String(h).padStart(2,"0")}${String(m).padStart(2,"0")}00`;
  const endStr   = `${dateStr}T${String(endH).padStart(2,"0")}${String(m).padStart(2,"0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: topic,
    dates: `${startStr}/${endStr}`,
    ctz: "Asia/Jerusalem",
  });
  if (description) params.set("details", description);
  if (location)    params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const ownerPhone = () => process.env.OWNER_PHONE ?? "";

// ── Main handler ─────────────────────────────────────────────────────────────

export async function handleMessage(
  sock: WASocket,
  msg: WAMessage
): Promise<void> {
  if (msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  const isGroup = remoteJid.endsWith("@g.us");
  const senderJid = isGroup ? (msg.key.participant ?? remoteJid) : remoteJid;
  const senderPhone = jidToPhone(senderJid);
  const pushName = msg.pushName ?? senderPhone;

  try { await upsertContact(senderPhone, pushName, remoteJid); } catch { /* non-fatal */ }

  // ── Audio messages ────────────────────────────────────────────────────────
  if (msg.message?.audioMessage) {
    // In DM context, check if participant has an active conversation state
    if (!isGroup) {
      const dmState = await getDmState(senderPhone);
      if (dmState?.stage === "awaiting_availability" || dmState?.stage === "clarifying") {
        await handleDmAudioAvailability(sock, msg, senderPhone, dmState);
        return;
      }
    }
    await handleAudio(sock, msg, remoteJid, senderPhone);
    return;
  }

  const text = extractText(msg);
  console.log(`[labi] msg from ${senderPhone} | group=${isGroup} | text=${text?.slice(0, 80) ?? "(no text)"}`);
  if (!text) return;

  // ── DM conversation routing (bypasses intent detection) ───────────────────
  if (!isGroup) {
    const dmState = await getDmState(senderPhone);
    if (dmState) {
      if (dmState.stage === "awaiting_availability" || dmState.stage === "clarifying") {
        await handleDmAvailabilityReply(text, senderPhone, dmState);
        return;
      }
    }

    // Organizer picking a slot from candidates
    const slotPickState = await getDmState(`slot-pick:${senderPhone}`);
    if (slotPickState && /^[\d\s]+$/.test(text.trim())) {
      await handleOrganizerPickSlot(text, senderPhone, slotPickState);
      return;
    }

    // Pending range slot pick (numeric reply to "here are 4 options" sent to DM)
    const senderDmJid = `${senderPhone}@s.whatsapp.net`;
    const pendingSlots = await getPendingSlots(senderDmJid);
    if (pendingSlots && /^[\d\s]+$/.test(text.trim())) {
      await handlePendingSlotPick(text, senderDmJid, senderPhone, pendingSlots);
      return;
    }
  }

  // ── Group gating ──────────────────────────────────────────────────────────
  if (isGroup) {
    const botPhone = jidToPhone(sock.user?.id ?? "");
    const botName = await getBotName();
    const botNameEscaped = botName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isMentioned = new RegExp(`labi|לאבי|${botNameEscaped}`, "i").test(text);
    const isMentionedViaAt = /^@\d+/.test(text.trim());
    const mentionedJids: string[] =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const isMentionedByNumber = mentionedJids.some(j => jidToPhone(j) === botPhone);
    const isReplyToBot =
      msg.message?.extendedTextMessage?.contextInfo?.participant
        ? jidToPhone(msg.message.extendedTextMessage.contextInfo.participant) === botPhone
        : false;

    if (!isMentioned && !isMentionedViaAt && !isMentionedByNumber && !isReplyToBot) return;
  }

  const intent = detectIntent(text);
  console.log(`[labi] intent=${intent}`);

  const botPhone = jidToPhone(sock.user?.id ?? "");
  const mentionedParticipantPhones: string[] = (
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []
  )
    .map((jid) => jidToPhone(jid))
    .filter((phone) => phone !== botPhone);

  switch (intent) {
    case "schedule_meeting":
      await handleScheduleMeeting(text, remoteJid, senderPhone, isGroup, mentionedParticipantPhones);
      break;

    case "find_time":
      if (isGroup) {
        await handleSmartFindTime(text, remoteJid, senderPhone, sock);
      } else {
        await sendText(remoteJid, "ניתן להתחיל תזמון חכם רק מתוך קבוצה.");
      }
      break;

    case "poll_vote":
      // In a group with open proposing poll — handled separately via owner DM
      // In group "collecting" phase — this is a stray number, ignore
      break;

    case "close_poll":
      if (isGroup) await handleCancelPoll(remoteJid, senderPhone);
      break;

    case "block_add":
      await handleBlockAdd(text, remoteJid, senderPhone);
      break;

    case "block_remove":
      await handleBlockRemove(text, remoteJid, senderPhone);
      break;

    case "block_list":
      await handleBlockList(remoteJid, senderPhone);
      break;

    case "reminder":
      await handleReminder(text, remoteJid, senderPhone);
      break;

    case "rename":
      await handleRename(text, remoteJid, senderPhone);
      break;

    case "rename_bot":
      await handleRenameBot(text, remoteJid, senderPhone);
      break;

    case "help":
      await handleHelp(remoteJid, senderPhone);
      break;

    case "transcribe":
      await sendText(remoteJid, "שלח הודעת קולית ואתמלל אותה.");
      break;

    default:
      break;
  }
}

// ── Feature 1: Schedule a meeting ────────────────────────────────────────────

async function handleScheduleMeeting(
  text: string,
  replyJid: string,
  senderPhone: string,
  isGroup: boolean,
  mentionedPhones: string[] = []
): Promise<void> {
  try {
    const today = todayJerusalem();
    await sendText(replyJid, t(text, "מנתח את הבקשה...", "Parsing your request..."));

    const parsed = await parseSchedulingCommand(text, today);

    if (!parsed.date && parsed.dateRangeStart && parsed.dateRangeEnd) {
      // Range request — find 4 free slots and offer them
      await handleRangeSchedule(text, replyJid, senderPhone, isGroup, parsed, mentionedPhones);
      return;
    }

    if (!parsed.date) {
      await sendText(replyJid, t(text,
        "לא הצלחתי לזהות תאריך. ציין יום ספציפי, למשל: \"קבע פגישה ביום שני הקרוב\".",
        "I couldn't determine the date. Please specify a day, e.g. \"schedule a meeting for next Monday\"."
      ));
      return;
    }

    if (!parsed.time) {
      await sendText(replyJid, t(text,
        "לא הצלחתי לזהות שעה. ציין שעה, למשל: \"בשעה 14:00\".",
        "I couldn't determine the time. Please add a time, e.g. \"at 14:00\"."
      ));
      return;
    }

    const endIso = new Date(new Date(toLocalIso(parsed.date, parsed.time)).getTime() + 60 * 60 * 1000).toISOString().replace("Z", "+00:00");
    const startLocal = `${parsed.date}T${parsed.time.padStart(5, "0")}:00`;
    const topic = parsed.topic ?? "פגישה";

    // Resolve participants
    let participantPhones: string[] = [];
    if (mentionedPhones.length > 0) {
      participantPhones = mentionedPhones.filter((p) => p !== senderPhone);
    } else if (parsed.participants === "everyone" && isGroup) {
      const contacts = await getContactsForChat(replyJid);
      participantPhones = contacts.map((c) => c.phone).filter((p) => p !== senderPhone);
    } else if (Array.isArray(parsed.participants)) {
      const resolved = await resolveNamesToPhones(parsed.participants);
      participantPhones = resolved.filter((r) => r.phone !== null).map((r) => r.phone as string);
      const unresolved = resolved.filter((r) => r.phone === null).map((r) => r.name);
      if (unresolved.length > 0) {
        await sendText(replyJid, t(text,
          `לא מצאתי פרטי קשר עבור: ${unresolved.join(", ")}. טיפ: השתמש ב-@ כדי להזכיר אותם ישירות.`,
          `Could not find contacts for: ${unresolved.join(", ")}. Tip: use @ to mention them directly.`
        ));
      }
    }

    // Create Zoom meeting (optional — skip if not configured or times out)
    let joinUrl: string | null = null;
    let meetingPassword: string | null = null;
    if (parsed.meetingType === "zoom") {
      try {
        const zoomMeeting = await withTimeout(createZoomMeeting({
          topic,
          startTime: startLocal,
          durationMinutes: 60,
          timezone: "Asia/Jerusalem",
        }), 8000);
        joinUrl = zoomMeeting.join_url;
        meetingPassword = zoomMeeting.password;
      } catch (e) {
        console.error("[labi] Zoom API failed (non-fatal):", e instanceof Error ? e.message : e);
        await sendText(replyJid, t(text,
          "⚠️ לא הצלחתי ליצור פגישת זום. הפגישה נקבעת ללא קישור זום.",
          "⚠️ Could not create Zoom meeting. Scheduling without Zoom link."
        ));
      }
    }

    // Google Calendar (optional — skip if not configured or times out)
    let calendarAdded = false;
    try {
      await withTimeout(createCalendarEvent({
        summary: topic,
        location: parsed.meetingType === "zoom" ? (joinUrl ?? undefined) : (parsed.location ?? undefined),
        description: parsed.meetingType === "zoom" && joinUrl ? `Zoom join link: ${joinUrl}` : undefined,
        startIso: toLocalIso(parsed.date, parsed.time),
        endIso: endIso,
      }), 8000);
      calendarAdded = true;
    } catch (e) {
      console.error("[labi] Google Calendar failed (non-fatal):", e instanceof Error ? e.message : e);
    }

    const friendlyTime = friendlyDateHebrew(parsed.date, parsed.time);
    const calLink = buildCalendarLink(parsed.date, parsed.time, topic,
      parsed.meetingType === "zoom" && joinUrl ? `Zoom: ${joinUrl}` : undefined,
      parsed.meetingType === "zoom" ? (joinUrl ?? undefined) : (parsed.location ?? undefined)
    );

    // Notify participants
    if (participantPhones.length > 0) {
      const participantMsg =
        parsed.meetingType === "zoom" && joinUrl
          ? t(text,
              `הוזמנת לפגישת זום "${topic}" ב${friendlyTime}.\nכניסה: ${joinUrl}${meetingPassword ? `\nסיסמה: ${meetingPassword}` : ""}\n\n📅 הוסף ליומן:\n${calLink}`,
              `You've been invited to a Zoom meeting "${topic}" on ${friendlyDateTime(parsed.date, parsed.time)}.\nJoin: ${joinUrl}${meetingPassword ? `\nPassword: ${meetingPassword}` : ""}\n\n📅 Add to calendar:\n${calLink}`
            )
          : t(text,
              `הוזמנת לפגישה "${topic}" ב${friendlyTime}.${parsed.location ? `\nמיקום: ${parsed.location}` : ""}\n\n📅 הוסף ליומן:\n${calLink}`,
              `You've been invited to a meeting "${topic}" on ${friendlyDateTime(parsed.date, parsed.time)}.${parsed.location ? `\nLocation: ${parsed.location}` : ""}\n\n📅 Add to calendar:\n${calLink}`
            );

      await Promise.allSettled(
        participantPhones.map((phone) => sendText(`${phone}@s.whatsapp.net`, participantMsg))
      );
    }

    // Confirm
    const calFooter = calendarAdded
      ? t(text, `\n\n📅 הוסף ליומן:\n${calLink}`, `\n\n📅 Add to calendar:\n${calLink}`)
      : "";
    const participantFooter = participantPhones.length > 0
      ? t(text, `\n\nהוזמנו ${participantPhones.length} משתתפים.`, `\n\n${participantPhones.length} participant(s) notified.`)
      : "";

    const confirmMsg =
      parsed.meetingType === "zoom" && joinUrl
        ? t(text,
            `✅ פגישה נקבעה!\n\nנושא: ${topic}\nמתי: ${friendlyTime}\nקישור זום: ${joinUrl}${meetingPassword ? `\nסיסמה: ${meetingPassword}` : ""}${calFooter}${participantFooter}`,
            `✅ Meeting scheduled!\n\nTopic: ${topic}\nWhen: ${friendlyDateTime(parsed.date, parsed.time)}\nZoom: ${joinUrl}${meetingPassword ? `\nPassword: ${meetingPassword}` : ""}${calFooter}${participantFooter}`
          )
        : t(text,
            `✅ פגישה נקבעה!\n\nנושא: ${topic}\nמתי: ${friendlyTime}${parsed.location ? `\nמיקום: ${parsed.location}` : ""}${calFooter}${participantFooter}`,
            `✅ Meeting scheduled!\n\nTopic: ${topic}\nWhen: ${friendlyDateTime(parsed.date, parsed.time)}${parsed.location ? `\nLocation: ${parsed.location}` : ""}${calFooter}${participantFooter}`
          );

    await sendText(replyJid, confirmMsg);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[labi] handleScheduleMeeting error: ${errMsg}`);
    await sendText(replyJid, t(text,
      `מצטער, לא הצלחתי לקבוע את הפגישה: ${errMsg}`,
      `Sorry, I couldn't schedule the meeting: ${errMsg}`
    ));
  }
}

// ── Range scheduling: find 4 slots and offer them ────────────────────────────

async function handleRangeSchedule(
  text: string,
  replyJid: string,
  senderPhone: string,
  isGroup: boolean,
  parsed: Awaited<ReturnType<typeof parseSchedulingCommand>>,
  mentionedPhones: string[]
): Promise<void> {
  try {
    const start = parsed.dateRangeStart!;
    const end   = parsed.dateRangeEnd!;
    await sendText(replyJid, t(text, "מחפש זמנים פנויים...", "Looking for free slots..."));

    const ownerBusy = await withTimeout(getOwnerBusyRanges(60), 8000).catch(() => []);
    const ownerBlocks = await getOwnerBlocks();
    const daysAhead = daysBetween(start, end);

    const rawSlots = findCandidateSlots({
      startDate: start,
      daysAhead,
      participantPhones: [],
      participantWindows: new Map(),
      participantBlocks: new Map(),
      ownerBusy,
      ownerBlocks,
    });

    if (rawSlots.length === 0) {
      await sendText(replyJid, t(text,
        `לא נמצאו זמנים פנויים בין ${start} ל-${end}.`,
        `No free slots found between ${start} and ${end}.`
      ));
      return;
    }

    const slots = rawSlots.slice(0, 4);
    const topic = parsed.topic ?? (isHebrew(text) ? "פגישה" : "Meeting");

    // Resolve participants
    let participantPhones: string[] = [];
    if (mentionedPhones.length > 0) {
      participantPhones = mentionedPhones.filter(p => p !== senderPhone);
    } else if (parsed.participants === "everyone" && isGroup) {
      const contacts = await getContactsForChat(replyJid);
      participantPhones = contacts.map(c => c.phone).filter(p => p !== senderPhone);
    } else if (Array.isArray(parsed.participants)) {
      const resolved = await resolveNamesToPhones(parsed.participants);
      participantPhones = resolved.filter(r => r.phone !== null).map(r => r.phone as string);
    }

    // DM the initiator with options — never post in group
    const dmJid = `${senderPhone}@s.whatsapp.net`;
    const lines = slots.map((s, i) => `${i + 1}. ${friendlyDateHebrew(s.date, s.startTime)}`);

    const optionsMsg = isHebrew(text)
      ? `📅 *${topic}* — בחר זמן:\n\n${lines.join("\n")}\n\nענה במספר (1–${slots.length})`
      : `📅 *${topic}* — pick a time:\n\n${lines.join("\n")}\n\nReply with a number (1–${slots.length})`;

    await sendText(dmJid, optionsMsg);

    // If triggered from a group, post brief ack there
    if (isGroup) {
      await sendText(replyJid, t(text,
        "שלחתי לך אפשרויות זמן בפרטי 📩",
        "Sent you time options in a private message 📩"
      ));
    }

    // Save pending pick keyed to sender's DM JID
    await setPendingSlots(dmJid, {
      slots: slots.map(s => ({ date: s.date, startTime: s.startTime, endTime: s.endTime })),
      topic,
      meetingType: parsed.meetingType,
      location: parsed.location,
      participantPhones,
      originalText: text,
      groupJid: isGroup ? replyJid : null,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await sendText(`${senderPhone}@s.whatsapp.net`, t(text,
      `שגיאה בחיפוש זמנים: ${errMsg}`,
      `Error finding slots: ${errMsg}`
    ));
  }
}

async function handlePendingSlotPick(
  text: string,
  dmJid: string,       // sender's DM JID (where the pick came in)
  senderPhone: string,
  pending: PendingSlotPick
): Promise<void> {
  const n = parseInt(text.trim(), 10);
  if (isNaN(n) || n < 1 || n > pending.slots.length) {
    await sendText(dmJid, t(pending.originalText,
      `בחר מספר בין 1 ל-${pending.slots.length}.`,
      `Please reply with a number between 1 and ${pending.slots.length}.`
    ));
    return;
  }

  const slot = pending.slots[n - 1];
  await clearPendingSlots(dmJid);

  // Notify DM first so user knows something is happening
  await sendText(dmJid, t(pending.originalText, "קובע פגישה...", "Scheduling..."));

  // Schedule — send confirmation to group if originated there, otherwise back to DM
  const confirmJid = pending.groupJid ?? dmJid;
  await handleScheduleMeeting(
    `schedule a ${pending.meetingType === "zoom" ? "zoom" : "meeting"} "${pending.topic}" on ${slot.date} at ${slot.startTime}`,
    confirmJid,
    senderPhone,
    pending.groupJid !== null,
    pending.participantPhones
  );
}

// ── Feature 2: Smart scheduling (DM availability collection) ─────────────────

async function handleSmartFindTime(
  text: string,
  groupJid: string,
  senderPhone: string,
  sock: WASocket
): Promise<void> {
  try {
    // Extract topic
    const topicMatch = text.match(/(?:for|about|לגבי|בנושא)\s+(.+?)(?:\s*$)/i);
    const topic = topicMatch?.[1]?.trim() ?? "פגישה";

    // Collect group members (excluding bot and the organizer themselves)
    const botPhone = jidToPhone(sock.user?.id ?? "");
    const contacts = await getContactsForChat(groupJid);
    const participants = contacts
      .map((c) => c.phone)
      .filter((p) => p !== botPhone && p !== senderPhone);

    if (participants.length === 0) {
      await sendText(groupJid, "לא מצאתי משתתפים בקבוצה. ודא שאנשי הקשר שלחו הודעה לפחות פעם אחת.");
      return;
    }

    // Create poll
    const poll = await createPoll({ groupId: groupJid, topic, requestedBy: senderPhone, participants });

    // Notify group
    await sendText(groupJid, `📅 *${topic}*\n\nשולח בקשות זמינות ל-${participants.length} משתתפים בפרטי... אעדכן ברגע שכולם יענו.`);

    // DM each participant
    const today = todayJerusalem();
    const nextWeek = addDays(today, 7);
    const dmMsg = `היי! לאבי כאן 🤖\n\n*${topic}* — מתי אתה פנוי השבוע?\n\nציין ימים ושעות בעברית או אנגלית, למשל:\n"ראשון אחה"צ, שלישי 14-18, חמישי כל היום"\n\n(תאריכים: ${today} עד ${nextWeek})`;

    for (const phone of participants) {
      try {
        await sendText(`${phone}@s.whatsapp.net`, dmMsg);
        await setDmState(phone, {
          pollId: poll.id,
          groupId: groupJid,
          stage: "awaiting_availability",
          topic,
          clarifyAttempts: 0,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error(`[labi] failed to DM ${phone}: ${e}`);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await sendText(groupJid, `מצטער, לא הצלחתי להתחיל בתזמון: ${errMsg}`);
  }
}

// ── Feature 2b: Handle DM availability reply ──────────────────────────────────

async function handleDmAvailabilityReply(
  text: string,
  senderPhone: string,
  dmState: { pollId: string; groupId: string; stage: string; topic: string; clarifyAttempts: number }
): Promise<void> {
  const dmJid = `${senderPhone}@s.whatsapp.net`;
  const today = todayJerusalem();

  try {
    const { windows, unclear } = await parseAvailability(text, today);

    if (unclear || windows.length === 0) {
      const attempts = dmState.clarifyAttempts + 1;
      if (attempts >= 2) {
        // Give up — treat as fully unavailable
        await sendText(dmJid, "בסדר, אסמן אותך כלא זמין לפגישה זו.");
        await recordAvailability(dmState.groupId, senderPhone, []);
        await clearDmState(senderPhone);
        await checkAndFinalizeScheduling(dmState.groupId);
        return;
      }
      // Ask to clarify
      await sendText(dmJid, `לא הצלחתי להבין את הזמינות שלך 😅\nאנא ציין ימים ושעות ספציפיות, למשל:\n"שני 10-15, רביעי אחרי 14:00"`);
      await setDmState(senderPhone, { ...dmState, stage: "clarifying", clarifyAttempts: attempts, updatedAt: new Date().toISOString() });
      return;
    }

    // Got valid availability
    const poll = await recordAvailability(dmState.groupId, senderPhone, windows);
    await clearDmState(senderPhone);

    const windowSummary = windows.map(w => `${w.day} ${w.startTime}–${w.endTime}`).join(", ");
    await sendText(dmJid, `תודה! 🙏 רשמתי: ${windowSummary}\nאעדכן ברגע שיימצא זמן מתאים.`);

    if (poll) await checkAndFinalizeScheduling(dmState.groupId);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[labi] handleDmAvailabilityReply error: ${errMsg}`);
    await sendText(dmJid, "מצטער, אירעה שגיאה בעיבוד הבקשה. אנא נסה שוב.");
  }
}

// ── Handle DM availability from voice message ─────────────────────────────────

async function handleDmAudioAvailability(
  sock: WASocket,
  msg: WAMessage,
  senderPhone: string,
  dmState: { pollId: string; groupId: string; stage: string; topic: string; clarifyAttempts: number }
): Promise<void> {
  const dmJid = `${senderPhone}@s.whatsapp.net`;
  try {
    const transcript = await transcribeAudio(sock, msg);
    if (!transcript) {
      await sendText(dmJid, "לא הצלחתי לתמלל את ההודעה הקולית. נסה לכתוב את הזמינות שלך.");
      return;
    }
    await sendText(dmJid, `*תמלול:* ${transcript}`);
    await handleDmAvailabilityReply(transcript, senderPhone, dmState);
  } catch (err) {
    await sendText(dmJid, "שגיאה בתמלול. נסה לכתוב את הזמינות שלך.");
  }
}

// ── Check if all responded, then compute and send options to owner ────────────

async function checkAndFinalizeScheduling(groupId: string): Promise<void> {
  const poll = await getPoll(groupId);
  if (!poll || poll.status !== "collecting") return;

  const pending = pendingParticipants(poll);
  if (pending.length > 0 && !allResponded(poll)) {
    // Notify group of progress if someone just responded
    // (optional — could be noisy, so keep it quiet)
    return;
  }

  // All responded (or forced) — run intersection
  const today = todayJerusalem();
  const ownerBlocks = await getOwnerBlocks();
  const ownerBusy = await getOwnerBusyRanges(14);

  const participantWindowsMap = new Map(
    Object.entries(poll.availability)
  );
  const participantBlocksMap = new Map<string, Awaited<ReturnType<typeof getOwnerBlocks>>>();
  for (const phone of poll.participants) {
    const blocks = await getParticipantBlocks(phone);
    participantBlocksMap.set(phone, blocks);
  }

  const rawSlots = findCandidateSlots({
    startDate: today,
    daysAhead: 14,
    participantPhones: poll.participants,
    participantWindows: participantWindowsMap,
    participantBlocks: participantBlocksMap,
    ownerBusy,
    ownerBlocks,
  });

  if (rawSlots.length === 0) {
    // Notify group: no overlap found
    await sendText(groupId, `⚠️ לא נמצא זמן משותף לפגישה "${poll.topic}". המארגן יצור קשר לתיאום ידני.`);
    await updatePoll({ ...poll, status: "cancelled" });

    // Notify organizer
    const organizer = poll.requestedBy;
    if (organizer) {
      await sendText(`${organizer}@s.whatsapp.net`,
        `⚠️ לא נמצא זמן משותף לפגישה "${poll.topic}".\nמשתתפים שלא ענו: ${pendingParticipants(poll).join(", ") || "—"}`
      );
    }
    return;
  }

  // Convert to CandidateOption[]
  const candidates: CandidateOption[] = rawSlots.map((s, i) => ({
    index: i + 1,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    availableCount: s.availableCount,
    totalCount: s.totalCount,
    missingPhones: s.missingPhones,
  }));

  // Store candidates in poll and move to "proposing"
  poll.candidates = candidates;
  poll.status = "proposing";
  await updatePoll(poll);

  // Send options to organizer in DM
  const organizer = poll.requestedBy;
  if (organizer) {
    const pickMsg = formatCandidatesMessage(candidates, poll.topic);
    await sendText(`${organizer}@s.whatsapp.net`, pickMsg);

    // Store slot-pick state (keyed to organizer's phone)
    await setDmState(`slot-pick:${organizer}`, {
      pollId: poll.id,
      groupId,
      stage: "done",
      topic: poll.topic,
      clarifyAttempts: 0,
      updatedAt: new Date().toISOString(),
    });
  }
}

// ── Organizer picks a slot ────────────────────────────────────────────────────

async function handleOrganizerPickSlot(
  text: string,
  senderPhone: string,
  ownerPollState: { pollId: string; groupId: string; topic: string }
): Promise<void> {
  const dmJid = `${senderPhone}@s.whatsapp.net`;
  try {
    const indices = text.trim().split(/[\s,]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0);
    if (indices.length === 0) return;

    const chosen = indices[0];
    const poll = await getPoll(ownerPollState.groupId);
    if (!poll || poll.status !== "proposing" || !poll.candidates) {
      await sendText(dmJid, "אין הצבעה פתוחה כרגע.");
      return;
    }

    const candidate = poll.candidates.find(c => c.index === chosen);
    if (!candidate) {
      await sendText(dmJid, `מספר ${chosen} לא תקין. בחר מספר בין 1 ל-${poll.candidates.length}.`);
      return;
    }

    // Schedule the meeting
    await sendText(dmJid, `מזמין פגישה ל${friendlyDateHebrew(candidate.date, candidate.startTime)}...`);

    const zoomMeeting = await createZoomMeeting({
      topic: poll.topic,
      startTime: `${candidate.date}T${candidate.startTime}:00`,
      durationMinutes: 60,
      timezone: "Asia/Jerusalem",
    });

    const calLink = buildCalendarLink(candidate.date, candidate.startTime, poll.topic,
      `Zoom: ${zoomMeeting.join_url}`, zoomMeeting.join_url);

    await createCalendarEvent({
      summary: poll.topic,
      location: zoomMeeting.join_url,
      description: `Zoom: ${zoomMeeting.join_url}`,
      startIso: toLocalIso(candidate.date, candidate.startTime),
      endIso: toLocalIso(candidate.date, candidate.endTime),
    });

    // Notify all participants
    const friendlyTime = friendlyDateHebrew(candidate.date, candidate.startTime);
    const participantMsg = `✅ נקבעה פגישה: *${poll.topic}*\n📅 ${friendlyTime}\nזום: ${zoomMeeting.join_url}${zoomMeeting.password ? `\nסיסמה: ${zoomMeeting.password}` : ""}\n\n📅 הוסף ליומן:\n${calLink}`;

    for (const phone of poll.participants) {
      try { await sendText(`${phone}@s.whatsapp.net`, participantMsg); } catch { /* ignore */ }
    }

    // Notify group
    await sendText(ownerPollState.groupId, `✅ *${poll.topic}* נקבע!\n${friendlyTime}\nזום: ${zoomMeeting.join_url}`);

    // Confirm to owner
    await sendText(dmJid, `✅ הפגישה נקבעה והוזמנו ${poll.participants.length} משתתפים.`);

    // Clean up
    poll.status = "scheduled";
    poll.selectedCandidate = candidate;
    await updatePoll(poll);
    await clearDmState(`slot-pick:${senderPhone}`);

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[labi] handleOwnerPickSlot error: ${errMsg}`);
    await sendText(dmJid, `שגיאה בקביעת הפגישה: ${errMsg}`);
  }
}

// ── Cancel/abort poll ─────────────────────────────────────────────────────────

async function handleCancelPoll(groupJid: string, senderPhone: string): Promise<void> {
  const poll = await getPoll(groupJid);
  if (!poll) {
    await sendText(groupJid, "אין הצבעה פתוחה בקבוצה זו.");
    return;
  }
  const isOwner = senderPhone === ownerPhone();
  const isOrganizer = senderPhone === poll.requestedBy;
  if (!isOwner && !isOrganizer) {
    await sendText(groupJid, "רק מי שפתח את ההצבעה או מנהל הבוט יכולים לבטל אותה.");
    return;
  }
  // Clear all DM states
  for (const phone of poll.participants) {
    await clearDmState(phone).catch(() => {});
  }
  await clearDmState(`slot-pick:${poll.requestedBy}`).catch(() => {});
  await deletePoll(groupJid);
  await sendText(groupJid, "ההצבעה בוטלה.");
}

// ── Block management ──────────────────────────────────────────────────────────

async function handleBlockAdd(text: string, replyJid: string, senderPhone: string): Promise<void> {
  try {
    const today = todayJerusalem();
    const parsed = await parseBlockCommand(text, today);
    if (!parsed) {
      await sendText(replyJid, "לא הצלחתי לנתח את החסימה. נסה שוב, למשל: \"חסום כל יום חמישי 08:30-13:30\"");
      return;
    }

    if (senderPhone === ownerPhone()) {
      const block = await addOwnerBlock(parsed);
      const desc = parsed.type === "recurring"
        ? `כל יום ${parsed.day} ${parsed.startTime}–${parsed.endTime}`
        : `${parsed.date} ${parsed.startTime}–${parsed.endTime}`;
      await sendText(replyJid, `✅ חסימה נוספה: ${desc} [id: ${block.id}]`);
    } else {
      const block = await addParticipantBlock(senderPhone, parsed);
      const desc = parsed.type === "recurring"
        ? `כל יום ${parsed.day} ${parsed.startTime}–${parsed.endTime}`
        : `${parsed.date} ${parsed.startTime}–${parsed.endTime}`;
      await sendText(replyJid, `✅ חסימה נוספה לך: ${desc} [id: ${block.id}]`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await sendText(replyJid, `שגיאה בהוספת חסימה: ${errMsg}`);
  }
}

async function handleBlockRemove(text: string, replyJid: string, senderPhone: string): Promise<void> {
  // Extract id or label from message
  const idMatch = text.match(/\b([a-f0-9]{8})\b/i) ?? text.match(/(?:block|חסימה)\s+(.+?)(?:\s*$)/i);
  const idOrLabel = idMatch?.[1]?.trim();

  if (!idOrLabel) {
    await sendText(replyJid, "ציין את ה-id של החסימה. השתמש ב'הצג חסימות' כדי לראות את הרשימה.");
    return;
  }

  try {
    let removed: boolean;
    if (senderPhone === ownerPhone()) {
      removed = await removeOwnerBlock(idOrLabel);
    } else {
      removed = await removeParticipantBlock(senderPhone, idOrLabel);
    }
    await sendText(replyJid, removed ? `✅ החסימה הוסרה.` : `לא מצאתי חסימה עם המזהה "${idOrLabel}".`);
  } catch (err) {
    await sendText(replyJid, `שגיאה בהסרת חסימה: ${err instanceof Error ? err.message : err}`);
  }
}

async function handleBlockList(replyJid: string, senderPhone: string): Promise<void> {
  try {
    const blocks = senderPhone === ownerPhone()
      ? await getOwnerBlocks()
      : await getParticipantBlocks(senderPhone);
    await sendText(replyJid, `*חסימות לוח הזמנים שלך:*\n\n${formatBlocks(blocks)}`);
  } catch (err) {
    await sendText(replyJid, `שגיאה בטעינת חסימות: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Reminders ─────────────────────────────────────────────────────────────────

async function handleReminder(text: string, replyJid: string, senderPhone: string): Promise<void> {
  const owner = ownerPhone();
  if (owner && senderPhone !== owner) {
    await sendText(replyJid, "תזכורות זמינות רק למנהל הבוט.");
    return;
  }
  try {
    const today = todayJerusalem();
    const parsed = await parseReminderCommand(text, today);
    await createGoogleTask({ title: parsed.title, dueDate: parsed.dueDate ?? undefined });
    const duePart = parsed.dueDate ? ` ל-${parsed.dueDate}` : "";
    await sendText(replyJid, `✓ תזכורת נוצרה${duePart}: *${parsed.title}*`);
  } catch (err) {
    await sendText(replyJid, `שגיאה ביצירת תזכורת: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Rename ────────────────────────────────────────────────────────────────────

async function handleRename(text: string, replyJid: string, senderPhone: string): Promise<void> {
  // Extract the name after "call me", "my name is", "קרא לי", etc.
  const match =
    text.match(/(?:call\s+me|my\s+name\s+is)\s+(.+)/i) ??
    text.match(/(?:קרא\s+לי|תקרא\s+לי|השם\s+שלי\s+(?:הוא\s+)?)\s*(.+)/);

  const newName = match?.[1]?.trim().replace(/[*_~`]/g, ""); // strip markdown chars

  if (!newName || newName.length < 2 || newName.length > 40) {
    await sendText(replyJid, "לא הצלחתי להבין את השם. נסה: \"קרא לי ד\"ר כהן\"");
    return;
  }

  try {
    await setPreferredName(senderPhone, newName);
    await sendText(replyJid, `✅ בסדר, אקרא לך *${newName}* מעכשיו.`);
  } catch (err) {
    await sendText(replyJid, `שגיאה בשמירת השם: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Rename bot ────────────────────────────────────────────────────────────────

async function handleRenameBot(text: string, replyJid: string, senderPhone: string): Promise<void> {
  if (senderPhone !== ownerPhone()) {
    await sendText(replyJid, "רק מנהל הבוט יכול לשנות את שמו.");
    return;
  }

  const match =
    text.match(/(?:rename|call)\s+yourself\s+(.+)/i) ??
    text.match(/your\s+name\s+is\s+(.+)/i) ??
    text.match(/(?:תקרא\s+לעצמך|שנה\s+את\s+שמך\s+ל(?:ـ)?|תשנה\s+את\s+שמך\s+ל(?:ـ)?)\s*(.+)/);

  const newName = match?.[1]?.trim().replace(/[*_~`]/g, "");

  if (!newName || newName.length < 2 || newName.length > 30) {
    await sendText(replyJid, "לא הצלחתי להבין את השם. נסה: \"תקרא לעצמך יוסי\"");
    return;
  }

  const oldName = await getBotName();
  await setBotName(newName);
  await sendText(replyJid, `✅ שמי שונה מ-*${oldName}* ל-*${newName}*. מעכשיו פנה אליי בשמי החדש בקבוצות.`);
}

// ── Help ──────────────────────────────────────────────────────────────────────

async function handleHelp(replyJid: string, _senderPhone: string): Promise<void> {
  const botName = await getBotName();
  const msg = `*${botName} — פקודות זמינות* 🤖

*תזמון פגישה:*
• "תזמן זום עם @יוסי ביום חמישי בשעה 14:00"
• "schedule a zoom with everyone on Monday at 10:00"

*תזמון חכם (בקבוצה):*
• "מצא זמן לפגישה בנושא X" — שולח בקשות לכל המשתתפים

*חסימות לוח זמנים:*
• "חסום כל יום חמישי 08:30-13:30"
• "הסר חסימה [id]"
• "הצג חסימות"

*תזכורות (מנהל בלבד):*
• "תזכיר לי להתקשר לד"ר כהן מחר"

*תמלול:*
• שלח הודעה קולית — אתמלל אוטומטית

*שם מוצג (שלך):*
• "קרא לי ד\"ר לוי" / "call me Dr. Levy"

*שם הבוט (מנהל בלבד):*
• "תקרא לעצמך יוסי" / "rename yourself Yossi"

*עזרה:* "עזרה" / "help"`;

  await sendText(replyJid, msg);
}

// ── Feature 4: Voice transcription ───────────────────────────────────────────

async function transcribeAudio(sock: WASocket, msg: WAMessage): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { downloadContentFromMessage } = await import("@whiskeysockets/baileys");
  const stream = await downloadContentFromMessage(msg.message!.audioMessage!, "audio");

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const audioBuffer = Buffer.concat(chunks);

  const openai = new OpenAI({ apiKey });
  const transcription = await openai.audio.transcriptions.create({
    file: await OpenAI.toFile(audioBuffer, "voice.ogg", { type: "audio/ogg" }),
    model: "whisper-1",
  });

  return transcription.text;
}

async function handleAudio(
  sock: WASocket,
  msg: WAMessage,
  replyJid: string,
  senderPhone: string
): Promise<void> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await sendText(replyJid, "תמלול לא מוגדר (חסר OPENAI_API_KEY).");
      return;
    }

    await sendText(replyJid, "מתמלל הודעה קולית...");

    const text = await transcribeAudio(sock, msg);
    if (!text) { await sendText(replyJid, "לא הצלחתי לתמלל."); return; }

    // Generate summary via Claude
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    let summary = "";
    if (anthropicKey) {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const claude = new Anthropic({ apiKey: anthropicKey });
      const res = await claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        system: "Summarize the following voice message transcript in one short sentence. Reply in the same language (Hebrew or English). No explanation, just the summary.",
        messages: [{ role: "user", content: text }],
      });
      summary = res.content.filter(c => c.type === "text").map(c => (c as {type:"text";text:string}).text).join("").trim();
    }

    const summaryLine = summary ? `*${summary}*\n\n` : "";
    await sendText(replyJid, `${summaryLine}${text}`);

    // Auto-handle reminder intent in transcript
    if (detectIntent(text) === "reminder") {
      await handleReminder(text, replyJid, senderPhone);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await sendText(replyJid, `שגיאה בתמלול: ${errMsg}`);
  }
}

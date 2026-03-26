/**
 * Message handler — routes incoming Baileys messages to the correct feature.
 *
 * Features handled:
 *   1. schedule_meeting  — parse + Zoom + Google Calendar + WhatsApp invites
 *   2. find_time         — mini Doodle poll (group only)
 *   3. poll_vote         — record vote in open poll
 *   4. close_poll        — owner closes poll, schedules winning slot
 *   5. audio             — Whisper transcription
 *   unknown              — silently ignored
 *
 * Group messages: only processed when the message mentions "labi" or "לאבי"
 * (case-insensitive) OR is a direct reply to Labi's own message.
 */

import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import OpenAI from "openai";
import { Readable } from "stream";
import { sendText } from "./whatsapp";
import { detectIntent, parsePollVote, parseSchedulingCommand } from "./lib/claude-parser";
import { createZoomMeeting } from "./lib/zoom";
import {
  createCalendarEvent,
  findFreeSlots,
} from "./lib/google-calendar";
import {
  closePoll,
  createPoll,
  formatPollMessage,
  formatVoteTally,
  getPoll,
  recordVote,
} from "./lib/poll-manager";
import {
  getContactsForChat,
  resolveNamesToPhones,
  upsertContact,
} from "./lib/contacts";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the plain text from a WAMessage (conversation or extended text). */
function extractText(msg: WAMessage): string | null {
  return (
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    null
  );
}

/** Strip @s.whatsapp.net / @g.us suffix and :device suffix to get the raw phone/id. */
function jidToPhone(jid: string): string {
  return jid.replace(/@.+$/, "").replace(/:\d+$/, "");
}

/** Format a local date+time string to ISO 8601 UTC. */
function toUtcIso(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM, timezone: Asia/Jerusalem (UTC+3)
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`);
  return d.toISOString();
}

/** Format an ISO date string as a friendly human-readable string. */
function friendlyDateTime(date: string, time: string): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const d = new Date(`${date}T${time}:00+03:00`);
  return `${dayNames[d.getDay()]} ${date} at ${time}`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function handleMessage(
  sock: WASocket,
  msg: WAMessage
): Promise<void> {
  // Ignore our own outgoing messages
  if (msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid) return;

  const isGroup = remoteJid.endsWith("@g.us");

  // In a group, participant is the sender; in DM it's the remoteJid itself
  const senderJid = isGroup
    ? (msg.key.participant ?? remoteJid)
    : remoteJid;

  const senderPhone = jidToPhone(senderJid);
  const pushName = msg.pushName ?? senderPhone;

  // Persist contact
  try {
    await upsertContact(senderPhone, pushName, remoteJid);
  } catch {
    // Non-fatal
  }

  // ── Handle audio messages (transcription) ────────────────────────────────
  if (msg.message?.audioMessage) {
    await handleAudio(sock, msg, remoteJid, senderPhone);
    return;
  }

  const text = extractText(msg);
  console.log(`[labi] msg from ${senderPhone} | group=${isGroup} | text=${text?.slice(0, 80) ?? "(no text)"}`);
  if (!text) return; // Ignore non-text, non-audio messages

  // ── Group gating: only respond when addressed ─────────────────────────────
  if (isGroup) {
    const botPhone = jidToPhone(sock.user?.id ?? "");
    const isMentioned = /labi|לאבי/i.test(text);

    // Detect any @mention at the start of the message (user tagged someone)
    const isMentionedViaAt = /^@\d+/.test(text.trim());

    // Check mentionedJid list in extended message context
    const mentionedJids: string[] =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const isMentionedByNumber = mentionedJids.length > 0;

    const isReplyToBot =
      msg.message?.extendedTextMessage?.contextInfo?.participant
        ? jidToPhone(msg.message.extendedTextMessage.contextInfo.participant) ===
          botPhone
        : false;

    console.log(`[labi] group gate: mentioned=${isMentioned} mentionedViaAt=${isMentionedViaAt} mentionedByNumber=${isMentionedByNumber} replyToBot=${isReplyToBot} botPhone=${botPhone}`);
    if (!isMentioned && !isMentionedViaAt && !isMentionedByNumber && !isReplyToBot) return;
  }

  const intent = detectIntent(text);
  console.log(`[labi] intent=${intent}`);

  // Extract @mentioned participants from the message (excluding Labi itself)
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
        await handleFindTime(text, remoteJid);
      } else {
        await sendText(remoteJid, "Poll-based scheduling is only available in group chats.");
      }
      break;

    case "poll_vote":
      if (isGroup) {
        await handlePollVote(text, remoteJid, senderPhone);
      }
      break;

    case "close_poll":
      if (isGroup) {
        await handleClosePoll(remoteJid, senderPhone);
      }
      break;

    case "transcribe":
      await sendText(
        remoteJid,
        "Please send a voice message and I'll transcribe it for you."
      );
      break;

    default:
      // Silently ignore unknown intents
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
  console.log(`[labi] handleScheduleMeeting called replyJid=${replyJid}`);
  try {
    const today = new Date().toISOString().slice(0, 10);
    await sendText(replyJid, "Parsing your request...");

    const parsed = await parseSchedulingCommand(text, today);

    if (!parsed.date || !parsed.time) {
      await sendText(
        replyJid,
        "I couldn't determine the date or time. Please include a specific date and time, e.g. \"schedule a zoom on Thursday at 14:00\"."
      );
      return;
    }

    const startIso = toUtcIso(parsed.date, parsed.time);
    const endDate = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    // Local time string for Zoom (no Z suffix — Zoom uses timezone param to interpret it)
    const startLocal = `${parsed.date}T${parsed.time.padStart(5, "0")}:00`;
    const topic = parsed.topic ?? "Meeting";

    // Resolve participants to phone numbers
    // Priority: @mentioned contacts in message > "everyone" > name resolution
    let participantPhones: string[] = [];
    if (mentionedPhones.length > 0) {
      // Use @mentioned participants directly — most reliable
      participantPhones = mentionedPhones.filter((p) => p !== senderPhone);
    } else if (parsed.participants === "everyone" && isGroup) {
      const contacts = await getContactsForChat(replyJid);
      participantPhones = contacts
        .map((c) => c.phone)
        .filter((p) => p !== senderPhone);
    } else if (Array.isArray(parsed.participants)) {
      const resolved = await resolveNamesToPhones(parsed.participants);
      participantPhones = resolved
        .filter((r) => r.phone !== null)
        .map((r) => r.phone as string);

      const unresolved = resolved
        .filter((r) => r.phone === null)
        .map((r) => r.name);
      if (unresolved.length > 0) {
        await sendText(
          replyJid,
          `Note: I couldn't find contact info for: ${unresolved.join(", ")}. Tip: use @ to mention them directly next time.`
        );
      }
    }

    // Create Zoom meeting (only for zoom type)
    let joinUrl: string | null = null;
    let meetingPassword: string | null = null;
    if (parsed.meetingType === "zoom") {
      const zoomMeeting = await createZoomMeeting({
        topic,
        startTime: startLocal,
        durationMinutes: 60,
        timezone: "Asia/Jerusalem",
      });
      joinUrl = zoomMeeting.join_url;
      meetingPassword = zoomMeeting.password;
    }

    // Create Google Calendar event
    const calDescription =
      parsed.meetingType === "zoom" && joinUrl
        ? `Zoom join link: ${joinUrl}`
        : undefined;

    await createCalendarEvent({
      summary: topic,
      location:
        parsed.meetingType === "zoom"
          ? (joinUrl ?? undefined)
          : (parsed.location ?? undefined),
      description: calDescription,
      startIso: `${parsed.date}T${parsed.time}:00+03:00`,
      endIso: endDate.replace("Z", "+00:00"),
    });

    // Notify participants via WhatsApp
    const friendlyTime = friendlyDateTime(parsed.date, parsed.time);
    if (participantPhones.length > 0) {
      const participantMsg =
        parsed.meetingType === "zoom" && joinUrl
          ? `You've been invited to a Zoom meeting "${topic}" on ${friendlyTime}.\nJoin here: ${joinUrl}${meetingPassword ? `\nPassword: ${meetingPassword}` : ""}`
          : `You've been invited to a meeting "${topic}" on ${friendlyTime}.${parsed.location ? `\nLocation: ${parsed.location}` : ""}`;

      await Promise.allSettled(
        participantPhones.map((phone) =>
          sendText(`${phone}@s.whatsapp.net`, participantMsg)
        )
      );
    }

    // Confirm to the original chat
    const confirmMsg =
      parsed.meetingType === "zoom" && joinUrl
        ? `Meeting scheduled!\n\nTopic: ${topic}\nWhen: ${friendlyTime}\nZoom link: ${joinUrl}${meetingPassword ? `\nPassword: ${meetingPassword}` : ""}${participantPhones.length > 0 ? `\n\nInvites sent to ${participantPhones.length} participant(s).` : ""}`
        : `Meeting scheduled!\n\nTopic: ${topic}\nWhen: ${friendlyTime}${parsed.location ? `\nLocation: ${parsed.location}` : ""}${participantPhones.length > 0 ? `\n\nInvites sent to ${participantPhones.length} participant(s).` : ""}`;

    await sendText(replyJid, confirmMsg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[labi] handleScheduleMeeting error: ${msg}`);
    await sendText(
      replyJid,
      `Sorry, I couldn't schedule the meeting: ${msg}`
    );
  }
}

// ── Feature 2a: Trigger a Doodle poll ────────────────────────────────────────

async function handleFindTime(text: string, groupJid: string): Promise<void> {
  try {
    // Extract optional topic from the message
    const topicMatch = text.match(/(?:for|about|regarding)\s+(.+?)(?:\s+this|\s+next|$)/i);
    const topic = topicMatch?.[1] ?? null;

    await sendText(groupJid, "Checking the calendar for available slots...");

    const slots = await findFreeSlots(7, 60, 9, 18);

    if (slots.length === 0) {
      await sendText(
        groupJid,
        "I couldn't find any free slots in the next 7 days. The calendar appears to be fully booked."
      );
      return;
    }

    const poll = await createPoll(groupJid, slots, topic ?? undefined);
    const pollMsg = formatPollMessage(poll);
    await sendText(groupJid, pollMsg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendText(groupJid, `Sorry, I couldn't start the poll: ${msg}`);
  }
}

// ── Feature 2b: Record a poll vote ───────────────────────────────────────────

async function handlePollVote(
  text: string,
  groupJid: string,
  senderPhone: string
): Promise<void> {
  try {
    const existingPoll = await getPoll(groupJid);
    if (!existingPoll || existingPoll.status !== "open") return; // No open poll — ignore digit messages

    const indices = parsePollVote(text);
    if (indices.length === 0) return;

    const updatedPoll = await recordVote(groupJid, senderPhone, indices);
    if (!updatedPoll) return;

    const tally = formatVoteTally(updatedPoll);
    await sendText(groupJid, `Vote recorded!\n\n${tally}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendText(groupJid, `Sorry, I couldn't record the vote: ${msg}`);
  }
}

// ── Feature 2c: Close poll and schedule ──────────────────────────────────────

async function handleClosePoll(
  groupJid: string,
  senderPhone: string
): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE ?? "";

  if (senderPhone !== ownerPhone) {
    await sendText(
      groupJid,
      "Only the bot owner can close the poll and schedule the meeting."
    );
    return;
  }

  try {
    const result = await closePoll(groupJid, ownerPhone);

    if (!result) {
      await sendText(groupJid, "There is no open poll in this group.");
      return;
    }

    const { winningOption } = result;
    const topic = result.poll.topic ?? "Meeting";

    await sendText(
      groupJid,
      `Poll closed! The winning time slot is: ${friendlyDateTime(winningOption.date, winningOption.time)}\n\nScheduling the meeting...`
    );

    // Schedule the meeting with the winning slot
    await handleScheduleMeeting(
      `schedule a zoom for ${topic} on ${winningOption.date} at ${winningOption.time}`,
      groupJid,
      ownerPhone,
      true
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendText(groupJid, `Sorry, I couldn't close the poll: ${msg}`);
  }
}

// ── Feature 4: Voice transcription ───────────────────────────────────────────

async function handleAudio(
  sock: WASocket,
  msg: WAMessage,
  replyJid: string,
  _senderPhone: string
): Promise<void> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await sendText(replyJid, "Voice transcription is not configured (missing OPENAI_API_KEY).");
      return;
    }

    await sendText(replyJid, "Transcribing voice message...");

    // Download the audio stream from Baileys
    const { downloadContentFromMessage } = await import("@whiskeysockets/baileys");
    const stream = await downloadContentFromMessage(
      msg.message!.audioMessage!,
      "audio"
    );

    // Collect stream into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    // Convert buffer to a File-like object for OpenAI SDK
    const readable = Readable.from(audioBuffer);
    (readable as unknown as Record<string, unknown>).name = "voice.ogg";

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: await OpenAI.toFile(audioBuffer, "voice.ogg", { type: "audio/ogg" }),
      model: "whisper-1",
      // No language specified — auto-detect Hebrew/English
    });

    await sendText(replyJid, `Transcription:\n\n${transcription.text}`);
  } catch (err) {
    const msg2 = err instanceof Error ? err.message : String(err);
    await sendText(replyJid, `Sorry, I couldn't transcribe the voice message: ${msg2}`);
  }
}

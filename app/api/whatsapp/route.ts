/**
 * WhatsApp Cloud API webhook
 *
 * GET  — Meta webhook verification (one-time setup)
 * POST — Incoming messages router
 *
 * IMPORTANT: always returns HTTP 200 immediately.
 * All processing happens asynchronously after the response is sent.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendText, downloadMedia, type WhatsAppWebhookPayload, type IncomingMessage } from "@/lib/whatsapp";
import { detectIntent, parsePollVote, parseSchedulingCommand } from "@/lib/claude-parser";
import { createZoomMeeting } from "@/lib/zoom";
import { createCalendarEvent, findFreeSlots } from "@/lib/google-calendar";
import { upsertContact, getContactsForChat, resolveNamesToPhones } from "@/lib/contacts";
import { createPoll, getPoll, recordVote, closePoll, formatPollMessage, formatVoteTally } from "@/lib/poll-manager";
import OpenAI from "openai";

// ── GET — Webhook verification ───────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[whatsapp] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST — Incoming messages ─────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: WhatsAppWebhookPayload;
  try {
    body = (await req.json()) as WhatsAppWebhookPayload;
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // 2. Return 200 immediately — Meta requires a fast response
  // Fire-and-forget the async processing
  processWebhook(body).catch((err) => {
    console.error("[whatsapp] processWebhook error:", err);
  });

  return new NextResponse("OK", { status: 200 });
}

// ── Async processing ─────────────────────────────────────────────────────────

async function processWebhook(body: WhatsAppWebhookPayload): Promise<void> {
  if (body.object !== "whatsapp_business_account") return;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const { messages, contacts: metaContacts } = change.value;
      if (!messages?.length) continue;

      for (const message of messages) {
        const senderPhone = message.from;
        const displayName = metaContacts?.[0]?.profile?.name ?? senderPhone;

        // Derive chat ID — for group messages Meta puts the group WA ID in context
        const chatId = message.context?.group_id ?? senderPhone;
        const isGroup = !!message.context?.group_id;

        // Store sender in contacts
        await upsertContact(senderPhone, displayName, chatId).catch(() => null);

        try {
          await routeMessage(message, senderPhone, chatId, isGroup);
        } catch (err) {
          console.error("[whatsapp] routeMessage error:", err);
          await sendText(
            senderPhone,
            "Sorry, something went wrong processing your message. Please try again."
          ).catch(() => null); // Labi error handler
        }
      }
    }
  }
}

async function routeMessage(
  message: IncomingMessage,
  senderPhone: string,
  chatId: string,
  isGroup: boolean
): Promise<void> {
  // ── Audio: transcription ─────────────────────────────────────────────────
  if (message.type === "audio" && message.audio?.id) {
    await handleTranscription(message.audio.id, senderPhone);
    return;
  }

  // ── Text messages ────────────────────────────────────────────────────────
  if (message.type !== "text" || !message.text?.body) return;

  const text = message.text.body.trim();
  const intent = detectIntent(text);

  console.log(`[whatsapp] Intent: ${intent} | From: ${senderPhone} | Text: ${text.slice(0, 80)}`);

  switch (intent) {
    case "schedule_meeting":
      await handleScheduleMeeting(text, senderPhone, chatId, isGroup);
      break;

    case "find_time":
      if (isGroup) {
        await handleFindTime(text, chatId, senderPhone);
      } else {
        await sendText(senderPhone, "Hi, I'm Labi! The 'find a time' poll feature works in group chats only.");
      }
      break;

    case "poll_vote":
      if (isGroup) {
        await handlePollVote(text, senderPhone, chatId);
      }
      break;

    case "close_poll": {
      const ownerPhone = process.env.OWNER_PHONE;
      if (senderPhone !== ownerPhone) {
        await sendText(senderPhone, "Only the owner can close a poll.");
        return;
      }
      if (isGroup) {
        await handleClosePoll(chatId, senderPhone);
      }
      break;
    }

    case "unknown":
    default:
      // Silently ignore unknown messages
      break;
  }
}

// ── Feature 1: Schedule a meeting ───────────────────────────────────────────

async function handleScheduleMeeting(
  text: string,
  senderPhone: string,
  chatId: string,
  isGroup: boolean
): Promise<void> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

  await sendText(senderPhone, "Got it! Scheduling your meeting now...");

  const parsed = await parseSchedulingCommand(text, today);

  if (!parsed.date || !parsed.time) {
    await sendText(
      senderPhone,
      "I couldn't figure out the date or time. Please try again, e.g.: \"Schedule a zoom with Avi on Thursday at 14:00\""
    );
    return;
  }

  const topic = parsed.topic ?? "Meeting";
  const startIso = buildIso(parsed.date, parsed.time);
  const endIso = buildIso(parsed.date, parsed.time, 60);

  // Resolve participants to phone numbers
  let participantPhones: string[] = [];
  if (parsed.participants === "everyone" && isGroup) {
    const contacts = await getContactsForChat(chatId);
    participantPhones = contacts.map((c) => c.phone).filter((p) => p !== senderPhone);
  } else if (Array.isArray(parsed.participants) && parsed.participants.length > 0) {
    const resolved = await resolveNamesToPhones(parsed.participants);
    participantPhones = resolved.filter((r) => r.phone).map((r) => r.phone as string);
  }

  if (parsed.meetingType === "inperson") {
    // In-person meeting — no Zoom, use physical location
    const physicalLocation = parsed.location ?? "TBD";

    await createCalendarEvent({
      summary: topic,
      location: physicalLocation,
      startIso,
      endIso,
    }).catch((err) =>
      console.warn("[whatsapp] Google Calendar create failed (non-fatal):", err)
    );

    const inviteMsg =
      `You've been invited to an in-person meeting: *${topic}*\n` +
      `Date: ${parsed.date} at ${parsed.time}\n` +
      `Location: ${physicalLocation}`;

    await Promise.allSettled(
      participantPhones.map((phone) => sendText(phone, inviteMsg))
    );

    await sendText(
      senderPhone,
      `Meeting scheduled!\n\n*${topic}*\n${parsed.date} at ${parsed.time}\nLocation: ${physicalLocation}\n\nInvited ${participantPhones.length} participant(s).`
    );
  } else {
    // Zoom meeting
    const zoom = await createZoomMeeting({
      topic,
      startTime: startIso,
      durationMinutes: 60,
      timezone: "Asia/Jerusalem",
    });

    await createCalendarEvent({
      summary: topic,
      location: zoom.join_url,
      startIso,
      endIso,
    }).catch((err) =>
      console.warn("[whatsapp] Google Calendar create failed (non-fatal):", err)
    );

    const inviteMsg =
      `You've been invited to a Zoom meeting: *${topic}*\n` +
      `Date: ${parsed.date} at ${parsed.time}\n` +
      `Join: ${zoom.join_url}`;

    await Promise.allSettled(
      participantPhones.map((phone) => sendText(phone, inviteMsg))
    );

    await sendText(
      senderPhone,
      `Meeting scheduled!\n\n*${topic}*\n${parsed.date} at ${parsed.time}\n\nJoin URL: ${zoom.join_url}\n\nInvited ${participantPhones.length} participant(s).`
    );
  }
}

// ── Feature 2: Find a time (poll) ────────────────────────────────────────────

async function handleFindTime(
  text: string,
  groupId: string,
  senderPhone: string
): Promise<void> {
  const existingPoll = await getPoll(groupId);
  if (existingPoll?.status === "open") {
    await sendText(senderPhone, "There's already an open poll for this group.\n\n" + formatPollMessage(existingPoll));
    return;
  }

  await sendText(senderPhone, "Looking at available times...");

  const slots = await findFreeSlots(7, 60);
  if (slots.length === 0) {
    await sendText(senderPhone, "Couldn't find any free slots in the next 7 days.");
    return;
  }

  // Infer topic from the message if possible
  const topicMatch = text.match(/meeting\s+(?:about\s+|for\s+)?(.+)/i);
  const topic = topicMatch?.[1]?.trim() ?? "Team Meeting";

  const poll = await createPoll(groupId, slots.slice(0, 5), topic);
  await sendText(senderPhone, formatPollMessage(poll));
}

// ── Poll vote ────────────────────────────────────────────────────────────────

async function handlePollVote(
  text: string,
  senderPhone: string,
  groupId: string
): Promise<void> {
  const indices = parsePollVote(text);
  if (indices.length === 0) return;

  const updated = await recordVote(groupId, senderPhone, indices);
  if (!updated) return; // No open poll

  await sendText(
    senderPhone,
    `Your vote has been recorded (option${indices.length > 1 ? "s" : ""}: ${indices.join(", ")}). Thanks!`
  );
}

// ── Close poll + schedule ────────────────────────────────────────────────────

async function handleClosePoll(groupId: string, ownerPhone: string): Promise<void> {
  const result = await closePoll(groupId, ownerPhone);
  if (!result) {
    await sendText(ownerPhone, "No open poll found for this group.");
    return;
  }

  const { winningOption } = result;
  await sendText(ownerPhone, `Closing poll. Winning slot: ${winningOption.date} at ${winningOption.time}`);

  // Proceed with scheduling
  const topic = result.poll.topic ?? "Team Meeting";
  const startIso = buildIso(winningOption.date, winningOption.time);
  const endIso = buildIso(winningOption.date, winningOption.time, 60);

  const zoom = await createZoomMeeting({
    topic,
    startTime: startIso,
    durationMinutes: 60,
    timezone: "Asia/Jerusalem",
  });

  await createCalendarEvent({
    summary: topic,
    location: zoom.join_url,
    startIso,
    endIso,
  }).catch((err) =>
    console.warn("[whatsapp] Google Calendar create failed (non-fatal):", err)
  );

  // Notify all voters
  const voterPhones = Object.keys(result.poll.votes);
  const inviteMsg =
    `Meeting scheduled: *${topic}*\n` +
    `${winningOption.date} at ${winningOption.time}\n` +
    `Join Zoom: ${zoom.join_url}`;

  await Promise.allSettled(voterPhones.map((phone) => sendText(phone, inviteMsg)));

  await sendText(
    ownerPhone,
    `Done! Meeting scheduled for ${winningOption.date} at ${winningOption.time}.\nZoom: ${zoom.join_url}\nNotified ${voterPhones.length} participant(s).`
  );
}

// ── Feature 4: Voice transcription ───────────────────────────────────────────

async function handleTranscription(mediaId: string, replyTo: string): Promise<void> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    await sendText(replyTo, "Labi: Voice transcription is not configured (OPENAI_API_KEY missing).");
    return;
  }

  await sendText(replyTo, "Labi is transcribing your voice message...");

  const audioBuffer = await downloadMedia(mediaId);

  const openai = new OpenAI({ apiKey: openaiKey });

  // Build a File-like object that OpenAI SDK accepts
  // Convert Node.js Buffer → ArrayBuffer to satisfy the File constructor's BlobPart type
  const arrayBuf = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength
  ) as ArrayBuffer;
  const file = new File([arrayBuf], "voice.ogg", { type: "audio/ogg; codecs=opus" });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    // language omitted → auto-detect (handles Hebrew + English)
  });

  await sendText(replyTo, `Transcript:\n${transcription.text}`);
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Build an ISO 8601 datetime string in Asia/Jerusalem timezone.
 * @param date   YYYY-MM-DD
 * @param time   HH:MM
 * @param offsetMinutes  minutes to add (for end time)
 */
function buildIso(date: string, time: string, offsetMinutes = 0): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  d.setMinutes(d.getMinutes() + offsetMinutes);
  // Return ISO with +03:00 offset (IST — Israel Standard Time)
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${mins}:00+03:00`;
}

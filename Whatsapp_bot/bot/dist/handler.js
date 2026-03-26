"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessage = handleMessage;
const openai_1 = __importDefault(require("openai"));
const stream_1 = require("stream");
const whatsapp_js_1 = require("./whatsapp.js");
const claude_parser_js_1 = require("./lib/claude-parser.js");
const zoom_js_1 = require("./lib/zoom.js");
const google_calendar_js_1 = require("./lib/google-calendar.js");
const poll_manager_js_1 = require("./lib/poll-manager.js");
const contacts_js_1 = require("./lib/contacts.js");
// ── Helpers ──────────────────────────────────────────────────────────────────
/** Extract the plain text from a WAMessage (conversation or extended text). */
function extractText(msg) {
    return (msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        null);
}
/** Strip @s.whatsapp.net or @g.us suffix to get the raw phone/id. */
function jidToPhone(jid) {
    return jid.replace(/@.+$/, "");
}
/** Format a local date+time string to ISO 8601 UTC. */
function toUtcIso(date, time) {
    // date: YYYY-MM-DD, time: HH:MM, timezone: Asia/Jerusalem (UTC+3)
    const [h, m] = time.split(":").map(Number);
    const d = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`);
    return d.toISOString();
}
/** Format an ISO date string as a friendly human-readable string. */
function friendlyDateTime(date, time) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const d = new Date(`${date}T${time}:00+03:00`);
    return `${dayNames[d.getDay()]} ${date} at ${time}`;
}
// ── Main handler ─────────────────────────────────────────────────────────────
async function handleMessage(sock, msg) {
    // Ignore our own outgoing messages
    if (msg.key.fromMe)
        return;
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid)
        return;
    const isGroup = remoteJid.endsWith("@g.us");
    // In a group, participant is the sender; in DM it's the remoteJid itself
    const senderJid = isGroup
        ? (msg.key.participant ?? remoteJid)
        : remoteJid;
    const senderPhone = jidToPhone(senderJid);
    const pushName = msg.pushName ?? senderPhone;
    // Persist contact
    try {
        await (0, contacts_js_1.upsertContact)(senderPhone, pushName, remoteJid);
    }
    catch {
        // Non-fatal
    }
    // ── Handle audio messages (transcription) ────────────────────────────────
    if (msg.message?.audioMessage) {
        await handleAudio(sock, msg, remoteJid, senderPhone);
        return;
    }
    const text = extractText(msg);
    if (!text)
        return; // Ignore non-text, non-audio messages
    // ── Group gating: only respond when addressed ─────────────────────────────
    if (isGroup) {
        const isMentioned = /labi|לאבי/i.test(text);
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant
            ? jidToPhone(msg.message.extendedTextMessage.contextInfo.participant) ===
                jidToPhone(sock.user?.id ?? "")
            : false;
        if (!isMentioned && !isReplyToBot)
            return;
    }
    const intent = (0, claude_parser_js_1.detectIntent)(text);
    switch (intent) {
        case "schedule_meeting":
            await handleScheduleMeeting(text, remoteJid, senderPhone, isGroup);
            break;
        case "find_time":
            if (isGroup) {
                await handleFindTime(text, remoteJid);
            }
            else {
                await (0, whatsapp_js_1.sendText)(remoteJid, "Poll-based scheduling is only available in group chats.");
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
            await (0, whatsapp_js_1.sendText)(remoteJid, "Please send a voice message and I'll transcribe it for you.");
            break;
        default:
            // Silently ignore unknown intents
            break;
    }
}
// ── Feature 1: Schedule a meeting ────────────────────────────────────────────
async function handleScheduleMeeting(text, replyJid, senderPhone, isGroup) {
    try {
        const today = new Date().toISOString().slice(0, 10);
        await (0, whatsapp_js_1.sendText)(replyJid, "Parsing your request...");
        const parsed = await (0, claude_parser_js_1.parseSchedulingCommand)(text, today);
        if (!parsed.date || !parsed.time) {
            await (0, whatsapp_js_1.sendText)(replyJid, "I couldn't determine the date or time. Please include a specific date and time, e.g. \"schedule a zoom on Thursday at 14:00\".");
            return;
        }
        const startIso = toUtcIso(parsed.date, parsed.time);
        const endDate = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
        const topic = parsed.topic ?? "Meeting";
        // Resolve participants to phone numbers
        let participantPhones = [];
        if (parsed.participants === "everyone" && isGroup) {
            const contacts = await (0, contacts_js_1.getContactsForChat)(replyJid);
            participantPhones = contacts
                .map((c) => c.phone)
                .filter((p) => p !== senderPhone);
        }
        else if (Array.isArray(parsed.participants)) {
            const resolved = await (0, contacts_js_1.resolveNamesToPhones)(parsed.participants);
            participantPhones = resolved
                .filter((r) => r.phone !== null)
                .map((r) => r.phone);
            const unresolved = resolved
                .filter((r) => r.phone === null)
                .map((r) => r.name);
            if (unresolved.length > 0) {
                await (0, whatsapp_js_1.sendText)(replyJid, `Note: I couldn't find contact info for: ${unresolved.join(", ")}. Proceeding without them.`);
            }
        }
        // Create Zoom meeting (only for zoom type)
        let joinUrl = null;
        let meetingPassword = null;
        if (parsed.meetingType === "zoom") {
            const zoomMeeting = await (0, zoom_js_1.createZoomMeeting)({
                topic,
                startTime: startIso,
                durationMinutes: 60,
                timezone: "Asia/Jerusalem",
            });
            joinUrl = zoomMeeting.join_url;
            meetingPassword = zoomMeeting.password;
        }
        // Create Google Calendar event
        const calDescription = parsed.meetingType === "zoom" && joinUrl
            ? `Zoom join link: ${joinUrl}`
            : undefined;
        await (0, google_calendar_js_1.createCalendarEvent)({
            summary: topic,
            location: parsed.meetingType === "zoom"
                ? (joinUrl ?? undefined)
                : (parsed.location ?? undefined),
            description: calDescription,
            startIso: `${parsed.date}T${parsed.time}:00+03:00`,
            endIso: endDate.replace("Z", "+00:00"),
        });
        // Notify participants via WhatsApp
        const friendlyTime = friendlyDateTime(parsed.date, parsed.time);
        if (participantPhones.length > 0) {
            const participantMsg = parsed.meetingType === "zoom" && joinUrl
                ? `You've been invited to a Zoom meeting "${topic}" on ${friendlyTime}.\nJoin here: ${joinUrl}${meetingPassword ? `\nPassword: ${meetingPassword}` : ""}`
                : `You've been invited to a meeting "${topic}" on ${friendlyTime}.${parsed.location ? `\nLocation: ${parsed.location}` : ""}`;
            await Promise.allSettled(participantPhones.map((phone) => (0, whatsapp_js_1.sendText)(`${phone}@s.whatsapp.net`, participantMsg)));
        }
        // Confirm to the original chat
        const confirmMsg = parsed.meetingType === "zoom" && joinUrl
            ? `Meeting scheduled!\n\nTopic: ${topic}\nWhen: ${friendlyTime}\nZoom link: ${joinUrl}${meetingPassword ? `\nPassword: ${meetingPassword}` : ""}${participantPhones.length > 0 ? `\n\nInvites sent to ${participantPhones.length} participant(s).` : ""}`
            : `Meeting scheduled!\n\nTopic: ${topic}\nWhen: ${friendlyTime}${parsed.location ? `\nLocation: ${parsed.location}` : ""}${participantPhones.length > 0 ? `\n\nInvites sent to ${participantPhones.length} participant(s).` : ""}`;
        await (0, whatsapp_js_1.sendText)(replyJid, confirmMsg);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await (0, whatsapp_js_1.sendText)(replyJid, `Sorry, I couldn't schedule the meeting: ${msg}`);
    }
}
// ── Feature 2a: Trigger a Doodle poll ────────────────────────────────────────
async function handleFindTime(text, groupJid) {
    try {
        // Extract optional topic from the message
        const topicMatch = text.match(/(?:for|about|regarding)\s+(.+?)(?:\s+this|\s+next|$)/i);
        const topic = topicMatch?.[1] ?? null;
        await (0, whatsapp_js_1.sendText)(groupJid, "Checking the calendar for available slots...");
        const slots = await (0, google_calendar_js_1.findFreeSlots)(7, 60, 9, 18);
        if (slots.length === 0) {
            await (0, whatsapp_js_1.sendText)(groupJid, "I couldn't find any free slots in the next 7 days. The calendar appears to be fully booked.");
            return;
        }
        const poll = await (0, poll_manager_js_1.createPoll)(groupJid, slots, topic ?? undefined);
        const pollMsg = (0, poll_manager_js_1.formatPollMessage)(poll);
        await (0, whatsapp_js_1.sendText)(groupJid, pollMsg);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await (0, whatsapp_js_1.sendText)(groupJid, `Sorry, I couldn't start the poll: ${msg}`);
    }
}
// ── Feature 2b: Record a poll vote ───────────────────────────────────────────
async function handlePollVote(text, groupJid, senderPhone) {
    try {
        const existingPoll = await (0, poll_manager_js_1.getPoll)(groupJid);
        if (!existingPoll || existingPoll.status !== "open")
            return; // No open poll — ignore digit messages
        const indices = (0, claude_parser_js_1.parsePollVote)(text);
        if (indices.length === 0)
            return;
        const updatedPoll = await (0, poll_manager_js_1.recordVote)(groupJid, senderPhone, indices);
        if (!updatedPoll)
            return;
        const tally = (0, poll_manager_js_1.formatVoteTally)(updatedPoll);
        await (0, whatsapp_js_1.sendText)(groupJid, `Vote recorded!\n\n${tally}`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await (0, whatsapp_js_1.sendText)(groupJid, `Sorry, I couldn't record the vote: ${msg}`);
    }
}
// ── Feature 2c: Close poll and schedule ──────────────────────────────────────
async function handleClosePoll(groupJid, senderPhone) {
    const ownerPhone = process.env.OWNER_PHONE ?? "";
    if (senderPhone !== ownerPhone) {
        await (0, whatsapp_js_1.sendText)(groupJid, "Only the bot owner can close the poll and schedule the meeting.");
        return;
    }
    try {
        const result = await (0, poll_manager_js_1.closePoll)(groupJid, ownerPhone);
        if (!result) {
            await (0, whatsapp_js_1.sendText)(groupJid, "There is no open poll in this group.");
            return;
        }
        const { winningOption } = result;
        const topic = result.poll.topic ?? "Meeting";
        await (0, whatsapp_js_1.sendText)(groupJid, `Poll closed! The winning time slot is: ${friendlyDateTime(winningOption.date, winningOption.time)}\n\nScheduling the meeting...`);
        // Schedule the meeting with the winning slot
        await handleScheduleMeeting(`schedule a zoom for ${topic} on ${winningOption.date} at ${winningOption.time}`, groupJid, ownerPhone, true);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await (0, whatsapp_js_1.sendText)(groupJid, `Sorry, I couldn't close the poll: ${msg}`);
    }
}
// ── Feature 4: Voice transcription ───────────────────────────────────────────
async function handleAudio(sock, msg, replyJid, _senderPhone) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            await (0, whatsapp_js_1.sendText)(replyJid, "Voice transcription is not configured (missing OPENAI_API_KEY).");
            return;
        }
        await (0, whatsapp_js_1.sendText)(replyJid, "Transcribing voice message...");
        // Download the audio stream from Baileys
        const { downloadContentFromMessage } = await Promise.resolve().then(() => __importStar(require("@whiskeysockets/baileys")));
        const stream = await downloadContentFromMessage(msg.message.audioMessage, "audio");
        // Collect stream into a buffer
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);
        // Convert buffer to a File-like object for OpenAI SDK
        const readable = stream_1.Readable.from(audioBuffer);
        readable.name = "voice.ogg";
        const openai = new openai_1.default({ apiKey });
        const transcription = await openai.audio.transcriptions.create({
            file: await openai_1.default.toFile(audioBuffer, "voice.ogg", { type: "audio/ogg" }),
            model: "whisper-1",
            // No language specified — auto-detect Hebrew/English
        });
        await (0, whatsapp_js_1.sendText)(replyJid, `Transcription:\n\n${transcription.text}`);
    }
    catch (err) {
        const msg2 = err instanceof Error ? err.message : String(err);
        await (0, whatsapp_js_1.sendText)(replyJid, `Sorry, I couldn't transcribe the voice message: ${msg2}`);
    }
}
//# sourceMappingURL=handler.js.map
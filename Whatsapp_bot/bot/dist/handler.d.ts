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
export declare function handleMessage(sock: WASocket, msg: WAMessage): Promise<void>;
//# sourceMappingURL=handler.d.ts.map
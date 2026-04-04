/**
 * scheduling-poll.ts
 *
 * Manages the lifecycle of a scheduling poll in Vercel KV.
 *
 * Key schema:
 *   poll:{groupId}              → SchedulingPoll (current poll for a group)
 *   dm-state:{phone}            → DmConversationState (per-participant DM state)
 *
 * Flow:
 *   1. Owner triggers poll in group → poll created, DMs sent to participants
 *   2. Each participant replies in DM → availability parsed and stored
 *   3. When all replied (or owner forces close) → find slots → send group options
 *   4. Owner picks a slot → meeting scheduled
 */

import { kv } from "@vercel/kv";
import { AvailabilityWindow } from "./availability-parser";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PollStatus =
  | "collecting"   // waiting for participant availability replies
  | "proposing"    // options sent to group, waiting for owner to pick
  | "scheduled"    // meeting has been scheduled
  | "cancelled";   // owner cancelled

export interface SchedulingPoll {
  id: string;                    // random hex
  groupId: string;
  topic: string;
  meetingType: "zoom" | "inperson";
  dateRangeStart: string;        // YYYY-MM-DD
  dateRangeEnd: string;          // YYYY-MM-DD
  requestedBy: string;           // phone of person who triggered it
  participants: string[];        // phone numbers
  availability: Record<string, AvailabilityWindow[]>; // phone → windows
  responded: string[];           // phones that have replied
  status: PollStatus;
  candidates?: CandidateOption[]; // populated after intersection
  selectedCandidate?: CandidateOption; // set when owner picks
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
  reminderSentAt?: string;       // ISO of last reminder
}

export interface CandidateOption {
  index: number;        // 1-based label shown to owner
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
  availableCount: number;
  totalCount: number;
  missingPhones: string[];
}

// Tracks where a participant is in the DM conversation
export type DmStage =
  | "awaiting_availability"   // initial ask sent, waiting for reply
  | "clarifying"              // bot sent a clarification request
  | "done";                   // availability recorded

export interface DmConversationState {
  pollId: string;
  groupId: string;
  stage: DmStage;
  topic: string;
  clarifyAttempts: number;
  updatedAt: string;
  dateRangeStart?: string;  // YYYY-MM-DD — the date(s) the participant was asked about
  dateRangeEnd?: string;    // YYYY-MM-DD
}

// ── KV keys ───────────────────────────────────────────────────────────────────

const pollKey    = (groupId: string) => `poll:${groupId}`;
const dmKey      = (phone: string)   => `dm-state:${phone}`;

const POLL_TTL = 7 * 24 * 60 * 60; // 7 days
const DM_TTL   = 7 * 24 * 60 * 60;

// ── Poll CRUD ─────────────────────────────────────────────────────────────────

export async function createPoll(opts: {
  groupId: string;
  topic: string;
  meetingType?: "zoom" | "inperson";
  dateRangeStart: string;
  dateRangeEnd: string;
  requestedBy: string;
  participants: string[];
}): Promise<SchedulingPoll> {
  const { randomBytes } = await import("crypto");
  const poll: SchedulingPoll = {
    id: randomBytes(4).toString("hex"),
    groupId: opts.groupId,
    topic: opts.topic,
    meetingType: opts.meetingType ?? "inperson",
    dateRangeStart: opts.dateRangeStart,
    dateRangeEnd: opts.dateRangeEnd,
    requestedBy: opts.requestedBy,
    participants: opts.participants,
    availability: {},
    responded: [],
    status: "collecting",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(pollKey(opts.groupId), poll, { ex: POLL_TTL });
  return poll;
}

export async function getPoll(groupId: string): Promise<SchedulingPoll | null> {
  return kv.get<SchedulingPoll>(pollKey(groupId));
}

export async function updatePoll(poll: SchedulingPoll): Promise<void> {
  poll.updatedAt = new Date().toISOString();
  await kv.set(pollKey(poll.groupId), poll, { ex: POLL_TTL });
}

export async function deletePoll(groupId: string): Promise<void> {
  await kv.del(pollKey(groupId));
}

// ── Availability recording ────────────────────────────────────────────────────

export async function recordAvailability(
  groupId: string,
  phone: string,
  windows: AvailabilityWindow[]
): Promise<SchedulingPoll | null> {
  const poll = await getPoll(groupId);
  if (!poll || poll.status !== "collecting") return null;

  poll.availability[phone] = windows;
  if (!poll.responded.includes(phone)) poll.responded.push(phone);

  await updatePoll(poll);
  return poll;
}

// ── DM state ─────────────────────────────────────────────────────────────────

export async function setDmState(phone: string, state: DmConversationState): Promise<void> {
  await kv.set(dmKey(phone), state, { ex: DM_TTL });
}

export async function getDmState(phone: string): Promise<DmConversationState | null> {
  return kv.get<DmConversationState>(dmKey(phone));
}

export async function clearDmState(phone: string): Promise<void> {
  await kv.del(dmKey(phone));
}

// ── Status helpers ────────────────────────────────────────────────────────────

export function allResponded(poll: SchedulingPoll): boolean {
  return poll.participants.every(p => poll.responded.includes(p));
}

export function pendingParticipants(poll: SchedulingPoll): string[] {
  return poll.participants.filter(p => !poll.responded.includes(p));
}

// ── Format options for group message ─────────────────────────────────────────

const HEBREW_DAYS: Record<string, string> = {
  sunday: "ראשון", monday: "שני", tuesday: "שלישי",
  wednesday: "רביעי", thursday: "חמישי", friday: "שישי", saturday: "שבת",
};
const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  const dayName = HEBREW_DAYS[DAY_NAMES[d.getDay()]];
  return `${dayName} ${d.getDate()} ${HEBREW_MONTHS[d.getMonth()]}`;
}

export function formatCandidatesMessage(
  candidates: CandidateOption[],
  topic: string,
  phoneToName?: Map<string, string>
): string {
  const lines = [`📅 *${topic}* — זמנים אפשריים:\n`];

  for (const c of candidates) {
    const allAvail = c.availableCount === c.totalCount;
    lines.push(`${c.index}. ${formatDate(c.date)} ${c.startTime}–${c.endTime} — ${allAvail ? "✅ כולם פנויים" : `${c.availableCount}/${c.totalCount} פנויים`}`);
    if (!allAvail && c.missingPhones.length > 0) {
      const names = c.missingPhones.map(p => phoneToName?.get(p) ?? p.slice(-4)).join(", ");
      lines.push(`   ⚠️ לא יכולים: ${names}`);
    }
  }

  lines.push("\nענה במספר כדי לקבוע (לדוגמה: *2*)");
  return lines.join("\n");
}

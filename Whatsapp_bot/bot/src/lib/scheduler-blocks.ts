/**
 * Schedule blocks — stores recurring and one-time unavailability blocks
 * for the owner and participants in Vercel KV.
 *
 * Key schema:
 *   blocks:owner               → ScheduleBlock[]
 *   blocks:participant:{phone} → ScheduleBlock[]
 */

import { kv } from "@vercel/kv";
import { randomBytes } from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleBlock {
  id: string;
  type: "recurring" | "onetime";
  day?: string;      // recurring: "monday" | "tuesday" | etc.
  date?: string;     // onetime: YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  label?: string;
}

// ── Default owner blocks ──────────────────────────────────────────────────────

const DEFAULT_OWNER_BLOCKS: Omit<ScheduleBlock, "id">[] = [
  { type: "recurring", day: "thursday", startTime: "08:30", endTime: "13:30", label: "Thursday morning" },
  { type: "recurring", day: "monday",   startTime: "08:00", endTime: "12:30", label: "Monday morning" },
];

// ── Keys ─────────────────────────────────────────────────────────────────────

const OWNER_KEY = "blocks:owner";
const participantKey = (phone: string) => `blocks:participant:${phone}`;

// ── Owner blocks ──────────────────────────────────────────────────────────────

export async function getOwnerBlocks(): Promise<ScheduleBlock[]> {
  const stored = await kv.get<ScheduleBlock[]>(OWNER_KEY);
  if (stored) return stored;
  // First run: seed defaults
  const defaults = DEFAULT_OWNER_BLOCKS.map(b => ({ ...b, id: randomBytes(4).toString("hex") }));
  await kv.set(OWNER_KEY, defaults);
  return defaults;
}

export async function addOwnerBlock(block: Omit<ScheduleBlock, "id">): Promise<ScheduleBlock> {
  const blocks = await getOwnerBlocks();
  const newBlock: ScheduleBlock = { ...block, id: randomBytes(4).toString("hex") };
  blocks.push(newBlock);
  await kv.set(OWNER_KEY, blocks);
  return newBlock;
}

export async function removeOwnerBlock(idOrLabel: string): Promise<boolean> {
  const blocks = await getOwnerBlocks();
  const filtered = blocks.filter(b => b.id !== idOrLabel && b.label?.toLowerCase() !== idOrLabel.toLowerCase());
  if (filtered.length === blocks.length) return false;
  await kv.set(OWNER_KEY, filtered);
  return true;
}

// ── Participant blocks ────────────────────────────────────────────────────────

export async function getParticipantBlocks(phone: string): Promise<ScheduleBlock[]> {
  return (await kv.get<ScheduleBlock[]>(participantKey(phone))) ?? [];
}

export async function addParticipantBlock(phone: string, block: Omit<ScheduleBlock, "id">): Promise<ScheduleBlock> {
  const blocks = await getParticipantBlocks(phone);
  const newBlock: ScheduleBlock = { ...block, id: randomBytes(4).toString("hex") };
  blocks.push(newBlock);
  await kv.set(participantKey(phone), blocks, { ex: 365 * 24 * 60 * 60 });
  return newBlock;
}

export async function removeParticipantBlock(phone: string, idOrLabel: string): Promise<boolean> {
  const blocks = await getParticipantBlocks(phone);
  const filtered = blocks.filter(b => b.id !== idOrLabel && b.label?.toLowerCase() !== idOrLabel.toLowerCase());
  if (filtered.length === blocks.length) return false;
  await kv.set(participantKey(phone), filtered, { ex: 365 * 24 * 60 * 60 });
  return true;
}

// ── Utility ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

export function isBlockedBySchedule(
  blocks: ScheduleBlock[],
  date: string, // YYYY-MM-DD
  time: string  // HH:MM
): boolean {
  const dayName = DAY_NAMES[new Date(`${date}T12:00:00+03:00`).getDay()];
  for (const b of blocks) {
    if (b.type === "recurring" && b.day === dayName) {
      if (time >= b.startTime && time < b.endTime) return true;
    }
    if (b.type === "onetime" && b.date === date) {
      if (time >= b.startTime && time < b.endTime) return true;
    }
  }
  return false;
}

export function formatBlocks(blocks: ScheduleBlock[]): string {
  if (blocks.length === 0) return "No blocks set.";
  return blocks.map(b =>
    b.type === "recurring"
      ? `• Every ${b.day} ${b.startTime}–${b.endTime}${b.label ? ` (${b.label})` : ""} [id: ${b.id}]`
      : `• ${b.date} ${b.startTime}–${b.endTime}${b.label ? ` (${b.label})` : ""} [id: ${b.id}]`
  ).join("\n");
}

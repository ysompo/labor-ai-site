/**
 * availability-intersect.ts
 *
 * Finds overlapping time slots across multiple participants' availability windows,
 * filtered against the owner's busy ranges and schedule blocks.
 *
 * Returns up to MAX_SLOTS candidate slots sorted by number of available participants.
 */

import { AvailabilityWindow } from "./availability-parser";
import { ScheduleBlock, isBlockedBySchedule } from "./scheduler-blocks";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CandidateSlot {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  availableCount: number;
  totalCount: number;
  missingPhones: string[]; // phones of participants who did NOT confirm this slot
}

interface BusyRange {
  date: string;
  startTime: string;
  endTime: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_DURATION_MIN = 60; // minutes per slot
const MAX_SLOTS = 5;
const SLOT_STEP_MIN = 30;     // granularity when scanning
const WORKING_START = "08:00";
const WORKING_END   = "20:00";
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

// ── Time helpers ──────────────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayNameOf(dateStr: string): string {
  return DAY_NAMES[new Date(`${dateStr}T12:00:00+03:00`).getDay()];
}

function timeOverlaps(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ── Owner busy check ──────────────────────────────────────────────────────────

function isOwnerBusy(
  date: string,
  startTime: string,
  endTime: string,
  ownerBusy: BusyRange[],
  ownerBlocks: ScheduleBlock[]
): boolean {
  const sMin = toMinutes(startTime);
  const eMin = toMinutes(endTime);

  // Check calendar busy ranges
  for (const b of ownerBusy) {
    if (b.date !== date) continue;
    if (timeOverlaps(sMin, eMin, toMinutes(b.startTime), toMinutes(b.endTime))) return true;
  }

  // Check recurring/onetime blocks
  if (isBlockedBySchedule(ownerBlocks, date, startTime)) return true;

  return false;
}

// ── Participant availability check ────────────────────────────────────────────

function participantAvailable(
  phone: string,
  date: string,
  startTime: string,
  endTime: string,
  participantWindows: Map<string, AvailabilityWindow[]>,
  participantBlocks: Map<string, ScheduleBlock[]>
): boolean {
  const dayName = dayNameOf(date);
  const windows = participantWindows.get(phone) ?? [];
  const blocks  = participantBlocks.get(phone) ?? [];
  const sMin = toMinutes(startTime);
  const eMin = toMinutes(endTime);

  // Check participant is not blocked
  if (isBlockedBySchedule(blocks, date, startTime)) return false;

  // Check participant has at least one window covering this slot
  for (const w of windows) {
    if (w.day !== dayName) continue;
    if (toMinutes(w.startTime) <= sMin && toMinutes(w.endTime) >= eMin) return true;
  }

  return false;
}

// ── Main intersection ─────────────────────────────────────────────────────────

export function findCandidateSlots(opts: {
  startDate: string;           // YYYY-MM-DD inclusive
  daysAhead: number;           // how many days to scan
  participantPhones: string[];
  participantWindows: Map<string, AvailabilityWindow[]>;
  participantBlocks: Map<string, ScheduleBlock[]>;
  ownerBusy: BusyRange[];
  ownerBlocks: ScheduleBlock[];
}): CandidateSlot[] {
  const {
    startDate, daysAhead,
    participantPhones, participantWindows, participantBlocks,
    ownerBusy, ownerBlocks,
  } = opts;

  const results: CandidateSlot[] = [];
  const workStart = toMinutes(WORKING_START);
  const workEnd   = toMinutes(WORKING_END);
  const total = participantPhones.length;

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const date = addDays(startDate, dayOffset);

    for (let slotStart = workStart; slotStart + SLOT_DURATION_MIN <= workEnd; slotStart += SLOT_STEP_MIN) {
      const slotEnd = slotStart + SLOT_DURATION_MIN;
      const startTime = fromMinutes(slotStart);
      const endTime   = fromMinutes(slotEnd);

      // Skip if owner is busy
      if (isOwnerBusy(date, startTime, endTime, ownerBusy, ownerBlocks)) continue;

      // Count available participants
      const missingPhones: string[] = [];
      let availableCount = 0;

      for (const phone of participantPhones) {
        if (participantAvailable(phone, date, startTime, endTime, participantWindows, participantBlocks)) {
          availableCount++;
        } else {
          missingPhones.push(phone);
        }
      }

      if (availableCount === 0 && total > 0) continue;

      results.push({ date, startTime, endTime, availableCount, totalCount: total, missingPhones });
    }
  }

  // Sort: full availability first, then by date, then by time
  results.sort((a, b) => {
    const byAvail = b.availableCount - a.availableCount;
    if (byAvail !== 0) return byAvail;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.startTime < b.startTime ? -1 : 1;
  });

  // Deduplicate: don't return overlapping slots on same day
  const picked: CandidateSlot[] = [];
  const usedDaySlots = new Set<string>();

  for (const slot of results) {
    const key = `${slot.date}-${slot.startTime}`;
    if (usedDaySlots.has(key)) continue;

    // Mark all overlapping slots as used
    const sMin = toMinutes(slot.startTime);
    for (let m = sMin; m < sMin + SLOT_DURATION_MIN; m += SLOT_STEP_MIN) {
      usedDaySlots.add(`${slot.date}-${fromMinutes(m)}`);
    }

    picked.push(slot);
    if (picked.length >= MAX_SLOTS) break;
  }

  return picked;
}

// ── Format helpers ────────────────────────────────────────────────────────────

const HEBREW_DAYS: Record<string, string> = {
  sunday: "ראשון", monday: "שני", tuesday: "שלישי",
  wednesday: "רביעי", thursday: "חמישי", friday: "שישי", saturday: "שבת",
};

const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function formatDateHebrew(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+03:00`);
  const dayName = HEBREW_DAYS[DAY_NAMES[d.getDay()]];
  return `${dayName} ${d.getDate()} ${HEBREW_MONTHS[d.getMonth()]}`;
}

export function formatCandidatesHebrew(slots: CandidateSlot[]): string {
  if (slots.length === 0) return "לא נמצאו זמנים מתאימים";

  return slots
    .map((s, i) => {
      const allAvail = s.availableCount === s.totalCount;
      const suffix = allAvail
        ? "✅ כולם פנויים"
        : `${s.availableCount}/${s.totalCount} פנויים`;
      return `${i + 1}. ${formatDateHebrew(s.date)} ${s.startTime}–${s.endTime} — ${suffix}`;
    })
    .join("\n");
}

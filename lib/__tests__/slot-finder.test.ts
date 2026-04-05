/**
 * Tests for lib/slot-finder.ts — pure function, no mocks needed.
 *
 * All dates are constructed in UTC (vitest config sets TZ=UTC) so that
 * getHours() and toISOString() are consistent regardless of machine timezone.
 *
 * Reference anchor: Monday 2025-03-03 08:00 UTC
 *   → first candidate slot is 09:00 (workdayStart = 9)
 *
 * March 2025 calendar (UTC):
 *   Mon 03 · Tue 04 · Wed 05 · Thu 06 · Fri 07 · Sat 08 · Sun 09 · Mon 10
 */

import { describe, it, expect } from 'vitest';
import { computeFreeSlots, type BusyRange } from '../slot-finder';

// Reference time: Monday 2025-03-03 08:00 UTC
const REF = new Date(Date.UTC(2025, 2, 3, 8, 0, 0));

/** Build a UTC ms timestamp */
function ts(year: number, month: number, day: number, hour: number): number {
  return Date.UTC(year, month - 1, day, hour, 0, 0);
}

/** Build a busy range spanning [startHour, endHour) on a given day */
function busy(day: number, startHour: number, endHour: number): BusyRange {
  return {
    start: ts(2025, 3, day, startHour),
    end:   ts(2025, 3, day, endHour),
  };
}

// ── empty calendar ────────────────────────────────────────────────────────────

describe('empty calendar', () => {
  it('returns up to maxSlots (5) free slots', () => {
    const slots = computeFreeSlots([], REF);
    expect(slots).toHaveLength(5);
  });

  it('first slot is at 09:00 when reference is 08:00', () => {
    const [first] = computeFreeSlots([], REF);
    expect(first.time).toBe('09:00');
  });

  it('all slots fall within working hours 09:00–18:00', () => {
    const slots = computeFreeSlots([], REF, 7, 60, 9, 18);
    for (const s of slots) {
      const h = parseInt(s.time.slice(0, 2), 10);
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThan(18);
    }
  });

  it('respects a custom maxSlots parameter', () => {
    const slots = computeFreeSlots([], REF, 30, 60, 9, 18, 3);
    expect(slots).toHaveLength(3);
  });
});

// ── single-calendar busy ranges ───────────────────────────────────────────────

describe('single-calendar busy ranges', () => {
  it('skips a slot that is fully covered by a busy range', () => {
    // event 09:00–10:00 on Monday
    const slots = computeFreeSlots([busy(3, 9, 10)], REF);
    expect(slots.map(s => s.time)).not.toContain('09:00');
  });

  it('skips a slot that partially overlaps with a busy range', () => {
    // event 09:30–10:30 — overlaps the 09:00–10:00 slot and the 10:00–11:00 slot
    const ranges: BusyRange[] = [{ start: ts(2025, 3, 3, 9) + 30 * 60 * 1000, end: ts(2025, 3, 3, 10) + 30 * 60 * 1000 }];
    const slots = computeFreeSlots(ranges, REF);
    expect(slots.map(s => s.time)).not.toContain('09:00');
    expect(slots.map(s => s.time)).not.toContain('10:00');
  });

  it('allows a slot that starts exactly when a busy range ends', () => {
    // event 09:00–10:00; slot at 10:00 should be free
    const slots = computeFreeSlots([busy(3, 9, 10)], REF);
    expect(slots.map(s => s.time)).toContain('10:00');
  });
});

// ── two-calendar overlap (merged busy ranges) ─────────────────────────────────

describe('two-calendar overlap', () => {
  it('correctly finds free slots when busy ranges from two calendars are merged', () => {
    // Calendar A: event Mon 09:00–10:00
    // Calendar B: event Mon 10:00–11:00
    const calA: BusyRange[] = [busy(3, 9, 10)];
    const calB: BusyRange[] = [busy(3, 10, 11)];
    const merged = [...calA, ...calB];

    const slots = computeFreeSlots(merged, REF);
    expect(slots.map(s => s.time)).not.toContain('09:00');
    expect(slots.map(s => s.time)).not.toContain('10:00');
    expect(slots.map(s => s.time)).toContain('11:00');
  });

  it('returns 5 slots when both calendars are empty', () => {
    const slots = computeFreeSlots([...[], ...[]], REF);
    expect(slots).toHaveLength(5);
  });
});

// ── fully booked ──────────────────────────────────────────────────────────────

describe('fully booked calendar', () => {
  it('returns empty array when every working hour is occupied', () => {
    const ranges: BusyRange[] = [];
    // Fill Mon–Sun working hours (Mon 03 → Sun 09) with hour-long events
    for (let d = 3; d <= 9; d++) {
      for (let h = 9; h < 18; h++) {
        ranges.push(busy(d, h, h + 1));
      }
    }
    const slots = computeFreeSlots(ranges, REF, 7);
    expect(slots).toHaveLength(0);
  });
});

// ── slot duration longer than any gap ─────────────────────────────────────────

describe('slot duration longer than any gap', () => {
  it('returns empty array when back-to-back 30-min events block every hour slot', () => {
    const ranges: BusyRange[] = [];
    // 30-min events on every half-hour: 09:00–09:30, 09:30–10:00, 10:00–10:30, …
    // An hourly slot at 09:00 (09:00–10:00) overlaps with the 09:00–09:30 event.
    // An hourly slot at 10:00 (10:00–11:00) overlaps with the 10:00–10:30 event.
    // ⟹ no full-hour slot is free.
    for (let d = 3; d <= 9; d++) {
      for (let h = 9; h < 18; h++) {
        const base = ts(2025, 3, d, h);
        ranges.push({ start: base,                    end: base + 30 * 60 * 1000 });
        ranges.push({ start: base + 30 * 60 * 1000,  end: base + 60 * 60 * 1000 });
      }
    }
    const slots = computeFreeSlots(ranges, REF, 7, 60);
    expect(slots).toHaveLength(0);
  });
});

// ── Israeli calendar rules ────────────────────────────────────────────────────

describe('Israeli calendar rules', () => {
  it('never returns a slot on Saturday', () => {
    // Reference: Friday 2025-03-07 10:00 UTC, look 3 days ahead (includes Sat 08)
    const friRef = new Date(Date.UTC(2025, 2, 7, 10, 0, 0));
    const slots = computeFreeSlots([], friRef, 3, 60, 9, 18, 20);
    for (const s of slots) {
      const dow = new Date(s.date + 'T12:00:00Z').getUTCDay();
      expect(dow).not.toBe(6); // 6 = Saturday
    }
  });

  it('never returns a Friday slot at or after 14:00', () => {
    // Reference: Friday 2025-03-07 08:00 UTC
    const friRef = new Date(Date.UTC(2025, 2, 7, 8, 0, 0));
    const slots = computeFreeSlots([], friRef, 1, 60, 9, 18, 20);
    const fridaySlots = slots.filter(s => {
      const dow = new Date(s.date + 'T12:00:00Z').getUTCDay();
      return dow === 5; // Friday
    });
    for (const s of fridaySlots) {
      const h = parseInt(s.time.slice(0, 2), 10);
      expect(h).toBeLessThan(14);
    }
  });

  it('resumes on Sunday after skipping Friday afternoon and Saturday', () => {
    // Reference: Friday 2025-03-07 13:00 UTC — only 13:00 is within working hours before cutoff
    const friRef = new Date(Date.UTC(2025, 2, 7, 13, 0, 0));
    const slots = computeFreeSlots([], friRef, 3, 60, 9, 18, 10);
    const days = [...new Set(slots.map(s => new Date(s.date + 'T12:00:00Z').getUTCDay()))];
    expect(days).not.toContain(6); // no Saturday
    // After Friday, the next day must be Sunday (0) or later
    const hasSunday = days.some(d => d === 0);
    expect(hasSunday).toBe(true);
  });
});

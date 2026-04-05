/**
 * Pure slot-finding algorithm — no I/O, no side effects.
 *
 * Takes a list of pre-computed busy time ranges (ms timestamps) and returns
 * hourly free slots within working hours over the next N days.
 *
 * Israeli calendar rules:
 *   - Working hours: workdayStart–workdayEnd (default 09:00–18:00 local time)
 *   - Friday afternoon (≥ 14:00) and Saturday are skipped
 */

export interface BusyRange {
  /** Start of busy period, ms timestamp (inclusive) */
  start: number;
  /** End of busy period, ms timestamp (exclusive) */
  end: number;
}

export interface FreeSlot {
  date: string; // YYYY-MM-DD (UTC date at slot time)
  time: string; // HH:MM (local hour)
}

/**
 * Find up to `maxSlots` free hourly slots given a list of busy ranges.
 * Slots are placed at the start of each hour (09:00, 10:00, …).
 *
 * @param busyRanges   Pre-computed busy intervals (caller applies any desired padding).
 * @param referenceTime  The "now" anchor; the first candidate slot is the next full hour.
 */
export function computeFreeSlots(
  busyRanges: BusyRange[],
  referenceTime: Date,
  daysAhead = 7,
  slotDurationMinutes = 60,
  workdayStart = 9,
  workdayEnd = 18,
  maxSlots = 5
): FreeSlot[] {
  const end = new Date(referenceTime.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const slots: FreeSlot[] = [];

  const cursor = new Date(referenceTime);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1); // start from the next full hour

  while (cursor < end && slots.length < maxSlots) {
    const hour = cursor.getHours();
    const dayOfWeek = cursor.getDay(); // 0 = Sun, 6 = Sat

    // Skip Saturday entirely
    if (dayOfWeek === 6) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(workdayStart, 0, 0, 0);
      continue;
    }

    // Skip Friday afternoon
    if (dayOfWeek === 5 && hour >= 14) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(workdayStart, 0, 0, 0);
      continue;
    }

    if (hour >= workdayStart && hour < workdayEnd) {
      const slotStart = cursor.getTime();
      const slotEnd = slotStart + slotDurationMinutes * 60 * 1000;

      const isBusy = busyRanges.some((r) => slotStart < r.end && slotEnd > r.start);

      if (!isBusy) {
        slots.push({
          date: cursor.toISOString().slice(0, 10),
          time: `${String(hour).padStart(2, '0')}:00`,
        });
      }
    }

    cursor.setHours(cursor.getHours() + 1);
  }

  return slots;
}

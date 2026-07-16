/**
 * Demo mode for local sales previews.
 *
 * Active ONLY when env DEMO_MODE === 'true'. Everything the demo path serves
 * is visibly labeled as demo: API responses carry `demo: true` and the UI
 * renders DEMO stamps. Real configured providers always win — demo mode is
 * consulted only when the real integration is missing (blocked). With
 * DEMO_MODE unset or any other value, behavior is exactly the honest blocked
 * state as before. Never enable in production.
 */
import type { CalendarProvider, Slot } from './provider';

/** True only when the operator explicitly opted into demo mode. */
export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEMO_MODE === 'true';
}

/** Demo slots are rendered in the firm timezone. */
export const DEMO_TIMEZONE = 'America/Chicago';

/** Explicit CDT wall-clock offset used in every demo slot ISO string. */
const DEMO_OFFSET = '-05:00';

/** Sample start hours (local), weekdays only. */
const DEMO_HOURS = [9, 10, 11, 13, 14, 15, 16] as const;

const SLOT_MINUTES = 30;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Deterministic sample availability for sales demos: weekdays (Mon–Fri)
 * within [fromISO, toISO], at DEMO_HOURS local time, 30 minutes each.
 * Same inputs always produce the same outputs — no randomness, no clock
 * dependence beyond the caller-supplied range.
 */
export class DemoCalendarProvider implements CalendarProvider {
  async getAvailableSlots(_firmId: string, fromISO: string, toISO: string): Promise<Slot[]> {
    const from = new Date(fromISO);
    const to = new Date(toISO);
    const slots: Slot[] = [];
    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: DEMO_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const seenDates = new Set<string>();

    for (let cursor = from.getTime(); cursor < to.getTime(); cursor += 86_400_000) {
      const localDate = dateFmt.format(new Date(cursor)); // YYYY-MM-DD in America/Chicago
      if (seenDates.has(localDate)) continue;
      seenDates.add(localDate);
      const [year, month, day] = localDate.split('-').map(Number);
      // Weekday from the wall-clock date itself (noon UTC avoids edge effects).
      const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
      if (weekday === 0 || weekday === 6) continue; // Sun / Sat
      for (const hour of DEMO_HOURS) {
        const datePart = `${year}-${pad2(month)}-${pad2(day)}`;
        const startISO = `${datePart}T${pad2(hour)}:00:00.000${DEMO_OFFSET}`;
        const endISO = `${datePart}T${pad2(hour)}:${pad2(SLOT_MINUTES)}:00.000${DEMO_OFFSET}`;
        const start = new Date(startISO);
        const end = new Date(endISO);
        if (start < from || end > to) continue;
        slots.push({ startISO, endISO, timezone: DEMO_TIMEZONE });
      }
    }
    return slots;
  }
}

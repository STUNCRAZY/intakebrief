/**
 * Calendar availability service — the honesty gate for booking.
 * NEVER fabricates availability: when no calendar provider is configured
 * (missing GOOGLE_CALENDAR_* env), getAvailability returns a blocked status
 * and zero slots. Only a connected provider's real free/busy data produces
 * slots, and any slot already held or confirmed in the BookingService is
 * filtered out so it can never be double-offered.
 *
 * Also owns the process-wide BookingService singleton, backed by a
 * JSON-file SlotStore (.runtime/slots.json) so holds/confirmations survive
 * route-handler reloads.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BookingService, type SlotStore, type SlotState } from '@/lib/booking/service';
import { DemoCalendarProvider, isDemoMode } from './demo';
import { GoogleCalendarProvider, type CalendarProvider } from './provider';

/** Holds expire after 15 minutes. */
export const HOLD_TTL_MS = 15 * 60 * 1000;

const REQUIRED_GOOGLE_ENV = [
  'GOOGLE_CALENDAR_CLIENT_ID',
  'GOOGLE_CALENDAR_CLIENT_SECRET',
  'GOOGLE_CALENDAR_REFRESH_TOKEN',
  'GOOGLE_CALENDAR_ID',
] as const;

/** SlotStore persisted to a JSON file so booking state survives reloads. */
export class FileSlotStore implements SlotStore {
  private readonly map = new Map<string, SlotState>();

  constructor(private readonly filePath: string = defaultSlotsFile()) {
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, SlotState>;
      for (const [slotId, state] of Object.entries(parsed)) {
        if (state && typeof state === 'object') {
          this.map.set(slotId, { hold: state.hold ?? null, confirmed: state.confirmed ?? null });
        }
      }
    } catch {
      // Missing or corrupt file: start empty. Availability is never at risk —
      // worst case a stale hold disappears and the provider is re-queried.
      this.map.clear();
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.map), null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  get(slotId: string): SlotState | undefined {
    return this.map.get(slotId);
  }

  set(slotId: string, state: SlotState): void {
    this.map.set(slotId, state);
    this.save();
  }

  entries(): IterableIterator<[string, SlotState]> {
    return this.map.entries();
  }
}

function defaultSlotsFile(): string {
  return path.join(process.cwd(), '.runtime', 'slots.json');
}

let bookingService: BookingService | null = null;

/** Process-wide BookingService singleton backed by the file store. */
export function getBookingService(): BookingService {
  if (!bookingService) {
    bookingService = new BookingService(new FileSlotStore());
  }
  return bookingService;
}

/** Test hook: swap/reset the singleton (e.g. in-memory store + injected clock). */
export function _resetBookingServiceForTests(store?: SlotStore, now?: () => number): void {
  bookingService = new BookingService(store, now);
}

export type AvailabilityResult =
  | { status: 'ok'; timezone: string; slots: { startISO: string; endISO: string }[]; demo?: boolean }
  | { status: 'blocked'; detail: string };

/**
 * Real availability for a firm in [fromISO, toISO].
 * Blocked (honestly, zero slots) when no provider is configured; otherwise
 * the provider's free/busy slots minus anything held or confirmed.
 * `providerOverride` exists so tests can inject a stub CalendarProvider.
 */
export async function getAvailability(
  firmId: string,
  fromISO: string,
  toISO: string,
  env: NodeJS.ProcessEnv = process.env,
  providerOverride?: CalendarProvider | null,
): Promise<AvailabilityResult> {
  let provider: CalendarProvider | null;
  if (providerOverride !== undefined) {
    provider = providerOverride;
  } else {
    try {
      provider = new GoogleCalendarProvider(env);
    } catch {
      provider = null;
    }
  }

  // Demo mode: only when no real provider is configured. A configured real
  // provider always wins; without DEMO_MODE === 'true' this stays blocked.
  const demo = !provider && isDemoMode(env);
  if (!provider && demo) {
    provider = new DemoCalendarProvider();
  }

  if (!provider) {
    const missing = REQUIRED_GOOGLE_ENV.filter((name) => !env[name]);
    return {
      status: 'blocked',
      detail: `calendar not configured: missing ${missing.length > 0 ? missing.join(', ') : REQUIRED_GOOGLE_ENV.join(', ')}`,
    };
  }

  const timezone = env.CALENDAR_TIMEZONE || 'America/Chicago';
  const slots = await provider.getAvailableSlots(firmId, fromISO, toISO);
  const booking = getBookingService();
  const confirmedIds = new Set(booking.getConfirmed().map((c) => c.slotId));
  const open = slots
    .filter((slot) => !confirmedIds.has(slot.startISO) && !booking.isHeld(slot.startISO))
    .map((slot) => ({ startISO: slot.startISO, endISO: slot.endISO }));
  return demo ? { status: 'ok', timezone, slots: open, demo: true } : { status: 'ok', timezone, slots: open };
}

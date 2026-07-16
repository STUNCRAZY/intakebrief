/**
 * Calendar provider abstraction.
 * GoogleCalendarProvider implements real availability via the Google Calendar
 * freeBusy REST endpoint using OAuth refresh-token credentials from env.
 * getCalendarProvider() returns null when credentials are absent, which the
 * rest of the app treats as an honest "blocked" state.
 */

export interface Slot {
  startISO: string;
  endISO: string;
  timezone: string;
}

export interface CalendarProvider {
  getAvailableSlots(firmId: string, fromISO: string, toISO: string): Promise<Slot[]>;
}

const REQUIRED_ENV = [
  'GOOGLE_CALENDAR_CLIENT_ID',
  'GOOGLE_CALENDAR_CLIENT_SECRET',
  'GOOGLE_CALENDAR_REFRESH_TOKEN',
  'GOOGLE_CALENDAR_ID',
] as const;

/** Convert a wall-clock time in `timezone` to a UTC Date using Intl offsets (no deps). */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timezone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const renderedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = renderedAsUtc - guess;
  return new Date(guess - offsetMs);
}

interface BusyInterval {
  start: Date;
  end: Date;
}

export class GoogleCalendarProvider implements CalendarProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly calendarId: string;
  private readonly timezone: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    for (const name of REQUIRED_ENV) {
      if (!env[name]) {
        throw new Error(`GoogleCalendarProvider blocked: missing env var ${name}`);
      }
    }
    this.clientId = env.GOOGLE_CALENDAR_CLIENT_ID as string;
    this.clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET as string;
    this.refreshToken = env.GOOGLE_CALENDAR_REFRESH_TOKEN as string;
    this.calendarId = env.GOOGLE_CALENDAR_ID as string;
    this.timezone = env.CALENDAR_TIMEZONE || 'America/Chicago';
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.token;
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`google token refresh failed: HTTP ${res.status}`);
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error('google token refresh failed: no access_token in response');
    this.cachedToken = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return json.access_token;
  }

  async getAvailableSlots(_firmId: string, fromISO: string, toISO: string): Promise<Slot[]> {
    const token = await this.getAccessToken();
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        timeMin: fromISO,
        timeMax: toISO,
        items: [{ id: this.calendarId }],
      }),
    });
    if (!res.ok) throw new Error(`google freeBusy query failed: HTTP ${res.status}`);
    const json = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };
    const busy: BusyInterval[] = (json.calendars?.[this.calendarId]?.busy ?? []).map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));
    return this.computeOpenSlots(new Date(fromISO), new Date(toISO), busy);
  }

  /** Candidate slots: 60 minutes, 09:00–17:00 local, weekdays, minus busy intervals. */
  private computeOpenSlots(from: Date, to: Date, busy: BusyInterval[]): Slot[] {
    const slots: Slot[] = [];
    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: this.timezone, weekday: 'short' });
    const seenDates = new Set<string>();

    for (let cursor = from.getTime(); cursor < to.getTime(); cursor += 86_400_000) {
      const localDate = dateFmt.format(new Date(cursor));
      if (seenDates.has(localDate)) continue;
      seenDates.add(localDate);
      const [year, month, day] = localDate.split('-').map(Number);
      for (let hour = 9; hour < 17; hour += 1) {
        const start = zonedTimeToUtc(year, month, day, hour, this.timezone);
        const end = new Date(start.getTime() + 3_600_000);
        if (start < from || end > to) continue;
        const weekday = weekdayFmt.format(start);
        if (weekday === 'Sat' || weekday === 'Sun') continue;
        const overlapsBusy = busy.some((b) => start < b.end && end > b.start);
        if (!overlapsBusy) {
          slots.push({ startISO: start.toISOString(), endISO: end.toISOString(), timezone: this.timezone });
        }
      }
    }
    return slots;
  }
}

/** Real provider when configured; null (= blocked) when env credentials are missing. */
export function getCalendarProvider(): CalendarProvider | null {
  try {
    return new GoogleCalendarProvider();
  } catch {
    return null;
  }
}

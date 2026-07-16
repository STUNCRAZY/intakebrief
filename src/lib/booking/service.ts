/**
 * Booking state machine — pure logic, no external calls.
 * A slot moves: open -> held (TTL) -> confirmed. Holds auto-release on expiry
 * (checked lazily on every access), and every write re-reads current state
 * first ("recheck-before-confirm") so a stale caller can never double-book.
 * Works against a pluggable SlotStore; an in-memory implementation ships here
 * and is what whichever calendar provider gets connected will use initially.
 */

export interface HoldRecord {
  holdId: string;
  slotId: string;
  expiresAt: number;
}

export interface ConfirmedBooking {
  slotId: string;
  paymentRef: string;
  confirmedAt: number;
}

export interface SlotState {
  hold: HoldRecord | null;
  confirmed: ConfirmedBooking | null;
}

export interface SlotStore {
  get(slotId: string): SlotState | undefined;
  set(slotId: string, state: SlotState): void;
  entries(): IterableIterator<[string, SlotState]>;
}

export class InMemorySlotStore implements SlotStore {
  private readonly map = new Map<string, SlotState>();

  get(slotId: string): SlotState | undefined {
    return this.map.get(slotId);
  }

  set(slotId: string, state: SlotState): void {
    this.map.set(slotId, state);
  }

  entries(): IterableIterator<[string, SlotState]> {
    return this.map.entries();
  }
}

export class BookingService {
  private sequence = 0;

  constructor(
    private readonly store: SlotStore = new InMemorySlotStore(),
    private readonly now: () => number = Date.now,
  ) {}

  /** Lazily drop an expired hold, then return fresh state. */
  private recheck(slotId: string): SlotState {
    const state = this.store.get(slotId) ?? { hold: null, confirmed: null };
    if (state.hold && state.hold.expiresAt <= this.now()) {
      state.hold = null;
      this.store.set(slotId, state);
    }
    return state;
  }

  /** Hold a slot for ttlMs. Throws if already confirmed or actively held. */
  hold(slotId: string, ttlMs: number): string {
    const state = this.recheck(slotId);
    if (state.confirmed) throw new Error(`slot ${slotId} is already confirmed`);
    if (state.hold) throw new Error(`slot ${slotId} is already held`);
    const holdId = `hold-${++this.sequence}`;
    state.hold = { holdId, slotId, expiresAt: this.now() + ttlMs };
    this.store.set(slotId, state);
    return holdId;
  }

  /** Release a hold by id. Returns false when the hold id is unknown/expired. */
  releaseHold(holdId: string): boolean {
    for (const [slotId, state] of this.store.entries()) {
      if (state.hold?.holdId === holdId) {
        state.hold = null;
        this.store.set(slotId, state);
        return true;
      }
    }
    return false;
  }

  isHeld(slotId: string): boolean {
    return this.recheck(slotId).hold !== null;
  }

  /**
   * Confirm a slot after payment. Re-reads state immediately before writing:
   * throws on an existing confirmation (double-book), consumes any active hold.
   */
  confirmBooking(slotId: string, paymentRef: string): ConfirmedBooking {
    const state = this.recheck(slotId);
    if (state.confirmed) throw new Error(`slot ${slotId} is already confirmed`);
    const confirmed: ConfirmedBooking = { slotId, paymentRef, confirmedAt: this.now() };
    state.confirmed = confirmed;
    state.hold = null;
    this.store.set(slotId, state);
    return confirmed;
  }

  getConfirmed(): ConfirmedBooking[] {
    const confirmed: ConfirmedBooking[] = [];
    for (const [, state] of this.store.entries()) {
      if (state.confirmed) confirmed.push(state.confirmed);
    }
    return confirmed;
  }
}

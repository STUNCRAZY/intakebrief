# End-to-end preflight run — 2026-07-17

Outcome: full operational chain passed, including user-confirmed inbox delivery.

## Production recording run

The final recording repeated the chain with a fresh `Jordan Mitchell` guardianship inquiry at 2:53 PM and a fresh Stripe Sandbox payment at 3:02 PM:

- Both initial emails reported `accepted` and the inquiry was classified as guardianship with high confidence.
- 73 current Google Calendar choices were returned; Monday, July 20 at 9:00 AM CDT was held for 15 minutes.
- Stripe event `evt_1TuHxeCHadpXvx86H1vfPZGX` reached the local webhook at 3:02:18 PM and received HTTP 200.
- `.runtime/slots.json` persisted `2026-07-20T14:00:00.000Z` with a `cs_test_...` payment reference and no remaining hold.
- The topical customer response, firm notification, and final customer confirmation were visually captured from the controlled inbox.
- The final public video and dated master share SHA-256 `778B969CF9B28FABF85AEC522C14A7EDA76251BF5D03A4331540EB559F2DDE0D`.

## Verified

- Application health endpoint returned healthy.
- Google OAuth token refresh succeeded.
- Google Calendar returned 79 real slots in `America/Chicago`; demo mode was off.
- Initial Resend attempt exposed address-case sensitivity in the sandbox restriction. The test recipient and firm map were normalized to lowercase.
- Controlled inquiry retry:
  - firm notification: `accepted`
  - customer response: `accepted`
  - matter classification: `guardianship`, medium confidence
- A real Google-derived slot was held for 15 minutes.
- Stripe created a hosted Sandbox Checkout session for exactly `$50.00`.
- Stripe test card `4242 4242 4242 4242` completed successfully; no real charge was made.
- Stripe CLI received `checkout.session.completed` and forwarded it to `/api/webhooks/stripe`.
- The webhook returned HTTP 200.
- Booking state persisted the selected slot as confirmed with a `cs_test_...` payment reference.
- The confirmed slot was removed from subsequent availability results.
- One Stripe event id was persisted in the idempotency store.
- The user visually confirmed all four expected workflow messages in `fgarcia@tlg-works.com`.

## Evidence

- Stripe listener: `.runtime/stripe-listen.out.log`
- Booking state: `.runtime/slots.json`
- Webhook idempotency store: `.runtime/stripe-events.json`
- Preflight checkout state: `.runtime/preflight-checkout.json`
- Stripe checkout frame: `design/video-plan/preflight-stripe-test-card.png`
- Honest return/verification frame: `design/video-plan/preflight-stripe-return.png`

## Inbox confirmation

The user visually confirmed the four expected messages in `fgarcia@tlg-works.com`:

1. Firm inquiry notification
2. Automated customer response
3. Deposit-received firm confirmation
4. Customer booking confirmation

The inquiry API reported both initial messages accepted, the webhook completed successfully, and the recipient confirmed the visible results. The Resend key remains send-only, so automated delivery-event lookup is unavailable.

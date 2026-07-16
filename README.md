# IntakeBrief

Lead-capture + sales-research web application for small and boutique law firms.
Design language: **"Docket & Ledger"** — an editorial law-journal aesthetic
(paper/ink palette, ruled lines, rubber-stamp badges, docket numbers).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- No Tailwind — hand-built design tokens (`src/styles/tokens.css`) + CSS Modules
- Vitest unit tests, zod validation, Resend (email), Stripe (payments)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the integrations you use
npm run dev                  # http://localhost:3000
```

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Development server               |
| `npm run build`     | Production build                 |
| `npm run start`     | Serve the production build       |
| `npm test`          | Unit tests (`vitest run`)        |
| `npm run typecheck` | Strict `tsc --noEmit`            |

## Repository map

- `research/firms/*.json` — 25 researched firm profiles (read-only input data)
- `content/firms/*.json` — generated website-concept/outreach content (added by a later wave)
- `src/lib/firms` — profile/content loaders, pipeline types
- `src/lib/inquiry` — inquiry contracts + per-firm field definitions
- `src/lib/email` — email provider abstraction (Resend + blocked null provider)
- `src/lib/classify` — deterministic, keyword-based matter classification (no AI)
- `src/lib/calendar` — Google Calendar free/busy availability provider
- `src/lib/booking` — booking state machine (hold → confirm) with pluggable store
- `src/lib/payments` — Stripe hosted-checkout deposit helpers
- `/status` — honest per-integration configuration status (no fake greens)

## External services

### Email — Resend

Env vars: `RESEND_API_KEY`, `EMAIL_FROM`, optional `TEST_INBOX_ADDRESS`, `FIRM_RECIPIENTS_JSON`.

1. Create an account at <https://resend.com> and verify your sending domain
   (Domains → Add domain → publish the DKIM/SPF records it shows).
2. API Keys → Create API Key (sending permission) → copy it into `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on the verified domain,
   e.g. `IntakeBrief <intake@yourdomain.com>`.
4. Optional sandbox: when `TEST_INBOX_ADDRESS` is set, **all** outbound email is
   redirected to that inbox and the original recipient is noted in the subject
   suffix `[TEST → original@example.com]`.
5. `FIRM_RECIPIENTS_JSON` maps firm ids to notification inboxes:
   `'{"<firmId>":"intake@firm.com"}'`.

Without `RESEND_API_KEY`/`EMAIL_FROM` the app uses `NullEmailProvider`, which
reports every send as **blocked** (naming the missing variable) and never
pretends to have sent anything.

### Calendar — Google Calendar

Env vars: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`,
`GOOGLE_CALENDAR_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`, optional `CALENDAR_TIMEZONE`
(default `America/Chicago`).

1. Google Cloud Console → create a project → APIs & Services → Enable APIs →
   enable **Google Calendar API**.
2. OAuth consent screen → External → fill in app name/contact email → add scope
   `https://www.googleapis.com/auth/calendar`.
3. Credentials → Create Credentials → OAuth client ID → Web application.
   Add `https://developers.google.com/oauthplayground` as an authorized
   redirect URI. Copy the client ID/secret into the env vars.
4. Open OAuth 2.0 Playground → gear icon → "Use your own OAuth credentials" →
   authorize the `calendar` scope → exchange the authorization code for tokens →
   copy the **refresh token** into `GOOGLE_CALENDAR_REFRESH_TOKEN`.
5. `GOOGLE_CALENDAR_ID` is usually the account's Gmail address (or `primary`).

Availability is computed from the Calendar `freeBusy` endpoint (weekday
09:00–17:00 local, 60-minute slots, minus busy intervals). With no credentials,
`getCalendarProvider()` returns `null` and the app reports calendar as blocked.

### Payments — Stripe

Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional `STRIPE_PRICE_ID`.

1. <https://dashboard.stripe.com> → Developers → API keys → copy the **Secret key**
   into `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → Add endpoint:
   `{APP_BASE_URL}/api/webhooks/stripe`, listening for `checkout.session.completed`.
   Copy the endpoint's **Signing secret** into `STRIPE_WEBHOOK_SECRET`.
3. Optional: create a Product/Price for the consultation deposit and set
   `STRIPE_PRICE_ID`. When unset, checkout uses inline `price_data` with the
   server-side constant `DEPOSIT_AMOUNT_CENTS = 5000` ($50.00).

Payments always use Stripe-hosted Checkout — raw card data never touches this
app, and the amount is never taken from client input. Webhook payloads are
verified with `constructWebhookEvent` and the `isDepositPaid` guard.
`getStripe()` returns `null` (blocked) when `STRIPE_SECRET_KEY` is missing.

### AI (optional)

`AI_PROVIDER`, `AI_API_KEY`. The shipped matter classifier is deterministic
keyword scoring and needs no AI key; these vars are reserved for later waves.

## Environment reference

See `.env.example` for the complete, commented list. Audit-log and runtime
paths (`AUDIT_LOG_PATH`, `runtime-data/`) are git-ignored by design.

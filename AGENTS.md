# IntakeBrief

Lead-capture + sales-research web app for boutique law firms (Next.js 15 App Router,
React 19, TypeScript strict, hand-built CSS Modules — no Tailwind).

## Cursor Cloud specific instructions

### Services

Single service: the Next.js app. Everything runs from `package.json` scripts (see the
README "Scripts" table). Standard commands:

- `npm run dev` — dev server on http://localhost:3000
- `npm run build` / `npm run start` — production build / serve
- `npm test` — Vitest unit tests (`vitest run`)
- `npm run typecheck` — strict `tsc --noEmit` (this is the static/lint check; there is
  **no** `lint` script and no ESLint config in the repo)

The update script already runs `npm install`, so dependencies are present when a cloud
agent starts. Start the dev server yourself (it is not auto-started).

### Runs fully without secrets (honest graceful degradation)

The app is designed to never fake integration success. With no env vars set, every
external integration reports a labeled **blocked** status instead of failing or faking:

- Email (Resend): missing `RESEND_API_KEY`/`EMAIL_FROM` → `NullEmailProvider`, so a
  submitted inquiry returns `firmNotification.status: "blocked"`. This is expected, not a bug.
- Calendar (Google), Payments (Stripe), local AI (Ollama) similarly report blocked/fallback.

So you can run and test the whole app end-to-end with **no** `.env.local` and no secrets.
The `/status` page shows the honest per-integration configuration state.

### Non-obvious behavior gotchas

- The capture-page **scheduling** section only appears after `firmNotification.status ===
  "accepted"`, which requires a real `RESEND_API_KEY` + `EMAIL_FROM` (Resend actually
  sends mail). Without email configured, submitting still works and shows the honest
  "blocked" delivery status, but the slot picker / holds / deposit UI stays hidden.
- To exercise scheduling/checkout UI without live credentials, set `DEMO_MODE=true` in
  `.env.local` (serves clearly-labeled sample availability + simulated checkout; never for
  production) **and** provide email config so notifications are accepted.
- Valid firm ids come from `research/firms/*.json` filenames (e.g. `biles-law`). Capture
  pages live at `/capture/<firmId>`, firm research at `/firms/<firmId>`.
- Copy `.env.example` → `.env.local` (git-ignored) to configure integrations. `.env.local`
  is never committed.

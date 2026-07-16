# Custom Intake Design — Alagood Cartwright Burke PC (Denton, TX)

Lane: business/civil + employment (this firm carries the employment/civil-rights field set)
Live site: https://www.dentonlaw.com/ — **accessible**; findings below are from the live homepage, /about/, /contact/, and the theme stylesheet.

---

## 1. Live-site findings

### Palette (all values extracted from `https://www.dentonlaw.com/wp-content/themes/alagoodcartwright/style.css`)

| Hex | Role on live site | Source in CSS |
|---|---|---|
| `#427d9d` | **Primary brand blue** — all CTA buttons (`.cmn-btn`, Gravity Forms submit), nav sub-menus, link hovers, banner accent | `a.cmn-btn` (line ~1508), `.hm-form-sec ... input[type="submit"]` (line ~1934), `.topmenu ... sub-menu` (line ~1167) |
| `#164863` | **Deep navy** — large section backgrounds (attorneys, blog, interior page banner) | `.attorney-sec` (line ~1715), `.hmblg-sec` (line ~1840), `.page_bnr` (line ~2076) |
| `#9bbec8` | **Light sky-blue accent** — award block background, button's left color-wedge (`a.cmn-btn:before`), footer headings, borders | `a.cmn-btn:before` (line ~1512), `.awards-sec .award-blk` (line ~1570), `.site-footer .ftr-address h3` (line ~2020) |
| `#d2b589` | **Warm tan/gold accent** — attorney feature card background, footer headings, circular badge borders | `.attorney-sec .attrny-left-cnt` (line ~1727), `.case-results-sec ... h4::before` (line ~1820) |
| `#0d374c` / `#0c3449` | Dark blue text on light backgrounds | style.css (awards h2 `#0c3449`, line ~1574) |
| `#212e51` | Indigo badge fill (case-results icons) | `.case-results-sec ... h4::before` (line ~1820) |
| `#fff` | Text on navy/blue sections, button text | throughout |

The site's feel: deep navy + steel blue, lifted by a light sky-blue and a single warm tan. No red/orange anywhere — the palette is calm, established, North-Texas-professional.

### Typography (from the same stylesheet + homepage `<head>`)

- **Display serif:** `'Bodoni Moda 18pt'` (self-hosted woff2) — hero H1 at 109px, weight 500–600, ALL UPPERCASE, tight letter-spacing (`-2.3px`). Used for `.banner-sec h1`, `.about-sec h2`, `.page_title h2`. This is the firm's signature voice visually.
- **Secondary serif:** `'Libre Bodoni', serif` — attorney names, footer headings (uppercase, 600).
- **Button/label sans:** `'Jost'` — CTAs in uppercase, weight 500, letter-spacing `0.46px`; also the oversized outlined section words (weight 200, letter-spacing `5.5px`).
- **Body/UI sans:** `'Poppins'` (Google Fonts, weights 300–900) — body copy, dates, links.
- Character: big uppercase Bodoni serif headlines = formal, established, "Denton institution since 2003"; Jost/Poppins keep the UI modern and legible.

### Voice (quoted from live pages)

- **"Your Partners in Navigating Legal Challenges"** — homepage hero H1, https://www.dentonlaw.com/
- **"Trusted Legal Advice For Many Areas Of Life"** — homepage + https://www.dentonlaw.com/about/
- "we help people find **effective solutions to life's problems**" — https://www.dentonlaw.com/
- **"Your Success Is Our Primary Concern"** and **"Get The Answers You Need"** — https://www.dentonlaw.com/about/
- CTA language everywhere: **"Schedule A Consultation"** / "Call 940-891-0003" — https://www.dentonlaw.com/contact/
- Their own disclaimer voice (worth mirroring): "The use of the internet or this form for communication with the firm … does not establish an attorney-client relationship. Confidential or time-sensitive information should not be sent through this form." — https://www.dentonlaw.com/contact/

Tone: plain-language, partner-framed ("partners," "we work closely with each client"), confident without bravado, never urgent-salesy.

### Current contact-form weaknesses (observed at /contact/)

1. **One long single-page Gravity Form** — First Name*, Phone*, Email*, Practice Area, Case Urgency, How Did You Hear About Us, Preferred Contact Method, Message, disclaimer checkbox — all on one wall, no progress indication.
2. **"Case Urgency"** is a vague self-assessment dropdown; a deadline date would do the same job and feed routing.
3. **"How Did You Hear About Us"** is marketing friction placed in front of a person with a legal problem.
4. **No scheduling at all** — form ends in "we'll get back to you"; research profile confirms no online booking widget. Every CTA promise ("Schedule A Consultation") lands on a form that cannot schedule.
5. Disclaimer checkbox sits only at the bottom, easy to blow past; nothing sets expectations about what happens after submit.
6. Their viewport disables pinch-zoom (`user-scalable=no`) — our intake must not repeat that; the intake is a fresh page and should allow zoom for low-vision users.

---

## 2. Custom intake page — wireframe plan

Multi-step, one decision per screen, in the firm's real system: page background `#164863` deep navy; step cards `#fff`; primary buttons `#427d9d` with the site's signature `#9bbec8` left wedge (mirrors `a.cmn-btn:before`); step headlines in `'Bodoni Moda 18pt'` uppercase; microcopy/labels in `'Poppins'`; button labels in `'Jost'` uppercase; a thin `#d2b589` rule under each step headline (the tan accent appears once per screen, as on their attorney card).

```
┌──────────────────────────────────────────────────────────────┐
│ TOP BAR (navy #164863)                                        │
│ ALAGOOD CARTWRIGHT BURKE PC   ·   940-891-0003                │
│ Progress: ● 1 Contact → ○ 2 Your matter → ○ 3 Time → ○ 4 Reserve │
├──────────────────────────────────────────────────────────────┤
│ STEP 1 — "Get The Answers You Need"          (Bodoni, upper) │
│ ── tan #d2b589 rule ──                                       │
│ Microcopy: "Tell us how to reach you. An attorney from our   │
│ Denton office will be ready for your consultation — your     │
│ success is our primary concern."  (Poppins, #0d374c)         │
│                                                              │
│ [ Full name            ]                                     │
│ [ Email                ]                                     │
│ [ Phone                ]                                     │
│ Preferred way to reach you: ( Call ) ( Text ) ( Email )      │
│   ← segmented control, selected = #427d9d fill, white text   │
│                                                              │
│ Trust line (small, #787878): "This form does not create an   │
│ attorney-client relationship. Please don't include           │
│ confidential details yet."  ← their real disclaimer voice    │
│                                                              │
│ [ CONTINUE → ]   button #427d9d, #9bbec8 wedge, Jost upper   │
├──────────────────────────────────────────────────────────────┤
│ STEP 2 — "Trusted Legal Advice For Many Areas Of Life"       │
│ Microcopy: "What's going on? A sentence or two is plenty —   │
│ we help people find effective solutions to life's problems." │
│                                                              │
│ "Which of these sounds closest?" (tap one — optional chips;  │
│  each chip pre-starts the message box with those words)      │
│  [My job / employer] [A business or contract dispute]        │
│  [An injury or accident] [Property / real estate]            │
│  [A will, trust, or estate] [Something else]                 │
│  chips: outlined #427d9d, selected fill #427d9d              │
│                                                              │
│ [ What happened, briefly…                    ]  ← textarea   │
│ [ Who's on the other side? (employer, company, or person) ]  │
│    helper: "We use this only to check for conflicts."        │
│ [ Is there a deadline — a court, filing, or response date? ] │
│    ( date picker OR "No deadline / not sure" toggle )        │
│                                                              │
│ Consent block (light #9bbec8 panel, both boxes, plain type): │
│  ☐ It's OK for the firm to contact me about my inquiry.      │
│  ☐ I understand this form doesn't create an attorney-client  │
│    relationship.                                             │
│                                                              │
│ [ ← BACK ]                    [ CHOOSE MY TIME → ]           │
├──────────────────────────────────────────────────────────────┤
│ STEP 3 — "Schedule A Consultation"          (their real CTA) │
│ Microcopy: "Pick a time that works. Consultations are 30     │
│ minutes, Monday through Friday, with our Denton office."     │
│                                                              │
│  Day strip: Mon–Fri only (weekends shown greyed "Office      │
│  closed")                                                    │
│  Two windows, exactly as offered:                            │
│   MORNING   9:00 9:30 10:00 10:30 11:00  (CT)                │
│   AFTERNOON 1:30 2:00 2:30 3:00 3:30 4:00 4:30 (CT)          │
│  slot pills: white with #427d9d border; selected = solid     │
│  #427d9d; taken = #d1d1d1 strike                             │
│                                                              │
│ On selection, honest-hold banner appears (#9bbec8 panel,     │
│ #0d374c text):                                               │
│  "We'll hold Tuesday, July 21 at 2:00 PM CT for 15 minutes   │
│   while you reserve it. A $50.00 deposit secures the time;   │
│   if the deposit isn't completed, the time is released."     │
│  Countdown: "Held for 14:32" in Jost uppercase, #427d9d      │
│                                                              │
│ [ ← BACK ]                    [ RESERVE THIS TIME → ]        │
├──────────────────────────────────────────────────────────────┤
│ STEP 4 — "Reserve Your Consultation"                         │
│ Summary card (white, tan #d2b589 left border):               │
│   Tue, Jul 21 · 2:00–2:30 PM CT · 30-minute consultation     │
│   Reservation deposit: $50.00  (fixed, shown read-only —     │
│   never an editable field)                                   │
│ Microcopy: "Your deposit secures this time with our office.  │
│ You'll pay through our secure checkout — we never see your   │
│ card details."                                               │
│ [ PAY $50.00 & SECURE MY TIME → ] → hosted Stripe-style      │
│ checkout (sandbox-equivalent pre-launch)                     │
│ Trust line: lock icon + "Secure checkout · Deposit set by    │
│ the firm · Held time releases in MM:SS if not completed"     │
├──────────────────────────────────────────────────────────────┤
│ STEP 5 — CONFIRMATION (rendered ONLY after verified payment  │
│ webhook — never from the browser redirect alone)             │
│ State A (webhook verified): navy panel, Bodoni headline      │
│ "You're Confirmed." + "Your consultation is set for Tue,     │
│ Jul 21 at 2:00 PM CT. A confirmation is on its way to your   │
│ email. We look forward to helping you find an effective      │
│ solution."                                                   │
│ State B (redirect returned, webhook not yet verified):       │
│ "Almost there — we're verifying your payment. This usually   │
│ takes a few seconds; you'll receive confirmation by email.   │
│ Returning to this page alone does not confirm your time."    │
└──────────────────────────────────────────────────────────────┘
```

**Mobile behavior:** single column throughout; slot pills wrap 3-up with 44px+ tap targets; the hold banner + countdown becomes sticky at the bottom of step 3/4; CTAs full-width; progress dots collapse to "Step 2 of 4" text; **pinch-zoom allowed** (deliberate fix of the current site's `user-scalable=no`); the `#9bbec8` wedge collapses to a 4px top border on the button so the full-width CTA keeps the brand mark.

---

## 3. Field optimization

| # | Field (current 12) | Decision | Why |
|---|---|---|---|
| 1 | Full name | **KEEP** (step 1) | Identity + conflict check; classifier ignores it, intake can't. |
| 2 | Email | **KEEP** (step 1) | Confirmation + webhook receipt channel. |
| 3 | Phone | **KEEP** (step 1) | Firm's primary contact habit ("Call 940-891-0003"). |
| 4 | Preferred contact method | **KEEP** (step 1, segmented control) | One tap, zero typing; the firm already asks it. |
| 5 | Message | **KEEP** (step 2, reprompted "What happened, briefly") | This is the classifier's fuel — free text naturally yields "employer," "fired," "contract," "deposit," "deadline" keywords. |
| 6 | Consent to be contacted | **MERGE** into one consent block (step 2) | Two short checkboxes on one panel reads as one action; keeps TCPA cover without its own screen. |
| 7 | No-attorney-client acknowledgment | **MERGE** into same consent block (step 2) | Same legal moment, same panel — mirrors their existing single disclaimer line. |
| 8 | Employer / organization | **KEEP** (step 2, reframed "Who's on the other side?") | Opposing-party name is what a conflict check actually needs; the helper text says so, which builds trust. |
| 9 | Event date | **DEFER** to consultation | Classification doesn't need it; the narrative + deadline carry urgency. Asked live, with documents in hand. |
| 10 | Type of concern | **MERGE** into message via tappable concern chips | Chips ("My job / employer," "A business or contract dispute"…) seed the exact classifier keywords into the free text instead of a redundant dropdown. |
| 11 | Written notice received | **DEFER** to consultation | Yes/no detail that doesn't change classification or routing; the attorney asks it in the 30 minutes. |
| 12 | Filing / response deadline | **KEEP** (step 2, date-or-unsure) | Real urgency signal that replaces the site's vague "Case Urgency" dropdown and justifies earliest-slot routing. |

Nothing is fully **CUT** — every field either earns its place at first contact or is honestly better asked in the consultation it books.

**Final field count per step:**
- **Step 1: 4 visible fields** (name, email, phone, contact-method control) ✅ ≤5
- **Step 2: 3 fields + optional chips + 2 consent checkboxes** (message, opposing party, deadline)
- **Step 3: slot picker only** (0 form fields)
- **Step 4: hosted checkout only** ($50.00 read-only; 0 editable firm fields)
- **Total user-typed fields across the flow: 7** (down from 12)

---

## 4. Flow architecture

```
Homepage / practice-page CTA  "Schedule A Consultation"  (#427d9d, #9bbec8 wedge)
        │
        ▼
STEP 1 · Contact — 4 fields (name / email / phone / preferred method)
        │
        ▼
STEP 2 · Classification-eliciting inputs
        │   • Concern chips (optional) → seed classifier keywords
        │   • "What happened, briefly" → free text → deterministic
        │     keyword match across the ~25 topics
        │   • Opposing party → conflict check
        │   • Deadline date → urgency
        │   • Combined consent block (contact OK + no attorney-client)
        ▼
STEP 3 · Slot selection — Mon–Fri, 30-min slots, two windows:
        │   9:00–11:00 and 1:30–4:30 US Central
        │   Selection places a REAL 15-minute hold, shown honestly
        │   with a live countdown; expiry releases the slot.
        ▼
STEP 4 · $50.00 reservation deposit — fixed server-side, displayed
        │   read-only ("Deposit set by the firm"), framed as securing
        │   the held time, via hosted Stripe-style checkout
        │   (sandbox-equivalent until Stripe is live). Last step.
        ▼
STEP 5 · Confirmation rendered ONLY after the verified payment
            webhook. Browser redirect → "verifying payment" state,
            NEVER a confirmation.
```

**Exact honest-hold microcopy I'd ship (step 3, in the firm's partner voice):**

> "We'll hold **Tuesday, July 21 at 2:00 PM CT** for the next **15 minutes** while you reserve it. Your **$50.00 deposit** secures that time with our office — if the deposit isn't completed, the time is released for someone else who needs it. Your consultation is confirmed once your payment is verified, and we'll email you right away."

**Step-4 deposit framing (button + support line):**

> Button: **"Pay $50.00 & Secure My Time →"**
> Support: "Your deposit secures the time you're holding. It's set by the firm and paid through our secure checkout — we never see your card details."

**Step-5 anti-redirect language (so a bare return URL can never fake confirmation):**

> "Almost there — we're verifying your payment now. This usually takes a few seconds, and your confirmation will arrive by email. Please know that simply returning to this page does not confirm your appointment; your time is confirmed only after your payment is verified."

---

*All palette hexes, font stacks, taglines, and disclaimer language above were extracted from dentonlaw.com and its theme stylesheet on 2026-07-16. No firm claims, results, or credentials were invented; the board-certification and award mentions on the live About page informed trust placement but were not restated as new claims.*

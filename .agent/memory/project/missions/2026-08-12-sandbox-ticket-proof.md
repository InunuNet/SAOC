---
schema: athanor.mission/v1
slug: sandbox-ticket-proof
goal: Prove the existing single-tier ticket flow end to end against the PayFast sandbox
  on a deployed environment, then pause for council feedback before any multi-tier
  work
created_at: '2026-08-12T16:31:04.626500+00:00'
started_at: '2026-08-12T16:31:04.626500+00:00'
last_active_at: '2026-08-12T20:35:00+00:00'
status: in_progress
cost_estimate:
  features: 5
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  title: Deploy current main so the ticket flow exists in a deployed environment
  inline_brief: DONE. Deploy pushed 2026-08-12T20:35Z; verified live within 2 minutes.
    Commit `4212e88` now serving; `/tickets`, `/national-show/faq`, `/national-show/plan-your-visit`
    all return 200. Venue corrections from 427fbaf/8bfe0f0 now live (Stellenbosch Flying
    Club showing in 4 places, zero CTICC-era references).
  status: done
  milestone: M1
- id: F2
  title: Confirm SITE_URL resolves to a publicly reachable host at runtime
  inline_brief: DONE. The deployed checkout returns `return_url`, `cancel_url`, and
    `notify_url` all correctly built on `https://saoc-prod--saoc-webapp.europe-west4.hosted.app`.
    Verified by captured PayFast payload. ITN callbacks are delivered to this URL
    (publicly reachable, sufficient for sandbox).
  status: done
  milestone: M1
- id: F3
  title: Complete a real sandbox purchase end to end
  inline_brief: |-
    PARTIAL. The reservation half works: POST /api/tickets/checkout returns 201 with a
    valid PayFast payload, booking ref format SAOC-2027-C584G82Z7F6D, amount 150.00,
    sandbox process URL, and all three callback URLs correctly built on SITE_URL.

    Still unproven, and required to complete F3 - completing payment through the PayFast
    sandbox UI, the Firestore reserved -> paid transition on callback, and the
    confirmation page rendering the real booking ref.

    The merchant key IS now correct (a trailing tab was stripped and rolled out ~07:35 on
    2026-08-13; see docs/secret-corruption-incidents.md) - do not repeat the earlier note
    claiming the real key is still needed.

    IMPORTANT when testing: PayFast's sandbox 404s at /eng/process/finish/<uuid> even when
    the payment succeeded and the callback fired. Judge success from the ITN entry in Cloud
    Logging and the Firestore ticket status, never from PayFast's return page.

    Test data to clean up before UAT: 4 ticket documents (SAOC-2027-E8WND2SM4HTD,
    SAOC-2027-JG6Q598FG0QD, SAOC-2027-5H63FBAE8AHP, SAOC-2027-C584G82Z7F6D), all still
    'reserved', plus 2 contactSubmissions diagnostic documents.
  status: in_progress
  milestone: M2
- id: F4
  title: Verify the ITN webhook signature path against a real sandbox callback
  inline_brief: '`app/api/tickets/itn/route.ts` is sha256-pinned (A15 in contract-ticketing-hardening.yaml)
    — do NOT modify it; changing it requires the documented re-pin ceremony in `contracts/golden/ticketing-hardening/itn-write-guard.golden.md`.
    Confirm a genuine PayFast sandbox ITN is received, passes signature and source-IP
    validation, and marks the ticket paid. Also confirm a tampered/invalid ITN is rejected
    — a webhook that accepts everything passes the happy path too.


    PROGRESS 2026-08-13 — the REJECT half is PROVEN, unexpectedly and for real. Two genuine
    PayFast sandbox ITNs arrived at the deployed endpoint (Cloud Logging, 07:24:51 and
    07:30:10) for m_payment_id SAOC-2027-E8WND2SM4HTD and SAOC-2027-5H63FBAE8AHP, and both
    were rejected with "[tickets/itn] Signature mismatch — rejecting ITN". So: PayFast can
    reach the endpoint, the route runs, signature validation executes, and an ITN whose
    signature does not match is refused rather than blindly accepted. That is the half most
    webhooks get wrong, and it was proven by accident rather than by a crafted tamper test.

    The mismatch cause was OUR bug, not PayFast''s: PAYFAST_SANDBOX_MERCHANT_KEY carried a
    trailing tab (14 bytes, not 13) from .env.local into Secret Manager, so the signed
    payload never matched. Fixed and rolled out ~07:35. See docs/secret-corruption-incidents.md.

    STILL UNPROVEN: the ACCEPT path — a valid ITN passing signature AND source-IP validation
    and transitioning the ticket reserved -> paid. Retry a purchase now that the key is clean.
    Note the authoritative signal is the ITN log entry, NOT PayFast''s return page: their
    sandbox 404s at /eng/process/finish/<uuid> even when the payment and callback succeed.'
  status: pending
  milestone: M2
- id: F5
  title: Verify admission at the door, and record what is NOT yet proven
  inline_brief: Scan the purchased ticket through /admin door check-in and confirm
    a paid ticket admits once and is refused on a second scan. BLOCKED until Firebase
    Auth (Email/Password) is enabled on saoc-webapp — see needs-human.md; the admission
    logic in `lib/checkin.ts` is fixed and gate-green but no account can exist in any
    environment. If still blocked, record it as blocked rather than skipping silently.
    Also record the known gap that confirmation emails will NOT arrive (no Resend account;
    `lib/email.ts` swallows the failure by design, so purchase returns 201 while the
    email goes nowhere) — that is expected, not a ticketing defect.
  status: pending
  milestone: M3
milestones:
- id: M1
  title: The current ticket flow is actually deployed and reachable
  features:
  - F1
  - F2
  status: done
- id: M2
  title: A real sandbox payment completes and the webhook is trustworthy
  features:
  - F3
  - F4
  status: in_progress
- id: M3
  title: Admission verified, and every remaining gap named honestly
  features:
  - F5
  status: pending
---

# Mission: Prove the single-tier ticket flow end to end

## Context

**Brad's directive, 2026-08-12:** "Let's just do a single tier to test through the ticketing
system when our sandbox is up and happy... Then we can expand out into a multi-tier ticketing
system once we know it works. We can pause at the single tier until we get full feedback from
the end."

The point of this mission is to de-risk the payment path **once, cheaply**, rather than
discovering a gateway problem inside a five-product checkout. Nothing here builds new ticketing
capability — it proves what already exists actually works outside localhost.

### What already exists (do not rebuild)

The ticketing hardening work is contract-green at 37/37 (`contracts/contract-ticketing-hardening.yaml`):
transactional capacity that cannot oversell, buyer-bound idempotency, 30-minute reservation TTL,
60-bit booking references, a door scanner that fails closed on every unenumerated state, and
`SITE_URL` declared in `apphosting.yaml`. `/tickets` renders five types and a working PayFast
sandbox purchase form. Ticket reachability (header, home, `/national-show`) shipped separately.

**All of that has only ever been exercised on localhost.**

### Scope discipline

- **Single tier only.** Do NOT build Symposium, WOSA Conference, Workshops or Exhibitor as
  separate bookable products. That work is deliberately parked behind this mission's result AND
  council feedback — see the backlog entry of 2026-08-12.
- **Do not modify `app/api/tickets/itn/route.ts`.** It is sha256-pinned.
- **Do not switch PayFast to live credentials.** Sandbox only. Going live additionally requires
  real council prices and the DNS cutover — see the "Go-live: PayFast live credentials" backlog
  entry.
- **Do not change prices.** Every figure in the dataset is invented by us and rendered with a
  "Provisional price — pending council confirmation" label. That is correct until the council
  supplies real ones.

### Known blockers, named up front

- **Firebase Auth is not enabled** on `saoc-webapp`, so `/admin` and the door scanner are dead in
  every environment. F5 is blocked on it. Highest value per minute of Brad's time.
- **No Resend account**, so confirmation emails silently do not send. Expected; do not chase it
  as a bug during F3.
- **Real prices and venue capacity** are still unconfirmed by the council — the single most
  revenue-blocking open item, and a hard gate on going live (not on this mission).

## Progress (2026-08-12)

**M1 Complete** — Deployment succeeded; `/tickets`, `/national-show/faq`, `/national-show/plan-your-visit`
now return 200 on production. Venue corrections (Stellenbosch Flying Club) confirmed live. Sandbox merchant key
secured in Secret Manager after identifying and fixing a trailing-tab corruption in the earlier write.

**M2 Partial** — The reservation half (checkout → PayFast redirect) works and returns a valid booking
reference. Remaining: completing a live payment through the PayFast sandbox UI, verifying the Firestore
`reserved` → `paid` transition on ITN callback, confirming the confirmation page renders the booking ref.

**Known gap:** Two prior test reservations exist in Firestore (`SAOC-2027-JG6Q598FG0QD`, `SAOC-2027-C584G82Z7F6D`)
and two `contactSubmissions` records — test data from diagnostic probes, marked for cleanup before UAT.

**Also addressed today:** Three separate secret-corruption incidents in 16 weeks, all from the same defect class
(values decorated by extraction pipelines with no post-write verification). A standing practice recommendation
and candidate contract assertion are now documented in `docs/secret-corruption-incidents.md`. See `learned.md`
for the transferable lessons.

**Resume:** Run `python3 execution/mission.py resume` for F3 completion path.

## Notes

- Dev server is on port 3333 locally, not 3000.
- Assert behaviour over real HTTP round-trips for anything security- or money-relevant. Source
  greps are not evidence — this project has a documented history of false-green assertions.
- Every mutating check needs an explicit `timeout_seconds`; the 60s default caused four live
  dataset incidents by SIGKILLing checks mid-restore.

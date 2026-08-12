---
schema: athanor.mission/v1
slug: sandbox-ticket-proof
goal: Prove the existing single-tier ticket flow end to end against the PayFast sandbox
  on a deployed environment, then pause for council feedback before any multi-tier
  work
created_at: '2026-08-12T16:31:04.626500+00:00'
started_at: null
last_active_at: null
status: pending
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
  inline_brief: The deployed site is stale — `/tickets`, `/national-show/faq` and
    `/national-show/plan-your-visit` all 404 on saoc-prod--saoc-webapp.europe-west4.hosted.app
    while returning 200 locally. Last confirmed deploy was `01dd63f` on 2026-07-30;
    every August commit is undeployed. Nothing else in this mission can be tested
    until this lands. Push-to-main autodeploy IS armed (proven by assertion A10 in
    the F2 deploy work), so this may need nothing more than a push — verify a NEW
    build id and commit sha actually serve traffic rather than assuming.
  status: pending
  milestone: M1
- id: F2
  title: Confirm SITE_URL resolves to a publicly reachable host at runtime
  inline_brief: The ITN callback is delivered to whatever `SITE_URL` names. It is declared
    in `apphosting.yaml` as the hosted.app URL, which is public and sufficient for
    sandbox testing — beta.saoc.co.za is NOT required for this mission. Verify the
    value that actually resolves at runtime, not the value in the yaml; this project
    has a documented incident where a secret resolved to a corrupted payload and every
    outcome looked identical.
  status: pending
  milestone: M1
- id: F3
  title: Complete a real sandbox purchase end to end
  inline_brief: Buy one ticket through the deployed UI against sandbox.payfast.co.za
    — checkout → PayFast → return → confirmation page. Confirm the Firestore ticket
    document transitions `reserved` → `paid`, the booking reference is 60-bit random
    (not sequential), and the confirmation page renders the real reference. Assert
    over real HTTP round-trips, never source greps — this is money-relevant.
  status: pending
  milestone: M2
- id: F4
  title: Verify the ITN webhook signature path against a real sandbox callback
  inline_brief: '`app/api/tickets/itn/route.ts` is sha256-pinned (A15 in contract-ticketing-hardening.yaml)
    — do NOT modify it; changing it requires the documented re-pin ceremony in `contracts/golden/ticketing-hardening/itn-write-guard.golden.md`.
    Confirm a genuine PayFast sandbox ITN is received, passes signature and source-IP
    validation, and marks the ticket paid. Also confirm a tampered/invalid ITN is rejected
    — a webhook that accepts everything passes the happy path too.'
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
  status: pending
- id: M2
  title: A real sandbox payment completes and the webhook is trustworthy
  features:
  - F3
  - F4
  status: pending
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

## Notes

- Dev server is on port 3333 locally, not 3000.
- Assert behaviour over real HTTP round-trips for anything security- or money-relevant. Source
  greps are not evidence — this project has a documented history of false-green assertions.
- Every mutating check needs an explicit `timeout_seconds`; the 60s default caused four live
  dataset incidents by SIGKILLing checks mid-restore.

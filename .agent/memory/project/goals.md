# Goals

## Mission

Build and maintain the South African Orchid Council's digital presence and tooling. SAOC is the workspace for this project, running on the Athanor agentic framework.

## Active Goals

1. Establish what the SAOC project needs to build (website, membership system, events, etc.)
2. Keep the Athanor workspace healthy and in sync
3. Deliver working software for the South African Orchid Council

## Current Mission Status (updated 2026-08-12)

**Overnight four-stream session, all shipped in `be80580` — four contracts green and documented:**

- ~~`ticketing-hardening` — F6 payment/door security (37/37, @qa PASS)~~ ✅ Door scanner fails
  closed on every unenumerated state; capacity is a Firestore transaction; booking refs are
  60-bit crypto-random; checkout idempotency is bound to buyer and payload; abandoned
  reservations release on a TTL that can never expire a paid ticket; `SITE_URL` declared in
  `apphosting.yaml`. **@qa round 2 raised R2-1…R2-5, none fixed** — see `backlog.md`.
- ~~`show-visitor-info` (72/72)~~ ✅ Show identity now flows from the `nationalShow` singleton to
  all seven surfaces; Plan Your Visit, What to Expect and FAQ added, Sanity-editable and marked
  pending committee confirmation. **Round-2 fixes gate-verified but not re-reviewed by @qa.**
- ~~`cms-wiring-cleanup` (14/14, @qa PASS)~~ ✅ Event revalidation tags, archive detail merge,
  `province` wiring, two dead fields removed.
- ~~`show-exhibitor-info` (52/52)~~ ✅ Structured entry guide replacing the placeholder, built on
  researched international convention and marked pending, not stated as SAOC policy.
  **Round-2 fixes gate-verified but not re-reviewed by @qa.**

Still open on ticketing: **F5 (emailed QR ticket)**. Highest-value remaining work is @qa round 3
on Stream A and first round-2 review on B and D.

Two blockers are external, not code: **Firebase Auth is unprovisioned on `saoc-webapp`**, so
`/admin` and the door scanner are non-functional in every environment; and the committee still
owes real prices, capacity, venue, dates and every exhibitor rule. Both in `needs-human.md`.

### Prior status (2026-08-11)

`ticketing-pages` — M1+M2 (F1–F4) done, gate green 57/57. Public ticket flow exists end to end:
`/tickets` (buy page), `/tickets/confirmation` (honest pending/paid polling against the ITN
race), `/tickets/cancelled`, `/api/tickets/status`. Pricing, capacity, sales-open switch and all
visitor-facing copy are Sanity-controlled (`ticketType` docs + `ticketsPage` singleton +
`nationalShow.salesOpen`) — the payment code itself (`lib/payfast.ts`, the ITN route) never
imports Sanity, mechanically enforced. Dataset seeded with 5 provisional ticket types,
`salesOpen=true` for the demo. Docs: `docs/ticketing.md`, `docs/ticketing-for-editors.md`.
Remaining: F5 (emailed QR ticket), F6 (a11y + payment-security hardening — see backlog's F6 door
scanner / TOCTOU / idempotency items), F7 (docs + deploy config, incl. `SITE_URL` in
`apphosting.yaml`). See `reboot.md` for resume instructions.

`cms-activation-deploy` (prior mission) — 5 of 6 features done; F6 (Studio edit → live site) was
BLOCKED on a Firebase App Hosting CDN edge, since resolved by the later `cms-loop-and-wiring`
mission (bounded-staleness `revalidate = 60` fix, see `learned.md`).

# Goals

## Mission

Build and maintain the South African Orchid Council's digital presence and tooling. SAOC is the workspace for this project, running on the Athanor agentic framework.

## Active Goals

1. Establish what the SAOC project needs to build (website, membership system, events, etc.)
2. Keep the Athanor workspace healthy and in sync
3. Deliver working software for the South African Orchid Council

## Current Mission Status (updated 2026-08-11)

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

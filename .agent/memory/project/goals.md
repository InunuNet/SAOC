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

### admin-auth-hardening (started 2026-08-14, in progress)

M1 (auth gate closed + proven + provisioning) done and gated. **F4 (Google sign-in) done
2026-08-15**, gate green 6/6 — claim-first provisioning design, see `learned.md`. **F5
(Microsoft + Apple sign-in) PARKED by user decision.**

**2026-08-15, post-ship:** F4 met reality and needed three real fixes a green gate could not
catch — invisible login inputs (and the identical defect on `/admin`/`/admin/door` one click
behind it), a missing deployed `ADMIN_EMAIL_ALLOWLIST`, and `beta.saoc.co.za` not yet in
Firebase's authorised domains. All three fixed (`79ee2f8`, `93c5855`, `22397a1`), verified by
browser against the live build, and **F4 is now proven end to end by a human** — Brad signed in
with Google and reached `/admin` with real ticket data, same Firebase uid throughout, no second
account. This closes F6's admin half. **F6's door-scanner half is still `pending`, milestone
M3** — not yet proven at a real entrance by a human. New standing rule added to `rules.md`:
"Visual work is not done until a browser has seen it." See `backlog.md`
"admin-auth-hardening" section and `learned.md` "F4 meets reality" for full detail.

### 2026-08-16 — safety scanner shipped ahead of mission chain, ticketing still blocked on the pin

Out-of-mission session (active mission checkpoint stayed at M2/F4, unchanged) shipped three
commits: `f7155fe` live-dataset residue scanner + CI guard (DONE), `2828d0a` PayFast ITN
signature helpers (BLOCKED — route stays sha256-pinned, no ticket can reach `paid` until Brad
authorizes the re-pin ceremony), `011d98b` WCAG accent-contrast audit (HELD for Brad's design
call, no production code). Also repaired a live content defect found this session: the
`/national-show` H1 had been serving a leftover `F3-TITLE-SENTINEL-*` string with a
2098-12-31 countdown for ~3 days — restored from seed, revalidated, verified. **The PayFast
pin-lift is now the single blocker standing between the codebase and F6 (door check-in proven
end to end) / go-live** — see `backlog.md` "Session 2026-08-16" section.

### 2026-08-16 (afternoon) — P1 weak-assertion audit: DONE, no live vulnerability

~~P1 weak-assertion audit across payment/auth-security contracts~~ ✅ Every audited property
(admin claim enforcement, ITN signature, amount match, server-confirm gating, transaction
atomicity, idempotent replay) verified correctly implemented in the actual code; the assertions
guarding several of them were weak enough that stub handlers with only comment-level keywords
passed them. Fixed across `650d02c` through `f4a37bd` (six commits) — see `backlog.md` and
`learned.md` for full detail and the reusable "retire via `exit 77` + `SUPERSEDED:`" remedy for
contracts that go red because the code improved. **New open finding, not yet explained:** the
Firestore `tickets` fixture-leak count is climbing session over session (5→12→17 docs) despite
checks calling `withCleanup()` — root cause unmeasured, tracked in `backlog.md`. The PayFast
sha256-pin lift (Brad's call) remains the single blocker on F6/go-live; untouched this session.

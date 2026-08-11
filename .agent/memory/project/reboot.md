# Reboot Context
_Generated: 2026-08-11T22:00Z_

## What happened last session
Session 2026-08-11 (continued): mission `ticketing-pages` M1+M2 (F1–F4) delivered and
gate-green (57/57 shell assertions). The public ticket flow now exists: `/tickets` (buy page),
`/tickets/confirmation` (honest pending/paid polling, handles the ITN race), `/tickets/cancelled`,
plus `app/api/tickets/status`. Pricing, capacity, sales-open switch and all visitor-facing copy
are Sanity-controlled (`ticketType` docs + `ticketsPage` singleton + `nationalShow.salesOpen`);
the payment code itself never imports Sanity (mechanically enforced, A51/A52). Docs written:
`docs/ticketing.md` and `docs/ticketing-for-editors.md` (plain-language guide for Lee-Ann).
Sanity dataset seeded with 5 ticket types, `salesOpen=true` for tomorrow's demo. QA went past its
brief and found two real pre-existing security gaps (door scanner admits unpaid tickets; capacity
TOCTOU race) — both logged below and in `backlog.md`, neither fixed yet.

---

# START HERE — resume instructions (2026-08-11, ~22:00)

## Active mission: `ticketing-pages` — M1+M2 done, M3/M4 (F5–F7) not started

`.agent/memory/project/missions/2026-08-11-ticketing-pages.md` (7 features, 4 milestones).

- **M1 (F1)** — done. CMS-controlled pricing/capacity/sales-open switch.
- **M2 (F2–F4)** — done, gate green 57/57. `/tickets`, `/tickets/confirmation`,
  `/tickets/cancelled` all live and working against the demo dataset.
- **M3 (F5, pending)** — emailed QR ticket via Resend on confirmed payment. Closes the loop with
  the existing door scanner at `/admin/door`, which today has nothing real to scan.
- **M4 (F6/F7, pending)** — accessibility/responsive pass + payment-security hardening (F6);
  docs/deploy-config/secretary handover (F7, includes `SITE_URL` in `apphosting.yaml`).

**TO RESUME:** `python3 execution/mission.py resume`, then dispatch @architect for F5's contract
(F5 depends on Resend being configured — check `RESEND_API_KEY` status in `backlog.md`'s
"Blocked (awaiting Brad)" section first, it may still be unset).

### Demo status (tomorrow, 2026-08-12)
Brad demos to Lee-Ann tomorrow morning and to the council tomorrow night. M2 (the three pages) IS
the demo and is ready: dev server has `/tickets` → checkout → PayFast sandbox → `/tickets/confirmation`
working end to end, `salesOpen=true`, 5 provisional ticket types seeded and clearly labelled
"Provisional price — pending council confirmation." Do not let F5/F6/F7 delay or complicate the
demo — they are the follow-up pass.

## Known bugs found this session — not yet fixed, all logged in backlog.md
1. **Door scanner admits unpaid tickets (HIGHEST ticketing priority for F6).**
   `app/api/admin/checkin/route.ts` never checks `status === 'paid'` or `showId` — a merely
   `reserved` ticket is as admissible as a paid one.
2. **TOCTOU race on ticket capacity.** `app/api/tickets/checkout/route.ts`'s capacity check is an
   unguarded read-then-write; @qa reproduced overselling live (54/50 on a 50-capacity type under
   5 concurrent POSTs). Needs Firestore `runTransaction`.
3. **Checkout idempotency + booking-ref enumeration.** No duplicate-POST protection beyond the
   client disabling its submit button; booking refs are guessable 6-digit numbers.
4. **`SITE_URL` still absent from `apphosting.yaml` (F7).** Works locally; a real deploy would
   send PayFast's ITN callback to the old Joomla site (`https://saoc.co.za`) and every deployed
   payment would sit permanently `reserved`.

## Contract-design lesson to carry forward (see learned.md "PayFast Ticketing — Milestone M1+M2")
Grep-based assertions produced false greens three times this session (comments matching a
substring, not the actual behaviour) and once let a real bug (no server-side capacity
enforcement) pass under a "sold out" string match. When writing the F5/F6 contract, assert
behaviour (a real HTTP round-trip, a real concurrent-request test) wherever the thing being
checked is security- or money-relevant — not a source grep.

## Sibling mission `saoc-pages-editable` — still M1 complete, F3/F4/F5 pending (unchanged)
F1 (hero `_key` fix) and F2 (editability audit) done, gate green on 4 assertions. Audit at
`.agent/memory/project/f2-editability-audit.md` — ~75 hardcoded fields, ranked. Not touched this
session; still queued behind `ticketing-pages`.

## Carried-over blockers (unchanged from before this session)
1. **`scripts/seed-page-singletons.ts` uses destructive `createOrReplace`** across six
   singletons — running it silently reverts any editor's Studio changes. No content lost yet
   (verified via Sanity history API), but it must become preserve-existing/create-if-absent
   before Lee-Ann is handed real Studio access. The `ticketing-pages` mission's own seed script
   (`scripts/seed-ticketing.ts`) was written create-if-absent-only deliberately — use it as the
   reference pattern when fixing this one.
2. **Was "Judges Training" ever meant to be its own page?** No route or component exists; only a
   "Becoming a Judge" section inside `/judging`. Still blocks a credible F3 estimate on
   `saoc-pages-editable`. Awaiting Brad.
3. **Real ticket prices and venue capacity from the council** — the single most revenue-blocking
   open item; everything live in the demo dataset is an invented placeholder.

## Process note (still applies)
Brad's correction, and it stands: **plan → write mission to disk → wrap up → compact → resume.**
Do not run a build chain in a context that is nearly spent. Wrapping up first is not overhead.

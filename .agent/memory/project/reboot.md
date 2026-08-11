# Reboot Context
_Generated: 2026-08-11T18:55Z_

## What happened last session
Session 2026-08-11 evening: PayFast sandbox configured and verified end-to-end against Brad's own sandbox account (signed payload accepted, payment session minted, payment page rendered). Fixed checkout SITE_URL hardcoded to old Joomla origin. Mission saoc-pages-editable M1 COMPLETE: F1 hero _key fix (seed-page-singletons.ts generates+backfills _key, live data repaired, gate green on 4 assertions, verified no image re-upload and no other keyless arrays) and F2 editability audit (~75 hardcoded fields ranked). Discovered blocker: seed-page-singletons.ts createOrReplace silently reverts editor content across 6 singletons (no loss tonight, verified via Sanity history API). Planned+activated mission ticketing-pages, contract contract-ticketing-m1-m2.yaml with 57 shell assertions and full goldens delivered; dev dispatched then STOPPED before writing anything - resumes fresh next session. Council discussion points added: document custody governance, society iCal feed aggregation.

---

# START HERE — resume instructions (2026-08-11, ~21:00)

## Active mission: `ticketing-pages` — ready to build, nothing written yet

`.agent/memory/project/missions/2026-08-11-ticketing-pages.md` (7 features, 4 milestones).
**Contract and goldens are COMPLETE and validated. No implementation exists on disk.**

- Contract: `contracts/contract-ticketing-m1-m2.yaml` — **57 shell assertions**, YAML valid,
  covers F1–F4 (M1+M2). Zero `agent_review` assertions.
- Goldens: `contracts/golden/ticketing-m1-m2/` — 11 files. Read `README.md` first.

**TO RESUME: dispatch @dev against the contract and goldens.** A dev agent was dispatched and
then stopped before touching a single file — verified, working tree clean of ticketing code.
Do not re-run @architect; the contract is the authority.

### HARD DEADLINE
Brad demos to Lee-Ann **tomorrow morning** and to the council **tomorrow night (2026-08-12)**.
Priority M1 → M2. **M2 (the three pages) IS the demo.** F5 (emailed QR ticket), F6 (a11y +
security hardening) and F7 (docs) are the follow-up pass — do not let them delay the pages.

### Decisions settled tonight — do not reopen
- **SAOC branding for ticketing.** Show branding is coming but is a SEPARATE LATER PASS. Do not
  anticipate or mock it up. Use the existing Sage & Paper system in `app/globals.css`; no new
  tokens, colours or fonts.
- **All visitor-facing copy must be Sanity-editable** — `ticketsPage` singleton, 15 fields, every
  heading/message/button label. The line: **anything a visitor reads is content; anything that
  moves money is code.** Mechanically enforced (A51/A52 assert `lib/payfast.ts` and the ITN route
  never import Sanity).
- **Sales default CLOSED**; checkout returns 403 on direct POST when closed. Prices are
  provisional and must be visibly labelled so — the council has never confirmed real prices.
- **Never modify `app/api/tickets/itn/route.ts`** — asserted byte-identical via SHA-256 (A43).
- Seeding is create-if-absent ONLY. Never `createOrReplace`. Never touch `seed-page-singletons.ts`.

## PayFast sandbox — DONE, do not redo
Brad's own sandbox credentials in `.env.local`, custom passphrase matched both sides. Verified
live: `sandbox.payfast.co.za` accepted a signed payload, minted a payment session and rendered the
payment page ("SAOC 2027 National Show Ticket / R 150.00"). Test tickets cleaned from Firestore.
`SITE_URL` is set locally and read at request time — **still absent from `apphosting.yaml`**
(mission F7), so a deployed ITN would use the fallback origin and never arrive.

## Sibling mission `saoc-pages-editable` — M1 COMPLETE, F3/F4/F5 pending
F1 (hero `_key`) and F2 (audit) done, M1 gate green on 4 real assertions. Audit at
`.agent/memory/project/f2-editability-audit.md` — ~75 hardcoded fields, ranked.

## BLOCKER affecting both missions
`scripts/seed-page-singletons.ts` uses `createOrReplace` with hardcoded literals across six
singletons — running it silently reverts any editor's Studio changes. **No content was lost
tonight** (verified by diffing against pre-seed state via the Sanity history API; only
`nationalShow.countdownDate` changed, and only its timezone representation — same instant).
Must become preserve-existing/create-if-absent before Lee-Ann is handed Studio.

## Awaiting Brad
1. **Was "Judges Training" ever meant to be its own page?** No route or component exists; only a
   "Becoming a Judge" section inside `/judging`. Blocks a credible F3 estimate on the sibling
   mission.
2. Real ticket prices and venue capacity from the council — the item most directly blocking revenue.

## Process note
Brad's correction, and it stands: **plan → write mission to disk → wrap up → compact → resume.**
Do not run a build chain in a context that is nearly spent. Wrapping up first is not overhead.

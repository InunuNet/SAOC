# Reboot Context
_Generated: 2026-08-13T00:00Z_

## What happened in this session (2026-08-12, evening through night)

### Venue Residue Remediation (commit 8bfe0f0)
Full remediation chain for CTICC residue that the earlier sweep (`427fbaf`) missed. Two new contracts:

- **`contract-venue-seed-truth.yaml`** (16 assertions) — purged CTICC from `lib/data/shows.ts`,
  `lib/data/events.ts`, `scripts/seed-page-singletons.ts`, `scripts/seed-show-visitor-info.ts`.
- **`contract-venue-prose-residue.yaml`** (31 assertions) — corrected three Sanity FAQs + seed source +
  golden JSON. Carried venue-describing prose ("modern convention centre", "parking garages") without
  naming it, so name-only sweep missed them.
- New doc: `docs/venue-prose-residue.md`. Updated: `docs/show-visitor-info.md`, helpers.
- Five orchestration lessons logged in `learned.md` (uncommitted-work risk, self-inflicted misdiagnosis,
  surgical-edit discipline, brief-imprecision, tool-vs-spec conformance).

### Secret Corruption Incidents (2026-08-12, incident root cause found and documented)
Three separate incidents in 16 weeks (F2 July, F3 incidents Aug) share one defect class: values
extracted via pipelines that silently decorate them (dotenv banner, trailing whitespace, stray chars)
with no verification after writing. All reached production looking like different problems (auth
failures, gateway misconfigurations, hung transactions).

- **F2 (July):** `SANITY_REVALIDATE_SECRET` + `SANITY_API_TOKEN` stored with 80–95 bytes of dotenv
  banner prose prepended.
- **F3 parallel (Aug 12):** `PAYFAST_SANDBOX_MERCHANT_KEY` stored with trailing tab (14 bytes, not 13).
- **F3 main (Aug 12):** `FIREBASE_ADMIN_CLIENT_EMAIL` stored with stray `Y\n` (61 bytes, not 59) —
  corrupted since 2026-06-23, never surfaced until `/api/contact` and `/api/tickets` went live today.

**Fixes:** Re-write all three using `printf '%s' | --data-file=-`, verify by SHA-256 + byte length,
force rollout. **Standing recommendation:** post-write verification as a contract assertion.

**Documentation:** `docs/secret-corruption-incidents.md` (root cause, ruled-out hypotheses, verification
practice, mandatory-rollout-on-secret-change fact). Lessons added to `learned.md`.

### Mission `sandbox-ticket-proof` — M1 Complete, M2 Partial (2026-08-12)

Status: **active**, partially complete. Resume with `python3 execution/mission.py resume`.

- **F1 DONE:** Deploy pushed; commit `4212e88` now serving. `/tickets`, `/national-show/faq`,
  `/national-show/plan-your-visit` all 200. Venue corrections live (Stellenbosch Flying Club, zero
  CTICC refs).
- **F2 DONE:** `SITE_URL` verified as it resolves at runtime — checkout returns correct PayFast URLs
  built on `https://saoc-prod--saoc-webapp.europe-west4.hosted.app`.
- **F3 PARTIAL:** Reservation works — `POST /api/tickets/checkout` returns 201 with valid payload,
  booking ref `SAOC-2027-C584G82Z7F6D`, sandbox process URL. Still unproven: PayFast sandbox UI
  payment completion, Firestore `reserved` → `paid` transition, confirmation page render. Note: two
  test reservations + two contact submissions exist in Firestore from diagnostics — marked for cleanup.
- **F4/F5 unchanged:** F5 still blocked on Firebase Auth (Email/Password) enablement.

**Also resolved in deploy:** CI now matches App Hosting builder's BUILD-availability variables exactly
(was too broken to catch failures — dataset secret resolved empty, token secret missing, Node 20 vs 22).

## Do not touch

Per Brad's standing instruction (2026-08-12), `branding/`, `design spec/`, and
`design/Claude Design HTML/` are being reorganised by hand and are off-limits to every agent
until he says otherwise — not even a hygiene pass. See `backlog.md` "Standing rule (2026-08-12,
Brad)".

## Live blockers (verify current state against `backlog.md` rather than trusting this list)

- **Firebase Auth (Email/Password) not enabled on `saoc-webapp`** — blocks `/admin` and the door
  scanner in every environment. F5 of the active mission is blocked on this. Brad to unblock.
- **Real council ticket prices + venue capacity unconfirmed** — top revenue blocker, also a hard
  gate on going live. Content input required from the committee.
- **No Resend account** — confirmation emails silently do not send (contact form + ticket
  purchase both degrade silently by design, not a new bug).
- **Sandbox merchant key now secured** (fixed trailing-tab corruption today); merchant key in
  `.env.local` also trimmed. PayFast checkout now works on production sandbox.

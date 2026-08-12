# Reboot Context
_Generated: 2026-08-12T20:35Z_

## What happened last session (evening, commit 8bfe0f0)

Full remediation chain for CTICC venue residue that the earlier venue-name sweep (`427fbaf`)
missed. Two new contracts, both gate-green and independently verified by the orchestrator (not
just self-reported):

- **`contract-venue-seed-truth.yaml`** (16 assertions) — purged "Cape Town International
  Convention Centre" from `lib/data/shows.ts`, `lib/data/events.ts`,
  `scripts/seed-page-singletons.ts`, `scripts/seed-show-visitor-info.ts`. Seeds are
  `createIfNotExists`, so the stale copy was inert today, but any future rebuild-from-empty would
  have regressed the venue.
- **`contract-venue-prose-residue.yaml`** (31 assertions) — corrected three live Sanity FAQ
  documents (`showFaq-accessibility-1`, `showFaq-getting-there-1`, `showFaq-getting-there-2`)
  plus `showVisitorInfo.publicTransport`, the seed source, and the `show-visitor-info` golden
  JSON. These carried prose that *described* the old venue's characteristics ("modern convention
  centre", "parking garages") without naming it, so the name-only sweep missed them.
- New doc: `docs/venue-prose-residue.md`. Updated: `docs/show-visitor-info.md`,
  `docs/show-visitor-info-for-editors.md`.
- Five orchestration-discipline lessons from this chain (uncommitted-work risk, self-inflicted
  misdiagnosis, surgical-edit discipline, brief-imprecision propagation, tool-vs-spec
  conformance) are in `learned.md` under "Orchestration Discipline — Venue Residue Remediation".

## Active mission — `sandbox-ticket-proof`

Status: `pending`, not yet started. Resume point is **F1** (deploy current `main`).
`.agent/memory/project/missions/2026-08-12-sandbox-ticket-proof.md` has full detail; resume with
`python3 execution/mission.py resume`.

**Verified stale as of this wrap-up (commit `8bfe0f0`, checked live 2026-08-12T18:28Z):**
`https://saoc-prod--saoc-webapp.europe-west4.hosted.app/` still serves the build from `01dd63f`
(2026-07-30) — `/tickets` returns a live 404 in production while returning 200 locally. Every
commit since 2026-08-01, including today's venue corrections, is undeployed. F1's eventual push
will ship the venue-residue fix alongside everything else queued since 2026-08-01.

F5 (door check-in) remains blocked on Firebase Auth (Email/Password) not being enabled on
`saoc-webapp` — no account can exist in any environment until that changes. This is Brad's to
unblock, logged in `needs-human.md`.

## Do not touch

Per Brad's standing instruction (2026-08-12), `branding/`, `design spec/`, and
`design/Claude Design HTML/` are being reorganised by hand and are off-limits to every agent
until he says otherwise — not even a hygiene pass. See `backlog.md` "Standing rule (2026-08-12,
Brad)".

## Live blockers (verify current state against `backlog.md` rather than trusting this list)

- **Firebase Auth (Email/Password) not enabled on `saoc-webapp`** — blocks `/admin` and the door
  scanner in every environment. F5 of the active mission is blocked on this.
- **Deployed site stale at `01dd63f`** (2026-07-30) — reconfirmed live 2026-08-12T18:28Z. F1 of
  the active mission.
- **Real council ticket prices + venue capacity unconfirmed** — top revenue blocker, also a hard
  gate on going live.
- **No Resend account** — confirmation emails silently do not send (contact form + ticket
  purchase both degrade silently by design, not a new bug).

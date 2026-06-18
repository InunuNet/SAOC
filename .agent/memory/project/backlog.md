# Athanor Issue Backlog

## SAOC Project — Active (Phase 1 scope only)

_Last compacted: 2026-06-18 by session. Full history: git log on this file._

- [x] **Phase A: Foundation** — Next.js + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting (InunuNet) + lint/format + CI. (saoc-full-platform MA, A1–A9, done 2026-06-12)
- [x] **Phase B: 8 static content pages** — Home, About, Societies, National Show, Judging, Judges Training, Contact, Sponsors — CMS-driven from Sanity. (saoc-full-platform MB, B1–B7, done 2026-06-12)
- [x] **Phase C: Events calendar page** — Sanity-sourced, month-grouped, ICS export. (saoc-full-platform MC, done 2026-06-12) ⚠️ Note: member-only event submission form built as C5 is Phase 2 scope — shipped but not linked in Phase 1 UI.
- [x] **Phase D (partial): 2027 Show ticketing** — D1 (Resend email), D3 (Firestore ticket model), D5 (admin dashboard), D6 (door check-in) done 2026-06-13. D2 (payment gateway) and D4 (buy flow) BLOCKED — pending payment account setup.
- [x] **Phase E: SEO, Secretary training, launch checklist** — E4 22/22, E5 19/19, E6 14/14 — all PASS 2026-06-13.
- [ ] **D2: Payment gateway** — BLOCKED. Proposal specifies Yoco; Yoco SA signup was broken 2026-06-06. Re-check Yoco availability before committing to Stripe fallback. Brad to attempt Yoco signup again or confirm Stripe SA account ready.
- [ ] **D4: Ticket buy flow** — BLOCKED pending D2 (payment gateway). Scope: checkout UI, purchase confirmation, Firestore ticket write, email confirmation via Resend.
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before launch. Setup guide: docs/email-dns-setup.md. Brad to add DNS records once Resend domain verified.
- [ ] **Domain transfer** — saoc.co.za to Inunu Net registrar. Brad to initiate. R172.50 once-off.
- [ ] **DNS cutover** — point saoc.co.za to Firebase App Hosting. Requires domain transfer complete + SPF/DKIM/DMARC in place.
- [ ] **Live Yoco test transactions + cross-browser dry-run** — Phase 1 launch gate. Run after D2/D4 complete.

## Blocked (awaiting Brad)
- **Payment account**: Attempt Yoco SA signup again (was broken 2026-06-06, may be resolved). Fallback: Stripe SA. Either must be in place before D2/D4 can proceed.
- **DNS records**: SPF/DKIM/DMARC + Firebase hosting A-record. Brad to add after Resend domain verified.
- **Domain transfer**: saoc.co.za from current registrar to Inunu Net.

## Phase 2 — Out of scope (do not work on until Phase 1 ships)
- Society individual pages + admin logins + federated ticketing
- Paid SAOC membership (Yoco recurring billing) + members-only area
- Digital archive of Orchids South Africa yearbooks
- Donation system, sponsorship management, Google Ad Grant
- Learning library, judges training portal, articles/video

## Resolved
- Hosting research (2026-06-13): Stay on Firebase App Hosting. Deliverable: `documents/hosting-research-2026-06-13.md`.

## Harness Upstream (Athanor → InunuNet/Athanor)
- [ ] **[athanor-upstream] sync-autonomy v2** — `set-autonomy LEVEL=high` should propagate to `.claude/settings.json` permissionMode. Filed 2026-06-16.
- [ ] **[athanor-upstream] mission.py slug fix** — cross-date slug scan fix needs upstreaming via `make update-template`. Filed 2026-06-16.

## Deferred (auto-tracked)
- [ ] [dev 2026-06-18] Factory loop script needs error handling — Out of scope for this task _(priority: low, handoff: 20260618T075409-dev.json)_

_Last compacted: 2026-06-19 by session. Dismissed: all check_own_comms pulse items through 20260618123944, qa-guard pings, quota-monitor alerts. All informational, no action required. Full history: git log on this file._

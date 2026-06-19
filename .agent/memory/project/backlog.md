# Athanor Issue Backlog

## SAOC Project — Active (Phase 1 scope only)

_Last compacted: 2026-06-18 by session. Full history: git log on this file._

- [x] **Phase A: Foundation** — Next.js + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting (InunuNet) + lint/format + CI. (saoc-full-platform MA, A1–A9, done 2026-06-12)
- [x] **Phase B: 8 static content pages** — Home, About, Societies, National Show, Judging, Judges Training, Contact, Sponsors — CMS-driven from Sanity. (saoc-full-platform MB, B1–B7, done 2026-06-12)
- [x] **Phase C: Events calendar page** — Sanity-sourced, month-grouped, ICS export. (saoc-full-platform MC, done 2026-06-12) ⚠️ Note: member-only event submission form built as C5 is Phase 2 scope — shipped but not linked in Phase 1 UI.
- [x] **Phase D (partial): 2027 Show ticketing** — D1 (Resend email), D3 (Firestore ticket model), D5 (admin dashboard), D6 (door check-in) done 2026-06-13. D2 (payment gateway) and D4 (buy flow) BLOCKED — pending payment account setup.
- [x] **Phase E: SEO, Secretary training, launch checklist** — E4 22/22, E5 19/19, E6 14/14 — all PASS 2026-06-13.
- [ ] **D2: Stripe SA payment gateway** — BLOCKED pending Brad's Stripe SA account setup. Yoco online payments confirmed still on waitlist 2026-06-18 ("temporarily limiting new online payment activations") — Stripe is the confirmed gateway. Brad to create Stripe SA account and supply publishable + secret keys.
- [ ] **D4: Ticket buy flow** — BLOCKED pending D2 (payment gateway). Scope: checkout UI, purchase confirmation, Firestore ticket write, email confirmation via Resend.
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before launch. Setup guide: docs/email-dns-setup.md. Brad to add DNS records once Resend domain verified.
- [ ] **Domain transfer** — saoc.co.za to Inunu Net registrar. Brad to initiate. R172.50 once-off.
- [ ] **DNS cutover** — point saoc.co.za to Firebase App Hosting. Requires domain transfer complete + SPF/DKIM/DMARC in place.
- [ ] **Live Yoco test transactions + cross-browser dry-run** — Phase 1 launch gate. Run after D2/D4 complete.

## Blocked (awaiting Brad)
- **Stripe SA account**: Brad to create at stripe.com — Yoco online payments confirmed on waitlist with no ETA (verified 2026-06-18). Stripe is the confirmed gateway. Supply `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `STRIPE_SECRET_KEY` to unblock D2/D4.
- **DNS records**: SPF/DKIM/DMARC + Firebase hosting A-record. Brad to add after Resend domain verified.
- **Domain transfer**: saoc.co.za from current registrar to Inunu Net.

## Phase 2 — Out of scope (do not work on until Phase 1 ships)
- Society individual pages + admin logins + federated ticketing
- Paid SAOC membership (Yoco recurring billing) + members-only area
- Digital archive of Orchids South Africa yearbooks
- Donation system, sponsorship management, Google Ad Grant
- Learning library, judges training portal, articles/video

## Hosting — Under Review (2026-06-19)
Previous verdict (2026-06-13): stay on Firebase. Brad now wants a Node.js host with a **South African data centre** — Firebase only has europe-west4 (Netherlands). New research needed before DNS cutover decision. Known SA-viable options: Fly.io (Johannesburg `jnb` ✅ verified), Coolify on Hetzner JNB VPS. Vercel not yet evaluated. Goal: SSR Next.js 15 App Router in SA, auto-deploy on push, minimal cost. Prior research at `documents/hosting-research-2026-06-13.md`.

## Harness Upstream (Athanor → InunuNet/Athanor)
- [ ] **[athanor-upstream] sync-autonomy v2** — `set-autonomy LEVEL=high` should propagate to `.claude/settings.json` permissionMode. Filed 2026-06-16.
- [ ] **[athanor-upstream] mission.py slug fix** — cross-date slug scan fix needs upstreaming via `make update-template`. Filed 2026-06-16.

## Deferred (auto-tracked)
- [ ] [dev 2026-06-18] Factory loop script needs error handling — Out of scope for this task _(priority: low, handoff: 20260618T075409-dev.json)_

_Last compacted: 2026-06-19 by session. Dismissed: all check_own_comms pulse items, qa-guard pings, quota-monitor alerts through 2026-06-19. All informational, no action required. Full history: git log on this file._

- [ ] SAOC (Misc): [qa-guard] Checking: Gemini Harness → InunuNet/Athanor

- [ ] SAOC (Misc): [quota-monitor] Athanor: no active mission

- [ ] SAOC (Misc): New Event: check_own_comms-20260618131736.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618132838.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618134033.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618135133.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618140314.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618141559.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618142749.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618154722.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618160153.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618161633.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618163213.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618164507.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618170025.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618172251.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618173817.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618180446.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260618184625.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619093223.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619094413.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619095633.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619100923.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619102033.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619103204.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619104316.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619105446.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619110518.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619123021.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619124148.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619125446.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619130615.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619131802.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619132930.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619134101.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619135229.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619140317.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619141431.txt

- [ ] SAOC (Misc): New Event: check_own_comms-20260619142630.txt

# Athanor Issue Backlog

## SAOC Project — Active (Phase 1 scope only)

_Last compacted: 2026-06-18 by session. Full history: git log on this file._

- [x] **Phase A: Foundation** — Next.js + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting (InunuNet) + lint/format + CI. (saoc-full-platform MA, A1–A9, done 2026-06-12)
- [x] **Phase B: 8 static content pages** — Home, About, Societies, National Show, Judging, Judges Training, Contact, Sponsors — CMS-driven from Sanity. (saoc-full-platform MB, B1–B7, done 2026-06-12)
- [x] **Phase C: Events calendar page** — Sanity-sourced, month-grouped, ICS export. (saoc-full-platform MC, done 2026-06-12) ⚠️ Note: member-only event submission form built as C5 is Phase 2 scope — shipped but not linked in Phase 1 UI.
- [x] **Phase D (partial): 2027 Show ticketing** — D1 (Resend email), D3 (Firestore ticket model), D5 (admin dashboard), D6 (door check-in) done 2026-06-13. D2 (payment gateway) and D4 (buy flow) BLOCKED — pending payment account setup.
- [x] **Phase E: SEO, Secretary training, launch checklist** — E4 22/22, E5 19/19, E6 14/14 — all PASS 2026-06-13.
- [x] **Chrome wiring** — Mounted real UtilityBar/Header/Footer in `app/layout.tsx` (was a TODO placeholder). UtilityBar pills + mono tagline, MobileMenu logo lockup fixed. QA 7/7 PASS, build clean. (commits 01ceb4a + b49ff7b, done 2026-06-23)
- [x] **Design-verify pass** — Post-chrome visual audit + fix. globals.css full token set (semantic colours, type scale, spacing, semantic classes), header abbreviated to "SA Orchid Council", hero display-xl/lg clamp scale, `radius-0` enforced across 8 card components. Site reads professional + editorial. (commit 35c9cbb, mission 2026-06-23-design-verify, done 2026-06-23)
- [x] **AI/LLM optimization** — llms.txt + llms-full.txt (LLM crawler index + full content dump), dynamic app/robots.ts (AI bot allowlist + Bytespider deny), NGO JSON-LD in layout head. 21/21 gate PASS. (ai-optimization contract, done 2026-06-28)
- [ ] **D2: Stripe SA payment gateway** — BLOCKED pending Brad's Stripe SA account setup. Yoco online payments confirmed still on waitlist 2026-06-18 ("temporarily limiting new online payment activations") — Stripe is the confirmed gateway. Brad to create Stripe SA account and supply publishable + secret keys.
- [ ] **D4: Ticket buy flow** — BLOCKED pending D2 (payment gateway). Scope: checkout UI, purchase confirmation, Firestore ticket write, email confirmation via Resend.
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before launch. Setup guide: docs/email-dns-setup.md. Brad to add DNS records once Resend domain verified.
- [ ] **Domain transfer** — saoc.co.za to Inunu Net registrar. Brad to initiate. R172.50 once-off.
- [ ] **DNS cutover** — point saoc.co.za to Firebase App Hosting. Requires domain transfer complete + SPF/DKIM/DMARC in place.
- [ ] **Live Yoco test transactions + cross-browser dry-run** — Phase 1 launch gate. Run after D2/D4 complete.
- [ ] **Auto-refresh llms.txt + llms-full.txt via Alembic** — Alembic-based script BUILT (`scripts/refresh-llms.ts`, `pnpm refresh-llms`): crawls 7 routes through Alembic → regenerates `public/llms-full.txt`. ⚠️ Alembic blocks `localhost` hostnames by design, so the script only works against the live external URL (`https://saoc.co.za/<page>`) — usable only POST DNS-cutover, and NOT usable in CI (GitHub Actions can't reach local Alembic). `public/llms.txt` (index + descriptions) stays hand-authored. Production automation moved to the GROQ item below. Depends on live domain. Docs: `docs/llm-optimization.md`.
- [x] **Auto-refresh llms-full.txt via GitHub Actions + Sanity GROQ** — nightly cron queries Sanity GROQ API directly (no Alembic/screen-scraping), commits updated public/llms-full.txt, Firebase auto-deploys. Depends on: DNS cutover, Sanity API token in GitHub secrets.
  - Done 2026-06-28 (llms-groq-cron mission). `scripts/refresh-llms.ts` rewritten to use standalone `@sanity/client` GROQ queries (6 sections: About, Societies, Judging, Events, National Show, Contact); `.github/workflows/refresh-llms.yml` runs nightly 2am UTC (4am SAST) + manual dispatch, auto-commits with `[skip ci]`. Contract A1–A8 PASS, QA PASS. Requires GitHub secrets `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_API_TOKEN` before nightly cron fires.

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

## Hosting — Decision Pending Brad (researched 2026-06-20)
Research complete: `documents/hosting-research-2026-06-20.md`. Key findings: (1) Vercel has Cape Town `cpt1` compute but SA SSR requires Pro plan ($20/month); free plan only caches in SA. (2) Fly.io `jnb` Johannesburg is best-value SA SSR at $8–15/month, requires Dockerfile migration. (3) "Coolify on Hetzner JNB" was a misconception — Hetzner Cloud has no SA DC; Hetzner SA is now Xneelo (separate company, suitable but maintenance-heavy). **Recommendation: stay on Firebase until latency is a measured problem; if SA compute is a hard requirement, Fly.io `jnb` is best value.** Brad to confirm: (a) hard requirement vs. preference, (b) budget ceiling, (c) no migration before DNS cutover.

## Harness Upstream (Athanor → InunuNet/Athanor)
- [ ] **[athanor-upstream] sync-autonomy v2** — `set-autonomy LEVEL=high` should propagate to `.claude/settings.json` permissionMode. Filed 2026-06-16.
- [ ] **[athanor-upstream] mission.py slug fix** — cross-date slug scan fix needs upstreaming via `make update-template`. Filed 2026-06-16.

## Deferred (auto-tracked)
- [ ] [dev 2026-06-18] Factory loop script needs error handling — Out of scope for this task _(priority: low, handoff: 20260618T075409-dev.json)_

_Last compacted: 2026-06-28 by session. Dismissed: 100+ check_own_comms pulse + quota-monitor + qa-guard informational noise — all informational, no action required. Full history: git log on this file._

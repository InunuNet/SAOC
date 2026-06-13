# Athanor Issue Backlog

## SAOC Project — Active (2026-06-05 reset)

- [x] **Audit M1–M4 work against new full brief** — completed as part of saoc-full-platform mission (Phase A/B retrofits).
_Last compacted: 2026-06-12 by backlog_trim.py. Full history: git log on this file._
- [x] **Phase A: Foundation** — Next.js + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting (InunuNet) + lint/format + CI. (saoc-full-platform MA, A1–A9, done 2026-06-12)
- [x] **Phase B: 8 static content pages** — Home, About, Societies, National Show, Judging, Judges Training, Contact, Sponsors — CMS-driven from Sanity. (saoc-full-platform MB, B1–B7, done 2026-06-12)
- [x] **Phase C: Events calendar page** — Sanity-sourced, month-grouped, ICS export + member-only submit form. (saoc-full-platform MC, C1–C5, done 2026-06-12)
- [x] **Phase D (partial): 2027 Show ticketing** — D1 (Resend email), D3 (Firestore ticket model), D5 (admin dashboard), D6 (door check-in) done 2026-06-13. D2 (Stripe SA) and D4 (buy flow) BLOCKED — pending Brad's payment account setup.
- [x] **Remove footer newsletter stub** — no newsletter references found in codebase (2026-06-13 verified).
- [x] **Fix `draftMode()` build-time console.error** — `sanityFetch` already guards `draftMode()` in try/catch; build clean (2026-06-13 verified).
- [x] **Fix `outputFileTracingRoot` build warning** — added `outputFileTracingRoot: process.cwd()` to next.config.ts (2026-06-13).
- [ ] **Phase E: Polish, testing, Secretary training, DNS cutover, launch.**
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before Phase D launch for cPanel SMTP ticket confirmations to reach Gmail/Outlook.
- [ ] **D2: Stripe SA payment gateway** — BLOCKED pending Brad's Stripe SA account setup. Yoco signup broken 2026-06-06; fallback is Stripe (ZAR).
- [ ] **D4: Ticket buy flow** — BLOCKED pending D2 (payment gateway).

## Priority (v3.x Stability)
- [ ] SAOC (Misc): [qa-guard] Checking: Gemini Harness → InunuNet/Athanor
- [ ] SAOC (Misc): [quota-monitor] Athanor: no active mission
- [x] SAOC (Alert): [P3] ghost-grove DEGRADED — 5/6 tests passed _(resolved 2026-06-12 by loop — stale mktemp files; fixed grove/tests/run_tests.sh)_
- [x] SAOC (Alert): [P0] ghost-unknown ERROR — 0/0 tests passed _(resolved 2026-06-12 — false positive from prior failure_router.sh bug; root cause fixed)_
- [ ] [dev 2026-06-12] Factory loop script needs error handling — Out of scope, low priority _(handoff: 20260612T194347-dev.json)_

## Blocked (Payment account)
- Stripe SA / Yoco account: Brad to set up before D2+D4 can proceed.

## Blocked (Hosting Research — 2026-06-11)
Research all Node.js/Next.js hosting platforms against SAOC constraints:
- Private GitHub org repo (InunuNet/SAOC) — must work on free/low tier
- South African audience — Johannesburg or Cape Town PoP preferred
- Non-profit budget — free tier or minimal cost
- Next.js 15 App Router + SSR (not static only)
- Auto-deploy on push to main

Platforms to cover: Cloudflare Pages, Railway, Render, Fly.io, Netlify, DigitalOcean App Platform, AWS Amplify, Azure Static Web Apps, Coolify (self-host), and any others relevant.

Deliverable: comparison table with verdict + recommended platform. Brad picks, THEN implementation begins.

## Deferred (auto-tracked)
_Last compacted: 2026-06-13 by session. Full history: git log on this file._

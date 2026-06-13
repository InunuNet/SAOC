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
- [x] **Phase E (autonomous): SEO E4 22/22, Secretary training E5 19/19, Launch checklist E6 14/14 — all PASS 2026-06-13. DNS cutover + D2/D4 blocked on Brad.**
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** — required before Phase D launch. Setup guide written: docs/email-dns-setup.md. Brad to add DNS records once Resend domain is verified.
- [ ] **D2: Stripe SA payment gateway** — BLOCKED pending Brad's Stripe SA account setup. Yoco signup broken 2026-06-06; fallback is Stripe (ZAR).
- [ ] **D4: Ticket buy flow** — BLOCKED pending D2 (payment gateway).

## Priority (v3.x Stability)
- [ ] SAOC (Misc): New Event: check_own_comms-20260613081432.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613081305.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613080710.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613080534.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613075938.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613075810.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613075217.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613075044.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613074455.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613074319.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613073723.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613073555.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613072841.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613072516.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613072053.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613071743.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613071303.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613070914.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613070525.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613070132.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613065756.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613065359.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613065020.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613064629.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613064240.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613063858.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613063452.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613063124.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613062720.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613062339.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613061927.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613061604.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613061154.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613060814.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260613060422.txt
- [ ] SAOC (Misc): [qa-guard] Checking: Gemini Harness → InunuNet/Athanor
- [ ] SAOC (Misc): [quota-monitor] Athanor: no active mission
- [x] SAOC (Misc): New Event: check_own_comms-20260613055741.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613055313.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613054228.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613053115.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613051830.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613050642.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613045538.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613044825.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613044830.txt _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): [quota-monitor] Athanor: no active mission _(dismissed — no active mission intended, 2026-06-14)_
- [x] SAOC (Misc): [qa-guard] Checking: Gemini Harness → InunuNet/Athanor _(dismissed — pulse noise, 2026-06-14)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613043651.txt _(dismissed — pulse noise, 2026-06-13)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613043537.txt _(dismissed — pulse noise, 2026-06-13)_
- [x] SAOC (Alert): [P0] ghost-unknown ERROR — 0/0 tests passed _(resolved 2026-06-13 — ghost tests 40/40 PASS; stale alert)_ <!-- fp:sha1:48fb8a6359a2 -->
- [x] SAOC (Misc): [quota-monitor] Athanor: no active mission _(dismissed — no active mission intended, 2026-06-13)_
- [x] SAOC (Misc): [qa-guard] Checking: Gemini Harness → InunuNet/Athanor _(dismissed — pulse noise, 2026-06-13)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613042324.txt _(dismissed — pulse noise, 2026-06-13)_
- [x] SAOC (Misc): New Event: check_own_comms-20260613042418.txt _(dismissed — pulse noise, 2026-06-13)_
- [x] SAOC (Misc): [qa-guard] Checking: Gemini Harness → InunuNet/Athanor _(dismissed — pulse noise, 2026-06-13)_
- [x] SAOC (Misc): [quota-monitor] Athanor: no active mission _(dismissed — no active mission intended, 2026-06-13)_
- [x] SAOC (Misc): New Event: check_own_comms noise _(dismissed — pulse noise, 2026-06-13)_
- [x] SAOC (Misc): [qa-guard] Checking: Gemini Harness → InunuNet/Athanor _(dismissed — no action needed, 2026-06-13)_
- [x] SAOC (Misc): [quota-monitor] Athanor: no active mission _(dismissed — no active mission intended, 2026-06-13)_
- [x] SAOC (Alert): [P3] ghost-grove DEGRADED — 5/6 tests passed _(resolved 2026-06-12 by loop — stale mktemp files; fixed grove/tests/run_tests.sh)_
- [x] SAOC (Alert): [P0] ghost-unknown ERROR — 0/0 tests passed _(resolved 2026-06-12 — false positive from prior failure_router.sh bug; root cause fixed)_
- [ ] [dev 2026-06-12] Factory loop script needs error handling — Out of scope, low priority _(handoff: 20260612T194347-dev.json)_

## Blocked (Payment account)
- Stripe SA / Yoco account: Brad to set up before D2+D4 can proceed.

## Resolved (Hosting Research — 2026-06-13)
Research complete. Deliverable: `documents/hosting-research-2026-06-13.md`
**Verdict: Stay on Firebase App Hosting.** Comparison table covers 9 platforms. Fly.io (JNB region) is the recommended fallback if SSR SA latency becomes an issue later. Brad to review and confirm.

## Deferred (auto-tracked)
_Last compacted: 2026-06-13 by session. Full history: git log on this file._

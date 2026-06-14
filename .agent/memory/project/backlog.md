# Athanor Issue Backlog

## SAOC Project — Active (2026-06-05 reset)

- [x] **Audit M1–M4 work against new full brief** — completed as part of saoc-full-platform mission (Phase A/B retrofits).
_Last compacted: 2026-06-13 by session. Full history: git log on this file._
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
- [ ] [dev 2026-06-12] Factory loop script needs error handling — Out of scope, low priority _(handoff: 20260612T194347-dev.json)_

## Blocked (Payment account)
- Stripe SA / Yoco account: Brad to set up before D2+D4 can proceed.

## Resolved (Hosting Research — 2026-06-13)
Research complete. Deliverable: `documents/hosting-research-2026-06-13.md`
**Verdict: Stay on Firebase App Hosting.** Comparison table covers 9 platforms. Fly.io (JNB region) is the recommended fallback if SSR SA latency becomes an issue later. Brad to review and confirm.

## Deferred (auto-tracked)
_Last compacted: 2026-06-14 by session. Dismissed: 500+ check_own_comms pulse items (through 20260614144824), qa-guard pings, quota-monitor alerts, 1× ghost-unknown P0 false-positive (fp:sha1:48fb8a6359a2 — no test suite matches this project), 1× loop-converged milestone, routine ingest_pulse.sh output. All informational, no action. Full history: git log on this file._

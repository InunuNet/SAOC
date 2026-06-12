# Athanor Issue Backlog

## SAOC Project — Active (2026-06-05 reset)

- [ ] **Audit M1–M4 work against new full brief** — scaffold/chrome/home/about exist but were built for the narrow 7-page mission; re-verify each against Phase A+B requirements before counting as done.
_Last compacted: 2026-06-12 by backlog_trim.py. Full history: git log on this file._
- [ ] **Phase A: Foundation** — Next.js latest + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting (InunuNet account) + lint/format pipeline + staging deploy.
- [ ] **Phase B: 8 static content pages** (per proposal) — Home, About, Societies, Judging, Judges Training, Events, Sponsors, Contact — CMS-driven from Sanity.
- [ ] **Phase C: Events calendar page** (Sanity-sourced, not Firebase RTDB).
- [ ] **Phase D: 2027 Show ticketing** — Stripe SA (Yoco signup broken) + cPanel SMTP confirmations + admin dashboard + door check-in tool.
- [ ] **Phase E: Polish, testing, Secretary training, DNS cutover, launch.**
- [ ] **Remove footer newsletter stub** — newsletter out of scope per 2026-06-06 decision.
- [ ] **Fix `draftMode()` build-time console.error** — `sanityFetch` calls `draftMode(… → [details](data/fix-draftmode-build-time-console-error-s.md)
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** before Phase D launch — required for cPanel SMTP ticket confirmations to reach Gmail/Outlook.

## Priority (v3.x Stability)
- [ ] SAOC (Misc): New Event: check_own_comms-20260612213121.txt
- [ ] SAOC (Misc): New Event: check_own_comms-20260612213058.txt
- [ ]  (Misc): [pain-point-monitor] Skipped (last run 8230s ago, cadence 21600s).
- [ ]  (Misc): New Event: check_own_comms-20260612205031.txt
- [ ]  (GitHub): New GitHub Issue (filename: check_github-20260612205029.txt)
- [ ]  (Misc): New Event: fleet_loop-20260612205032.txt
- [ ]  (Misc): New Event: comms_poll-20260612205031.txt
- [ ]  (AutoFix): Auto-fix Job Run (auto_fix_issues-20260612204915.txt)
- [ ]  (GitHub): New GitHub Issue (filename: check_github-20260612204353.txt)
- [ ]  (Misc): New Event: fleet_loop-20260612204352.txt
- [ ]  (Misc): New Event: fleet_loop-20260612204355.txt

      \_Last compacted: 2026-06-01 by backlog_trim.py. Full history: git log on this file.*

_These issues are critical for stabilizing the v3.x template and must be addressed before starting v4.0 work._


## Blocked (v4.0 Features)

_These v4.0 features are blocked pending the stabilization of the v3.x series. Do not start work on these items until all issues in the 'Priority' section are complete._

## Completed

> Truncated 13 items at trim time (2026-06-01). Restore from git history if needed.

## BLOCKING — Hosting Research (added 2026-06-11)

**Priority: CRITICAL — blocks all deployment work**

Research all Node.js/Next.js hosting platforms against SAOC constraints:
- Private GitHub org repo (InunuNet/SAOC) — must work on free/low tier
- South African audience — Johannesburg or Cape Town PoP preferred
- Non-profit budget — free tier or minimal cost
- Next.js 15 App Router + SSR (not static only)
- Auto-deploy on push to main

Platforms to cover: Cloudflare Pages, Railway, Render, Fly.io, Netlify, DigitalOcean App Platform, AWS Amplify, Azure Static Web Apps, Coolify (self-host), and any others relevant.

Deliverable: comparison table with verdict + recommended platform. Brad picks, THEN implementation begins.
> Truncated 635 items at trim time (2026-06-12). Restore from git history if needed.

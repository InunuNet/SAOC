# Athanor Issue Backlog

## SAOC Project — Active (2026-06-05 reset)

- [x] ~~Write full 5-phase mission plan~~ — `.agent/memory/project/missions/2026-06-06-saoc-full-platform.md` written by @lead (2026-06-06).
- [x] ~~Register mission + dispatch @architect for Phase A bedrock~~ — done 2026-06-06; mission `saoc-full-platform` active, contract gate 16/16 PASS (ESLint 9 flat config + Prettier 3).
- [x] ~~**Phase A next: A3 Sanity install + Studio route**~~ — done 2026-06-08; sanity@5 + @sanity/vision + next-sanity installed, `sanity.config.ts` + `sanity.cli.ts` + `/studio/[[...tool]]` route + `sanity/env.ts` + `sanity/lib/image.ts` all wired, env vars in `.env.local.example`, 16/16 gate PASS (+ build green via webpack `exportsPresence=false` workaround for React 19.2 `useEffectEvent`).
- [x] ~~**Phase A: A4 Sanity schemas (7 content types)**~~ — done 2026-06-08; added 4 new doc schemas (`judgingPage`, `membersPage`, `show`, `province`) on top of existing 12 → 16 total registered in `sanity/schemas/index.ts`. Contract gate 7/7 PASS. `contracts/` added to `tsconfig.json` exclude so golden files don't trip type-check. Docs table in `docs/m1-foundation.md`.
- [x] ~~**Phase A: A5 Seed Sanity from `lib/data/`**~~ — done 2026-06-08; `scripts/seed-sanity.ts` pushes 8 doc types via `@sanity/client` with idempotent `createOrReplace` + deterministic IDs. `@sanity/client@^7.22.1` + `dotenv@^17.4.2` added as explicit deps. Contract gate 5/5 PASS. `pnpm seed` script added.
- [x] ~~**Phase A: A6 next-sanity wiring with draft mode**~~ — done 2026-06-08; `sanity/lib/client.ts` (SanityClient|null for CI safety), `sanity/lib/fetch.ts` (sanityFetch + draftMode + ISR tags), `sanity/queries.ts` (5 GROQ via defineQuery), `app/api/draft|disable-draft|revalidate/route.ts` routes wired. Home page now async + calls sanityFetch (component prop-wiring deferred to B1). 14/14 contract gate PASS.
- [x] ~~**Phase A next: A7 Firebase project provisioning (InunuNet account)**~~ — done 2026-06-08; firebase.json + .firebaserc + apphosting.yaml env block scaffolded; Brad must complete manual GCP console steps per docs/a7-firebase-checklist.md. 10/10 contract gate PASS.
- [ ] **Audit M1–M4 work against new full brief** — scaffold/chrome/home/about exist but were built for the narrow 7-page mission; re-verify each against Phase A+B requirements before counting as done.
- [ ] **Phase A: Foundation** — Next.js latest + TS strict + Tailwind v4 + Sanity CMS + Firebase App Hosting (InunuNet account) + lint/format pipeline + staging deploy.
- [ ] **Phase B: 8 static content pages** (per proposal) — Home, About, Societies, Judging, Judges Training, Events, Sponsors, Contact — CMS-driven from Sanity.
- [ ] **Phase C: Events calendar page** (Sanity-sourced, not Firebase RTDB).
- [ ] **Phase D: 2027 Show ticketing** — Stripe SA (Yoco signup broken) + cPanel SMTP confirmations + admin dashboard + door check-in tool.
- [ ] **Phase E: Polish, testing, Secretary training, DNS cutover, launch.**
- [ ] **Remove footer newsletter stub** — newsletter out of scope per 2026-06-06 decision.
- [ ] **Configure SPF/DKIM/DMARC on saoc.co.za** before Phase D launch — required for cPanel SMTP ticket confirmations to reach Gmail/Outlook.
- [x] ~~Old mission `2026-06-01-saoc-website-build` (7 static marketing pages)~~ — abandoned 2026-06-05, scope too narrow vs full brief.
- [x] ~~Fix GitHub remote~~ — corrected from `BDauth/SAOC` to `InunuNet/SAOC` (2026-06-05).
- [x] ~~Update Athanor harness~~ — bumped to v3.7.73 via `make update-template` (2026-06-05).

## Priority (v3.x Stability)

- [ ] Inbox (AutoFix): Auto-fix Job Run (auto*fix_issues-20260421121634.txt)
      \_Last compacted: 2026-06-01 by backlog_trim.py. Full history: git log on this file.*
- [ ] Inbox (AutoFix): Auto-fix Job Run (auto_fix_issues-20260421121504.txt)
- [ ] Inbox (GitHub): New GitHub Issue (filename: check_github-20260421121132.txt)
- [ ] Inbox (GitHub): GitHub #60: P1: make update-template misses new execution/ scripts (onboard_fill.py, get_pulse_status.sh, sync_rules.sh, etc.)
- [ ] Inbox (AutoFix): Auto-fix Job Run (auto_fix_issues-20260421120035.txt)
- [ ] Inbox (GitHub): GitHub #46: [TEMPLATE BUG] Triple Version Mismatch: Makefile (v2.2.2) vs README vs Hooks
- [ ] Inbox (GitHub): GitHub #47: [TEMPLATE BUG] Boot sequence lacks Discovery & Capabilities summary
- [ ] Inbox (GitHub): GitHub #45: [TEMPLATE BUG] Alembic proxy and mandate missing from boot context
- [ ] Inbox (GitHub): GitHub #44: [TEMPLATE BUG] Brittle GitHub Auth Check in full_boot.sh
- [ ] Inbox (GitHub): GitHub #49: [TEMPLATE BUG] Pulse/Inbox integration is broken and undocumented
- [ ] Inbox (GitHub): GitHub #48: [TEMPLATE BUG] Boot sequence lacks Upstream Service Mapping (e.g., Alembic)
- [ ] Inbox (Alert): AGENT_FAILURE: @qa failed to validate symlinks
- [ ] Inbox (Misc): 🔄 Initialising update checkpoint...

_These issues are critical for stabilizing the v3.x template and must be addressed before starting v4.0 work._

- [ ] #38: Boot: auto-onboarding not triggered; WORKSPACE drift hard-locks Bash
- [ ] #37: Bug: Automatic boot hook missing in .gemini/settings.json
- [ ] #35: Bug: Harden Gemini Policy Schema to address unauthorized tool call bug
- [ ] #34: Bootstrap instructions drift from what origin/main actually ships
- [ ] #33: Template repo lacks a clean self-update path for Athanor itself
- [ ] #31: Claude PreToolUse write/edit guards do not parse hook JSON and silently fail open
- [ ] #30: Boot blocker scan branch is inverted in full_boot.sh

## Blocked (v4.0 Features)

_These v4.0 features are blocked pending the stabilization of the v3.x series. Do not start work on these items until all issues in the 'Priority' section are complete._

## Completed

> Truncated 13 items at trim time (2026-06-01). Restore from git history if needed.

# Athanor Issue Backlog

## SAOC Project — Active (2026-06-05 reset)

- [x] ~~Write full 5-phase mission plan~~ — `.agent/memory/project/missions/2026-06-06-saoc-full-platform.md` written by @lead (2026-06-06).
- [x] ~~Register mission + dispatch @architect for Phase A bedrock~~ — done 2026-06-06; mission `saoc-full-platform` active, contract gate 16/16 PASS (ESLint 9 flat config + Prettier 3).
- [ ] **Phase A next: A3 Sanity install + Studio route** — `pnpm add next-sanity @sanity/vision sanity@latest`, scaffold `sanity.config.ts`, mount `/studio/[[...index]]` route, env wiring (`NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`).
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

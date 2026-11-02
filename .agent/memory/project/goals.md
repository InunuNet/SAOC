# Goals

## Mission

Build and maintain the South African Orchid Council's digital presence and tooling. SAOC is the workspace for this project, running on the Athanor agentic framework.

## Active Goals

1. Establish what the SAOC project needs to build (website, membership system, events, etc.)
2. Keep the Athanor workspace healthy and in sync
3. Deliver working software for the South African Orchid Council

## Durable Project Facts (migrated from Claude's global per-project memory, 2026-09-02)

These facts previously lived only in `~/.claude/projects/-Users-vetus-ai-SAOC/memory/`, which is
out of scope per `.claude/rules/scope.md` and — more importantly — invisible to every chain
agent (@architect/@dev/@qa/@docs read `.agent/memory/project/` and `brain.py`, never that
directory). Recorded here so they actually reach the agents that need them.

- **National Show brand architecture — RESOLVED.** SAOC's own chrome (header/footer/nav) is
  site-wide; National Show-specific branding renders below the header, scoped to
  `/national-show` routes only. Do not let Show branding bleed into global chrome.
- **National Show 2027 branding assets** live in `branding/national-show-2027/` in this repo.
  Covered by the existing "leave `branding/` alone, Brad is reorganising it by hand" standing
  rule in `backlog.md`.
- **Deploy authorization is standing.** Push to Firebase App Hosting any time without asking
  first — this is the dev/staging site, not production. Does not extend to production deploys
  once the site goes live, or to any destructive action (still covered by "Ask Before
  Destructive Actions" in `.claude/rules/behavior.md`).
- **The Sanity dataset is not live production data** — the site is pre-production, so editing
  content in Sanity directly is safe. Still follow the project's careful-write method (never
  leave test-sentinel values behind — see the "Contract checks mutate live content" entries in
  `learned.md`).
- **Logo status:** Scott granted permission to redo the National Show logo; the new Show logo is
  done. Brad is separately designing the SAOC organisation logo himself — leave that to him, same
  as the other `branding/`/`design spec/` no-touch rules.
- **SAOC DNS zone is agent-editable** via cPanel UAPI on the `wh3` box; `ns1.inunu.co.za` IS that
  same `wh3` box (not a separate nameserver host).
- **Lee-Ann's documents take precedence over older in-project assumptions on the same fact** —
  her specs/answers outrank prior project data that was often an unconfirmed placeholder (the
  invented CTICC venue and the 18–21 September dates are the two worked examples of this).
- **"SAOC Dev Status" Google Sheet** (spreadsheetId `1CEq5_670M1Q-AA5ZyJ30ycASptsy2Is5sHJhMXNyClo`,
  https://docs.google.com/spreadsheets/d/1CEq5_670M1Q-AA5ZyJ30ycASptsy2Is5sHJhMXNyClo) is the
  cross-lane build/design status tracker — owner brad@inunu.net, tabs: Status, Pages, Flows,
  Lanes, Open Questions. The `Pages` tab tracks, per route: local link, build lane (SAOC lead /
  NOS Site), design lane (SAOC handoff / NOS Design), status (live / planned / 404-planned),
  content source (Lee-Ann doc / Sanity / Firestore / OURS), content stage (SOURCED / PROVISIONAL /
  PLACEHOLDER / FUNCTIONAL / DATA), what it's blocked on, and free-text notes. Read/write via
  `gws sheets spreadsheets values get/update --params '{"spreadsheetId":"...","range":"Pages!A1:J..."}'`.
  Existed since at least 2026-09-10 but no session had its id until 2026-09-14 — check it for
  current per-route status/blockers before assuming a route's state from code alone, since the
  NOS lanes' in-flight status lives there, not in this repo.
- **Ticketing spec security is a standing condition, not a negotiable tradeoff.** Brad delegated
  ticketing implementation authority, but security requirements are the condition that authority
  was granted under — never present a security tradeoff to Brad as if it were his open choice to
  relax.

## Launch deadline — 1 December 2026 (Brad, 2026-10-06)

Brad: "Deadline for launch is the 1st December" (2026-10-06, the same day as the Lee-Ann meeting
that asked for the beta password wall). Until launch, the site sits behind the beta password wall
(mission `beta-password-wall`). Launch is one deliberate act: set `SITE_PUBLIC_LAUNCH=true`
(exact string) in apphosting.yaml and roll out. That lifts the wall, the X-Robots-Tag noindex
header and the robots.txt disallow-all together. The saoc.co.za nameserver/domain migration
(see the Resend DNS sequencing note) is a separate step and must not be treated as the launch.
Plan backlog priority against this date.


History: `archive/goals-history.md` (grep it, do not read whole).

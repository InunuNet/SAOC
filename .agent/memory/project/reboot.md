# Reboot Context
_Generated: 2026-08-12T16:46Z_

## What happened last session (afternoon, commits eec80fe..51460dd)

1. **Content intake from Lee-Ann's Drive folder**, accessed via the `gws` CLI (curl/Alembic only
   see Drive's HTML shell — do not retry those for Drive links). Five docs pulled into
   `documents/from-leeann-drive/` (gitignored — Spec V3 carries plaintext mailbox passwords).
   Headline finding: **Spec V3 scopes TWO separate websites** (SAOC org site + a dedicated 2027
   Show site), not the single site we've built. Open commercial question for Brad, deliberately
   not acted on. Three client-approved Show copy docs arrived (first approved copy we have:
   about-2027, exhibitors, what-to-expect) plus a vendor-registration form.
2. **`beta.saoc.co.za` custom domain created** on the `saoc-prod` App Hosting backend via the
   Firebase REST API (see `learned.md` "Do the configuration yourself"). All three DNS records
   live and globally propagated; Firebase domain-ownership check was still pending at session end
   — verify its state before assuming the subdomain is fully live.
3. **Partners section redesigned** (`eec80fe`) — removed three invented partner orgs (American
   Orchid Society, Royal Horticultural Society, World Orchid Conference) from home page + site
   footer, fixed the dead `wosa.org.za` URL in both, rebuilt the remainder as real cards. Gate
   24/24.
4. **Favicon shipped** (`3e3f8e4`, `ccab0a2`) — SAOC orchid mark, 93KB source trimmed to 12KB,
   then cropped to fill the tab icon.
5. **Ticket reachability fixed** (`51460dd`) — `/tickets` was a dead end (only linked from a
   footer paragraph). Added 3 entry points (header nav, home CTA, national-show hero). The 7th
   header nav item then wrapped the desktop nav across ~1180–1210px, hitting iPad Pro 11"
   landscape (1194px) — caught by QA, fixed by moving both the hamburger and desktop-nav
   breakpoints together. Gate 16/16. Full lesson in `learned.md`.

## Missions scoped this session

- **`sandbox-ticket-proof` — ACTIVE** (`.agent/memory/project/missions/2026-08-12-sandbox-ticket-proof.md`).
  Goal: prove the existing single-tier ticket flow end to end against the PayFast sandbox on a
  deployed environment, then pause for council feedback before any multi-tier work. F1 (deploy
  current `main` — deployed site is still on `01dd63f` from 2026-07-30, so `/tickets` and other
  August routes 404 there) is the resume point: `python3 execution/mission.py resume`.
- **`national-show-design-alignment` — pending, BLOCKED** on Brad delivering the Claude Design
  handoff for the National Show section. Do not start F1 until the bundle lands; do not invent
  brand assets in the meantime.

## Live blockers (verify current state against `backlog.md` rather than trusting this list)

- **Firebase Auth (Email/Password) not enabled on `saoc-webapp`** — blocks `/admin` and the door
  scanner in every environment. Highest value per minute of Brad's time; F5 of the active mission
  is blocked on this.
- **Deployed site stale at `01dd63f`** (2026-07-30) — `/tickets` and other August routes 404 in
  production even though they work locally. F1 of the active mission.
- **Real council ticket prices + venue capacity unconfirmed** — top revenue blocker, also a hard
  gate on going live.
- **No Resend account** — confirmation emails silently do not send (contact form + ticket
  purchase both degrade silently by design, not a new bug).

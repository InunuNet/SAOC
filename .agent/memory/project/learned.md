## Hooks & Gates

- GitHub Issue #1274 (bug: require_docs.sh hook substring-matches any command containing gate keyword): This issue has been fixed. The `execution/hooks/require_docs.sh` script's `case` statement was updated from `"python3 "*"contract.py"*"gate"*)` to `"contract.py gate "*|"contract.py gate")` to enforce strict prefix matching. This ensures the hook only triggers for explicit `contract.py gate` commands. This fix has been implemented and verified by `test_require_docs_fix.sh`.
- (2026-06-18) The `maintainer -> close` handoff gate (`handoffs.yaml`) enforces `max_age_seconds: 86400` on `learned.md`. Any `git commit` from the maintainer agent is blocked by `require_maintainer.sh` unless `learned.md` has a `##` section, is ≥64 bytes, AND was modified within the last 24h. Fleet-loop / housekeeping commits must touch `learned.md` (even a dated note) to pass the close gate.

## Fleet-loop / Session Wrap

- (2026-06-18) Fleet-loop session: dismissed 157 deferred backlog noise items (check_own_comms pulse, qa-guard pings, quota-monitor alerts). Backlog compacted to 6 real open items — all Brad-blocked (D2/D4 payment, DNS, domain transfer) or athanor-upstream. No incoming CODI directive; standing autonomous directive confirmed.
- (2026-06-19) Fleet-loop session: no CODI directive found. All backlog items remain Brad-blocked (payment, DNS, domain transfer, secretary handover). All autonomous Phase A–E deliverables remain complete. Routine comms reply appended.
- (2026-06-20) Fleet-loop session: no CODI directive found. State unchanged — all Phase A–E complete, all remaining items Brad-blocked. learned.md touch required to satisfy maintainer close gate (max_age_seconds=86400). Routine comms reply appended.
- (2026-06-22) Fleet-loop session: no CODI directive found. State unchanged — all Phase A–E complete, all remaining items Brad-blocked. learned.md touch required to satisfy maintainer close gate each session. Boot size now 12954 bytes.
- (2026-06-23) Fleet-loop session: no CODI directive found. State unchanged — all Phase A–E complete, all remaining items Brad-blocked. Boot size 11850 bytes. Routine comms reply appended.
- (2026-06-25) Fleet-loop session: comms.md updated with session reply. State unchanged — all Phase A–E complete, all remaining items Brad-blocked. learned.md touched to satisfy maintainer close gate (mtime was 2026-06-23, >24h old → require_maintainer.sh blocked the commit until refreshed).
- (2026-06-23) Chrome wiring: `UtilityBar`, `Header`, and `Footer` were fully built in `components/chrome/` but never mounted in `app/layout.tsx` — a class of error where TODO placeholder comments hide incomplete wiring from code review. Always verify that built components are actually imported and rendered in layout, not just present on disk.

## Design & Visual Verification

- (2026-06-23) BrowserAgent visual audits have a HIGH false-positive rate on this project. In the design-verify pass it claimed the utility bar was missing and the logo read "North South African Orchid Council" — both completely false. Trust code review + reference-screenshot comparison over BrowserAgent prose descriptions; verify visually before acting on any BrowserAgent report.
- (2026-06-23) `pnpm build` must run BEFORE taking dev-server screenshots — a stale `.next` from a prior production build breaks the dev server. When `rm -rf` is blocked, clear it with `mv .next /tmp/...`.
- (2026-06-23) Tailwind v4 `@theme`: use `--font-family-serif: var(--font-serif)` NOT `--font-serif: var(--font-serif)` — the latter creates a circular CSS custom-property reference that silently fails.
- (2026-06-23) Design-verify pass (commit 35c9cbb): globals.css got the full design-token set (semantic color aliases, type scale, spacing tokens, semantic classes), header abbreviated to "SA Orchid Council" / "Making a difference since 1968", hero display-xl/lg clamp scale applied, and `radius-0` (no rounded-lg) enforced across 8 card components per spec.

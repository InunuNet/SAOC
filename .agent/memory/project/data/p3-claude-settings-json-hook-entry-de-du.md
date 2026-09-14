# p3-claude-settings-json-hook-entry-de-du

**[P3] `.claude/settings.json` hook-entry de-duplication is drafted but uncommitted, and
  is template-sync churn, not mission scope** (found 2026-09-08, mission `ticketing-complete`).
  Roughly 86 lines of working-tree diff replace hook entries duplicated in both the old
  `[ -f X ] && bash X || exit 0` form and the newer `[ -f X ] || exit 0; bash X` form with the
  single newer form — correct, and aligned with `.claude/rules/hooks.md`'s guidance on hook
  file shape. This is `make update-template` output reconciling drift, not something the
  ticketing-complete mission touched or should carry in its commit. Needs its own deliberate,
  separately-reviewed commit; exclude it explicitly when committing ticketing-complete's work.

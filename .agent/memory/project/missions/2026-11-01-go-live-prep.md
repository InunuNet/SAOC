---
schema: athanor.mission/v1
slug: go-live-prep
goal: 'Ticketing go-live prep, no copy changes (Brad 2026-11-01): M1 structural (test-data
  purge dry-run, reconcile-cron engineering half, Ozow check triage, go-live probe
  pack, admin session body cap + trusted-XFF routes, merge-when-green all checks,
  CI timeouts/cache, residue-guard quota handling, Sanity/tickets health probes, gate
  hygiene re-pins); M2 design polish (NOS home phone h2 32/300, sticky card 3px gap,
  2056 overruns, 768 scroller under header, countdown labels at 390, noindex/JSON-LD).
  Hard stop 12:00 SAST 2026-11-01 for the quota reset.'
created_at: '2026-11-01T08:55:46.622885+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features: []
milestones: []
---

# Mission: Ticketing go-live prep, no copy changes (Brad 2026-11-01): M1 structural (test-data purge dry-run, reconcile-cron engineering half, Ozow check triage, go-live probe pack, admin session body cap + trusted-XFF routes, merge-when-green all checks, CI timeouts/cache, residue-guard quota handling, Sanity/tickets health probes, gate hygiene re-pins); M2 design polish (NOS home phone h2 32/300, sticky card 3px gap, 2056 overruns, 768 scroller under header, countdown labels at 390, noindex/JSON-LD). Hard stop 12:00 SAST 2026-11-01 for the quota reset.

## Context

(Add context here)

## Notes


## Checkpoint 2026-11-02 (fleet wrap-up, Brad moving locations)

Nothing pushed, merged or deployed. Local and waiting for Brad: F3 `fix/sec-abuse-controls` 676f60c8 (NOS Site clone), F6 `fix/go-live-f6` a0c025dd, F6/F7 specs `spec/go-live-f6` 131f8ef4, F8 `fix/go-live-f8` 1c6d6e97, `design/nos-tech-audit` 8dd2ab63 (NOS Design clone).

Merge order once Lee-Ann has finished checking: F3 push, F3, then F6 and rebased F8 (repoint contact/newsletter to `lib/request-body.ts`; second merger fixes the F3 A26 seed exemption), then nos-tech-audit. F8 deploy needs the production XFF hop count (H4).

Owed: F8 re-QA of commits after 7d0c5a27, F8 skip-path test, retro-Codex from 2026-11-04 08:55.

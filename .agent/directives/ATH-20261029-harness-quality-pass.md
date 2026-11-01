---
schema: athanor.directive/v1
id: ATH-20261029-harness-quality-pass
targets: [all]
issued_at: '2026-10-29'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.73 — half the always-loaded instructions, one-run updates from the next release, a floor denial log
verify: python3 execution/boot_panel.py --format report
---

- **v3.8.73: sessions start leaner.** Always-loaded instructions are about
  half their old size (scaffold 46.8 KB to 23.6 KB). Rules whose trigger is
  a file now carry `paths:` and load only when you touch a matching file.
  No binding rule was dropped; a golden checks every one. `learned.md` is
  no longer read whole at boot: use `tail -n 60`, `grep -n -i <topic>` or
  `brain.py recall`.
- **Updates finish in one run, from the next release on.** The updater now
  restarts itself after replacing its own file. This release is installed
  by the old updater, so it still needs two runs. That is the last time.
- **The floor keeps a denial log.** Every denial appends one masked JSON
  line to `.agent/memory/project/telemetry/floor_denials.jsonl`
  (gitignored). Wildcards are judged against the session's working
  directory, so `ls -d execution/*/` and `contract.py validate` on a glob
  no longer get denied. Sensitive values are masked in the log and in
  permission notices.
- **WebFetch and WebSearch are now denied in settings.** Alembic remains
  the only web route.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261029-harness-quality-pass --result applied`

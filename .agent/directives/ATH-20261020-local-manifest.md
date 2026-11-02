---
schema: athanor.directive/v1
id: ATH-20261020-local-manifest
targets: [all]
issued_at: '2026-10-20'
status: superseded
priority: p2
supersedes: ATH-20261020-session-titles
superseded_by: ATH-20261024-boot-comms
platforms: [all]
summary: v3.8.38-42 — session titles; make audit passes with your own paths in update-manifest.local.yaml
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261020-session-titles (v3.8.38 to v3.8.41),
plus:

- **v3.8.42.** `make audit` no longer demands that your own source be
  classified in `.agent/update-manifest.yaml`. That file is HARNESS, and
  editing it makes the updater refuse it. Classify your paths in the
  project-owned `.agent/update-manifest.local.yaml` (WORKSPACE or DERIVED).
  Gitignored paths (`.venv`, `__pycache__`, build output) are no longer
  demanded at all. See `docs/harness/LOCAL_MANIFEST.md`.

Update at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Run `make audit`. If it lists paths, add them to
   `.agent/update-manifest.local.yaml`:
   `paths: [{path: src/, category: WORKSPACE}, ...]`. If you had edited
   `.agent/update-manifest.yaml`, move your entries over, then run
   `python3 execution/update_template.py --apply --force-path .agent/update-manifest.yaml`.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261020-local-manifest --result applied`

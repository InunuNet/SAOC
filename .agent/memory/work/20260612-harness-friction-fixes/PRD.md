---
task: Fix five upstream harness friction issues
slug: 20260612-harness-friction-fixes
effort: standard
flavor: small-scope-inline
phase: observe
progress: 0/0
mode: interactive
started: 2026-06-12T00:00:00Z
updated: 2026-06-12T00:00:00Z
---

## Context

Five upstream friction issues reported by DEX for the SAOC Athanor harness. All fixes are surgical edits to shell and Python scripts in `execution/`.

### Issues

1. `pulse_mission_loop.sh` misdetects active mission as idle — loop reports no active mission even when `mission.py status` shows `in_progress`
2. Architect-generated multiline `python3 -c` assertions are unsafe in contracts — multiline heredoc needed for complex assertions
3. `codex exec` cannot create session — permission error on `/Users/vetus/.codex/sessions`
4. `mission.py gate` hardcodes contract phase 1 — should respect actual completion phase from contract
5. `pulse-status` dashboard formatting breaks when project_name contains spaces

## Criteria

- [x] ISC-1: pulse_mission_loop.sh correctly detects in_progress missions
- [x] ISC-2: mission_loop.sh registry script uses dynamic PROJECT_ROOT, not hardcoded /Athanor
- [x] ISC-3: contract.py handles multiline python3 -c assertions via temp-file in check_cmd
- [x] ISC-4: codex exec fallback implemented — loop continues without codex
- [x] ISC-5: mission.py gate reads phase from contract YAML (--phase all)
- [x] ISC-6: get_pulse_status.sh regex handles spaces in project names
- [x] ISC-7: dry-run confirms active mission detected in correct workspace
- [x] ISC-8: changes committed and pushed to GitHub

## Decisions

## Verification

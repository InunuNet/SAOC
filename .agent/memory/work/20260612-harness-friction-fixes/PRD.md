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

- [ ] ISC-1: pulse_mission_loop.sh correctly detects in_progress missions
- [ ] ISC-2: pulse_mission_loop.sh idle-detection bug is root-caused and patched
- [ ] ISC-3: contract.py emits heredoc-style assertions instead of multiline python3 -c
- [ ] ISC-4: codex exec fallback implemented — loop continues without codex
- [ ] ISC-5: mission.py gate reads phase from contract YAML rather than hardcoding 1
- [ ] ISC-6: pulse_status.sh quoting fixes space-safe dashboard columns
- [ ] ISC-7: all five fixes verified with grep/test
- [ ] ISC-8: changes committed and pushed to GitHub

## Decisions

## Verification

---
task: Fix five upstream harness friction issues from DEX
slug: 20260612-000001_fix-harness-upstream-issues
effort: standard
flavor: small-scope-inline
phase: execute
progress: 8/8
mode: interactive
started: 2026-06-12T00:00:01Z
updated: 2026-06-12T00:00:05Z
---

## Context

Five upstream friction issues reported by DEX, all from the `ghost-fibonacci` mission run. Issues 1-4 were already fixed in locally-modified files (pulse_mission_loop.sh, mission.py, contract.py, architect.md). Issue 5 (pulse-status spaces) needed a targeted fix to get_pulse_status.sh which Makefile calls for `make pulse-status`.

## Criteria

- [x] ISC-1: pulse_mission_loop.sh fallback scan detects in_progress missions when active.json is stale
- [x] ISC-2: pulse_mission_loop.sh codex pre-check detects permission denied before exec
- [x] ISC-3: pulse_mission_loop.sh codex runtime fallback catches session error output
- [x] ISC-4: architect.md prohibits multiline python3 -c with clear examples
- [x] ISC-5: contract.py validate_cmd rejects multiline python3 -c with error
- [x] ISC-6: contract.py gate_cmd pre-flight rejects multiline python3 -c assertions
- [x] ISC-7: mission.py cmd_gate uses --phase all instead of hardcoded --phase 1
- [x] ISC-8: get_pulse_status.sh strips [project_name] prefix handling spaces correctly

## Decisions

- Issues 1-4 were already present as local uncommitted changes; no code was re-written
- Issue 5 (get_pulse_status.sh) required a targeted fix: switch to `-F ' [|] '` + NF>=4 guard + `sub(/^\[[^]]*\] /)` prefix strip, matching the approach already in pulse_status.sh

## Verification

All 8 criteria verified by code inspection and push to GitHub.

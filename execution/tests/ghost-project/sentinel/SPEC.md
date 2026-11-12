# Sentinel — Specification
**Version:** 1.0  
**Architect:** Athanor @architect agent  
**Date:** 2026-05-11  
**Build path:** `execution/tests/ghost-project/sentinel/`

## Purpose
Sentinel is a deterministic JSONL dead-letter-queue processor. It is the Athanor ghost project: a real-world mini-tool built by the agent team to validate the full factory pipeline end-to-end.

---

## Requirements

1. **Input:** `--queue <path.jsonl>` — newline-delimited JSON tasks. Each task:
   ```json
   {"id": "str", "type": "str", "payload": {}, "attempts": 0, "max_attempts": 3, "state": "pending"}
   ```
   Valid states: `pending`, `in_progress`, `done`, `failed`, `dead`

2. **Output:** `--output <path>` — same schema, mutated states. Default: rewrite queue in-place atomically.

3. **Task types** (closed set):
   - `write_file` — payload: `{path: str, content: str}` — writes content to path
   - `compute_hash` — payload: `{input_path: str, output_path: str}` — SHA256 of input, write hex to output
   - `sleep` — payload: `{ms: int}` — sleep N ms, **HARD CAP: 100ms max** (enforce even if payload says more)

4. **State machine:**
   - `pending` → `in_progress` (on pickup) → `done` (success) | `failed` (error)
   - On `failed`: if `attempts < max_attempts` → reset to `pending`; if `attempts >= max_attempts` → `dead`
   - **`attempts` is incremented when transitioning TO `in_progress`** (not on failure)

5. **Crash recovery (MANDATORY):**  
   On startup, any task in `in_progress` was interrupted. Reset it to `pending` and increment `attempts`. This must happen BEFORE processing any tasks.

6. **Idempotency (MANDATORY):**  
   - Tasks in `done` or `dead` state are skipped entirely — no side effects re-run
   - `write_file`: check task state BEFORE writing. Do not re-write if already done.
   - Queue state update is atomic (write → rename) immediately after side effect

7. **Atomic writes (MANDATORY — POSIX `os.replace` ONLY):**  
   - Write queue to `<path>.tmp` then `os.replace(tmp, path)` — atomic on POSIX
   - Do NOT use `shutil.move` — not atomic across filesystems
   - Every state transition triggers an atomic rewrite

8. **Schema validation (MANDATORY — full queue before any execution):**  
   - Validate ALL tasks against `schema.json` (JSON Schema draft-07) before processing any task
   - If any task fails validation → exit 2, no side effects created

9. **CLI flags:**
   - `--queue <path>` (required)
   - `--output <path>` (optional, default: in-place)
   - `--dry-run` (no side effects, show what would happen)
   - `--max-tasks <N>` (process at most N tasks per run)
   - `--schema <path>` (default: `schema.json` in same dir as sentinel.py)
   - `--verbose` (log each task state transition)

10. **Exit codes:**
    - `0` — all tasks in terminal state (`done` or `dead`). `failed` is transient, not terminal.
    - `1` — invalid config, missing file, bad CLI args
    - `2` — schema validation failure (no side effects)
    - `3` — unrecoverable I/O error mid-execution

11. **Output ordering:** JSONL output preserves insertion order of input. Use `json.dumps(..., sort_keys=True)` for deterministic field ordering within each object.

12. **`compute_hash` on missing input file:** State → `dead` immediately. Missing input won't be fixed by retry. No `failed` state for this case.

---

## Testing Affordances (test-only — gated by SENTINEL_TEST_MODE=1)

When env var `SENTINEL_TEST_MODE=1` is set, enable `--inject-fault=after-task=N`:
- Process N tasks normally, then simulate a crash (raise SystemExit mid-rewrite BEFORE os.replace completes)
- This tests that atomic writes survive power-loss
- **MUST be disabled when SENTINEL_TEST_MODE is unset** (cannot be used in production)

---

## What MUST Be Explicit in This Spec (Contract Checklist)

The validation contract will grep SPEC.md for these strings before allowing Phase 2 to begin:
- [x] "atomic write" — atomic write strategy defined
- [x] "in_progress recovery" — crash recovery defined  
- [x] "idempotency" — idempotency rules defined
- [x] "schema validation" — full-queue validation before execution defined
- [x] "sleep cap" — sleep hard cap defined
- [x] "os.replace" — specific atomic write mechanism named
- [x] "sort_keys=True" — deterministic output ordering defined
- [x] "SENTINEL_TEST_MODE" — test affordance gating defined

---

## Phases

### Phase 1 — Design (architect + lead) ✅ COMPLETE
- [x] SPEC.md written with all trap mitigations
- [x] schema.json defines task schema (JSON Schema draft-07)
- [ ] Validation contract created and validated

### Phase 2 — Core Implementation (dev)
- [ ] sentinel.py with state machine, 3 task handlers, atomic writes, CLI
- [ ] Gate: `python sentinel.py --queue tests/fixtures/valid_queue.jsonl` exits 0

### Phase 3 — Edge Cases + Tests (qa + dev)
- [ ] tests/test_sentinel.py covering all 12 assertions
- [ ] --inject-fault flag implemented
- [ ] All fixtures created
- [ ] Gate: `bash tests/run_tests.sh` exits 0, 12/12 pass

### Phase 4 — Docs + Wrap-up (docs + maintainer)
- [ ] README.md with usage, schema ref, exit codes, state diagram
- [ ] brain.py wrap-up stored with tags: ghost-project,sentinel
- [ ] HANDOFFS.md shows all phase transitions

---

## Binary Test Assertions (12)

| # | Assertion | Test command |
|---|-----------|-------------|
| 1 | Missing queue → exit 1 | `python sentinel.py --queue /nope.jsonl; [ $? -eq 1 ]` |
| 2 | Corrupt JSON → exit 2 | `python sentinel.py --queue tests/fixtures/corrupt_queue.jsonl; [ $? -eq 2 ]` |
| 3 | Schema violation → exit 2, no side effects | Run on bad schema fixture, check exit + no output files |
| 4 | Valid queue → no pending/in_progress tasks remain | `jq '[.[] | select(.state=="pending" or .state=="in_progress")] | length' output.jsonl` == 0 |
| 5 | Idempotency — re-run produces identical output | Run twice, `diff -q output1.jsonl output2.jsonl` |
| 6 | Done task is skipped | Pre-mark task done; assert side-effect file NOT created on re-run |
| 7 | Max attempts → dead | Task that always fails with max_attempts=3 ends in state=dead |
| 8 | in_progress on startup → reset + attempts++ | Pre-set in_progress; after run, attempts >= 1 |
| 9 | Atomic write survives mid-flight kill | inject-fault then re-run; queue parseable, no duplicates |
| 10 | Sleep cap enforced | payload.ms=999999; returns within 200ms wall time |
| 11 | dry-run has no side effects | --dry-run; assert no files created |
| 12 | Exit 0 when all tasks terminal | dead counts as terminal; unparseable → exit 2 |

---

## External Dependencies
- **stdlib only**: `argparse`, `json`, `os`, `hashlib`, `time`, `tempfile`; `jsonschema` is optional
- jsonschema is optional: when absent, a hand-rolled check mirroring `schema.json` gives the same exit codes (`pip install jsonschema` to use the package)
- No click, typer, requests, or other frameworks

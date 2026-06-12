# Relay — Specification
**Project:** Config-Driven Health Checker (file-based mock — fully hermetic)  
**Version:** 1.0 | **Date:** 2026-05-11 | **Build path:** `execution/tests/ghost-project/relay/`

## One-liner
Relay reads a YAML config of "services" to check and produces a structured health report — using file-based health markers (not real HTTP) for full hermeticity.

## Requirements

1. **Input:** `--config <health.yaml>` — YAML config defining services to check

2. **Config format:**
   ```yaml
   services:
     - name: "database"
       type: file_exists        # healthy if file exists
       path: /var/run/db.pid
       timeout_ms: 100
       expected_content: null   # optional: file must contain this string
     - name: "api"
       type: file_contains      # healthy if file exists AND contains string
       path: /tmp/api.status
       expected_content: "OK"
       timeout_ms: 100
     - name: "cache"
       type: always_up          # test-only: always returns healthy
     - name: "legacy"
       type: always_down        # test-only: always returns unhealthy
   ```

3. **Check types (closed set — hermetic):**
   - `file_exists` — healthy if path exists (any type: file, dir, socket)
   - `file_contains` — healthy if file exists AND contains `expected_content` string
   - `always_up` — always healthy (test affordance)
   - `always_down` — always unhealthy (test affordance)

4. **Output (JSONL to stdout, one object per service):**
   ```json
   {"name": "database", "status": "up"|"down"|"timeout", "checked_at": "ISO8601", "duration_ms": 12, "detail": "str"|null}
   ```
   After all checks, one summary object:
   ```json
   {"summary": true, "total": 4, "up": 3, "down": 1, "all_healthy": false}
   ```

5. **Parallel vs serial execution:** Checks run in the ORDER defined in config (serial). `--parallel` flag enables concurrent execution. This is the TRAP — parallel mode must still produce deterministic output (sort by name).

6. **Timeout:** `timeout_ms` per check. File checks almost never timeout, but use `signal.alarm` or threading with timeout for correctness. If timeout → status=`timeout`.

7. **`--format` flag:** `jsonl` (default) or `table` (human-readable ASCII table to stdout)

8. **`--fail-fast` flag:** Stop after first `down` or `timeout` result. Exit immediately with exit 2.

9. **Exit codes:**
   - `0` — all services healthy
   - `1` — config invalid or file not found
   - `2` — one or more services down or timeout

10. **Config validation (schema-first):** Validate entire config before running any checks. If invalid → exit 1, no checks run.

## Pre-Seeded Traps

**Trap 1 — Parallel output ordering:** `--parallel` uses threads. Output must be sorted by service name, not completion order. If dev just prints as threads complete, test will be non-deterministic.  
**Trap 2 — `timeout_ms` applies to each check:** Not total run time. Spec must be explicit.  
**Trap 3 — `--fail-fast` with parallel:** What does fail-fast mean when checks run concurrently? Spec must say: fail-fast only applies in serial mode. With `--parallel`, always complete all checks.  
**Trap 4 — Summary object last:** Summary object must always be the LAST line. If dev writes it before all checks, diff against expected output fails.  
**Trap 5 — Schema validates type field:** If a service has an unknown type, config is invalid (exit 1), not just that service is down. Agents often assume "unknown = skip", which is wrong.

## Binary Test Assertions (10)

| # | Assertion | Test command |
|---|-----------|-------------|
| 1 | Missing config → exit 1 | `python relay.py --config /nope.yaml; [ $? -eq 1 ]` |
| 2 | Invalid config type → exit 1 | Config with unknown type → `$? == 1` |
| 3 | All healthy → exit 0 | Config with only `always_up` services → `$? == 0` |
| 4 | One down → exit 2 | Config with `always_down` → `$? == 2` |
| 5 | file_exists passes when file present | Create file, check it → `status=up` |
| 6 | file_exists fails when file absent | Don't create file → `status=down` |
| 7 | file_contains passes with correct string | File with "OK" + expected_content="OK" → `status=up` |
| 8 | file_contains fails with wrong string | File with "ERROR" + expected_content="OK" → `status=down` |
| 9 | Parallel output sorted by name | `--parallel` → JSONL sorted by `name` field |
| 10 | Summary is last line | `tail -1 <output>` parses to object with `summary=true` |

## Phases
- **Phase 1:** SPEC.md (✅ done) + validation contract
- **Phase 2:** relay.py — config parsing, 4 check types, serial execution, output
- **Phase 3:** relay.py parallel mode + QA test suite + fixtures
- **Phase 4:** README.md + brain wrap-up tagged `ghost-project,relay`

## Dependencies
- stdlib only: `yaml` (PyYAML), `json`, `datetime`, `threading`, `signal`, `argparse`
- PyYAML: `pip install pyyaml` if missing

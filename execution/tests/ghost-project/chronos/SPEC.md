# Chronos — Specification
**Project:** Job Scheduler Simulator  
**Dominant trap class:** No-ambient-state (clock ban) + integer-vs-float discipline  
**Date:** 2026-05-11 | **Build path:** `execution/tests/ghost-project/chronos/`

## One-liner
Given jobs with intervals and last-run timestamps, compute next-run schedule relative to a supplied `--now` flag. The system clock is forbidden.

## Requirements

1. **Subcommand `plan`:** `chronos.py plan --jobs jobs.json --now 2026-05-11T12:00:00Z`
   - Emits JSON array of scheduled jobs to stdout
   - Job input schema: `[{"id": "str", "interval_seconds": int, "last_run": "ISO8601Z"|null, "max_skew_seconds": int}]`

2. **ALL time math in integer seconds from epoch.** NEVER call:
   - `time.time()` — FORBIDDEN
   - `datetime.now()` — FORBIDDEN
   - `datetime.utcnow()` — FORBIDDEN
   - `time.monotonic()` — FORBIDDEN
   - Parse ISO8601 manually to epoch int: `int(datetime.fromisoformat(ts.replace('Z','+00:00')).timestamp())`

3. **Overdue detection:** A job is overdue if `now_epoch - last_run_epoch > interval_seconds + max_skew_seconds` (strict `>`, NOT `>=`)
   - Overdue jobs: `"status": "overdue"`, include `"seconds_overdue": N`

4. **Null last_run:** → `"status": "due"`, `next_run = now_epoch`

5. **Normal job:** next_run = last_run_epoch + interval_seconds; status = "ok" or "overdue"

6. **Output:** JSON array sorted by `next_run` ascending, ties broken by `id` lexicographically. All `next_run` values are **integers** (no floats anywhere).
   - Each object: `{"id": "str", "next_run": int, "status": "due"|"ok"|"overdue", "seconds_overdue": int|null}`

7. **Subcommand `catchup`:** `chronos.py catchup --jobs jobs.json --now T --window N`
   - For each overdue job, list all timestamps it SHOULD have run during the last N seconds
   - Cap at 1000 entries per job → exit 12 if exceeded
   - Output: `{"id": "str", "missed_runs": [int, ...]}` per job

8. **Timestamp validation:**
   - Input timestamps MUST end in `Z` → exit 13 if any timestamp uses `+00:00` or other format
   - Zero or negative `interval_seconds` → exit 14

## Exit Codes
- `0` — success
- `12` — catchup cap exceeded (>1000 entries per job)
- `13` — timestamp not in `...Z` format
- `14` — zero or negative interval

## Pre-Seeded Traps (MANDATORY to handle)

**Trap 1 — Clock ban:** NEVER call the system clock. `--now` is the ONLY source of time. Any `time.time()` call causes test 10 to fail via grep.

**Trap 2 — Integer epoch only:** No floats in compute or output. `datetime.timestamp()` returns float — convert with `int()`.

**Trap 3 — Z-suffix strictness:** Only `...Z` accepted. `2026-05-11T12:00:00+00:00` (valid ISO8601) is REJECTED → exit 13.

**Trap 4 — Catchup DoS cap:** `chronos.py catchup --jobs jobs.json --now T --window 99999999` with interval=1 would produce billions of entries. Cap at 1000 per job → exit 12.

**Trap 5 — Overdue uses strict `>`:** `now - last_run == interval + max_skew` is NOT overdue. `>` only.

## Binary Test Assertions (12)

| # | Assertion | How to test |
|---|-----------|-------------|
| 1 | Plan output sorted by next_run, lex tiebreak | `jq -r '.[].id' out.json` matches expected order |
| 2 | Overdue job correctly detected | `jq '.[] \| select(.id=="a") \| .status' == "overdue"` |
| 3 | `seconds_overdue` value correct | jq numeric equality |
| 4 | Null last_run → status "due" | `jq '.[] \| select(.last_run_null) \| .status' == "due"` |
| 5 | Catchup emits correct number of missed runs | jq `.missed_runs \| length` |
| 6 | Catchup cap → exit 12 | interval=1, window=99999999 → `$? == 12` |
| 7 | Non-Z timestamp → exit 13 | `+00:00` format input → `$? == 13` |
| 8 | Zero interval → exit 14 | `$? == 14` |
| 9 | Idempotency: re-plan advances correctly | Plan, advance now past one next_run, re-plan → next is next-next |
| 10 | No system clock calls in source | `! grep -E 'time\.time\(\)\|datetime\.now\(\)\|datetime\.utcnow\(\)' chronos.py` |
| 11 | Integer-only output | `jq '.[].next_run \| type' == "number"` AND no `.` in numeric fields |
| 12 | Year 2099 input works | Use `--now 2099-01-01T00:00:00Z`, confirm correct output |

## Dependencies
- stdlib only: `json`, `argparse`, `datetime`, `sys`

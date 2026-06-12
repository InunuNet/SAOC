# Chronos — Deterministic Job Scheduler

A job scheduler simulator that computes next-run schedules and missed-run catchup lists from a supplied `--now` timestamp. The system clock is forbidden — all time comes from the caller.

## Usage

```bash
# Plan: compute next-run schedule
python3 chronos.py plan --jobs jobs.json --now 2026-05-11T12:00:00Z

# Catchup: list missed runs within a time window
python3 chronos.py catchup --jobs jobs.json --now 2026-05-11T12:00:00Z --window 3600
```

## Job Schema

```json
[
  {
    "id": "my-job",
    "interval_seconds": 3600,
    "last_run": "2026-05-11T10:00:00Z",
    "max_skew_seconds": 60
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique job identifier |
| `interval_seconds` | int | Run interval; must be > 0 |
| `last_run` | string or null | Last run time (must end in `Z`); null = never run |
| `max_skew_seconds` | int | Grace period before a job is considered overdue |

## Output — `plan`

JSON array sorted by `next_run` ascending, ties broken by `id` lexicographically.

```json
[
  {"id": "a", "next_run": 1778500400, "status": "overdue", "seconds_overdue": 400},
  {"id": "c", "next_run": 1778500800, "status": "due",    "seconds_overdue": null},
  {"id": "b", "next_run": 1778502600, "status": "ok",     "seconds_overdue": null}
]
```

| Status | Meaning |
|--------|---------|
| `due` | `last_run` is null — job has never run |
| `ok` | Job is within its interval + skew window |
| `overdue` | `now - last_run > interval + max_skew` (strict `>`) |

## Output — `catchup`

```json
[{"id": "job1", "missed_runs": [1778500100, 1778500400, 1778500700]}]
```

Lists all timestamps the job should have fired within the window. Capped at 1000 per job.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `12` | Catchup cap exceeded (>1000 missed runs per job) |
| `13` | Timestamp not in `...Z` format |
| `14` | Zero or negative `interval_seconds` |

## Time Math Rules

1. All time in **integer epoch seconds** — no floats.
2. Parse ISO8601 via: `int(datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp())`
3. `next_run = last_run_epoch + interval_seconds`
4. `seconds_overdue = now_epoch - last_run_epoch - interval_seconds`
5. Overdue condition: `now_epoch - last_run_epoch > interval_seconds + max_skew_seconds` (strict `>`)
6. System clock calls (`time.time()`, `datetime.now()`, etc.) are **forbidden**.

## Running Tests

```bash
bash tests/run_tests.sh
# Output: PASS 12/12
```

## Dependencies

stdlib only: `json`, `argparse`, `datetime`, `sys`

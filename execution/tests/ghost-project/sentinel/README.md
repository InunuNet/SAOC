# Sentinel — JSONL Dead-Letter Queue Processor

Sentinel is a deterministic JSONL dead-letter-queue processor. It is the Athanor ghost project: a real-world mini-tool built by the agent team to validate the full factory pipeline end-to-end.

---

## Usage

```bash
# Process a queue in-place
python3 sentinel.py --queue queue.jsonl

# Process to a separate output file with verbose logging
python3 sentinel.py --queue queue.jsonl --output out.jsonl --verbose

# Dry run — show what would happen without side effects
python3 sentinel.py --queue queue.jsonl --dry-run

# Process at most 5 tasks
python3 sentinel.py --queue queue.jsonl --max-tasks 5

# Use a custom schema
python3 sentinel.py --queue queue.jsonl --schema /path/to/schema.json
```

---

## CLI Reference

| Flag | Default | Description |
|------|---------|-------------|
| `--queue <path>` | (required) | Input JSONL queue file |
| `--output <path>` | in-place | Output JSONL file |
| `--dry-run` | off | No side effects; shows what would happen |
| `--max-tasks N` | unlimited | Process at most N tasks per run |
| `--schema <path>` | `schema.json` (next to sentinel.py) | JSON Schema (draft-07) |
| `--verbose` | off | Log each state transition |

---

## Schema

Each task in the JSONL queue is one JSON object per line:

```json
{
  "id": "task-001",
  "type": "write_file",
  "payload": {"path": "/tmp/out.txt", "content": "hello"},
  "attempts": 0,
  "max_attempts": 3,
  "state": "pending"
}
```

Valid `type` values and their payload shapes:

| Type | Payload fields |
|------|----------------|
| `write_file` | `path: str`, `content: str` |
| `compute_hash` | `input_path: str`, `output_path: str` |
| `sleep` | `ms: int` (hard-capped at 100ms) |

Valid `state` values: `pending`, `in_progress`, `done`, `failed`, `dead`

---

## State Machine

```
                 ┌─────────────────────────────────────────┐
                 │           STARTUP RECOVERY              │
                 │  in_progress → pending + attempts++     │
                 └─────────────────────────────────────────┘

        ┌─────────┐   pickup      ┌─────────────┐   success   ┌──────┐
        │ pending │ ────────────► │ in_progress │ ──────────► │ done │ (terminal)
        └─────────┘  attempts++   └─────────────┘             └──────┘
             ▲                           │
             │                           │ failure
             │                           ▼
             │                      ┌────────┐
             │  attempts <          │ failed │
             │  max_attempts        └────────┘
             │◄────────────────────── │
             │                        │ attempts >= max_attempts
             │                        ▼
             │                      ┌──────┐
             └──────────────────── │ dead │ (terminal)
                                    └──────┘

Special cases:
  • compute_hash on missing input_path → dead immediately (no retry)
  • sleep ms capped at 100ms regardless of payload value
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tasks in terminal state (`done` or `dead`) |
| `1` | Invalid config, missing file, bad CLI args |
| `2` | Schema validation failure (no side effects created) |
| `3` | Unrecoverable I/O error during execution |

---

## Crash Recovery

On startup, Sentinel scans the queue for any tasks in `in_progress` state. These were interrupted mid-execution. Sentinel resets them to `pending` and increments `attempts` before processing any tasks. This ensures at-least-once execution semantics with bounded retries.

---

## Atomic Writes

Every state transition triggers an atomic queue rewrite:

1. Write new queue state to `<path>.tmp`
2. Call `os.replace(tmp, path)` — atomic on POSIX

`shutil.move` is never used (not guaranteed atomic across filesystems).

---

## Testing (Test Mode)

```bash
# Run all 12 assertions
cd execution/tests/ghost-project/sentinel
bash tests/run_tests.sh

# Run with fault injection (test mode only)
SENTINEL_TEST_MODE=1 python3 sentinel.py \
  --queue queue.jsonl \
  --inject-fault after-task=2
```

The `--inject-fault` flag is only available when `SENTINEL_TEST_MODE=1` is set. It simulates a crash after N tasks by writing to `.tmp` without completing `os.replace`.

---

## Dependencies

- Python 3.10+ (stdlib only: `argparse`, `json`, `os`, `hashlib`, `time`, `tempfile`)
- `jsonschema` — `pip install jsonschema`

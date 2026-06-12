# Relay — Config-Driven Health Checker

Relay reads a YAML config of services and produces a structured health report. All checks are file-based (hermetic — no network required).

## Usage

```bash
python3 relay.py --config health.yaml
python3 relay.py --config health.yaml --parallel
python3 relay.py --config health.yaml --format table
python3 relay.py --config health.yaml --fail-fast
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--config` | required | Path to YAML config file |
| `--parallel` | off | Run all checks concurrently (output sorted by name) |
| `--format` | jsonl | Output format: `jsonl` or `table` |
| `--fail-fast` | off | Stop after first down/timeout (serial mode only) |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All services healthy |
| `1` | Config invalid or file not found |
| `2` | One or more services down or timeout |

## Config Format

```yaml
services:
  - name: "database"
    type: file_exists
    path: /var/run/db.pid
    timeout_ms: 100

  - name: "api"
    type: file_contains
    path: /tmp/api.status
    expected_content: "OK"
    timeout_ms: 200

  - name: "cache"
    type: always_up

  - name: "legacy"
    type: always_down
```

## Check Types

| Type | Healthy if... | Required fields |
|------|---------------|-----------------|
| `file_exists` | `path` exists (file, dir, socket) | `path` |
| `file_contains` | `path` exists AND contains `expected_content` | `path`, `expected_content` |
| `always_up` | Always (test affordance) | none |
| `always_down` | Never (test affordance) | none |

## Output (JSONL)

Each service produces one JSON object:
```json
{"name": "database", "status": "up", "checked_at": "2026-05-11T10:00:00+00:00", "duration_ms": 1, "detail": null}
```

Final line is always the summary:
```json
{"summary": true, "total": 4, "up": 3, "down": 1, "all_healthy": false}
```

Status values: `up`, `down`, `timeout`.

## Running Tests

```bash
cd execution/tests/ghost-project/relay
bash tests/run_tests.sh
```

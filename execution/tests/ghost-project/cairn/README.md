# Cairn

Idempotent task-state accumulator. Reads a list of task IDs, merges them into a persistent state file, and reports how many were added.

## Usage

```
python3 cairn.py <task-list-file> <state-file>
```

- `<task-list-file>` — one task ID per line
- `<state-file>` — path to the JSON state file (created if absent)

## ID Format

```
^[A-Z]{2}-[0-9]{4}$
```

Examples: `AB-0001`, `CD-0002`, `EF-0003`

## State File Format

```json
{"processed":["AB-0001","CD-0002","EF-0003"],"version":1}
```

- Keys sorted alphabetically (`sort_keys=True`)
- No spaces (`separators=(",",":")`)
- Trailing newline
- Written atomically (`.tmp` then `os.replace`)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 3 | Invalid task ID — state file untouched |
| 4 | Corrupt or invalid state file |

## Idempotence Guarantee

Running twice with the same inputs produces a byte-identical state file. The second run reports `added=0 total=<N>`.

## Running Tests

```bash
cd tests && bash run_tests.sh
```

Reports `PASS N/12`. Exits non-zero on any failure.

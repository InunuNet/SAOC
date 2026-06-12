# Argus — File Integrity Snapshot + Diff Tool

Argus takes SHA256 snapshots of directory trees and computes diffs between them. It is hermetic (no filesystem watching), stdlib-only, and deterministic.

## Usage

### Snapshot

```bash
python3 argus.py snapshot <dir> --output <snapshot.json> [--ignore <pattern>] [--follow-symlinks] [--verbose]
```

Walk `<dir>`, compute SHA256 for every file, write JSON manifest to `<snapshot.json>` (or stdout if `--output` is omitted).

**`--ignore`** accepts glob patterns and can be specified multiple times:

```bash
python3 argus.py snapshot ./src --output snap.json --ignore "*.pyc" --ignore "__pycache__"
```

### Diff

```bash
python3 argus.py diff <dir> <snapshot.json> [--ignore <pattern>] [--follow-symlinks]
```

Compare current state of `<dir>` to a prior snapshot. Emits JSONL to stdout, one event per line, sorted by path.

```json
{"event": "added"|"removed"|"modified"|"unchanged", "path": "rel/path", "old_hash": null|"abc", "new_hash": "xyz"|null}
```

## Exit Codes

| Command  | Code | Meaning |
|----------|------|---------|
| snapshot | 0 | Success |
| snapshot | 1 | Directory not found |
| snapshot | 3 | I/O error |
| diff | 0 | No changes detected |
| diff | 1 | Changes found (added/removed/modified) — **not an error** |
| diff | 2 | Snapshot file invalid or missing |
| diff | 3 | I/O error |

> Note: diff exit 1 means "changes found", not "error". Wire CI checks accordingly.

## Snapshot Format

```json
{
  "created_at": "2026-05-11T20:37:12+00:00",
  "root": "/absolute/path/to/dir",
  "files": {
    "relative/path/file.txt": {
      "sha256": "abc123...",
      "size_bytes": 1234,
      "mode": "100644"
    }
  }
}
```

## Behaviours

- **Streaming SHA256**: files are hashed in 4096-byte chunks — safe for files of any size.
- **Symlinks**: skipped by default. `--follow-symlinks` enables traversal with inode-based cycle detection.
- **Determinism**: `sort_keys=True` on JSON output; JSONL diff lines sorted by path.
- **Binary files**: hashed regardless of content type.

## Running Tests

```bash
cd execution/tests/ghost-project/argus
bash tests/run_tests.sh
```

Expected: `PASS 10/10`

# Argus — Specification
**Project:** File Integrity Snapshot + Diff Tool  
**Version:** 1.0 | **Date:** 2026-05-11 | **Build path:** `execution/tests/ghost-project/argus/`

## One-liner
Argus takes SHA256 snapshots of directory trees and computes diffs between them — hermetic, no filesystem watching.

## Requirements

1. **Two modes:**
   - `argus.py snapshot <dir> --output <snapshot.json>` — walk dir, compute SHA256 for every file, write JSON manifest
   - `argus.py diff <dir> <snapshot.json>` — compare current state to snapshot, report added/removed/modified/unchanged

2. **Snapshot format (JSON):**
   ```json
   {
     "created_at": "ISO8601",
     "root": "/abs/path",
     "files": {
       "relative/path/file.txt": {"sha256": "abc123...", "size_bytes": 1234, "mode": "100644"}
     }
   }
   ```

3. **Diff output (JSONL to stdout, one event per line):**
   ```json
   {"event": "added"|"removed"|"modified"|"unchanged", "path": "relative/path", "old_hash": null|"abc", "new_hash": "xyz"|null}
   ```

4. **Large file handling:** Files > 10MB → hash with streaming (4096-byte chunks, never read whole file into memory)

5. **Symlink handling:** Skip symlinks by default. `--follow-symlinks` enables traversal. Spec must be explicit.

6. **Binary file handling:** Hash all files regardless of content type — no text/binary distinction.

7. **Exit codes:**
   - Snapshot: `0` = success, `1` = dir not found, `3` = I/O error
   - Diff: `0` = no changes, `1` = changes found (this is the TRAP — agents may expect 0 for "success"), `2` = snapshot file invalid, `3` = I/O error

8. **`--ignore <pattern>` flag:** Glob pattern to exclude files (e.g., `--ignore "*.pyc"`, `--ignore ".git"`). Multiple flags allowed.

9. **Determinism:** Output JSON uses `sort_keys=True`. JSONL diff output sorted by path. Same directory = same output.

## Pre-Seeded Traps

**Trap 1 — Exit code semantics:** Diff exit 1 = "changes found" (not error). Agents may wire CI checks wrong.  
**Trap 2 — Streaming for large files:** If dev reads entire file to memory, test fixture with a 15MB file will expose it.  
**Trap 3 — Symlink infinite loop:** `--follow-symlinks` without cycle detection = infinite recursion. Spec must require cycle detection via visited inode set.  
**Trap 4 — Relative vs absolute paths in snapshot:** Snapshot stores relative paths; diff must strip root prefix correctly or paths won't match.  
**Trap 5 — Mode bits on snapshot file itself:** If argus snapshots the directory containing its own output, next diff will always show "modified". Solution: `--ignore` the output file.

## Binary Test Assertions (10)

| # | Assertion | Test command |
|---|-----------|-------------|
| 1 | Missing dir → exit 1 | `python argus.py snapshot /nonexistent; [ $? -eq 1 ]` |
| 2 | Valid snapshot created | `python argus.py snapshot tests/fixtures/sample_dir --output /tmp/snap.json && jq .files /tmp/snap.json | grep -q sha256` |
| 3 | No changes → diff exits 0 | Snapshot, then immediately diff → `$? == 0` |
| 4 | File added → diff exits 1 | Snapshot, add a file, diff → `$? == 1` |
| 5 | File removed → diff exits 1 | Snapshot, remove a file, diff → `$? == 1` |
| 6 | File modified → diff exits 1 | Snapshot, modify a file, diff → exit 1 AND event=modified in output |
| 7 | Large file → no OOM | Create 15MB file, snapshot → completes under 512MB RSS |
| 8 | Symlink not followed by default | Create symlink in dir, snapshot without --follow-symlinks → symlink not in output |
| 9 | Determinism | Run snapshot twice on same dir → outputs identical byte-for-byte |
| 10 | --ignore works | Create .pyc file, snapshot with `--ignore "*.pyc"` → .pyc not in snapshot |

## Phases
- **Phase 1:** SPEC.md (✅ done) + validation contract
- **Phase 2:** argus.py — snapshot mode, then diff mode
- **Phase 3:** QA writes test_argus.py + run_tests.sh + fixtures (sample_dir with known files)
- **Phase 4:** README.md + brain wrap-up tagged `ghost-project,argus`

## Dependencies
- stdlib only: `os`, `hashlib`, `json`, `fnmatch`, `argparse`

# SPEC: cairn

## One-liner

Idempotent task-state accumulator that merges task IDs from a file into a JSON state file and reports how many were added.

## Requirements

- Accepts exactly two positional arguments: `<task-list-file>` and `<state-file>`.
- Reads one task ID per line from `<task-list-file>`; blank lines are ignored.
- Every task ID must match `^[A-Z]{2}-[0-9]{4}$`. A single invalid ID aborts processing before touching the state file.
- If `<state-file>` does not exist, creates it with an empty `processed` list.
- If `<state-file>` exists and is not valid JSON or does not conform to the expected schema, exits 4 without modifying it.
- Merges new IDs into the existing `processed` list; duplicates are silently ignored (set semantics).
- The `processed` array is stored in sorted order so that input order does not affect output.
- Writes the state file atomically: writes to `<state-file>.tmp`, then calls `os.replace`.
- Prints exactly `added=<N> total=<M>` to stdout on success.
- Running twice with the same inputs produces a byte-identical state file and reports `added=0 total=<M>`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — state file written or unchanged |
| 3 | One or more task IDs failed format validation — state file untouched |
| 4 | State file exists but is corrupt or not a valid cairn state object |

## Pre-seeded Traps

- **Float-point sort**: IDs must be sorted as strings, not numerically. Using `sorted()` on bare strings is correct; converting to any numeric type before sorting is wrong.
- **Partial write on bad ID**: All IDs must be validated before any write. Validating in a loop and writing incrementally will corrupt the state file on error.
- **Non-atomic write**: Writing directly to `<state-file>` leaves a corrupt file if the process is interrupted. Must use `.tmp` + `os.replace`.
- **Space in JSON output**: Using the default `json.dumps()` adds spaces after `:` and `,`. Must pass `separators=(",",":")` for compact output.
- **Missing trailing newline**: The spec requires a trailing newline; omitting it makes the byte-identity check fail.
- **Idempotence via set, not list append**: Appending without deduplication breaks the idempotence guarantee and inflates `total`.
- **Missing `version` key**: The state object must include `"version":1`; omitting it fails the schema check on reload.
- **`sort_keys=False`**: Key order in the JSON output must be alphabetical (`sort_keys=True`); relying on dict insertion order produces `"version"` before `"processed"`.

## Binary Test Assertion Table

| # | Test name | What it tests | Expected outcome |
|---|-----------|---------------|-----------------|
| T1 | fresh run state matches expected_state_a.json | State file content on first run | Byte-identical to fixture |
| T2 | stdout reports added=3 total=3 | stdout format on first run | Exactly `added=3 total=3` |
| T3 | IDEMPOTENCE — second run byte-identical state | State file unchanged on re-run | Bytes before == bytes after |
| T4 | second run stdout added=0 total=3 | Stdout on idempotent re-run | Exactly `added=0 total=3` |
| T5 | resume run state matches expected_state_c.json | Merging tasks into pre-existing state | Byte-identical to fixture |
| T6 | resume stdout reports added=2 total=4 | Stdout when some IDs already present | Exactly `added=2 total=4` |
| T7 | bad ID exits 3 | Exit code on invalid ID | Exit code 3 |
| T8 | bad ID state file not created | State file untouched on invalid ID | File does not exist |
| T9 | corrupt state exits 4 | Exit code on corrupt state file | Exit code 4 |
| T10 | success exits 0 | Exit code on valid run | Exit code 0 |
| T11 | ORDER INVARIANCE — reversed input same state | Input order does not affect output | Byte-identical to T1 fixture |
| T12 | state file format exact | Compact JSON, sorted keys, trailing newline | Matches exact byte sequence |

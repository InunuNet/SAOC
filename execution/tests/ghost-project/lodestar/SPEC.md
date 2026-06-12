# Lodestar — Specification
**Project:** Multi-Source Config Precedence Merger  
**Dominant trap class:** Precedence merge semantics + canonical serialization (byte-exact output)  
**Date:** 2026-05-11 | **Build path:** `execution/tests/ghost-project/lodestar/`

## One-liner
Merge config values from three sources (defaults/env/flags) using deep-merge semantics, with null-as-tombstone, type checking, and byte-exact canonical JSON output.

## Requirements

1. **`lodestar.py merge --defaults d.json --env e.json --flags f.json`** → resolved config to stdout

2. **Canonical JSON output (MANDATORY — byte-exact):**
   ```python
   print(json.dumps(result, sort_keys=True, indent=2))
   # + trailing newline
   ```
   Every test compares with `cmp` or `diff` — byte-exact required.

3. **Precedence (highest to lowest):** `flags > env > defaults` — applied **per leaf key**, NOT per top-level section. A nested key in `defaults` that isn't in `flags` keeps its defaults value even if `flags` overrides a sibling.

4. **Deep-merge for objects:** Nested objects are merged recursively. `dict.update()` is WRONG — it clobbers nested objects.

5. **Lists are REPLACED, never concatenated:**
   - `defaults: {items: [3,4,5]}`, `flags: {items: [1,2]}` → result: `{items: [1,2]}`
   - NOT `{items: [3,4,5,1,2]}`

6. **`null` as tombstone:** A `null` value in a higher-precedence layer **removes the key entirely** from output. The key must not appear in the result JSON (not even as `null`).

7. **Type checking (per leaf, using defaults as the type contract):**
   - If a value in `env` or `flags` has a different Python type than the corresponding value in `defaults` → exit 9
   - List all mismatches on stderr before exiting
   - `null` in higher layers is exempt from type checking (it's a tombstone)
   - Missing keys in higher layers (not present at all) are fine

8. **Missing input file** → exit 11 (file not found, not empty)

9. **Optional `--schema s.json` flag:** validate final merged result against JSON Schema draft-07; schema failure → exit 10

10. **Subcommand `lodestar.py explain key.path.here --defaults d.json --env e.json --flags f.json`:**
    - Prints one line per layer showing that layer's value for the given key path
    - Format: `defaults: <value>`, `env: <value>` or `env: (not set)`, `flags: <value>` or `flags: (not set)`
    - Final line: `resolved: <value>` or `resolved: (tombstoned)`

## Exit Codes
- `0` — success
- `9` — type mismatch (all mismatches listed on stderr)
- `10` — schema validation failure
- `11` — missing input file

## Pre-Seeded Traps (MANDATORY to handle)

**Trap 1 — Deep-merge is NOT `dict.update()`:** `dict.update()` replaces entire nested objects. Must recurse for dicts.

**Trap 2 — Lists REPLACE, not concatenate:** Every merge library default is concat. This spec explicitly forbids it.

**Trap 3 — `null` is a tombstone, not a value:** The key must be ABSENT from output when null is in a higher layer. Not `"key": null`.

**Trap 4 — Type checking is per-leaf using defaults as contract:** `defaults: {port: 80}` defines `port` as int. `env: {port: "80"}` is a type error (str vs int) → exit 9.

**Trap 5 — Canonical JSON is byte-exact:** `sort_keys=True`, `indent=2`, trailing `\n`. Tests use `cmp` — even extra whitespace fails.

## Binary Test Assertions (11)

| # | Assertion | How to test |
|---|-----------|-------------|
| 1 | Shallow override: flags beats defaults | `diff <(lodestar.py merge ...) golden_shallow.json` |
| 2 | Deep merge preserves untouched nested siblings | `diff` to golden |
| 3 | List replacement (not concat) | `diff` to golden showing `[1,2]` not `[3,4,5,1,2]` |
| 4 | Type mismatch → exit 9 | `$? == 9` |
| 5 | All mismatches listed on stderr | count of stderr lines == count of conflicts |
| 6 | Null tombstone: key absent in output | `jq 'has("port")' output.json` == `false` |
| 7 | Schema-valid merge → exit 0 | normal run |
| 8 | Schema-invalid merge → exit 10 | `$? == 10` |
| 9 | Missing file → exit 11 | `$? == 11` |
| 10 | `explain` shows layer sources | each output line matches `^(defaults\|env\|flags\|resolved):` |
| 11 | Byte-exact canonical output | `cmp output.json golden.json` |

## Dependencies
- stdlib only: `json`, `argparse`, `sys`, `os`
- Optional: `jsonschema` (for `--schema` flag)

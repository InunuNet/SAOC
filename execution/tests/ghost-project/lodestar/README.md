# Lodestar — Multi-Source Config Precedence Merger

Merges config values from three sources (defaults / env / flags) using deep-merge semantics,
with null-as-tombstone, type checking, and byte-exact canonical JSON output.

## Usage

```bash
# Merge three config sources
python3 lodestar.py merge --defaults d.json --env e.json --flags f.json

# With optional JSON Schema validation
python3 lodestar.py merge --defaults d.json --env e.json --flags f.json --schema s.json

# Explain a key's value across layers
python3 lodestar.py explain nested.key --defaults d.json --env e.json --flags f.json
```

## Precedence Rules

`flags > env > defaults` — applied **per leaf key**.

- Nested dicts are **deep-merged** (not top-level replaced). A sibling key in `defaults`
  not present in `flags` is preserved even if `flags` overrides another sibling.
- Lists **replace** — never concatenate. `flags: {x: [1,2]}` with `defaults: {x: [3,4,5]}`
  resolves to `{x: [1,2]}`.
- `null` in a higher layer is a **tombstone** — the key is absent from output entirely.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 9 | Type mismatch (all mismatches listed on stderr) |
| 10 | Schema validation failure |
| 11 | Missing input file |

## Output Format

Canonical JSON: `sort_keys=True`, `indent=2`, trailing newline. Byte-exact reproducible.

## Running Tests

```bash
bash tests/run_tests.sh
```

Expected: `PASS 11/11`

## Dependencies

- Python 3.7+ stdlib only (`json`, `argparse`, `sys`, `os`)
- Optional: `jsonschema` for `--schema` flag (`pip install jsonschema`)

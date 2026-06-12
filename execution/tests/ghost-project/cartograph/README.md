# Cartograph

Dependency graph resolver. Parses a JSON manifest, validates the schema, detects cycles, and emits a deterministic lexicographic topological install order.

## Usage

```bash
# Resolve install order
python3 cartograph.py resolve manifest.json

# Show why a package is needed (reads manifest from stdin)
python3 cartograph.py why <pkg> < manifest.json
```

## Manifest Format

```json
{
  "packages": {
    "mylib": {
      "version": "1.2.3",
      "deps": ["other-pkg"]
    }
  }
}
```

Schema validated against `schema.json` (JSON Schema draft-07) before any graph traversal.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Cycle detected (printed to stderr as `a -> b -> c -> a`) |
| 3 | Missing dependency (printed to stderr as `Missing dependency: <name>`) |
| 4 | Package unreachable (`why` subcommand) |
| 5 | Schema validation error |

## Running Tests

```bash
bash tests/run_tests.sh
```

Reports `PASS 11/11` or `FAIL N/11`. Exits 0 on full pass.

All 11 test assertions pass with the current implementation.

## Algorithm

- **Topological sort**: Kahn's algorithm with `heapq` (min-heap) for lexicographically stable ordering.
- **Cycle detection**: DFS with in-stack marking; canonical form is the lex-smallest rotation.
- **`why` command**: BFS from all roots (packages with no dependents) for shortest path.

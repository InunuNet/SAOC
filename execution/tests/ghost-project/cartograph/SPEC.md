# Cartograph — Specification
**Project:** Dependency Graph Resolver  
**Dominant trap class:** Graph algorithm determinism (stable topo sort, canonical cycle form, BFS vs DFS)  
**Date:** 2026-05-11 | **Build path:** `execution/tests/ghost-project/cartograph/`

## One-liner
Parse a JSON dependency manifest, detect cycles, and emit a deterministic lexicographic topological install order.

## Requirements

1. **Input manifest format:**
   ```json
   {
     "packages": {
       "name": {
         "deps": ["other_pkg", ...],
         "version": "x.y.z"
       }
     }
   }
   ```

2. **Schema validation FIRST:** Validate manifest against bundled `schema.json` (JSON Schema draft-07) BEFORE any graph traversal. Schema error → exit 5, no traversal.

3. **Subcommand `cartograph.py resolve manifest.json`:**
   - On success (no cycles, no missing deps): print install order, one package per line, to stdout. Exit 0.
   - Topological sort MUST be **lexicographically stable**: use **Kahn's algorithm with a min-heap** (not a plain queue, not DFS). Python: `import heapq`.

4. **Cycle detection → exit 2:**
   - Print cycle to stderr as: `a -> b -> c -> a` (starting node repeated at end)
   - Cycle representation must be the **lexicographically smallest rotation**: if cycle contains nodes `[b, c, a]`, the canonical form starts with the lex-smallest node → `a -> b -> c -> a`

5. **Missing dependency → exit 3:**
   - A package is referenced in `deps` but not declared in `packages`
   - Print to stderr: `Missing dependency: <name>` (name the specific missing dep)

6. **Self-dependency** (`a` depends on `a`) → exit 2 (cycle of length 1): `a -> a`

7. **Subcommand `cartograph.py why <pkg> < manifest.json`:**
   - Find the **shortest path** (BFS from all roots) to `<pkg>`, print one node per line (root first, `<pkg>` last)
   - Unreachable → exit 4, print `unreachable` to stderr
   - "Roots" = packages with no incoming edges (nothing depends on them)

## Exit Codes
- `0` — success
- `2` — cycle detected
- `3` — missing dependency
- `4` — package unreachable (why subcommand)
- `5` — schema validation error

## Pre-Seeded Traps (MANDATORY to handle)

**Trap 1 — Lex-stable topo sort requires min-heap:** DFS gives undefined ordering. Kahn's with a plain `deque` gives insertion-order. Only `heapq` gives lex ordering. Use `heapq.heappush/heappop`.

**Trap 2 — Canonical cycle = lex-smallest rotation:** If DFS finds cycle `[b, c, a]`, must find the rotation starting at `a` (lex-smallest). Algorithm: for each rotation, pick the one where the first element is smallest; break ties by comparing second element, etc.

**Trap 3 — Schema error beats cycle:** A manifest that is BOTH malformed AND contains a cycle → exit 5 (schema), NOT exit 2 (cycle). Validation is first.

**Trap 4 — `why` uses BFS, not DFS:** DFS finds A path; BFS finds the SHORTEST path. For deeply nested graphs they differ. Use `collections.deque` with BFS.

**Trap 5 — Missing dep vs cycle are different exits:** Missing dep = exit 3, not exit 2.

## Manifest Schema (`schema.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["packages"],
  "properties": {
    "packages": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["deps", "version"],
        "properties": {
          "deps": {"type": "array", "items": {"type": "string"}},
          "version": {"type": "string"}
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

## Binary Test Assertions (11)

| # | Assertion | How to test |
|---|-----------|-------------|
| 1 | Linear deps → correct topo order | `diff <(cartograph.py resolve linear.json) expected_linear.txt` |
| 2 | Diamond deps → stable lex order | `diff <(cartograph.py resolve diamond.json) expected_diamond.txt` |
| 3 | Cycle detection → exit 2 | `$? == 2` |
| 4 | Cycle output canonical lex form | stderr matches `a -> b -> c -> a` exactly |
| 5 | Self-cycle → exit 2 | `$? == 2` |
| 6 | Missing dep → exit 3 | `$? == 3` |
| 7 | Missing dep names culprit | stderr contains the missing package name |
| 8 | Schema error beats cycle | malformed+cycle manifest → `$? == 5` |
| 9 | `why` returns shortest path | `diff <(cartograph.py why c < diamond.json) expected_why.txt` |
| 10 | `why` unreachable → exit 4 | `$? == 4` |
| 11 | Determinism: two runs identical | Run twice, diff outputs → empty diff |

## Test Fixtures to Create

- `tests/fixtures/linear.json` — A→B→C→D (no branches), expected order: A B C D
- `tests/fixtures/diamond.json` — A depends on B and C; B depends on D; C depends on D. Expected: D B C A (lex: D before B, B before C)
- `tests/fixtures/cycle.json` — A→B→C→A (3-cycle)
- `tests/fixtures/self.json` — package "a" with `deps: ["a"]`
- `tests/fixtures/missing.json` — package "a" depends on "libfoo" which isn't declared
- `tests/fixtures/malformed_cycle.json` — missing `version` field (schema error) AND has a cycle
- `expected_linear.txt`, `expected_diamond.txt`, `expected_why.txt`

## Dependencies
- stdlib only: `json`, `argparse`, `heapq`, `collections`, `sys`
- `jsonschema` for schema validation

# Grid — Specification

**Project:** Weighted 2D Grid Pathfinder with Articulation Point Detection
**Dominant trap class:** Pathfinding edge cases (start cost exclusion, identity case, articulation via per-cell removal vs DFS low-link)
**Date:** 2026-05-14 | **Build path:** `execution/tests/ghost-project/grid/`

## One-liner

Parse a 2D character grid, run weighted-shortest-path (Dijkstra), flood-fill reachability (BFS), and articulation/bridge-cell detection (BFS per-cell removal).

## Map Format

Plain text file. One row per line. Each character is one cell:

| Char         | Meaning                                   | Cost |
|--------------|-------------------------------------------|------|
| `1`..`9`     | Passable, cost = digit value              | 1..9 |
| `.`          | Passable                                  | 1    |
| `S`          | Passable (start marker, no special meaning) | 1  |
| `E`          | Passable (end marker, no special meaning)   | 1  |
| `#`          | Wall (impassable)                         | —    |

- Grid is **0-indexed**: top-left = `(0,0)`. First coordinate = **row (R)**, second = **column (C)**.
- Rows may be ragged in source, but treat missing trailing characters as walls if the implementation must rectangularize. (Test fixtures are always rectangular — implementations need not handle ragged input.)
- Movement is **4-directional** (up, down, left, right). **No diagonal movement.**
- Coordinates passed via CLI use the format `R,C` (no spaces, no parens).

## CLI

```
python3 grid.py cheapest-path --map <path> --from <R,C> --to <R,C>
python3 grid.py reachable     --map <path> --from <R,C>
python3 grid.py bridges       --map <path>
```

## Commands

### `cheapest-path`

Compute the minimum-cost path from `--from` to `--to` using **Dijkstra's algorithm** with a min-heap (`heapq`).

- **Cost model:** path cost = sum of costs of cells **ENTERED**. The starting cell's cost is **NOT** counted. Only cells you move INTO contribute.
- **Output (success):** a single line — the integer cost — to stdout. Exit 0.
- **Identity case:** if `--from` equals `--to`, output `0` immediately. Skip Dijkstra. Exit 0.
- **Unreachable:** if no path exists, output `UNREACHABLE` to stdout. Exit 0.
- **Start on wall:** if the cell at `--from` is `#`, exit 2. No stdout.
- **End on wall:** if `--to` is `#`, output `UNREACHABLE`. Exit 0. (Walls are simply not in the search frontier.)
- **Out-of-bounds `--from` or `--to`:** exit 2.

### `reachable`

Count the number of passable cells reachable from `--from` via **BFS flood-fill** (4-directional).

- **Output:** integer count to stdout. The count **includes** the start cell. Exit 0.
- **Start on wall:** exit 2. No stdout.
- **Out-of-bounds `--from`:** exit 2.

### `bridges`

Identify all **bridge cells** (articulation points): passable cells whose removal increases the number of connected components of the passable subgraph.

- **Algorithm:** compute baseline `K` = number of connected components among passable cells. For each passable cell `c`: temporarily mark `c` as a wall, recompute `K'`; if `K' > K`, then `c` is a bridge cell. Restore.
- **Walls cannot be bridges** — only passable cells are candidates.
- **Output:** one `R,C` per line, sorted ascending by **R first, then C** within row.
- **No bridges:** output a single line `NONE`. Exit 0.
- **All walls / no passable cells:** output `NONE`. Exit 0.

## Exit Codes

| Code | Condition |
|------|-----------|
| 0    | Success (including `UNREACHABLE`, `NONE`) |
| 2    | `--from` (or `--to`) on a wall, or out-of-bounds, or map file missing |

## Traps (MANDATORY to handle correctly)

1. **Start cell cost is excluded** — path cost = sum of costs of cells **entered**, not including `--from`. If you sum costs of ALL cells in the path, your `cheapest-path` will be off by the start cell's cost. (`9..` from (0,0) to (0,2) where (0,0)=9 should cost 2, not 11.)

2. **`--from == --to` short-circuits to `0`** — output `0` and exit before running Dijkstra. (A naive Dijkstra that pushes start with cost `grid[from]` may instead emit the start cell's cost, not 0.)

3. **`--from` on a wall → exit 2** for both `cheapest-path` AND `reachable`. Do not output a count or a path. This is a precondition violation.

4. **Bridges are passable cells only** — walls cannot be bridge cells. Skip walls during the candidate loop. (A loop over `for r,c in grid:` that doesn't filter walls will both waste time AND potentially mis-report.)

5. **Bridges output is sorted by R asc, then C asc** — not the natural enumeration order, not insertion order. Sort the final list `(R,C)` tuples lexicographically before printing.

6. **Single passable cell case** — `reachable` returns `1`, `bridges` returns `NONE`. Removing the one cell drops component count from 1 to 0, which is **not an increase**, so it is not a bridge.

7. **Disconnected grid** —
   - `reachable` counts only the component containing `--from`.
   - `cheapest-path` to a cell in a different component returns `UNREACHABLE`.
   - `bridges` operates on the union of all components; baseline `K` may exceed 1.

8. **`S` and `E` are NOT special** — they are passable cells with cost 1. Do not treat them as required endpoints. Coordinates come from `--from` / `--to` flags only. The characters are decorative for human map readers.

9. **Do NOT use Tarjan's DFS low-link for bridges** — the SPEC mandates per-cell BFS removal test. Tarjan's algorithm finds bridge **edges** in classical graph theory; here we want articulation **cells** (vertices), and the spec defines correctness by "removal increases component count". Implement that literal definition.

10. **4-directional movement only** — never include diagonals. A diagonal-allowing implementation will produce wrong costs on weighted grids and incorrect bridge findings.

## Algorithmic Notes

- **Dijkstra:** use `heapq` with `(cost, r, c)` tuples. Skip cells already finalized. Cost to enter cell `(r,c)` is `cell_cost(r,c)`. Stop early when popping target.
- **BFS reachable:** `collections.deque`, visited set; standard flood-fill.
- **Bridges baseline:** run BFS/Union-Find over ALL passable cells, count components. For each passable cell, run again with that cell masked.

## Dependencies

stdlib only: `argparse`, `heapq`, `collections`, `sys`.

## File Layout

```
grid/
├── SPEC.md                            (this file)
├── grid.py                            (to be implemented by @dev)
└── tests/
    ├── run_tests.sh                   (15 test cases)
    └── fixtures/
        ├── map_simple_3x3.txt
        ├── map_weighted.txt
        ├── map_blocked.txt
        ├── map_se_markers.txt
        ├── map_walls_only.txt
        ├── map_single.txt
        ├── map_chain.txt
        ├── map_square_2x2.txt
        ├── map_disconnected.txt
        ├── map_wall_start.txt
        └── map_partial.txt
```

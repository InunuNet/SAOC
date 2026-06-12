#!/usr/bin/env python3
"""Weighted 2D Grid Pathfinder with Articulation Point Detection."""

import argparse
import heapq
import sys
from collections import deque


def parse_map(path):
    """Return grid as list-of-lists of chars. Exit 2 if file missing."""
    try:
        with open(path) as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        sys.exit(2)
    return [list(line) for line in lines if line]


def cell_cost(grid, r, c):
    """Return movement cost to enter cell (r,c). Returns None if wall."""
    ch = grid[r][c]
    if ch == '#':
        return None
    if ch.isdigit():
        return int(ch)
    return 1  # '.', 'S', 'E'


def is_passable(grid, r, c):
    return grid[r][c] != '#'


def in_bounds(grid, r, c):
    return 0 <= r < len(grid) and 0 <= c < len(grid[r])


DIRS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def bfs_reachable(grid, start_r, start_c, mask=None):
    """BFS flood-fill from (start_r, start_c). mask is a set of blocked cells.
    Returns count of reachable passable cells (including start)."""
    if mask and (start_r, start_c) in mask:
        return 0
    if not is_passable(grid, start_r, start_c):
        return 0
    visited = {(start_r, start_c)}
    q = deque([(start_r, start_c)])
    while q:
        r, c = q.popleft()
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if not in_bounds(grid, nr, nc):
                continue
            if (nr, nc) in visited:
                continue
            if mask and (nr, nc) in mask:
                continue
            if not is_passable(grid, nr, nc):
                continue
            visited.add((nr, nc))
            q.append((nr, nc))
    return len(visited)


def count_components(grid, mask=None):
    """Count connected components of passable cells (excluding mask)."""
    rows = len(grid)
    visited = set()
    components = 0
    for r in range(rows):
        for c in range(len(grid[r])):
            if mask and (r, c) in mask:
                continue
            if not is_passable(grid, r, c):
                continue
            if (r, c) in visited:
                continue
            # BFS from here
            q = deque([(r, c)])
            visited.add((r, c))
            while q:
                cr, cc = q.popleft()
                for dr, dc in DIRS:
                    nr, nc = cr + dr, cc + dc
                    if not in_bounds(grid, nr, nc):
                        continue
                    if (nr, nc) in visited:
                        continue
                    if mask and (nr, nc) in mask:
                        continue
                    if not is_passable(grid, nr, nc):
                        continue
                    visited.add((nr, nc))
                    q.append((nr, nc))
            components += 1
    return components


def cmd_cheapest_path(args):
    grid = parse_map(args.map)

    # Parse coordinates
    try:
        fr, fc = map(int, args.from_.split(','))
        tr, tc = map(int, args.to.split(','))
    except ValueError:
        sys.exit(2)

    # Out-of-bounds check
    if not in_bounds(grid, fr, fc) or not in_bounds(grid, tr, tc):
        sys.exit(2)

    # --from on wall -> exit 2
    if not is_passable(grid, fr, fc):
        sys.exit(2)

    # Identity case
    if fr == tr and fc == tc:
        print(0)
        return

    # --to on wall -> UNREACHABLE
    if not is_passable(grid, tr, tc):
        print("UNREACHABLE")
        return

    # Dijkstra — cost = sum of costs of cells ENTERED (not start cell)
    dist = {}
    heap = [(0, fr, fc)]
    while heap:
        cost, r, c = heapq.heappop(heap)
        if (r, c) in dist:
            continue
        dist[(r, c)] = cost
        if r == tr and c == tc:
            print(cost)
            return
        for dr, dc in DIRS:
            nr, nc = r + dr, c + dc
            if not in_bounds(grid, nr, nc):
                continue
            if (nr, nc) in dist:
                continue
            enter_cost = cell_cost(grid, nr, nc)
            if enter_cost is None:
                continue  # wall
            heapq.heappush(heap, (cost + enter_cost, nr, nc))

    print("UNREACHABLE")


def cmd_reachable(args):
    grid = parse_map(args.map)

    try:
        fr, fc = map(int, args.from_.split(','))
    except ValueError:
        sys.exit(2)

    if not in_bounds(grid, fr, fc):
        sys.exit(2)

    if not is_passable(grid, fr, fc):
        sys.exit(2)

    count = bfs_reachable(grid, fr, fc)
    print(count)


def cmd_bridges(args):
    grid = parse_map(args.map)

    # Collect all passable cells
    passable = []
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if is_passable(grid, r, c):
                passable.append((r, c))

    if not passable:
        print("NONE")
        return

    baseline = count_components(grid)

    bridge_cells = []
    for (r, c) in passable:
        mask = {(r, c)}
        k_prime = count_components(grid, mask=mask)
        if k_prime > baseline:
            bridge_cells.append((r, c))

    bridge_cells.sort()

    if not bridge_cells:
        print("NONE")
    else:
        for r, c in bridge_cells:
            print(f"{r},{c}")


def main():
    parser = argparse.ArgumentParser(description="Weighted 2D Grid Pathfinder")
    subparsers = parser.add_subparsers(dest='command')

    # cheapest-path
    cp = subparsers.add_parser('cheapest-path')
    cp.add_argument('--map', required=True)
    cp.add_argument('--from', dest='from_', required=True)
    cp.add_argument('--to', required=True)

    # reachable
    rp = subparsers.add_parser('reachable')
    rp.add_argument('--map', required=True)
    rp.add_argument('--from', dest='from_', required=True)

    # bridges
    bp = subparsers.add_parser('bridges')
    bp.add_argument('--map', required=True)

    args = parser.parse_args()

    if args.command == 'cheapest-path':
        cmd_cheapest_path(args)
    elif args.command == 'reachable':
        cmd_reachable(args)
    elif args.command == 'bridges':
        cmd_bridges(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()

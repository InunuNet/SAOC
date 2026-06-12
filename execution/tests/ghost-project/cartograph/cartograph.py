#!/usr/bin/env python3
"""Cartograph — dependency graph resolver with cycle detection and path queries."""

import argparse
import collections
import heapq
import json
import sys
from pathlib import Path


def load_schema():
    schema_path = Path(__file__).parent / "schema.json"
    with open(schema_path) as f:
        return json.load(f)


def validate_manifest(manifest):
    """Validate manifest against schema.json. Exits 5 on failure."""
    import jsonschema
    schema = load_schema()
    try:
        jsonschema.validate(manifest, schema)
    except jsonschema.ValidationError as e:
        print(e.message, file=sys.stderr)
        sys.exit(5)


def build_graph(packages):
    """Build adjacency list and indegree map. Returns (graph, indeg).
    graph[dep] = list of packages that depend on dep (forward: dep->dependents).
    indeg[pkg] = number of deps pkg has.
    Exits 3 if a referenced dep is not declared."""
    graph = collections.defaultdict(list)
    indeg = {pkg: 0 for pkg in packages}

    for pkg, body in packages.items():
        for dep in body["deps"]:
            if dep not in packages:
                print(f"Missing dependency: {dep}", file=sys.stderr)
                sys.exit(3)
            graph[dep].append(pkg)
            indeg[pkg] += 1

    return graph, indeg


def kahn_topo(packages, graph, indeg):
    """Kahn's algorithm with heapq for lex-stable topological sort.
    Returns sorted order list. If len < len(packages), cycles exist."""
    heap = [p for p, d in indeg.items() if d == 0]
    heapq.heapify(heap)
    order = []
    in_deg = dict(indeg)  # work on a copy

    while heap:
        n = heapq.heappop(heap)
        order.append(n)
        for m in sorted(graph[n]):  # sort for determinism
            in_deg[m] -= 1
            if in_deg[m] == 0:
                heapq.heappush(heap, m)

    return order, in_deg


def find_cycle_canonical(packages, graph, in_deg):
    """Find and return the canonical (lex-smallest rotation) cycle string.
    Handles self-cycles specially."""
    # Collect nodes still in cycle (indegree > 0 after Kahn's)
    residual = {p for p, d in in_deg.items() if d > 0}

    if not residual:
        return None

    # Handle self-cycle: a node that depends on itself
    for pkg in sorted(residual):
        if pkg in [dep for dep in packages[pkg]["deps"] if dep in residual]:
            # self-cycle check
            if pkg in packages[pkg]["deps"]:
                return f"{pkg} -> {pkg}"

    # Find a cycle path via DFS within residual nodes
    # Build restricted adjacency (dep->pkg) within residual
    # We need to trace: pkg depends on dep => dep must come before pkg
    # In our graph: graph[dep] = [pkgs that depend on dep]
    # To find cycle: we need reverse: pkg -> its deps (within residual)
    dep_graph = collections.defaultdict(list)
    for pkg in residual:
        for dep in packages[pkg]["deps"]:
            if dep in residual:
                dep_graph[pkg].append(dep)

    # DFS to find cycle path
    def find_cycle_path(start):
        visited = {}
        path = []

        def dfs(node):
            if node in visited:
                if visited[node] == 'active':
                    # Found cycle — extract it
                    idx = path.index(node)
                    return path[idx:]
                return None
            visited[node] = 'active'
            path.append(node)
            for neighbor in sorted(dep_graph[node]):
                result = dfs(neighbor)
                if result is not None:
                    return result
            visited[node] = 'done'
            path.pop()
            return None

        return dfs(start)

    cycle_nodes = None
    for start in sorted(residual):
        cycle_nodes = find_cycle_path(start)
        if cycle_nodes is not None:
            break

    if cycle_nodes is None:
        return None

    # Find lex-smallest rotation
    n = len(cycle_nodes)
    best = cycle_nodes[:]
    for i in range(n):
        rotation = cycle_nodes[i:] + cycle_nodes[:i]
        if rotation < best:
            best = rotation

    return " -> ".join(best + [best[0]])


def cmd_resolve(args):
    """Resolve subcommand: load manifest from path, validate, topo sort."""
    manifest_path = args.manifest
    with open(manifest_path) as f:
        manifest = json.load(f)

    # Schema validation FIRST
    validate_manifest(manifest)

    packages = manifest["packages"]

    # Build graph + check missing deps (exits 3 if found)
    graph, indeg = build_graph(packages)

    # Kahn's algorithm
    order, in_deg_after = kahn_topo(packages, graph, indeg)

    # Check for cycles
    if len(order) < len(packages):
        cycle_str = find_cycle_canonical(packages, graph, in_deg_after)
        if cycle_str:
            print(cycle_str, file=sys.stderr)
        sys.exit(2)

    # Print install order
    for pkg in order:
        print(pkg)


def cmd_why(args):
    """Why subcommand: read manifest from stdin, BFS from roots to find pkg."""
    manifest = json.load(sys.stdin)

    # Schema validation FIRST
    validate_manifest(manifest)

    packages = manifest["packages"]
    target = args.pkg

    # Build graph + check missing deps
    # graph[dep] = [pkgs that depend on dep]  (reversed dependency edges)
    graph, indeg = build_graph(packages)

    # Roots = packages with no incoming edges (nothing depends on them).
    # In our graph structure, graph[pkg] = [dependents of pkg].
    # pkg appears as a KEY in graph iff something depends on pkg.
    # So roots = packages that do NOT appear as keys with non-empty lists in graph.
    depended_upon = {pkg for pkg, dependents in graph.items() if dependents}
    roots = sorted(p for p in packages if p not in depended_upon)

    if target not in packages:
        print("unreachable", file=sys.stderr)
        sys.exit(4)

    if target in roots:
        # Target is itself a root — path is just the target
        print(target)
        return

    # BFS from roots, traversing via "depends on" edges (pkg -> its deps)
    # "why c?" means: show the path from a root through to c
    # A depends on B: from root A, we traverse to B, then to B's deps, etc.
    queue = collections.deque()
    visited = set()
    for root in roots:
        queue.append((root, [root]))
        visited.add(root)

    while queue:
        node, path = queue.popleft()
        if node == target:
            for p in path:
                print(p)
            return
        for dep in sorted(packages[node]["deps"]):
            if dep not in visited:
                visited.add(dep)
                queue.append((dep, path + [dep]))

    # Not reachable
    print("unreachable", file=sys.stderr)
    sys.exit(4)


def main():
    parser = argparse.ArgumentParser(description="Cartograph dependency resolver")
    subparsers = parser.add_subparsers(dest="command")

    # resolve subcommand
    resolve_parser = subparsers.add_parser("resolve", help="Resolve install order")
    resolve_parser.add_argument("manifest", help="Path to manifest JSON file")

    # why subcommand
    why_parser = subparsers.add_parser("why", help="Find why a package is needed")
    why_parser.add_argument("pkg", help="Package name to trace")

    args = parser.parse_args()

    if args.command == "resolve":
        cmd_resolve(args)
    elif args.command == "why":
        cmd_why(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

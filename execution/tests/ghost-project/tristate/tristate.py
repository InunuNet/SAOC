#!/usr/bin/env python3
"""
Tristate — Task Status Propagation Engine
Spec: SPEC.md | Usage: python3 tristate.py graph.txt
"""

import sys
from collections import deque


# ── parsing ───────────────────────────────────────────────────────────────────

def parse_input(path: str):
    """
    Parse graph file into (nodes, deps, output_node).
    nodes: list of (node_id, outcome, value_or_None) in declaration order
    deps: list of (downstream_id, upstream_id, policy)
    output_node: str
    Exits 2 on any malformed input.
    """
    try:
        with open(path) as f:
            raw = f.read()
    except OSError as exc:
        print(f"ERROR: cannot read input file: {exc}", file=sys.stderr)
        sys.exit(2)

    # Split on exactly one blank line between sections
    sections = raw.strip().split("\n\n")
    if len(sections) != 3:
        print(
            f"ERROR: expected 3 sections separated by blank lines, got {len(sections)}",
            file=sys.stderr,
        )
        sys.exit(2)

    nodes_section, deps_section, output_section = sections

    nodes = _parse_nodes(nodes_section)
    deps = _parse_deps(deps_section)
    output_node = _parse_output(output_section)
    return nodes, deps, output_node


def _parse_nodes(section: str):
    """Parse NODES section. Returns list of (id, outcome, value_or_None)."""
    lines = section.strip().splitlines()
    if not lines or lines[0].strip() != "NODES":
        print("ERROR: first section must start with 'NODES'", file=sys.stderr)
        sys.exit(2)

    seen_ids = set()
    nodes = []
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 2:
            print(f"ERROR: malformed NODES line: {line!r}", file=sys.stderr)
            sys.exit(2)
        node_id = parts[0]
        outcome = parts[1].lower()
        if outcome not in ("ok", "empty", "failed"):
            print(
                f"ERROR: unknown outcome {parts[1]!r} for node {node_id!r} "
                f"(must be ok, empty, or failed)",
                file=sys.stderr,
            )
            sys.exit(2)
        if node_id in seen_ids:
            print(f"ERROR: duplicate node ID {node_id!r}", file=sys.stderr)
            sys.exit(2)
        seen_ids.add(node_id)
        if outcome == "ok":
            if len(parts) < 3:
                print(
                    f"ERROR: node {node_id!r} has outcome=ok but no VALUE", file=sys.stderr
                )
                sys.exit(2)
            # value is everything after the outcome token
            value = " ".join(parts[2:])
        else:
            value = None
        nodes.append((node_id, outcome, value))
    return nodes


def _parse_deps(section: str):
    """Parse DEPS section. Returns list of (downstream_id, upstream_id, policy)."""
    lines = section.strip().splitlines()
    if not lines or lines[0].strip() != "DEPS":
        print("ERROR: second section must start with 'DEPS'", file=sys.stderr)
        sys.exit(2)

    deps = []
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 3:
            print(f"ERROR: malformed DEPS line: {line!r}", file=sys.stderr)
            sys.exit(2)
        downstream_id, upstream_id, policy = parts
        policy = policy.lower()
        if policy not in ("strict", "lenient", "any"):
            print(
                f"ERROR: unknown policy {parts[2]!r} (must be strict, lenient, or any)",
                file=sys.stderr,
            )
            sys.exit(2)
        deps.append((downstream_id, upstream_id, policy))
    return deps


def _parse_output(section: str):
    """Parse OUTPUT section. Returns output node ID."""
    lines = section.strip().splitlines()
    if not lines or lines[0].strip() != "OUTPUT":
        print("ERROR: third section must start with 'OUTPUT'", file=sys.stderr)
        sys.exit(2)

    output_lines = [l.strip() for l in lines[1:] if l.strip()]
    if len(output_lines) != 1:
        print(
            f"ERROR: OUTPUT section must contain exactly one line, got {len(output_lines)}",
            file=sys.stderr,
        )
        sys.exit(2)
    parts = output_lines[0].split()
    if len(parts) != 2 or parts[0] != "OUTPUT":
        print(f"ERROR: malformed OUTPUT line: {output_lines[0]!r}", file=sys.stderr)
        sys.exit(2)
    return parts[1]


# ── validation ────────────────────────────────────────────────────────────────

def validate(nodes, deps, output_node):
    """
    Check all referential integrity and graph constraints.
    Exits 2 on violation.
    """
    node_ids = {n[0] for n in nodes}

    # Unknown NODE_ID in DEPS
    for downstream_id, upstream_id, policy in deps:
        if downstream_id not in node_ids:
            print(
                f"ERROR: unknown node {downstream_id!r} in DEPS", file=sys.stderr
            )
            sys.exit(2)
        if upstream_id not in node_ids:
            print(
                f"ERROR: unknown node {upstream_id!r} in DEPS", file=sys.stderr
            )
            sys.exit(2)
        # Self-dep
        if downstream_id == upstream_id:
            print(
                f"ERROR: self-dependency for node {downstream_id!r}", file=sys.stderr
            )
            sys.exit(2)

    # Mixed policies for same downstream
    downstream_policy: dict[str, str] = {}
    for downstream_id, upstream_id, policy in deps:
        if downstream_id in downstream_policy:
            if downstream_policy[downstream_id] != policy:
                print(
                    f"ERROR: mixed policies for downstream node {downstream_id!r}: "
                    f"{downstream_policy[downstream_id]!r} vs {policy!r}",
                    file=sys.stderr,
                )
                sys.exit(2)
        else:
            downstream_policy[downstream_id] = policy

    # Unknown NODE_ID in OUTPUT
    if output_node not in node_ids:
        print(f"ERROR: unknown node {output_node!r} in OUTPUT", file=sys.stderr)
        sys.exit(2)

    # Cycle detection (Kahn's algorithm)
    _check_cycles(nodes, deps)


def _check_cycles(nodes, deps):
    """Kahn's topological sort — exits 2 if a cycle is detected."""
    node_ids = [n[0] for n in nodes]

    # Build adjacency and in-degree
    successors: dict[str, list[str]] = {nid: [] for nid in node_ids}
    in_degree: dict[str, int] = {nid: 0 for nid in node_ids}

    for downstream_id, upstream_id, _ in deps:
        successors[upstream_id].append(downstream_id)
        in_degree[downstream_id] += 1

    queue = deque([nid for nid in node_ids if in_degree[nid] == 0])
    processed = 0
    while queue:
        nid = queue.popleft()
        processed += 1
        for succ in successors[nid]:
            in_degree[succ] -= 1
            if in_degree[succ] == 0:
                queue.append(succ)

    if processed != len(node_ids):
        print("ERROR: cycle detected in dependency graph", file=sys.stderr)
        sys.exit(2)


# ── evaluation ────────────────────────────────────────────────────────────────

def evaluate(nodes, deps):
    """
    Topological evaluation of node statuses.
    Returns dict: node_id → (outcome, value_or_None)
    """
    node_ids = [n[0] for n in nodes]

    # Build upstream list and policy per downstream
    upstreams: dict[str, list[str]] = {nid: [] for nid in node_ids}
    policy_map: dict[str, str] = {}
    for downstream_id, upstream_id, policy in deps:
        upstreams[downstream_id].append(upstream_id)
        policy_map[downstream_id] = policy

    # Initial statuses from declarations
    status: dict[str, str] = {}
    value: dict[str, str | None] = {}
    for node_id, outcome, val in nodes:
        status[node_id] = outcome
        value[node_id] = val

    # Topological order (Kahn's — nodes without incoming deps first)
    successors: dict[str, list[str]] = {nid: [] for nid in node_ids}
    in_degree: dict[str, int] = {nid: 0 for nid in node_ids}
    for downstream_id, upstream_id, _ in deps:
        successors[upstream_id].append(downstream_id)
        in_degree[downstream_id] += 1

    queue = deque([nid for nid in node_ids if in_degree[nid] == 0])
    topo_order = []
    while queue:
        nid = queue.popleft()
        topo_order.append(nid)
        for succ in successors[nid]:
            in_degree[succ] -= 1
            if in_degree[succ] == 0:
                queue.append(succ)

    # Evaluate in topological order
    for nid in topo_order:
        if not upstreams[nid]:
            # Source node: keep declared status
            continue

        pol = policy_map[nid]
        upstream_statuses = [status[uid] for uid in upstreams[nid]]

        if pol == "any":
            # Keep declared outcome/value regardless
            pass
        elif pol == "strict":
            # Any upstream NOT ok → downstream becomes failed
            if any(s != "ok" for s in upstream_statuses):
                status[nid] = "failed"
                value[nid] = None
        elif pol == "lenient":
            # Any upstream FAILED → downstream becomes failed; empty tolerated
            if any(s == "failed" for s in upstream_statuses):
                status[nid] = "failed"
                value[nid] = None

    return {nid: (status[nid], value[nid]) for nid in node_ids}


# ── output ────────────────────────────────────────────────────────────────────

def format_output(nodes, results, output_node):
    """Print one line per node (declaration order), then OUTPUT line."""
    lines = []
    for node_id, _, _ in nodes:
        outcome, val = results[node_id]
        if outcome == "ok":
            lines.append(f"{node_id} OK {val}")
        elif outcome == "empty":
            lines.append(f"{node_id} EMPTY")
        else:
            lines.append(f"{node_id} FAILED")

    out_outcome, out_val = results[output_node]
    if out_outcome == "ok":
        lines.append(f"OUTPUT: {out_val}")
    elif out_outcome == "empty":
        lines.append("OUTPUT: EMPTY")
    else:
        lines.append("OUTPUT: FAILED")

    return "\n".join(lines)


# ── main ──────────────────────────────────────────────────────────────────────

def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 1:
        print("Usage: tristate.py graph.txt", file=sys.stderr)
        sys.exit(2)

    path = args[0]
    nodes, deps, output_node = parse_input(path)
    validate(nodes, deps, output_node)
    results = evaluate(nodes, deps)
    print(format_output(nodes, results, output_node))
    sys.exit(0)


if __name__ == "__main__":
    main()

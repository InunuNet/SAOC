#!/usr/bin/env python3
"""
dispatch — Conditional-Edge Multi-Target Routing with Deduplication
Spec: SPEC.md

CLI: python3 dispatch.py routes.txt

Commands (tab-separated):
  ROUTE<TAB>SOURCE<TAB>TARGET        — add deduplicated string-target route
  SEND<TAB>SOURCE<TAB>TARGET<TAB>PAYLOAD — add parameterized send (never dedup)
  RESOLVE<TAB>SOURCE                 — output tasks for SOURCE in declaration order

Exit codes:
  0 — success
  2 — malformed line (wrong field count) or unknown command
"""

import sys


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv

    if len(args) != 1:
        print("Usage: dispatch.py routes.txt", file=sys.stderr)
        sys.exit(2)

    routes_file = args[0]

    try:
        with open(routes_file) as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot read {routes_file}: {exc}", file=sys.stderr)
        sys.exit(2)

    # Per-source: list of (kind, target, payload_or_None) in declaration order
    # kind: "route" or "send"
    declarations: dict[str, list[tuple[str, str, str | None]]] = {}
    # Per-source: set of already-seen (TARGET,) for ROUTE dedup
    route_seen: dict[str, set[str]] = {}

    for lineno, raw in enumerate(lines, 1):
        line = raw.rstrip("\n")
        if not line:
            continue

        parts = line.split("\t")
        cmd = parts[0]

        if cmd == "ROUTE":
            if len(parts) != 3:
                print(
                    f"ERROR: line {lineno}: ROUTE requires 3 fields, got {len(parts)}",
                    file=sys.stderr,
                )
                sys.exit(2)
            _, source, target = parts
            if source not in declarations:
                declarations[source] = []
                route_seen[source] = set()
            if target not in route_seen[source]:
                route_seen[source].add(target)
                declarations[source].append(("route", target, None))
            # else: duplicate ROUTE — silent no-op

        elif cmd == "SEND":
            if len(parts) != 4:
                print(
                    f"ERROR: line {lineno}: SEND requires 4 fields, got {len(parts)}",
                    file=sys.stderr,
                )
                sys.exit(2)
            _, source, target, payload = parts
            if source not in declarations:
                declarations[source] = []
                route_seen[source] = set()
            # SEND is NEVER deduplicated — always append
            declarations[source].append(("send", target, payload))

        elif cmd == "RESOLVE":
            if len(parts) != 2:
                print(
                    f"ERROR: line {lineno}: RESOLVE requires 2 fields, got {len(parts)}",
                    file=sys.stderr,
                )
                sys.exit(2)
            _, source = parts
            # Output all declared tasks in order; empty source → no output
            for kind, target, payload in declarations.get(source, []):
                if kind == "route":
                    print(f"TASK {target}")
                else:
                    print(f"TASK {target} {payload}")

        else:
            print(
                f"ERROR: line {lineno}: unknown command {cmd!r}",
                file=sys.stderr,
            )
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()

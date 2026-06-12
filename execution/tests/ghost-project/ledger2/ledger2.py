#!/usr/bin/env python3
"""ledger2 — Dual-Attribute Event Ledger with Independent Query Axes.

Usage: python3 ledger2.py events.txt

Input file format:
  Events section (tab-separated): ORIGIN<TAB>DISPLAY<TAB>TEXT
  Blank line separator
  Queries section: one query per line

Exit 0 on success. Exit 2 on any malformed input or out-of-range access.
"""
import sys

VALID_ORIGINS = {"user", "system", "agent"}
VALID_DISPLAYS = {"prompt", "response", "tool_result"}


def fail(msg=""):
    if msg:
        print(msg, file=sys.stderr)
    sys.exit(2)


def parse_input(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError as e:
        fail(f"Cannot read file: {e}")

    # Split into two sections on exactly one blank line
    # A blank line is a line with no content between newlines
    lines = content.split("\n")

    # Find the blank-line separator
    sep_idx = None
    for i, line in enumerate(lines):
        if line == "":
            sep_idx = i
            break

    if sep_idx is None:
        fail("Missing blank-line separator between events and queries sections")

    event_lines = lines[:sep_idx]
    query_lines = lines[sep_idx + 1:]

    # Remove trailing empty lines from query section
    while query_lines and query_lines[-1] == "":
        query_lines.pop()

    # Parse events
    events = []
    for lineno, line in enumerate(event_lines, start=1):
        if line == "":
            fail(f"Unexpected blank line in events section at line {lineno}")
        parts = line.split("\t", 2)
        if len(parts) < 3:
            fail(f"Event line {lineno} has fewer than 3 tab-separated fields")
        origin, display, text = parts
        if origin not in VALID_ORIGINS:
            fail(f"Invalid ORIGIN '{origin}' at line {lineno}")
        if display not in VALID_DISPLAYS:
            fail(f"Invalid DISPLAY '{display}' at line {lineno}")
        events.append({"origin": origin, "display": display, "text": text})

    return events, query_lines


def run_queries(events, query_lines):
    output_lines = []

    for query_line in query_lines:
        query_line = query_line.rstrip("\r")
        if not query_line:
            continue

        if query_line == "COUNT_REAL_USER":
            # Count events where origin=user (independent of display)
            count = sum(1 for e in events if e["origin"] == "user")
            output_lines.append(str(count))

        elif query_line == "COUNT_MODEL_INPUT":
            # Count events where display=prompt (independent of origin)
            count = sum(1 for e in events if e["display"] == "prompt")
            output_lines.append(str(count))

        elif query_line == "COUNT_BILLABLE":
            # Count events where origin=user AND display=prompt
            count = sum(1 for e in events if e["origin"] == "user" and e["display"] == "prompt")
            output_lines.append(str(count))

        elif query_line.startswith("AUDIT_AUTHOR "):
            parts = query_line.split(" ", 1)
            if len(parts) != 2:
                fail(f"Malformed AUDIT_AUTHOR query: '{query_line}'")
            try:
                n = int(parts[1])
            except ValueError:
                fail(f"AUDIT_AUTHOR requires an integer argument: '{parts[1]}'")
            # 1-indexed
            if n < 1 or n > len(events):
                fail(f"AUDIT_AUTHOR {n} out of range (1..{len(events)})")
            event = events[n - 1]
            output_lines.append(f"ORIGIN:{event['origin']}")

        elif query_line == "REBUILD_CONVERSATION":
            # For each event where display in {prompt, response}: [<display>] <text>
            for e in events:
                if e["display"] in ("prompt", "response"):
                    output_lines.append(f"[{e['display']}] {e['text']}")

        else:
            fail(f"Unknown query: '{query_line}'")

    return output_lines


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} events.txt", file=sys.stderr)
        sys.exit(2)

    events, query_lines = parse_input(sys.argv[1])

    if not query_lines:
        fail("No queries found in input file")

    output = run_queries(events, query_lines)
    print("\n".join(output))


if __name__ == "__main__":
    main()

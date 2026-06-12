#!/usr/bin/env python3
"""
Mirror — Pub/Sub Self-Publish Suppression
Spec: SPEC.md
"""

import sys


def parse_line(line: str, lineno: int):
    """
    Parse a single tab-separated event line.
    Returns (op, fields...) or raises SystemExit(2) on malformed input.
    """
    parts = line.rstrip("\n").split("\t")
    op = parts[0] if parts else ""

    if op == "SUBSCRIBE":
        if len(parts) != 3:
            print(
                f"ERROR: line {lineno}: SUBSCRIBE expects 3 fields, got {len(parts)}",
                file=sys.stderr,
            )
            sys.exit(2)
        _, agent_id, topic = parts
        return ("SUBSCRIBE", agent_id, topic)

    elif op == "PUBLISH":
        # PUBLISH<TAB>AGENT_ID<TAB>TOPIC<TAB>MESSAGE
        # MESSAGE is everything after the 3rd tab — may contain spaces, must NOT contain tabs
        if len(parts) < 4:
            print(
                f"ERROR: line {lineno}: PUBLISH expects at least 4 fields, got {len(parts)}",
                file=sys.stderr,
            )
            sys.exit(2)
        if len(parts) > 4:
            # Extra tabs mean MESSAGE contains a tab — forbidden
            print(
                f"ERROR: line {lineno}: PUBLISH MESSAGE must not contain tabs",
                file=sys.stderr,
            )
            sys.exit(2)
        _, agent_id, topic, message = parts
        return ("PUBLISH", agent_id, topic, message)

    elif op == "INBOX":
        if len(parts) != 2:
            print(
                f"ERROR: line {lineno}: INBOX expects 2 fields, got {len(parts)}",
                file=sys.stderr,
            )
            sys.exit(2)
        _, agent_id = parts
        return ("INBOX", agent_id)

    else:
        print(
            f"ERROR: line {lineno}: unknown operation {op!r}",
            file=sys.stderr,
        )
        sys.exit(2)


def run(events_path: str) -> None:
    """
    Process the events file and print INBOX results.

    Data structures:
      subscriptions: dict[topic, list[agent_id]]  — insertion order preserved
      inboxes:       dict[agent_id, list[message]] — insertion order preserved
    """
    # topic -> list of subscriber agent_ids (insertion order, deduplicated)
    subscriptions: dict[str, list[str]] = {}
    # agent_id -> list of received messages (insertion order)
    inboxes: dict[str, list[str]] = {}

    try:
        with open(events_path) as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot open {events_path}: {exc}", file=sys.stderr)
        sys.exit(1)

    for lineno, raw in enumerate(lines, 1):
        line = raw.rstrip("\n")
        if not line:
            continue  # skip blank lines

        event = parse_line(line, lineno)
        op = event[0]

        if op == "SUBSCRIBE":
            _, agent_id, topic = event
            if topic not in subscriptions:
                subscriptions[topic] = []
            # Idempotent: only add if not already subscribed
            if agent_id not in subscriptions[topic]:
                subscriptions[topic].append(agent_id)

        elif op == "PUBLISH":
            _, publisher, topic, message = event
            # Deliver to all subscribers EXCEPT the publisher (self-publish suppression)
            subscribers = subscriptions.get(topic, [])
            for subscriber in subscribers:
                if subscriber == publisher:
                    continue  # CRITICAL: skip self-publish
                if subscriber not in inboxes:
                    inboxes[subscriber] = []
                inboxes[subscriber].append(message)

        elif op == "INBOX":
            _, agent_id = event
            messages = inboxes.get(agent_id, [])
            formatted = ", ".join(messages)
            print(f"{agent_id} RECEIVED: [{formatted}]")


def main(argv=None) -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Mirror — Pub/Sub self-publish suppression processor"
    )
    parser.add_argument("events", metavar="events.txt", help="Path to tab-separated events file")
    args = parser.parse_args(argv)

    run(args.events)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
herald2 — Match-Predicate Handler Dispatch
Spec: SPEC.md

Usage: python3 herald2.py handlers.txt messages.txt

For each message, find all handlers whose KEYWORD is a case-insensitive
substring of the message. Sort matching handlers alphabetically by
HANDLER_NAME (case-sensitive lexicographic). Execute the FIRST handler only.

Output per message: MSG_NUM<TAB>HANDLER_NAME<TAB>ACTION_VALUE
                 or MSG_NUM<TAB>UNHANDLED

Exit 0 on success. Exit 2 on malformed input.
"""

import sys


# ── loading ───────────────────────────────────────────────────────────────────

def load_handlers(path: str) -> list[tuple[str, str, str]]:
    """
    Load handlers from a tab-separated file.
    Each line: HANDLER_NAME<TAB>KEYWORD<TAB>ACTION_VALUE

    Returns list of (handler_name, keyword, action_value).
    Empty file → returns [].
    Exits 2 on malformed lines (wrong field count, empty name, empty keyword).
    """
    handlers = []
    try:
        with open(path) as f:
            for lineno, line in enumerate(f, 1):
                line = line.rstrip("\n")
                if not line:
                    continue
                parts = line.split("\t")
                if len(parts) != 3:
                    print(
                        f"ERROR: handlers line {lineno}: expected 3 tab-separated fields, "
                        f"got {len(parts)}: {line!r}",
                        file=sys.stderr,
                    )
                    sys.exit(2)
                handler_name, keyword, action_value = parts
                if not handler_name:
                    print(
                        f"ERROR: handlers line {lineno}: HANDLER_NAME is empty",
                        file=sys.stderr,
                    )
                    sys.exit(2)
                if not keyword:
                    print(
                        f"ERROR: handlers line {lineno}: KEYWORD is empty",
                        file=sys.stderr,
                    )
                    sys.exit(2)
                handlers.append((handler_name, keyword, action_value))
    except OSError as exc:
        print(f"ERROR: cannot read handlers file {path!r}: {exc}", file=sys.stderr)
        sys.exit(1)
    return handlers


def load_messages(path: str) -> list[str]:
    """
    Load messages — one per line.
    Returns list of raw message strings (trailing newline stripped).
    """
    messages = []
    try:
        with open(path) as f:
            for line in f:
                messages.append(line.rstrip("\n"))
    except OSError as exc:
        print(f"ERROR: cannot read messages file {path!r}: {exc}", file=sys.stderr)
        sys.exit(1)
    return messages


# ── dispatch ──────────────────────────────────────────────────────────────────

def dispatch(handlers: list[tuple[str, str, str]], message: str) -> tuple[str, str] | None:
    """
    Find all handlers where keyword is a case-insensitive substring of message.
    Sort matching handlers alphabetically by handler_name (case-sensitive lexicographic).
    Return (handler_name, action_value) of the FIRST match, or None if no match.
    """
    msg_lower = message.lower()
    matches = [
        (handler_name, action_value)
        for handler_name, keyword, action_value in handlers
        if keyword.lower() in msg_lower
    ]
    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0]


# ── main ──────────────────────────────────────────────────────────────────────

def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]

    if len(args) != 2:
        print(
            f"Usage: python3 herald2.py handlers.txt messages.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    handlers_path, messages_path = args

    handlers = load_handlers(handlers_path)
    messages = load_messages(messages_path)

    for msg_num, message in enumerate(messages, 1):
        result = dispatch(handlers, message)
        if result is None:
            print(f"{msg_num}\tUNHANDLED")
        else:
            handler_name, action_value = result
            print(f"{msg_num}\t{handler_name}\t{action_value}")

    sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Find real getSecret('NAME') calls and direct process.env reads of NAME in a TypeScript file.

Structural lint helper. Comments are blanked and string/template literal CONTENTS are masked to `_`
in a second view, both views keeping identical offsets and line numbers. A call is matched on the
MASKED text (so `console.error("getSecret('X')")` or a comment can never count) and the secret NAME
argument, itself a string literal and therefore masked, is read back from the CLEAN text.

A secret that lives in an apphosting.yaml bundle is only visible through getSecret(): production
binds the bundles, not one env var per secret, so a direct process.env read of a bundled name
returns nothing there. Callers therefore require a getSecret call AND no direct env read.

  python3 secret_reads.py --first-call FILE NAME [AFTER_LINE]   line of first real getSecret('NAME')
  python3 secret_reads.py --env-reads FILE NAME                 lines of direct process.env reads

Exit 0 and prints line number(s) when found, 1 and prints nothing when absent, 2 on usage or I/O
error (message on stderr), so an instrument fault never reads as an absence.
"""
import re
import sys

QUOTES = "'\"`"
CALL = re.compile(r"\bgetSecret\s*\(\s*(['\"`])(_*)\1\s*[,)]")
ENV_DOT = re.compile(r"\bprocess\s*\.\s*env\s*\.\s*([A-Za-z_]\w*)")
ENV_BRACKET = re.compile(r"\bprocess\s*\.\s*env\s*\[\s*(['\"`])(_*)\1\s*\]")


def views(raw):
    """Return (clean, masked): comments blanked in both, string contents `_` in masked."""
    clean, masked = [], []
    i, n = 0, len(raw)
    blank = lambda ch: "\n" if ch == "\n" else " "  # noqa: E731
    while i < n:
        ch, nxt = raw[i], raw[i + 1] if i + 1 < n else ""
        if ch == "/" and nxt == "*":
            end = raw.find("*/", i + 2)
            stop = n if end == -1 else end + 2
            for ch2 in raw[i:stop]:
                clean.append(blank(ch2))
                masked.append(blank(ch2))
            i = stop
        elif ch == "/" and nxt == "/":
            while i < n and raw[i] != "\n":
                clean.append(" ")
                masked.append(" ")
                i += 1
        elif ch in QUOTES:
            clean.append(ch)
            masked.append(ch)
            i += 1
            while i < n and raw[i] != ch:
                if raw[i] == "\\" and i + 1 < n:
                    clean.extend((raw[i], raw[i + 1]))
                    masked.extend(("_", "_"))
                    i += 2
                    continue
                clean.append(raw[i])
                masked.append("\n" if raw[i] == "\n" else "_")
                i += 1
            if i < n:
                clean.append(ch)
                masked.append(ch)
                i += 1
        else:
            clean.append(ch)
            masked.append(ch)
            i += 1
    return "".join(clean), "".join(masked)


def _line(text, offset):
    return text.count("\n", 0, offset) + 1


def call_lines(raw, name):
    """Lines of real getSecret('NAME') calls (name read from the clean view)."""
    clean, masked = views(raw)
    return [
        _line(masked, m.start())
        for m in CALL.finditer(masked)
        if clean[m.start(2):m.end(2)] == name
    ]


def env_read_lines(raw, name):
    """Lines of direct process.env.NAME / process.env['NAME'] reads in code."""
    clean, masked = views(raw)
    lines = [_line(masked, m.start()) for m in ENV_DOT.finditer(masked) if m.group(1) == name]
    lines += [
        _line(masked, m.start())
        for m in ENV_BRACKET.finditer(masked)
        if clean[m.start(2):m.end(2)] == name
    ]
    return sorted(lines)


def env_read_names(raw):
    """Every name read directly from process.env in code (dot or bracket form)."""
    clean, masked = views(raw)
    names = {m.group(1) for m in ENV_DOT.finditer(masked)}
    names |= {clean[m.start(2):m.end(2)] for m in ENV_BRACKET.finditer(masked)}
    return names


def secret_call_names(raw):
    """Every name passed to a real getSecret(...) call."""
    clean, masked = views(raw)
    return {clean[m.start(2):m.end(2)] for m in CALL.finditer(masked)}


def main(argv):
    if len(argv) < 4 or argv[1] not in ("--first-call", "--env-reads"):
        print("usage: secret_reads.py --first-call FILE NAME [AFTER] | --env-reads FILE NAME",
              file=sys.stderr)
        return 2
    try:
        with open(argv[2], encoding="utf-8") as handle:
            raw = handle.read()
        if argv[1] == "--first-call":
            after = int(argv[4]) if len(argv) > 4 else 0
            lines = [n for n in call_lines(raw, argv[3]) if n > after][:1]
        else:
            lines = env_read_lines(raw, argv[3])
    except (OSError, ValueError) as exc:
        print(f"secret_reads.py: {type(exc).__name__} on {argv[2]!r}", file=sys.stderr)
        return 2
    if not lines:
        return 1
    print("\n".join(str(n) for n in lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

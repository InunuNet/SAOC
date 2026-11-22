#!/usr/bin/env python3
"""Structural lints over a TypeScript file: real getSecret('NAME') calls, direct process.env reads
of NAME, and "this guard's block contains a top-level return".

THESE ARE STRUCTURAL LINTS, NOT CONTROL-FLOW PROOFS. They read comment-blanked, string-masked text
and match braces; they do not parse TypeScript and do not prove a guard is reachable or that its
return executes (an `if (false)` wrapper, dead code or aliasing can still evade them). The
behavioural route-runner checks own that proof; these catch the plain regressions: the call gone,
read through the wrong accessor, mentioned only in a string or comment, or the refusal block no
longer returning.

Helpers: Comments are blanked and string/template literal CONTENTS are masked to `_`
in a second view, both views keeping identical offsets and line numbers. A call is matched on the
MASKED text (so `console.error("getSecret('X')")` or a comment can never count) and the secret NAME
argument, itself a string literal and therefore masked, is read back from the CLEAN text.

A secret that lives in an apphosting.yaml bundle is only visible through getSecret(): production
binds the bundles, not one env var per secret, so a direct process.env read of a bundled name
returns nothing there. Callers therefore require a getSecret call AND no direct env read.

  python3 secret_reads.py --first-call FILE NAME [AFTER_LINE]   line of first real getSecret('NAME')
  python3 secret_reads.py --env-reads FILE NAME                 lines of direct process.env reads
  python3 secret_reads.py --guard-returns FILE CONDITION [AFTER_LINE]
        the first `if (CONDITION) {` after AFTER_LINE has a `return` at the top level of its own block

Exit 0 and prints line number(s) when found, 1 and prints nothing when absent, 2 on usage or I/O
error (message on stderr), so an instrument fault never reads as an absence. --guard-returns exits 1
when the guard is absent and 4 when it is present but its block has no top-level return.
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


def guard_block_returns(raw, condition, after=0):
    """None if no `if (CONDITION) {` after line `after`; else True/False: does that block's own top
    level (brace depth 1, nested blocks excluded) contain a `return` statement?"""
    _, masked = views(raw)
    start = 0
    for _ in range(after):
        start = masked.find("\n", start) + 1
    head = re.compile(r"\bif\s*\(\s*" + re.escape(condition) + r"\s*\)\s*\{")
    match = head.search(masked, start)
    if not match:
        return None
    depth, top = 1, []
    for ch in masked[match.end():]:
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        top.append(ch if depth == 1 else " ")
    return re.search(r"\breturn\b", "".join(top)) is not None


def main(argv):
    if len(argv) < 4 or argv[1] not in ("--first-call", "--env-reads", "--guard-returns"):
        print("usage: secret_reads.py --first-call FILE NAME [AFTER] | --env-reads FILE NAME"
              " | --guard-returns FILE CONDITION [AFTER]", file=sys.stderr)
        return 2
    try:
        with open(argv[2], encoding="utf-8") as handle:
            raw = handle.read()
        if argv[1] == "--guard-returns":
            verdict = guard_block_returns(raw, argv[3], int(argv[4]) if len(argv) > 4 else 0)
            return 1 if verdict is None else (0 if verdict else 4)
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

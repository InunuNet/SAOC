#!/usr/bin/env python3
"""Emit a file's CODE only, with line numbers preserved, so a source-ORDER claim cannot be
satisfied by prose.

WHY THIS EXISTS. A4's ordering claim used an awk filter that skipped a line only when its LEADING
non-whitespace was a comment marker. A trailing comment therefore counted as code, and @qa proved
three mutations against real source that left the gate green:

  P1  delete the RECOVERY_TOKEN_SECRET guard, leave `const decoy = 0; // RECOVERY_TOKEN_SECRET ...`
  P3  move the real env read to the END of the file, after the write, leaving a trailing comment
      where it used to be — so the check asserted no ordering at all
  Q1  replace the amount comparison with `false // AMOUNT_MATCH_TOLERANCE comparison removed`
      — the guard that stops someone paying R1 for an R250 ticket, deletable with the gate green

Control: with the guard gone and no mention anywhere, the check went red. So it detected the total
absence of a STRING and nothing else.

Line comments are stripped only outside string literals, so `'https://…'` survives intact — a naive
truncation at the first `//` would corrupt every URL in the file and could hide a real match sitting
after one. Block comments are tracked across lines. Blank output lines are preserved so line
NUMBERS still correspond to the original file, which is what the ordering claim is expressed in.

  python3 code_lines.py <file>                     emit "<lineno>:<code>" for code-bearing lines
  python3 code_lines.py --first <file> <literal> [after]
                                                   first code line number containing <literal>
                                                   (LITERAL substring, never a regex — the two
                                                   awk-escaping bugs in this contract's checks both
                                                   came from dynamic regexes; there is nothing to
                                                   escape here). Prints nothing and exits 1 if absent.
  python3 code_lines.py --self-test                prove the stripper discriminates, then exit

EXIT CODES ARE THE INTERFACE, and 1 and 3 must never be confused. 0 = found, 1 = GENUINELY ABSENT,
2 = usage error, 3 = THE INSTRUMENT FAILED (unreadable file, a stripper crash) — no verdict is
possible. An uncaught exception would otherwise exit 1, which reads as "absent" and sends the next
reader hunting a defect in the source that is not there. That swallow class has already cost this
contract three incidents; it is closed here rather than at each call site.
"""

import sys

_QUOTES = ("'", '"', "`")


def strip_line(line, in_block):
    """Return (code_only_text, still_in_block) for one line."""
    out = []
    i = 0
    quote = None
    n = len(line)
    while i < n:
        two = line[i:i + 2]
        if in_block:
            if two == "*/":
                in_block = False
                i += 2
            else:
                i += 1
            continue
        if quote:
            out.append(line[i])
            if line[i] == "\\":
                if i + 1 < n:
                    out.append(line[i + 1])
                i += 2
                continue
            if line[i] == quote:
                quote = None
            i += 1
            continue
        if two == "//":
            break
        if two == "/*":
            in_block = True
            i += 2
            continue
        if line[i] in _QUOTES:
            quote = line[i]
            out.append(line[i])
            i += 1
            continue
        out.append(line[i])
        i += 1
    return "".join(out), in_block


def code_lines(text):
    in_block = False
    for number, line in enumerate(text.splitlines(), start=1):
        code, in_block = strip_line(line, in_block)
        yield number, code


CASES = [
    # (source, token, should_be_found_in_code)
    ("const decoy = 0; // RECOVERY_TOKEN_SECRET must be set", "RECOVERY_TOKEN_SECRET", False),
    ("  // RECOVERY_TOKEN_SECRET is read below", "RECOVERY_TOKEN_SECRET", False),
    ("const s = process.env.RECOVERY_TOKEN_SECRET;", "RECOVERY_TOKEN_SECRET", True),
    ("false // AMOUNT_MATCH_TOLERANCE comparison removed", "AMOUNT_MATCH_TOLERANCE", False),
    ("Math.abs(a - b) >= AMOUNT_MATCH_TOLERANCE", "AMOUNT_MATCH_TOLERANCE", True),
    # a URL must survive: naive truncation at the first '//' would eat the rest of the line
    ("const u = 'https://sandbox.example/eng/process'; const x = reserveTicket();",
     "reserveTicket", True),
    ("const u = 'https://sandbox.example/x';", "sandbox.example", True),
    # a token inside a string is code, not prose
    ("const name = 'RECOVERY_TOKEN_SECRET';", "RECOVERY_TOKEN_SECRET", True),
    # block comments, single and multi-line
    ("/* RECOVERY_TOKEN_SECRET */ const y = 1;", "RECOVERY_TOKEN_SECRET", False),
    ("const z = 2; /* trailing */ reserveTicket();", "reserveTicket", True),
]


def self_test():
    failures = []
    for source, token, expected in CASES:
        found = any(token in code for _, code in code_lines(source))
        if found != expected:
            failures.append(
                f"{source!r}: expected token {token!r} "
                f"{'in' if expected else 'absent from'} code, got the opposite"
            )
    multi = "const a = 1; /* start\nRECOVERY_TOKEN_SECRET\nend */ const b = 2;"
    if any("RECOVERY_TOKEN_SECRET" in code for _, code in code_lines(multi)):
        failures.append("a token inside a MULTI-LINE block comment was treated as code")
    numbers = [number for number, _ in code_lines("a\nb\nc")]
    if numbers != [1, 2, 3]:
        failures.append(f"line numbers not preserved: {numbers}")

    if failures:
        print(f"FAIL code_lines self-test — {len(failures)} case(s):", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1
    print(f"PASS code_lines self-test ({len(CASES)} cases + block/​numbering)")
    return 0


def first(path, literal, after=0):
    with open(path) as handle:
        for number, code in code_lines(handle.read()):
            if number > after and literal in code:
                return number
    return None


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "--first":
        if len(sys.argv) not in (4, 5):
            print("usage: code_lines.py --first <file> <literal> [after]", file=sys.stderr)
            return 2
        try:
            after = int(sys.argv[4]) if len(sys.argv) == 5 else 0
            line = first(sys.argv[2], sys.argv[3], after)
        except Exception as error:  # noqa: BLE001 — an instrument fault must not read as absence
            print(
                f"code_lines.py: INSTRUMENT FAILURE on {sys.argv[2]!r}: "
                f"{type(error).__name__}: {error}",
                file=sys.stderr,
            )
            return 3
        if line is None:
            return 1
        print(line)
        return 0
    if len(sys.argv) != 2:
        print("usage: code_lines.py <file> | --first ... | --self-test", file=sys.stderr)
        return 2
    if sys.argv[1] == "--self-test":
        return self_test()
    with open(sys.argv[1]) as handle:
        for number, code in code_lines(handle.read()):
            if code.strip():
                print(f"{number}:{code}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

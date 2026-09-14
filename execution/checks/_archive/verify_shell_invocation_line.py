#!/usr/bin/env python3
"""verify_shell_invocation_line.py -- assertion-shape-sweep F4 Defect 3
repair, generic wiring/safety-check helper for SHELL SCRIPT targets.

The bash-script counterpart to verify_yaml_check_command_contains.py
(which only applies to YAML contract targets). Replaces
contract-f4.yaml's original A1/A4, which grepped execution/hooks/full_boot.sh's
FULL TEXT and could be satisfied (A1) or defeated (A4) by a comment that
merely mentions the checker's filename or a forbidden word, without the
real invocation line ever being examined -- @qa exploited this shape for
real (see DECISION.md Defect 3).

Usage:
  verify_shell_invocation_line.py <script_path> <command_substring>
      [--must-contain SUBSTR]...
      [--must-not-contain SUBSTR]...

Algorithm (full spec: goldens/f4_shell_invocation_line_spec.md):
  1. Read script_path line by line.
  2. For each line, find the first UNQUOTED `#` (a simple, best-effort
     scan -- a `#` inside a single- or double-quoted string is not a
     comment start). Everything before that `#` is the line's "code
     portion"; everything from the `#` onward is comment.
  3. A line is a REAL INVOCATION of command_substring iff command_substring
     appears in the line's code portion. A line where command_substring
     appears only in the comment portion is a comment mention, not an
     invocation, and is ignored entirely. A line that is 100% comment
     (code portion empty/whitespace before the first non-comment token)
     never counts.
  4. Collect all real-invocation lines.
       - Zero found -> FAIL, naming the script and substring.
       - More than one found -> FAIL: ambiguous, cannot uniquely verify.
       - Exactly one found -> proceed with that line's FULL text (code +
         trailing comment both included -- `--must-contain "|| true"`
         needs to see real code that appears before a trailing comment,
         which is legitimately part of what's being asserted about; only
         a comment appearing BEFORE the command substring is excluded).
  5. Assert --must-contain / --must-not-contain against that one line.
  6. Print the located line and a clear PASS/FAIL reason. Exit 0/1.

Correctly classifying an arbitrary shell line's code-vs-comment split in
full generality requires real shell tokenization (nested quoting, escaped
quotes, here-docs, command substitution, etc.) -- deliberately out of
scope for this helper. Quote state IS tracked CONTINUOUSLY across the
whole file (a single- or double-quoted string legitimately spans multiple
physical lines in shell -- this file's own `python3 -c "..."` blocks do
exactly that -- so per-line-independent scanning would misfire on every
such block). What's out of scope: heredocs, command substitution, and
backtick quoting are not specially recognized. Instead of guessing on
input it cannot confidently classify, this helper FAILS LOUDLY (does not
silently guess) if the file ends with an unterminated quote (a real shell
syntax error) or with a trailing backslash-escape, since at that point
"where comments start" cannot be determined with confidence anywhere
downstream of the break. Failing closed on ambiguity is the design;
guessing is not.

CRITICAL corollary (found by @qa as a real false PASS, see DECISION.md
Defect 4): a line whose START is already inside an open quote span
carried over from a PRIOR line is not code at all -- it is string
content -- so it can never be a real invocation, no matter what its own
`#` characters look like. Such a line is EXCLUDED from candidacy
entirely, rather than having its own code/comment split computed (which
would be meaningless -- the whole line is inside someone else's string).
If command_substring happens to appear in the raw text of such a
line anyway, that is surfaced as a loud, distinct FAIL (never silently
ignored) naming the line -- a mention inside an unclosed quote span is a
genuine "cannot confidently classify" case, the same failing-closed
posture as an unterminated file.

KNOWN OVER-CONSERVATIVE CASE (deliberate, not an oversight -- probed and
confirmed by @qa): a physical line that CLOSES a multi-line quote span
partway through and then contains genuine real invocation code AFTER the
closing quote (e.g. `' \n python3 real_invocation.py`) is still excluded
entirely, because `start_dirty` is computed once from the state at the
very first character of the line and applied to the WHOLE line -- it does
not re-classify the tail of the line once the quote closes mid-line. This
under-detects (a real invocation on such a line is missed, producing a
"not actually invoked anywhere" FAIL rather than a PASS) -- it can never
over-detect (there is no way for this to turn a non-invocation into a
false PASS). Consistent with the fail-closed posture ruled above:
resolving the tail of a line correctly would require re-deriving
mid-line state that this helper's simple continuous scan does not track
per-position, and guessing wrong there would risk the false-PASS shape
this whole helper exists to eliminate. If a real invocation ever needs to
share a physical line with a quote-closing character, put it on its own
line instead -- consolidating to one clean-start invocation line is
already this helper's advice for the >1-lines-found case, and applies
here too.
"""
import sys
from pathlib import Path


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def _analyze_lines(text: str, script_path: str) -> list[dict] | None:
    """Walk `text` once, tracking single-/double-quote state CONTINUOUSLY
    across line boundaries (a quoted string may legitimately span multiple
    physical lines in real shell). Returns a list of per-line records
    (one per physical line, aligned with text.split("\\n")):
        {"start_dirty": bool, "code": str}
    `start_dirty` is True iff quote state was already open (in_single or
    in_double) at the very first character of that line -- such a line is
    string content, not code, and must never be treated as an invocation
    candidate (see module docstring). `code` is only meaningful when
    start_dirty is False: the line's code portion (text before the first
    unquoted #).

    Returns None if the file ends inside an open quote or mid-escape --
    caller must treat None as a hard, loud failure, never a silent guess.
    """
    in_single = False
    in_double = False
    in_comment = False
    escaped = False
    records: list[dict] = []
    current_code: list[str] = []
    current_start_dirty = in_single or in_double  # False at very start of file

    for ch in text:
        if ch == "\n":
            # Newline always ends both a comment and (only encountered on
            # a genuine unbalanced/unclosed file) any dangling escape;
            # quote state, in real shell, legitimately carries across the
            # newline and is NOT reset here.
            records.append({"start_dirty": current_start_dirty, "code": "".join(current_code)})
            current_code = []
            in_comment = False
            escaped = False
            current_start_dirty = in_single or in_double
            continue
        if current_start_dirty:
            # This line started inside an open quote span -- it is string
            # content, not classifiable code/comment. Don't bother tracking
            # a code portion for it; still track quote-toggling characters
            # below so state carries correctly into subsequent lines.
            pass
        if in_comment:
            continue
        if escaped:
            current_code.append(ch)
            escaped = False
            continue
        if ch == "\\" and not in_single:
            # Backslash escapes the next char in unquoted/double-quoted
            # context; inside single quotes, backslash is literal (real
            # shell semantics) so it does not escape anything there.
            escaped = True
            current_code.append(ch)
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
            current_code.append(ch)
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            current_code.append(ch)
            continue
        if ch == "#" and not in_single and not in_double:
            in_comment = True
            continue
        current_code.append(ch)

    records.append({"start_dirty": current_start_dirty, "code": "".join(current_code)})

    if in_single or in_double or escaped:
        print(
            f"FAIL: {script_path}: file ends with an unterminated quote or "
            f"dangling escape -- cannot confidently determine the code/comment "
            f"split anywhere in this file; refusing to guess.",
            file=sys.stderr,
        )
        return None

    return records


def main() -> None:
    argv = sys.argv[1:]
    if len(argv) < 2:
        fail(
            "usage: verify_shell_invocation_line.py <script_path> <command_substring> "
            "[--must-contain SUBSTR]... [--must-not-contain SUBSTR]..."
        )

    script_path_arg, command_substring = argv[0], argv[1]
    rest = argv[2:]

    must_contain: list[str] = []
    must_not_contain: list[str] = []
    i = 0
    while i < len(rest):
        flag = rest[i]
        if flag == "--must-contain":
            if i + 1 >= len(rest):
                fail("--must-contain requires a value")
            must_contain.append(rest[i + 1])
            i += 2
        elif flag == "--must-not-contain":
            if i + 1 >= len(rest):
                fail("--must-not-contain requires a value")
            must_not_contain.append(rest[i + 1])
            i += 2
        else:
            fail(f"unrecognized argument: {flag!r}")

    script_path = Path(script_path_arg)
    if not script_path.exists():
        fail(f"script not found: {script_path}")

    try:
        text = script_path.read_text()
    except OSError as e:
        fail(f"{script_path}: could not read file: {type(e).__name__}: {e}")

    # raw_lines is split on '\n' only, matching exactly how _analyze_lines
    # walks the text -- indices line up 1:1 with the returned records.
    raw_lines = text.split("\n")
    records = _analyze_lines(text, str(script_path))
    if records is None:
        # _analyze_lines already printed the FAIL reason.
        sys.exit(1)

    invocations = []  # list of (lineno, full_line_text) -- real candidates only
    dirty_mentions = []  # list of (lineno, full_line_text) -- inside an open quote span
    for lineno, (rec, line) in enumerate(zip(records, raw_lines), start=1):
        if rec["start_dirty"]:
            # This line is string content carried over from a prior line's
            # unclosed quote -- it can never be a real invocation, so it's
            # not a candidate. But a mention here must not be silently
            # swallowed either (that's exactly how the false-PASS
            # happened): flag it loudly instead.
            if command_substring in line:
                dirty_mentions.append((lineno, line))
            continue
        if command_substring in rec["code"]:
            invocations.append((lineno, line))

    if dirty_mentions:
        located = "; ".join(f"line {n}: {raw!r}" for n, raw in dirty_mentions)
        fail(
            f"{command_substring!r} appears on {len(dirty_mentions)} line(s) in "
            f"{script_path} that START inside an open multi-line quote span "
            f"carried over from a prior line -- that text is string content, "
            f"not classifiable as code or comment, so it cannot be confirmed "
            f"or ruled out as the real invocation; refusing to guess. {located}"
        )

    if not invocations:
        fail(
            f"{command_substring!r} is not actually invoked anywhere in "
            f"{script_path} (comment mentions, if any, don't count)."
        )

    if len(invocations) > 1:
        located = ", ".join(f"line {n}" for n, _ in invocations)
        fail(
            f"{command_substring!r} is invoked on {len(invocations)} > 1 lines "
            f"({located}) in {script_path} -- cannot uniquely verify wiring "
            f"properties; consolidate to one invocation or narrow command_substring."
        )

    lineno, located_line = invocations[0]
    print(f"Located invocation at {script_path}:{lineno}: {located_line}")

    problems = []
    for substr in must_contain:
        if substr not in located_line:
            problems.append(f"missing required substring {substr!r}")
    for substr in must_not_contain:
        if substr in located_line:
            problems.append(f"contains forbidden substring {substr!r}")

    if problems:
        fail(
            f"{script_path}:{lineno} failed {len(problems)} propert(y/ies): "
            f"{'; '.join(problems)}. Line: {located_line!r}"
        )

    print(f"PASS: {script_path}:{lineno} satisfies all required properties.")
    sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""A7 (spec directive-channel F1) -- the boot hook's directive block is guarded.

full_boot.sh is CRITICAL: its stdout is folded into the session context verbatim,
and some providers (Grok) discard it entirely. A directive block that ran
unconditionally would print an error on every downstream that has not yet pulled
`execution/directives.py` -- degrading boot everywhere to deliver a feature
nobody has. So this check asserts both halves:

  1. STRUCTURE  -- every reference to directives.py sits inside a single
                   `if [ -f "execution/directives.py" ]; then ... fi` block.
  2. BEHAVIOUR  -- that block, executed verbatim in a workspace WITHOUT the
                   script, exits 0 and prints nothing on stdout or stderr.

It also asserts the template/ mirror is byte-identical, since the mirror is the
copy a downstream actually receives on Path B.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOOK = ROOT / "execution" / "hooks" / "full_boot.sh"
MIRROR = ROOT / "template" / "execution" / "hooks" / "full_boot.sh"
GUARD = 'if [ -f "execution/directives.py" ]; then'

FAILURES: list = []


def check(name: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        FAILURES.append(name)


def block_bounds(lines: list) -> tuple:
    """Return (start, end) line indices of the guarded block, or (None, None)."""
    try:
        start = next(i for i, ln in enumerate(lines) if ln.strip() == GUARD)
    except StopIteration:
        return None, None
    depth = 0
    for idx in range(start, len(lines)):
        stripped = lines[idx].strip()
        if stripped.startswith("if ") or stripped == "if":
            depth += 1
        elif stripped == "fi":
            depth -= 1
            if depth == 0:
                return start, idx
    return start, None


def main() -> int:
    check("hook exists", HOOK.is_file(), f"missing {HOOK}")
    if not HOOK.is_file():
        return 1

    lines = HOOK.read_text(encoding="utf-8").splitlines()
    start, end = block_bounds(lines)
    check("A7.1 the guard `[ -f execution/directives.py ]` is present", start is not None,
          "no existence guard found around the directive block")
    check("A7.2 the guarded block is closed with a matching `fi`", end is not None)
    if start is None or end is None:
        return 1

    refs = [i for i, ln in enumerate(lines) if "directives.py" in ln]
    check("A7.3 the hook actually invokes the tool", bool(refs))
    outside = [i + 1 for i in refs if not (start <= i <= end)]
    check("A7.4 every directives.py reference is inside the one guarded block",
          not outside, f"unguarded reference(s) at line(s) {outside}")
    check("A7.5 exactly one guarded block (not several to drift apart)",
          sum(1 for ln in lines if ln.strip() == GUARD) == 1)

    block = "\n".join(lines[start:end + 1]) + "\n"
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "block.sh"
        script.write_text("set -u\n" + block, encoding="utf-8")
        run = subprocess.run(
            ["bash", str(script)], cwd=tmp, capture_output=True, text=True, timeout=30,
        )
    check("A7.6 the block exits 0 in a workspace without the script",
          run.returncode == 0, f"rc={run.returncode} stderr={run.stderr!r}")
    check("A7.7 the block prints NOTHING when the script is absent",
          run.stdout == "" and run.stderr == "",
          f"stdout={run.stdout!r} stderr={run.stderr!r}")

    check("A7.8 template/ mirror is byte-identical",
          MIRROR.is_file()
          and MIRROR.read_bytes() == HOOK.read_bytes(),
          "the mirror is what a downstream receives on Path B")

    print()
    if FAILURES:
        print(f"FAIL: {len(FAILURES)} check(s): {', '.join(FAILURES)}")
        return 1
    print("PASS: the boot hook's directive block is guarded and degrades silently")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Structural rail for workspace-owns-its-memory A11 (defect D3).

execution/manage_pulse.sh printed `Workspace registered: <path>` at rc=0 on a
machine where every write it attempted had failed, because the success line
sits unconditionally after the append. Behaviour is asserted by the golden
(check_pulse_registration_honest.sh); this check is the cheap structural rail
that keeps the shape from drifting back.

Two claims, both read off the source:

  1. The script creates its own state directory before touching the registry:
     an `mkdir -p` naming the registry's parent appears BEFORE the first
     reference to the registry file itself.
  2. The success report is guarded: between the append to the registry and the
     `Workspace registered` line there is a test of the write -- an `||`
     failure branch, an `if`/`then` around it, or an explicit `set -e`. A bare
     append followed by a bare echo is the defect and fails here.

Exit 0 when both hold; exit 1 with a diagnostic naming the failing claim.
"""
import os
import re
import sys

SCRIPT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "execution",
    "manage_pulse.sh",
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if not os.path.isfile(SCRIPT):
        fail(f"{SCRIPT} not found")

    with open(SCRIPT, encoding="utf-8") as fh:
        lines = fh.read().splitlines()

    # Strip comments so a commented-out example cannot satisfy a claim.
    code = [re.sub(r"(?<!\\)#.*$", "", ln) for ln in lines]

    def first(pattern):
        rx = re.compile(pattern)
        for i, ln in enumerate(code):
            if rx.search(ln):
                return i
        return None

    # ---- Claim 1: the tool creates its own state directory, early. ----------
    mkdir_at = first(r"\bmkdir\s+-p\b")
    if mkdir_at is None:
        fail(
            "manage_pulse.sh never runs `mkdir -p` -- the registry's parent "
            "directory is still assumed to exist (D3a)."
        )
    # The registry is used the moment something touches/greps/appends to it.
    use_at = first(r"(touch|grep|>>)\s.*REG_FILE|REG_FILE.*(<<|>>)")
    if use_at is not None and mkdir_at > use_at:
        fail(
            f"`mkdir -p` appears at line {mkdir_at + 1}, after the registry is "
            f"first used at line {use_at + 1}. The directory must exist before "
            "the first write (D3a)."
        )

    # ---- Claim 2: the success report is guarded by a test of the write. -----
    success_at = first(r"Workspace registered")
    if success_at is None:
        fail("no `Workspace registered` line found -- has the script been renamed?")

    if any(re.search(r"^\s*set\s+-[a-zA-Z]*e", ln) for ln in code):
        # `set -e` makes a failed append fatal before the echo can run.
        sys.exit(0)

    append_at = first(r">>\s*\"?\$\{?REG_FILE")
    if append_at is None:
        fail("no append to the registry found -- cannot verify the success report is guarded.")

    window = code[append_at : success_at + 1]
    guarded = any(
        re.search(r"\|\||\bif\b|\bthen\b|\bexit\b|\breturn\b|&&", ln) for ln in window
    )
    if not guarded:
        fail(
            f"the append at line {append_at + 1} is followed straight to the "
            f"success report at line {success_at + 1} with nothing testing "
            "whether the write happened. A step that failed must not print "
            "success, and rc must say so (D3b)."
        )

    sys.exit(0)


if __name__ == "__main__":
    main()

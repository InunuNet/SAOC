#!/usr/bin/env python3
"""Verification helper for backlog-slim-sidecar-files contract assertions A3–A7.

Usage: python3 execution/checks/verify_backlog_slim.py <subcommand>

Subcommands:
  creates-sidecar    A3 — sidecar file was written for the GEMINI-9 item
  pointer-under-280  A4 — all open lines in resulting backlog are <= 280 chars
  short-untouched    A5 — short item line is byte-identical before/after
  idempotent         A6 — second trim run produces identical backlog output
  sidecar-has-original  A7 — sidecar contains the original full GEMINI-9 text
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
GOLDEN_BEFORE = (
    REPO_ROOT
    / ".agent/memory/project/specs/backlog-slim-sidecar-files/goldens/golden_backlog_before.md"
)
TRIM_PY = REPO_ROOT / "execution" / "backlog_trim.py"
GEMINI9_SLUG = "gemini-9-high-t4-chain-auto-progression"

# Original body of the GEMINI-9 item (the text after "- [ ] " in the fixture)
GEMINI9_ORIGINAL_BODY = (
    "#GEMINI-9: **HIGH** — T4 chain auto-progression is an **architectural constraint**,"
    " not an instruction problem. Gemini CLI returns control to user after each generated"
    " response (turn-based model). Chain Continuous rule in AGENTS.md prevents deliberate"
    " pauses but cannot override framework-level session termination."
    " Fix options: (a) loop script calling `gemini -p \"resume\"` after each step,"
    " (b) mission-aware SessionStart hook that auto-resumes,"
    " (c) Gemini CLI feature request for autonomous chaining mode."
    " Confirmed after multiple test iterations 2026-05-18."
)

SHORT_ITEM_LINE = "- [ ] **feat: short item** — [Brad 2026-06-11] Small fix. **LOW**.\n"


def _run_trim(backlog_path: Path, data_dir: Path) -> None:
    """Run backlog_trim.py with the given path overrides."""
    env = os.environ.copy()
    env["BACKLOG_TRIM_PATH"] = str(backlog_path)
    env["BACKLOG_TRIM_DATA_DIR"] = str(data_dir)
    result = subprocess.run(
        [sys.executable, str(TRIM_PY)],
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"backlog_trim.py failed:\nstdout: {result.stdout}\nstderr: {result.stderr}",
              file=sys.stderr)
        sys.exit(1)


def _setup_temp() -> tuple[Path, Path, Path]:
    """Copy golden fixture to a temp dir. Returns (tmp_dir, backlog_path, data_dir)."""
    tmp_dir = Path(tempfile.mkdtemp(prefix="verify_backlog_slim_"))
    backlog_path = tmp_dir / "backlog.md"
    shutil.copy2(GOLDEN_BEFORE, backlog_path)
    data_dir = tmp_dir / "data"
    data_dir.mkdir()
    return tmp_dir, backlog_path, data_dir


def check_creates_sidecar() -> None:
    """A3: sidecar gemini-9-high-t4-chain-auto-progression.md is created."""
    tmp_dir, backlog_path, data_dir = _setup_temp()
    try:
        _run_trim(backlog_path, data_dir)
        sidecar = data_dir / f"{GEMINI9_SLUG}.md"
        if not sidecar.exists():
            print(f"FAIL A3: sidecar not found at {sidecar}", file=sys.stderr)
            sys.exit(1)
        print("PASS A3: sidecar created")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def check_pointer_under_280() -> None:
    """A4: every open item line in output is <= 280 chars."""
    tmp_dir, backlog_path, data_dir = _setup_temp()
    try:
        _run_trim(backlog_path, data_dir)
        lines = backlog_path.read_text(encoding="utf-8").splitlines(keepends=True)
        violations = [
            l for l in lines
            if re.match(r"^- \[ \]", l) and len(l.rstrip("\n")) > 280
        ]
        if violations:
            print(f"FAIL A4: {len(violations)} line(s) exceed 280 chars:", file=sys.stderr)
            for v in violations:
                print(f"  ({len(v.rstrip())}) {v.rstrip()}", file=sys.stderr)
            sys.exit(1)
        print("PASS A4: all open lines <= 280 chars")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def check_short_untouched() -> None:
    """A5: the short item line is byte-identical before and after trim."""
    tmp_dir, backlog_path, data_dir = _setup_temp()
    try:
        _run_trim(backlog_path, data_dir)
        lines = backlog_path.read_text(encoding="utf-8").splitlines(keepends=True)
        short_lines = [l for l in lines if re.match(r"^- \[ \] \*\*feat: short item\*\*", l)]
        if not short_lines:
            print("FAIL A5: short item line not found in output", file=sys.stderr)
            sys.exit(1)
        if short_lines[0] != SHORT_ITEM_LINE:
            print(
                f"FAIL A5: short item mutated.\n  expected: {repr(SHORT_ITEM_LINE)}"
                f"\n  got:      {repr(short_lines[0])}",
                file=sys.stderr,
            )
            sys.exit(1)
        # Also confirm no sidecar was created for the short item
        short_slug = "feat-short-item-brad-2026-06-11-small-fix"
        sidecar = data_dir / f"{short_slug}.md"
        if sidecar.exists():
            print(f"FAIL A5: unexpected sidecar created for short item: {sidecar}", file=sys.stderr)
            sys.exit(1)
        print("PASS A5: short item untouched")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def check_idempotent() -> None:
    """A6: running trim twice produces identical backlog output."""
    tmp_dir, backlog_path, data_dir = _setup_temp()
    try:
        _run_trim(backlog_path, data_dir)
        after_first = backlog_path.read_text(encoding="utf-8")
        _run_trim(backlog_path, data_dir)
        after_second = backlog_path.read_text(encoding="utf-8")
        if after_first != after_second:
            print("FAIL A6: second trim changed the backlog", file=sys.stderr)
            print(f"  first run length:  {len(after_first)}", file=sys.stderr)
            print(f"  second run length: {len(after_second)}", file=sys.stderr)
            sys.exit(1)
        print("PASS A6: idempotent")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def check_sidecar_has_original() -> None:
    """A7: the generated sidecar contains the full original GEMINI-9 body text."""
    tmp_dir, backlog_path, data_dir = _setup_temp()
    try:
        _run_trim(backlog_path, data_dir)
        sidecar = data_dir / f"{GEMINI9_SLUG}.md"
        if not sidecar.exists():
            print(f"FAIL A7: sidecar not found at {sidecar}", file=sys.stderr)
            sys.exit(1)
        content = sidecar.read_text(encoding="utf-8")
        if GEMINI9_ORIGINAL_BODY not in content:
            print("FAIL A7: sidecar does not contain original GEMINI-9 body text", file=sys.stderr)
            print(f"  sidecar content: {repr(content[:200])}", file=sys.stderr)
            sys.exit(1)
        print("PASS A7: sidecar contains original text")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


SUBCOMMANDS = {
    "creates-sidecar": check_creates_sidecar,
    "pointer-under-280": check_pointer_under_280,
    "short-untouched": check_short_untouched,
    "idempotent": check_idempotent,
    "sidecar-has-original": check_sidecar_has_original,
}


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in SUBCOMMANDS:
        valid = ", ".join(SUBCOMMANDS)
        print(f"Usage: {sys.argv[0]} <{valid}>", file=sys.stderr)
        sys.exit(2)
    SUBCOMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    main()

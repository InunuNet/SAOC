#!/usr/bin/env python3
"""Runs execution/verify_triad_coverage.py over every fixture in goldens/triad-classifier-cases.json
and compares the exit code (m3-f4-gate-hardening F4c). Exit 0 all match, 1 any mismatch, 2 setup."""
import json
import subprocess
import sys
from pathlib import Path

SPEC = Path(__file__).resolve().parents[1]
REPO = SPEC.parents[5]
LINTER = REPO / "execution" / "verify_triad_coverage.py"
FIXTURES = SPEC / "goldens" / "fixtures" / "triad"
CASES = SPEC / "goldens" / "triad-classifier-cases.json"


def exit_code(path: Path) -> int:
    return subprocess.run([sys.executable, str(LINTER), str(path)], capture_output=True, text=True, timeout=30).returncode


def main() -> int:
    if not LINTER.exists() or not CASES.exists():
        print("SETUP: linter or cases file missing")
        return 2
    cases = json.loads(CASES.read_text())
    failed = 0
    for case in cases["cases"]:
        got = exit_code(FIXTURES / case["file"])
        ok = got == case["expect"]
        failed += 0 if ok else 1
        print(f"{'ok' if ok else 'WRONG'} {case['file']} exit {got} (want {case['expect']})")
    got = exit_code(FIXTURES / "does-not-exist.yaml")
    ok = got == cases["missing_file_expect"]
    failed += 0 if ok else 1
    print(f"{'ok' if ok else 'WRONG'} missing file exit {got} (want {cases['missing_file_expect']})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

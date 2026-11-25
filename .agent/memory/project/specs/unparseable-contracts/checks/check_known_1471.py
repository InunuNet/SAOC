#!/usr/bin/env python3
"""check_known_1471.py -- strict validation of FILE may emit ONLY the known InunuNet/Athanor#1471 errors.

execution/contract.py flags any multiline cmd containing "python3" and "-c"; the slug `test-collision`
contains "-c", so A1 and A2 of mission-slug-collision-fix trip it though neither runs `python3 -c`.
Editing the command text to dodge it would be routing around a harness bug, so this check accepts
exactly those two errors (or none, once #1471 lands) and fails on anything else: a parse error, a
different message, or an error naming any assertion id other than A1/A2.

Usage: python3 check_known_1471.py FILE [--contract-py PATH]
"""
import subprocess
import sys

import yaml

KNOWN = {
    "Assertion A1: multiline python3 -c is prohibited — use single-line grep/test instead",
    "Assertion A2: multiline python3 -c is prohibited — use single-line grep/test instead",
}
EXPECTED_IDS = ["A1", "A2", "A3"]


def main(argv):
    args = argv[1:]
    contract_py = "execution/contract.py"
    if "--contract-py" in args:
        i = args.index("--contract-py")
        contract_py = args[i + 1]
        del args[i:i + 2]
    if len(args) != 1:
        print("usage: check_known_1471.py FILE [--contract-py PATH]")
        return 2
    path = args[0]

    with open(path, encoding="utf-8") as fh:
        docs = list(yaml.safe_load_all(fh))
    if len(docs) != 1 or not isinstance(docs[0], dict):
        print(f"FAIL: {path} is not exactly one YAML mapping document")
        return 1
    ids = [c.get("id") for c in docs[0].get("assertions", {}).get("checks", [])]
    if ids != EXPECTED_IDS:
        print(f"FAIL: assertion ids {ids} != {EXPECTED_IDS}")
        return 1

    proc = subprocess.run(
        [sys.executable, contract_py, "validate", "--strict", path],
        capture_output=True, text=True, encoding="utf-8",
    )
    output = (proc.stdout + proc.stderr).strip()
    errors = [ln.strip()[2:].strip() for ln in output.splitlines() if ln.strip().startswith("x ")]
    unexpected = [e for e in errors if e not in KNOWN]
    if unexpected:
        print("FAIL: errors beyond the known #1471 set:")
        for e in unexpected:
            print(f"  {e}")
        return 1
    if proc.returncode != 0 and not errors:
        print(f"FAIL: validate exited {proc.returncode} with no recognisable error line:\n{output}")
        return 1
    print(f"OK: {len(errors)} of {len(KNOWN)} known #1471 errors, nothing else (validate exit {proc.returncode})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""verify_turn_end_readonly.py — turn-timestamps F1 contract A11.

execution/hooks/turn_end_stamp.sh must never call write_last_start_epoch():
the per-session .turn_ts_<session_id>.json's last_start_epoch field is
owned exclusively by inject_pressure.sh's START write (DECISIONS.md D2). A
duplicate/late Stop firing must only ever RE-READ that record, never
overwrite it -- a read-only END hook has one fewer failure mode: it can
never corrupt state the START hook depends on.

This is a plain substring check, not a full AST walk -- a single-line grep
would work equally well, but contract.py gate cannot execute a bare
`python3 -c "..."` multiline snippet (see contract-f1.yaml's notes), so
this is a tiny standalone script instead.

Usage: python3 verify_turn_end_readonly.py
Exits 0 and prints "PASS: ..." on success, 1 with a diagnostic otherwise.
"""
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HOOK_PATH = os.path.join(REPO_ROOT, "execution", "hooks", "turn_end_stamp.sh")

FORBIDDEN = "write_last_start_epoch"


def main():
    if not os.path.isfile(HOOK_PATH):
        print("FAIL (expected until F1 is implemented): execution/hooks/turn_end_stamp.sh does not exist yet")
        sys.exit(1)
    with open(HOOK_PATH) as f:
        content = f.read()
    if FORBIDDEN in content:
        print(f"FAIL: execution/hooks/turn_end_stamp.sh calls {FORBIDDEN}() -- "
              "the END hook must be read-only w.r.t. the per-session START record (D2)")
        sys.exit(1)
    print("PASS: execution/hooks/turn_end_stamp.sh never writes last_start_epoch")


if __name__ == "__main__":
    main()

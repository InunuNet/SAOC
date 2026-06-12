#!/usr/bin/env python3
"""12-assertion test suite for cairn.py."""
import json
import os
import shutil
import subprocess
import sys
import tempfile

CAIRN = os.path.join(os.path.dirname(__file__), "..", "cairn.py")
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

TASKS_A = os.path.join(FIXTURES, "tasks_a.txt")
EXPECTED_A = os.path.join(FIXTURES, "expected_state_a.json")
PREEXISTING_C = os.path.join(FIXTURES, "preexisting_state_c.json")
TASKS_C = os.path.join(FIXTURES, "tasks_c.txt")
EXPECTED_C = os.path.join(FIXTURES, "expected_state_c.json")
TASKS_BAD = os.path.join(FIXTURES, "tasks_bad.txt")


def run(task_file, state_file):
    return subprocess.run(
        [sys.executable, CAIRN, task_file, state_file],
        capture_output=True, text=True
    )


def file_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def assert_diff(path_a, path_b, label):
    a = file_bytes(path_a)
    b = file_bytes(path_b)
    if a != b:
        print(f"FAIL [{label}]: files differ")
        print(f"  got ({path_a}):\n    {a!r}")
        print(f"  expected ({path_b}):\n    {b!r}")
        return False
    return True


results = []


def T(name, passed, detail=""):
    results.append((name, passed, detail))
    status = "PASS" if passed else "FAIL"
    extra = f" — {detail}" if detail and not passed else ""
    print(f"  [{status}] {name}{extra}")


with tempfile.TemporaryDirectory() as tmp:

    # ── Test 1: fresh run produces expected_state_a ──────────────────────────
    state1 = os.path.join(tmp, "state1.json")
    r = run(TASKS_A, state1)
    ok = assert_diff(state1, EXPECTED_A, "T1 state vs expected_a")
    T("T1: fresh run state matches expected_state_a.json", ok)

    # ── Test 2: stdout format ────────────────────────────────────────────────
    T("T2: stdout reports added=3 total=3", r.stdout.strip() == "added=3 total=3",
      repr(r.stdout.strip()))

    # ── Test 3: IDEMPOTENCE — byte-identical on second run ───────────────────
    state2 = os.path.join(tmp, "state2.json")
    shutil.copy(state1, state2)
    bytes_before = file_bytes(state2)
    run(TASKS_A, state2)
    bytes_after = file_bytes(state2)
    T("T3: IDEMPOTENCE — second run byte-identical state", bytes_before == bytes_after,
      f"before={bytes_before!r} after={bytes_after!r}")

    # ── Test 4: second run stdout shows added=0 ──────────────────────────────
    r2 = run(TASKS_A, state2)
    T("T4: second run stdout added=0 total=3", r2.stdout.strip() == "added=0 total=3",
      repr(r2.stdout.strip()))

    # ── Test 5: resume run with preexisting_state_c + tasks_c ────────────────
    state_c = os.path.join(tmp, "state_c.json")
    shutil.copy(PREEXISTING_C, state_c)
    r_c = run(TASKS_C, state_c)
    ok5 = assert_diff(state_c, EXPECTED_C, "T5 state_c vs expected_c")
    T("T5: resume run state matches expected_state_c.json", ok5)

    # ── Test 6: resume stdout ─────────────────────────────────────────────────
    T("T6: resume stdout reports added=2 total=4", r_c.stdout.strip() == "added=2 total=4",
      repr(r_c.stdout.strip()))

    # ── Test 7: bad ID exits 3 ────────────────────────────────────────────────
    state_bad = os.path.join(tmp, "state_bad.json")
    r_bad = run(TASKS_BAD, state_bad)
    T("T7: bad ID → exit 3", r_bad.returncode == 3,
      f"got exit {r_bad.returncode}")

    # ── Test 8: bad ID → state file UNTOUCHED ────────────────────────────────
    T("T8: bad ID → state file not created", not os.path.exists(state_bad),
      "state file was unexpectedly written")

    # ── Test 9: corrupt state → exit 4 ───────────────────────────────────────
    corrupt = os.path.join(tmp, "corrupt.json")
    with open(corrupt, "w") as f:
        f.write("not-valid-json!!!")
    r_corrupt = run(TASKS_A, corrupt)
    T("T9: corrupt state → exit 4", r_corrupt.returncode == 4,
      f"got exit {r_corrupt.returncode}")

    # ── Test 10: exit 0 on success ───────────────────────────────────────────
    state10 = os.path.join(tmp, "state10.json")
    r10 = run(TASKS_A, state10)
    T("T10: success exits 0", r10.returncode == 0, f"got exit {r10.returncode}")

    # ── Test 11: ORDER INVARIANCE ─────────────────────────────────────────────
    # Reverse tasks_a order (no dups), should produce same state as T1
    reversed_tasks = os.path.join(tmp, "tasks_reversed.txt")
    with open(TASKS_A) as f:
        lines = [l.strip() for l in f if l.strip()]
    # remove dups preserving order, then reverse
    seen = []
    seen_set = set()
    for l in lines:
        if l not in seen_set:
            seen.append(l)
            seen_set.add(l)
    with open(reversed_tasks, "w") as f:
        f.write("\n".join(reversed(seen)) + "\n")
    state11 = os.path.join(tmp, "state11.json")
    run(reversed_tasks, state11)
    ok11 = assert_diff(state11, EXPECTED_A, "T11 order-invariance")
    T("T11: ORDER INVARIANCE — reversed input same state", ok11)

    # ── Test 12: state file format matches spec exactly ───────────────────────
    with open(state10, "rb") as f:
        raw = f.read()
    # Must end with newline, no spaces, sorted keys
    ok12 = (
        raw.endswith(b"\n") and
        b" " not in raw and
        raw == b'{"processed":["AB-0001","CD-0002","EF-0003"],"version":1}\n'
    )
    T("T12: state file format exact (no spaces, sorted keys, trailing newline)", ok12,
      repr(raw))

# ── Summary ──────────────────────────────────────────────────────────────────
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"\nPASS {passed}/{total}")
if passed < total:
    sys.exit(1)

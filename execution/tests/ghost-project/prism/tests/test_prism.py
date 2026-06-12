#!/usr/bin/env python3
"""Test suite for prism.py — 12 assertions."""

import json
import os
import subprocess
import sys

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
PRISM = os.path.join(os.path.dirname(__file__), "..", "prism.py")
CONFIG = os.path.join(FIXTURES, "config.json")
INPUT = os.path.join(FIXTURES, "input.txt")
EXPECTED = os.path.join(FIXTURES, "expected.json")
NAN_INPUT = os.path.join(FIXTURES, "nan_input.txt")

passed = 0
failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        print(f"  PASS [{name}]")
        passed += 1
    else:
        print(f"  FAIL [{name}]{': ' + detail if detail else ''}")
        failed += 1


def run_prism(stdin_text=None, stdin_file=None, config=CONFIG):
    """Run prism.py with given input, return (stdout, returncode)."""
    if stdin_file:
        with open(stdin_file) as f:
            stdin_data = f.read()
    else:
        stdin_data = stdin_text or ""
    result = subprocess.run(
        [sys.executable, PRISM, config],
        input=stdin_data,
        capture_output=True,
        text=True,
    )
    return result.stdout, result.returncode


# --- Test 1: diff against expected.json ---
stdout, rc = run_prism(stdin_file=INPUT)
with open(EXPECTED) as f:
    expected_raw = f.read().strip()
ok("1:full_run_exit0", rc == 0, f"exit code={rc}")

# --- Test 2: stdout matches expected.json exactly ---
ok("2:stdout_matches_expected", stdout.strip() == expected_raw,
   f"got={stdout.strip()!r} want={expected_raw!r}")

# --- Test 3: output is valid JSON ---
try:
    parsed = json.loads(stdout)
    ok("3:valid_json", True)
except json.JSONDecodeError as e:
    ok("3:valid_json", False, str(e))
    parsed = {}

# --- Test 4: underflow count correct (2 values: -5, -0.0001) ---
ok("4:underflow_count", parsed.get("underflow") == 2,
   f"underflow={parsed.get('underflow')}")

# --- Test 5: bucket count (should be 4 buckets for boundaries [0,10,20,30]) ---
buckets = parsed.get("buckets", [])
ok("5:bucket_count", len(buckets) == 4, f"len={len(buckets)}")

# --- Test 6: echo 10 → bucket[0] count = 0 (10 goes to bucket[1] [10,20)) ---
stdout6, rc6 = run_prism(stdin_text="10\n")
parsed6 = json.loads(stdout6) if stdout6.strip() else {}
b6 = parsed6.get("buckets", [])
ok("6:boundary_10_not_in_bucket0",
   len(b6) > 0 and b6[0].get("count") == 0,
   f"bucket[0].count={b6[0].get('count') if b6 else 'N/A'}")

# --- Test 7: echo 10 → bucket[1] count = 1 ---
ok("7:boundary_10_in_bucket1",
   len(b6) > 1 and b6[1].get("count") == 1,
   f"bucket[1].count={b6[1].get('count') if len(b6) > 1 else 'N/A'}")

# --- Test 8: empty stdin → exit 0, all counts 0 ---
stdout8, rc8 = run_prism(stdin_text="")
ok("8:empty_stdin_exit0", rc8 == 0, f"exit code={rc8}")
parsed8 = json.loads(stdout8) if stdout8.strip() else {}
all_zero = all(b.get("count") == 0 for b in parsed8.get("buckets", []))
ok("8b:empty_stdin_all_zeros", all_zero and parsed8.get("underflow") == 0,
   f"parsed={parsed8}")

# --- Test 9: nan_input → exit 2 ---
stdout9, rc9 = run_prism(stdin_file=NAN_INPUT)
ok("9:nan_exit2", rc9 == 2, f"exit code={rc9}")

# --- Test 10: nan_input → stdout empty ---
ok("10:nan_stdout_empty", stdout9 == "", f"stdout={stdout9!r}")

# --- Test 11: bucket[3] has 'hi' key (value is null, not absent) ---
ok("11:final_bucket_hi_key_present",
   len(buckets) == 4 and "hi" in buckets[3],
   f"buckets[3]={buckets[3] if len(buckets) == 4 else 'N/A'}")

# --- Test 12: final bucket hi is null ---
ok("12:final_bucket_hi_null",
   len(buckets) == 4 and buckets[3].get("hi") is None,
   f"hi={buckets[3].get('hi') if len(buckets) == 4 else 'N/A'}")

# Summary
total = passed + failed
print(f"\nResults: {passed}/{total} passed")
sys.exit(0 if failed == 0 else 1)

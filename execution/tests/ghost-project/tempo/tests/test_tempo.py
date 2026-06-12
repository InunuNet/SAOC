#!/usr/bin/env python3
"""Test suite for tempo.py — 12 assertions."""

import json
import os
import subprocess
import sys
import tempfile

TEMPO = os.path.join(os.path.dirname(__file__), "..", "tempo.py")
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

PASS = 0
FAIL = 0
RESULTS = []


def run(input_data):
    """Run tempo.py with JSON input string, return CompletedProcess."""
    if isinstance(input_data, dict):
        input_data = json.dumps(input_data)
    return subprocess.run(
        [sys.executable, TEMPO],
        input=input_data,
        capture_output=True,
        text=True,
    )


def fixture_path(name):
    return os.path.join(FIXTURES, name)


def read_fixture(name):
    with open(fixture_path(name)) as f:
        return f.read().strip()


def assert_test(label, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        RESULTS.append(f"  PASS  [{PASS + FAIL:02d}] {label}")
    else:
        FAIL += 1
        RESULTS.append(f"  FAIL  [{PASS + FAIL:02d}] {label}" + (f": {detail}" if detail else ""))


# --- Test 1: in_a → expected_a (no jitter, no cap, delay=400) ---
proc = run(read_fixture("in_a.json"))
expected = read_fixture("expected_a.json")
assert_test(
    "in_a → expected_a (no jitter, no cap, delay=400)",
    proc.returncode == 0 and proc.stdout.strip() == expected,
    f"got={proc.stdout.strip()!r} expected={expected!r}",
)

# --- Test 2: in_b → expected_b (no jitter, capped, delay=5000) ---
proc = run(read_fixture("in_b.json"))
expected = read_fixture("expected_b.json")
assert_test(
    "in_b → expected_b (no jitter, capped, delay=5000)",
    proc.returncode == 0 and proc.stdout.strip() == expected,
    f"got={proc.stdout.strip()!r} expected={expected!r}",
)

# --- Test 3: in_c → expected_c via diff (jitter=full, attempt=1, delay=639) ---
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
    tf_path = tf.name
    with open(fixture_path("in_c.json")) as f:
        tf.write(f.read())

proc = subprocess.run(
    f"{sys.executable} {TEMPO} < {tf_path}",
    shell=True,
    capture_output=True,
    text=True,
)
os.unlink(tf_path)
expected = read_fixture("expected_c.json")
assert_test(
    "in_c → expected_c (full jitter, attempt=1, PRNG=0.639, delay=639)",
    proc.returncode == 0 and proc.stdout.strip() == expected,
    f"got={proc.stdout.strip()!r} expected={expected!r}",
)

# --- Test 4: diff in_c → expected_c ---
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tf:
    tf_path = tf.name
proc_c = subprocess.run(
    [sys.executable, TEMPO],
    stdin=open(fixture_path("in_c.json")),
    capture_output=True,
    text=True,
)
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as out_f:
    out_f.write(proc_c.stdout)
    out_path = out_f.name

diff_proc = subprocess.run(
    ["diff", out_path, fixture_path("expected_c.json")],
    capture_output=True,
    text=True,
)
os.unlink(out_path)
assert_test(
    "diff in_c → expected_c (golden match)",
    diff_proc.returncode == 0,
    f"diff output: {diff_proc.stdout!r}",
)

# --- Test 5: in_d → expected_d (full jitter, attempt=3, delay=1100) ---
proc = run(read_fixture("in_d.json"))
expected = read_fixture("expected_d.json")
assert_test(
    "in_d → expected_d (full jitter, attempt=3, PRNG=0.275, delay=1100)",
    proc.returncode == 0 and proc.stdout.strip() == expected,
    f"got={proc.stdout.strip()!r} expected={expected!r}",
)

# --- Test 6: diff in_d → expected_d ---
proc_d = subprocess.run(
    [sys.executable, TEMPO],
    stdin=open(fixture_path("in_d.json")),
    capture_output=True,
    text=True,
)
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as out_f:
    out_f.write(proc_d.stdout)
    out_path = out_f.name

diff_proc = subprocess.run(
    ["diff", out_path, fixture_path("expected_d.json")],
    capture_output=True,
    text=True,
)
os.unlink(out_path)
assert_test(
    "diff in_d → expected_d (golden match)",
    diff_proc.returncode == 0,
    f"diff output: {diff_proc.stdout!r}",
)

# --- Test 7: in_e → expected_e (boundary raw==max_ms, capped=false) ---
proc = run(read_fixture("in_e.json"))
expected = read_fixture("expected_e.json")
assert_test(
    "in_e → expected_e (boundary raw==max_ms, capped=false)",
    proc.returncode == 0 and proc.stdout.strip() == expected,
    f"got={proc.stdout.strip()!r} expected={expected!r}",
)

# --- Test 8: boundary strict — raw==max_ms → capped=false ---
result = run({"attempt": 4, "base_ms": 1000, "max_ms": 8000, "seed": 0, "jitter": "none"})
data = json.loads(result.stdout.strip())
assert_test(
    "boundary: raw==max_ms → capped=false (strict >)",
    result.returncode == 0 and data.get("capped") is False and data.get("delay_ms") == 8000,
    f"got capped={data.get('capped')!r}, delay_ms={data.get('delay_ms')!r}",
)

# --- Test 9: capped=true when raw > max_ms ---
result = run({"attempt": 10, "base_ms": 100, "max_ms": 5000, "seed": 0, "jitter": "none"})
data = json.loads(result.stdout.strip())
assert_test(
    "capped=true when raw > max_ms",
    result.returncode == 0 and data.get("capped") is True and data.get("delay_ms") == 5000,
    f"got capped={data.get('capped')!r}, delay_ms={data.get('delay_ms')!r}",
)

# --- Test 10: DETERMINISM — run twice on in_d, outputs identical ---
run1 = subprocess.run(
    [sys.executable, TEMPO],
    stdin=open(fixture_path("in_d.json")),
    capture_output=True,
    text=True,
)
run2 = subprocess.run(
    [sys.executable, TEMPO],
    stdin=open(fixture_path("in_d.json")),
    capture_output=True,
    text=True,
)
assert_test(
    "determinism: two runs on in_d produce identical output",
    run1.stdout == run2.stdout and run1.returncode == 0,
    f"run1={run1.stdout.strip()!r} run2={run2.stdout.strip()!r}",
)

# --- Test 11: attempt=0 → exit 1, stdout empty ---
result = run({"attempt": 0, "base_ms": 100, "max_ms": 1000, "seed": 42, "jitter": "none"})
assert_test(
    "attempt=0 → exit 1, stdout empty",
    result.returncode == 1 and result.stdout == "",
    f"rc={result.returncode}, stdout={result.stdout!r}",
)

# --- Test 12: max_ms < base_ms → exit 1 ---
result = run({"attempt": 1, "base_ms": 1000, "max_ms": 500, "seed": 42, "jitter": "none"})
assert_test(
    "max_ms < base_ms → exit 1",
    result.returncode == 1 and result.stdout == "",
    f"rc={result.returncode}, stdout={result.stdout!r}",
)

# --- Report ---
for line in RESULTS:
    print(line)

total = PASS + FAIL
print(f"\nPASS {PASS}/{total}")
if FAIL:
    sys.exit(1)

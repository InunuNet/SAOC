#!/usr/bin/env python3
"""12-assertion test suite for triage.py."""

import subprocess
import sys
import os

FIXTURES = os.path.join(os.path.dirname(__file__), 'fixtures')
TRIAGE = os.path.join(os.path.dirname(__file__), '..', 'triage.py')


def run(input_file):
    with open(input_file, 'rb') as f:
        result = subprocess.run(
            [sys.executable, TRIAGE],
            stdin=f,
            capture_output=True,
            text=True,
        )
    return result


def load_fixture(name):
    with open(os.path.join(FIXTURES, name)) as f:
        return f.read()


def test_all():
    failures = []
    passed = 0

    # Run main fixture
    r = run(os.path.join(FIXTURES, 'input.jsonl'))
    expected_out = load_fixture('expected.txt')
    expected_err = load_fixture('expected.stderr').strip()

    # Test 1: exit code is 5 (5 failures)
    if r.returncode == 5:
        passed += 1
    else:
        failures.append(f"Test 1 FAIL: exit code={r.returncode}, expected=5")

    # Test 2: stdout matches expected.txt
    if r.stdout == expected_out:
        passed += 1
    else:
        failures.append(f"Test 2 FAIL: stdout mismatch\nGOT:\n{r.stdout}\nEXPECTED:\n{expected_out}")

    # Test 3: stderr matches expected.stderr
    actual_err = r.stderr.strip()
    if actual_err == expected_err:
        passed += 1
    else:
        failures.append(f"Test 3 FAIL: stderr={repr(actual_err)}, expected={repr(expected_err)}")

    # Test 4: cap_input.jsonl → exit 99 (not 100 or 150)
    r_cap = run(os.path.join(FIXTURES, 'cap_input.jsonl'))
    if r_cap.returncode == 99:
        passed += 1
    else:
        failures.append(f"Test 4 FAIL: cap exit code={r_cap.returncode}, expected=99")

    # Test 5: alpha line → OK
    lines = r.stdout.splitlines()
    if lines[0] == 'alpha\tOK\t10':
        passed += 1
    else:
        failures.append(f"Test 5 FAIL: line[0]={repr(lines[0])}")

    # Test 6: unparseable line → ?  FAIL  parse_error
    if lines[1] == '?\tFAIL\tparse_error':
        passed += 1
    else:
        failures.append(f"Test 6 FAIL: line[1]={repr(lines[1])}")

    # Test 7: ok2 (value=1000) → 2000 (inclusive boundary high)
    if lines[3] == 'ok2\tOK\t2000':
        passed += 1
    else:
        failures.append(f"Test 7 FAIL: line[3]={repr(lines[3])}")

    # Test 8: ok5 (value=0) → 0 (inclusive boundary low)
    if lines[7] == 'ok5\tOK\t0':
        passed += 1
    else:
        failures.append(f"Test 8 FAIL: line[7]={repr(lines[7])}")

    # Test 9: BadCaps → FAIL bad_id
    if lines[2] == 'BadCaps\tFAIL\tbad_id':
        passed += 1
    else:
        failures.append(f"Test 9 FAIL: line[2]={repr(lines[2])}")

    # Test 10: ok3 (value=1001) → FAIL bad_value
    if lines[4] == 'ok3\tFAIL\tbad_value':
        passed += 1
    else:
        failures.append(f"Test 10 FAIL: line[4]={repr(lines[4])}")

    # Test 11: missing id → ?  FAIL  missing_id
    if lines[5] == '?\tFAIL\tmissing_id':
        passed += 1
    else:
        failures.append(f"Test 11 FAIL: line[5]={repr(lines[5])}")

    # Test 12: missing value → ok4  FAIL  missing_value
    if lines[6] == 'ok4\tFAIL\tmissing_value':
        passed += 1
    else:
        failures.append(f"Test 12 FAIL: line[6]={repr(lines[6])}")

    return passed, failures


if __name__ == '__main__':
    passed, failures = test_all()
    total = 12
    for f in failures:
        print(f)
    print(f"PASS {passed}/{total}")
    sys.exit(0 if passed == total else 1)

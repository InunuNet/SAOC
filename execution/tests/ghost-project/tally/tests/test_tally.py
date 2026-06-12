"""12-assertion test suite for tally.py."""

import json
import subprocess
import sys
from pathlib import Path

TALLY = Path(__file__).parent.parent / "tally.py"
FIXTURES = Path(__file__).parent / "fixtures"
INPUT_CSV = FIXTURES / "input.csv"
EXPECTED_JSON = FIXTURES / "expected.json"
BAD_INPUT_CSV = FIXTURES / "bad_input.csv"


def run(csv_path):
    return subprocess.run(
        [sys.executable, str(TALLY), str(csv_path)],
        capture_output=True,
        text=True,
    )


def load_expected():
    return json.loads(EXPECTED_JSON.read_text())


def test_exact_stdout_match():
    """Test 1: stdout matches expected.json exactly (diff passes)."""
    result = run(INPUT_CSV)
    expected = EXPECTED_JSON.read_text()
    assert result.stdout == expected, f"stdout mismatch:\n{result.stdout!r}\n!=\n{expected!r}"


def test_exit_0_on_success():
    """Test 2: exit code is 0 on valid input."""
    result = run(INPUT_CSV)
    assert result.returncode == 0, f"expected exit 0, got {result.returncode}"


def test_group_10_is_first():
    """Test 3: group '10' is first (lexicographic order)."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    assert data["groups"][0]["id"] == "10", f"first group is {data['groups'][0]['id']!r}, expected '10'"


def test_banker_rounding_down():
    """Test 4: group 'a' rounds 2.125 DOWN to 2.12 (banker's: half-to-even)."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    group_a = next(g for g in data["groups"] if g["id"] == "a")
    assert group_a["rounded_total"] == "2.12", f"expected '2.12', got {group_a['rounded_total']!r}"


def test_banker_rounding_up():
    """Test 5: group 'b' rounds 2.135 UP to 2.14 (banker's: half-to-even)."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    group_b = next(g for g in data["groups"] if g["id"] == "b")
    assert group_b["rounded_total"] == "2.14", f"expected '2.14', got {group_b['rounded_total']!r}"


def test_no_float_drift():
    """Test 6: group 'c' raw_total is '0.3000' (0.1+0.2 exact in Decimal)."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    group_c = next(g for g in data["groups"] if g["id"] == "c")
    assert group_c["raw_total"] == "0.3000", f"expected '0.3000', got {group_c['raw_total']!r}"


def test_grand_total():
    """Test 7: grand_total equals '8.56'."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    assert data["grand_total"] == "8.56", f"expected '8.56', got {data['grand_total']!r}"


def test_bad_input_exit_1():
    """Test 8: bad_input.csv produces exit code 1."""
    result = run(BAD_INPUT_CSV)
    assert result.returncode == 1, f"expected exit 1, got {result.returncode}"


def test_bad_input_empty_stdout():
    """Test 9: bad_input.csv produces empty stdout."""
    result = run(BAD_INPUT_CSV)
    assert result.stdout == "", f"expected empty stdout, got {result.stdout!r}"


def test_raw_total_four_decimal_places():
    """Test 10: all raw_total values are formatted to exactly 4 decimal places."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    for g in data["groups"]:
        parts = g["raw_total"].split(".")
        assert len(parts) == 2 and len(parts[1]) == 4, \
            f"group {g['id']!r} raw_total {g['raw_total']!r} not 4dp"


def test_rounded_total_two_decimal_places():
    """Test 11: all rounded_total values are formatted to exactly 2 decimal places."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    for g in data["groups"]:
        parts = g["rounded_total"].split(".")
        assert len(parts) == 2 and len(parts[1]) == 2, \
            f"group {g['id']!r} rounded_total {g['rounded_total']!r} not 2dp"


def test_group_count():
    """Test 12: output contains exactly 5 groups (10, 2, a, b, c)."""
    result = run(INPUT_CSV)
    data = json.loads(result.stdout)
    assert len(data["groups"]) == 5, f"expected 5 groups, got {len(data['groups'])}"


TESTS = [
    test_exact_stdout_match,
    test_exit_0_on_success,
    test_group_10_is_first,
    test_banker_rounding_down,
    test_banker_rounding_up,
    test_no_float_drift,
    test_grand_total,
    test_bad_input_exit_1,
    test_bad_input_empty_stdout,
    test_raw_total_four_decimal_places,
    test_rounded_total_two_decimal_places,
    test_group_count,
]


if __name__ == "__main__":
    passed = 0
    failed = 0
    for t in TESTS:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
            failed += 1
    total = passed + failed
    print(f"\n{'PASS' if failed == 0 else 'FAIL'} {passed}/{total}")
    sys.exit(0 if failed == 0 else 1)

"""Test suite for cartograph.py — 11 assertions per SPEC.md."""

import os
import subprocess
import sys

CARTOGRAPH = os.path.join(os.path.dirname(__file__), "..", "cartograph.py")
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

PYTHON = sys.executable


def run_resolve(fixture_name, stdin_data=None):
    """Run cartograph.py resolve <fixture>."""
    manifest = os.path.join(FIXTURES, fixture_name)
    result = subprocess.run(
        [PYTHON, CARTOGRAPH, "resolve", manifest],
        capture_output=True,
        text=True,
    )
    return result


def run_why(pkg, fixture_name):
    """Run cartograph.py why <pkg> < <fixture>."""
    manifest = os.path.join(FIXTURES, fixture_name)
    with open(manifest) as f:
        stdin_data = f.read()
    result = subprocess.run(
        [PYTHON, CARTOGRAPH, "why", pkg],
        input=stdin_data,
        capture_output=True,
        text=True,
    )
    return result


def read_expected(filename):
    with open(os.path.join(FIXTURES, filename)) as f:
        return f.read()


def test_1_linear_topo_order():
    """Test 1: Linear deps → correct topo order."""
    result = run_resolve("linear.json")
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    expected = read_expected("expected_linear.txt")
    assert result.stdout == expected, f"Expected:\n{expected}\nGot:\n{result.stdout}"


def test_2_diamond_lex_stable():
    """Test 2: Diamond deps → stable lex order."""
    result = run_resolve("diamond.json")
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    expected = read_expected("expected_diamond.txt")
    assert result.stdout == expected, f"Expected:\n{expected}\nGot:\n{result.stdout}"


def test_3_cycle_exit_2():
    """Test 3: Cycle detection → exit 2."""
    result = run_resolve("cycle.json")
    assert result.returncode == 2, f"Expected exit 2, got {result.returncode}"


def test_4_cycle_canonical_form():
    """Test 4: Cycle output is canonical lex form."""
    result = run_resolve("cycle.json")
    stderr = result.stderr.strip()
    assert stderr == "a -> b -> c -> a", f"Expected 'a -> b -> c -> a', got '{stderr}'"


def test_5_self_cycle_exit_2():
    """Test 5: Self-cycle → exit 2."""
    result = run_resolve("self.json")
    assert result.returncode == 2, f"Expected exit 2, got {result.returncode}"


def test_6_missing_dep_exit_3():
    """Test 6: Missing dependency → exit 3."""
    result = run_resolve("missing.json")
    assert result.returncode == 3, f"Expected exit 3, got {result.returncode}"


def test_7_missing_dep_names_culprit():
    """Test 7: Missing dep stderr contains the package name."""
    result = run_resolve("missing.json")
    assert "libfoo" in result.stderr, f"Expected 'libfoo' in stderr, got: '{result.stderr}'"


def test_8_schema_error_beats_cycle():
    """Test 8: Schema error beats cycle → exit 5."""
    result = run_resolve("malformed_cycle.json")
    assert result.returncode == 5, f"Expected exit 5, got {result.returncode}"


def test_9_why_shortest_path():
    """Test 9: why returns shortest path."""
    result = run_why("c", "diamond.json")
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}\nStderr: {result.stderr}"
    expected = read_expected("expected_why.txt")
    assert result.stdout == expected, f"Expected:\n{expected}\nGot:\n{result.stdout}"


def test_10_why_unreachable_exit_4():
    """Test 10: why unreachable → exit 4."""
    result = run_why("nonexistent_pkg", "diamond.json")
    assert result.returncode == 4, f"Expected exit 4, got {result.returncode}"


def test_11_determinism():
    """Test 11: Two runs produce identical output."""
    result1 = run_resolve("diamond.json")
    result2 = run_resolve("diamond.json")
    assert result1.stdout == result2.stdout, "Outputs differ between runs"
    assert result1.returncode == result2.returncode, "Exit codes differ between runs"


if __name__ == "__main__":
    tests = [
        test_1_linear_topo_order,
        test_2_diamond_lex_stable,
        test_3_cycle_exit_2,
        test_4_cycle_canonical_form,
        test_5_self_cycle_exit_2,
        test_6_missing_dep_exit_3,
        test_7_missing_dep_names_culprit,
        test_8_schema_error_beats_cycle,
        test_9_why_shortest_path,
        test_10_why_unreachable_exit_4,
        test_11_determinism,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"PASS: {test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL: {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"ERROR: {test.__name__}: {e}")
            failed += 1

    total = passed + failed
    print(f"\n{'PASS' if failed == 0 else 'FAIL'} {passed}/{total}")
    sys.exit(0 if failed == 0 else 1)

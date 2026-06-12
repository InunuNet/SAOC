#!/usr/bin/env python3
"""
Quill test suite — 12 assertions per SPEC.md
Uses subprocess.run to exercise quill.py as a black-box CLI.
"""

import subprocess
import sys
import os

# Resolve paths relative to this file
QUILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUILL_BIN = os.path.join(QUILL_DIR, "quill.py")
FIXTURES = os.path.join(QUILL_DIR, "tests", "fixtures")


def quill(*args, stdin_data=None):
    """Run quill.py with given args and return CompletedProcess."""
    cmd = [sys.executable, QUILL_BIN] + list(args)
    return subprocess.run(cmd, capture_output=True, input=stdin_data)


def fix(name):
    """Return absolute path to a fixture file."""
    return os.path.join(FIXTURES, name)


def golden(name):
    """Return contents of a golden file."""
    with open(fix(f"golden_{name}.txt"), "rb") as f:
        return f.read()


PASS = []
FAIL = []


def run_test(num, description, fn):
    try:
        fn()
        PASS.append(num)
        print(f"  PASS {num}: {description}")
    except AssertionError as e:
        FAIL.append(num)
        print(f"  FAIL {num}: {description} — {e}")
    except Exception as e:
        FAIL.append(num)
        print(f"  ERROR {num}: {description} — {e}")


# ---------------------------------------------------------------------------
# Test definitions
# ---------------------------------------------------------------------------

def test_01_simple_substitution():
    """Test 1: Simple variable substitution."""
    r = quill("render", fix("simple.txt"), fix("simple_ctx.json"))
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
    assert r.stdout == golden("simple"), f"stdout mismatch: {r.stdout!r}"


def test_02_dotted_path():
    """Test 2: Dotted path a.b.c resolution."""
    r = quill("render", fix("dotted.txt"), fix("dotted_ctx.json"))
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
    assert r.stdout == golden("dotted"), f"stdout mismatch: {r.stdout!r}"


def test_03_for_loop():
    """Test 3: For-loop iteration."""
    r = quill("render", fix("for.txt"), fix("for_ctx.json"))
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
    assert r.stdout == golden("for"), f"stdout mismatch: {r.stdout!r}"


def test_04_nested_for():
    """Test 4: Nested for-loops with outer scope access."""
    r = quill("render", fix("nested.txt"), fix("nested_ctx.json"))
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
    assert r.stdout == golden("nested"), f"stdout mismatch: {r.stdout!r}"


def test_05_if_truthy():
    """Test 5: if-truthy renders block."""
    import json, tempfile, os

    tmpl = "{% if flag %}YES{% endif %}\n"
    ctx = json.dumps({"flag": True}).encode()

    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="wb") as tf:
        tf.write(tmpl.encode())
        tpath = tf.name
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="wb") as cf:
        cf.write(ctx)
        cpath = cf.name

    try:
        r = quill("render", tpath, cpath)
        assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
        assert b"YES" in r.stdout, f"Expected 'YES' in output: {r.stdout!r}"
    finally:
        os.unlink(tpath)
        os.unlink(cpath)


def test_06_if_falsy():
    """Test 6: if-falsy (0, false, null, '', []) omits block."""
    import json, tempfile, os

    falsy_cases = [
        {"val": 0},
        {"val": False},
        {"val": None},
        {"val": ""},
        {"val": []},
    ]
    tmpl = "{% if val %}BODY{% endif %}\n"

    for case in falsy_cases:
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="wb") as tf:
            tf.write(tmpl.encode())
            tpath = tf.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="wb") as cf:
            cf.write(json.dumps(case).encode())
            cpath = cf.name
        try:
            r = quill("render", tpath, cpath)
            assert r.returncode == 0, f"Expected exit 0 for case {case}, got {r.returncode}"
            assert b"BODY" not in r.stdout, f"Expected empty output for {case}, got {r.stdout!r}"
        finally:
            os.unlink(tpath)
            os.unlink(cpath)


def test_07_strict_undefined_exit_code():
    """Test 7: Strict mode undefined var → exit 7."""
    r = quill("render", fix("undef.txt"), fix("simple_ctx.json"))
    assert r.returncode == 7, f"Expected exit 7, got {r.returncode}"


def test_08_strict_undefined_stdout_empty():
    """Test 8: Strict mode undefined var → stdout EMPTY."""
    r = quill("render", fix("undef.txt"), fix("simple_ctx.json"))
    assert r.stdout == b"", f"Expected empty stdout, got {r.stdout!r}"


def test_09_lenient_mode():
    """Test 9: Lenient mode → empty string for undefined var."""
    r = quill("render", "--lenient", fix("undef.txt"), fix("simple_ctx.json"))
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
    assert r.stdout == golden("lenient"), f"stdout mismatch: {r.stdout!r}"


def test_10_parse_error_line_number():
    """Test 10: Unclosed {{ → exit 6 + stderr includes line number."""
    import tempfile, os

    tmpl = "line1\nHello {{ unclosed\nline3\n"
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False, mode="wb") as tf:
        tf.write(tmpl.encode())
        tpath = tf.name
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="wb") as cf:
        cf.write(b"{}")
        cpath = cf.name
    try:
        r = quill("render", tpath, cpath)
        assert r.returncode == 6, f"Expected exit 6, got {r.returncode}"
        stderr = r.stderr.decode()
        assert "2" in stderr, f"Expected line number '2' in stderr: {stderr!r}"
    finally:
        os.unlink(tpath)
        os.unlink(cpath)


def test_11_escape_braces():
    """Test 11: Escape sequences produce literal {{ and }}."""
    r = quill("render", fix("escape.txt"), fix("simple_ctx.json"))
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
    assert r.stdout == golden("escape"), f"stdout mismatch: {r.stdout!r}"
    # Specifically verify the output line matches {{not a var}}
    assert b"{{not a var}}" in r.stdout, f"Expected '{{not a var}}' in output: {r.stdout!r}"


def test_12_custom_truthiness():
    """Test 12: Custom truthiness — 0 (int) falsy, '0' (str) truthy."""
    r = quill("render", fix("truthiness.txt"), fix("truthiness_ctx.json"))
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}"
    assert b"STR_ZERO_TRUTHY" in r.stdout, f"Expected 'STR_ZERO_TRUTHY' in output: {r.stdout!r}"
    assert b"INT_ZERO_TRUTHY" not in r.stdout, f"Expected 'INT_ZERO_TRUTHY' NOT in output: {r.stdout!r}"


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

TESTS = [
    (1, "Simple variable substitution", test_01_simple_substitution),
    (2, "Dotted path a.b.c resolution", test_02_dotted_path),
    (3, "For-loop iteration", test_03_for_loop),
    (4, "Nested for-loops with outer scope", test_04_nested_for),
    (5, "If-truthy renders block", test_05_if_truthy),
    (6, "If-falsy omits block (0, false, null, '', [])", test_06_if_falsy),
    (7, "Strict undefined → exit 7", test_07_strict_undefined_exit_code),
    (8, "Strict undefined → stdout EMPTY", test_08_strict_undefined_stdout_empty),
    (9, "Lenient mode → empty for undefined", test_09_lenient_mode),
    (10, "Parse error unclosed {{ → exit 6 + line number", test_10_parse_error_line_number),
    (11, "Escape braces → literal {{ and }}", test_11_escape_braces),
    (12, "Custom truthiness: '0' truthy, 0 falsy", test_12_custom_truthiness),
]

if __name__ == "__main__":
    print(f"Running Quill tests ({len(TESTS)} total)...")
    for num, desc, fn in TESTS:
        run_test(num, desc, fn)

    total = len(TESTS)
    passed = len(PASS)
    failed = len(FAIL)

    print()
    if failed == 0:
        print(f"PASS {passed}/{total}")
        sys.exit(0)
    else:
        print(f"FAIL {passed}/{total} ({failed} failures: {FAIL})")
        sys.exit(1)

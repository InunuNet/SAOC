#!/usr/bin/env python3
"""
Lodestar test suite — 11 assertions per SPEC.md
Tests use subprocess.run to exercise lodestar.py as a black-box CLI.
"""

import json
import os
import subprocess
import sys
import tempfile

SCRIPT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lodestar.py")
FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")

DEFAULTS = os.path.join(FIXTURES, "defaults.json")
ENV = os.path.join(FIXTURES, "env.json")
FLAGS = os.path.join(FIXTURES, "flags.json")
FLAGS_INVALID_PORT = os.path.join(FIXTURES, "flags_invalid_port.json")
TYPE_ERROR_ENV = os.path.join(FIXTURES, "type_error_env.json")
SCHEMA = os.path.join(FIXTURES, "schema.json")
GOLDEN = os.path.join(FIXTURES, "golden_merged.json")


def run_merge(defaults=DEFAULTS, env=ENV, flags=FLAGS, schema=None):
    cmd = [sys.executable, SCRIPT, "merge",
           "--defaults", defaults, "--env", env, "--flags", flags]
    if schema:
        cmd += ["--schema", schema]
    return subprocess.run(cmd, capture_output=True, text=True)


def run_explain(key_path, defaults=DEFAULTS, env=ENV, flags=FLAGS):
    cmd = [sys.executable, SCRIPT, "explain", key_path,
           "--defaults", defaults, "--env", env, "--flags", flags]
    return subprocess.run(cmd, capture_output=True, text=True)


def test_1_shallow_override():
    """Flags beats defaults for a shallow key (port: 8080 not 80)."""
    result = run_merge()
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    data = json.loads(result.stdout)
    assert data["port"] == 8080, f"Expected port=8080, got {data['port']}"
    return True


def test_2_deep_merge_preserves_siblings():
    """nested.b from defaults is preserved even though flags/env only set nested.a."""
    result = run_merge()
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    data = json.loads(result.stdout)
    assert "nested" in data, "nested key missing from output"
    assert data["nested"]["b"] == 2, f"Expected nested.b=2, got {data['nested'].get('b')}"
    assert data["nested"]["a"] == 99, f"Expected nested.a=99 (from env), got {data['nested'].get('a')}"
    return True


def test_3_list_replacement_not_concat():
    """items in flags ([1,2]) replaces defaults ([3,4,5]) — not concatenated."""
    result = run_merge()
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    data = json.loads(result.stdout)
    assert data["items"] == [1, 2], f"Expected items=[1,2], got {data['items']}"
    return True


def test_4_type_mismatch_exits_9():
    """Type mismatch (port as string instead of int) causes exit 9."""
    result = run_merge(env=TYPE_ERROR_ENV)
    assert result.returncode == 9, f"Expected exit 9, got {result.returncode}"
    return True


def test_5_type_mismatch_all_listed_on_stderr():
    """All type mismatches are reported on stderr before exit."""
    result = run_merge(env=TYPE_ERROR_ENV)
    assert result.returncode == 9, f"Expected exit 9, got {result.returncode}"
    stderr_lines = [l for l in result.stderr.strip().splitlines() if l.strip()]
    assert len(stderr_lines) >= 1, f"Expected at least 1 mismatch on stderr, got: {result.stderr!r}"
    # Verify it mentions 'port'
    assert any("port" in line for line in stderr_lines), \
        f"Expected 'port' mismatch in stderr, got: {result.stderr!r}"
    return True


def test_6_null_tombstone_key_absent():
    """tombstone_key set to null in flags must be absent from output (not present as null)."""
    result = run_merge()
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    data = json.loads(result.stdout)
    assert "tombstone_key" not in data, \
        f"tombstone_key should be absent, but found: {data.get('tombstone_key')}"
    return True


def test_7_schema_valid_exits_0():
    """A valid merge against schema exits 0."""
    result = run_merge(schema=SCHEMA)
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}\nstderr: {result.stderr}"
    return True


def test_8_schema_invalid_exits_10():
    """Schema-invalid merge (port=99999 > 65535) exits 10."""
    result = run_merge(flags=FLAGS_INVALID_PORT, schema=SCHEMA)
    assert result.returncode == 10, f"Expected exit 10, got {result.returncode}"
    return True


def test_9_missing_file_exits_11():
    """Missing input file exits 11."""
    result = run_merge(defaults="/tmp/lodestar_no_such_file_12345.json")
    assert result.returncode == 11, f"Expected exit 11, got {result.returncode}"
    return True


def test_10_explain_shows_layer_sources():
    """explain output has lines matching ^(defaults|env|flags|resolved):."""
    import re
    result = run_explain("nested.a")
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    lines = result.stdout.strip().splitlines()
    assert len(lines) == 4, f"Expected 4 lines, got {len(lines)}: {result.stdout!r}"
    pattern = re.compile(r"^(defaults|env|flags|resolved):")
    for line in lines:
        assert pattern.match(line), f"Line does not match expected format: {line!r}"
    return True


def test_11_byte_exact_canonical_output():
    """Output is byte-exact match against golden_merged.json."""
    result = run_merge()
    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}"
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        f.write(result.stdout)
        tmp_path = f.name
    try:
        cmp_result = subprocess.run(
            ["cmp", tmp_path, GOLDEN],
            capture_output=True
        )
        assert cmp_result.returncode == 0, \
            f"Output is NOT byte-exact with golden.\nActual:\n{result.stdout!r}\nGolden:\n{open(GOLDEN).read()!r}"
    finally:
        os.unlink(tmp_path)
    return True


TESTS = [
    ("1: Shallow override (flags > defaults)", test_1_shallow_override),
    ("2: Deep merge preserves untouched sibling (nested.b)", test_2_deep_merge_preserves_siblings),
    ("3: List replacement not concatenation", test_3_list_replacement_not_concat),
    ("4: Type mismatch exits 9", test_4_type_mismatch_exits_9),
    ("5: All type mismatches listed on stderr", test_5_type_mismatch_all_listed_on_stderr),
    ("6: Null tombstone key absent from output", test_6_null_tombstone_key_absent),
    ("7: Schema-valid merge exits 0", test_7_schema_valid_exits_0),
    ("8: Schema-invalid merge exits 10", test_8_schema_invalid_exits_10),
    ("9: Missing file exits 11", test_9_missing_file_exits_11),
    ("10: explain shows all layer sources", test_10_explain_shows_layer_sources),
    ("11: Byte-exact canonical JSON output", test_11_byte_exact_canonical_output),
]


def main():
    passed = 0
    failed = 0
    for name, fn in TESTS:
        try:
            fn()
            print(f"  PASS  {name}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {name}")
            print(f"        {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR {name}")
            print(f"        {type(e).__name__}: {e}")
            failed += 1

    total = passed + failed
    print(f"\nResults: {passed}/{total} passed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Herald test suite — 10 assertions from SPEC.md.
Uses subprocess.run to test herald.py as a CLI binary.
"""
import subprocess
import json
import os
import sys
import tempfile

# Paths
HERALD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERALD_PY = os.path.join(HERALD_DIR, "herald.py")
FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")

PYTHON = sys.executable


def run(args, stdin_text=""):
    """Run herald.py with given args and stdin, return CompletedProcess."""
    cmd = [PYTHON, HERALD_PY] + args
    return subprocess.run(
        cmd,
        input=stdin_text,
        capture_output=True,
        text=True,
    )


def parse_jsonl(text):
    """Parse JSONL output into list of dicts."""
    records = []
    for line in text.strip().splitlines():
        line = line.strip()
        if line:
            records.append(json.loads(line))
    return records


def assert_test(number, description, condition, detail=""):
    if condition:
        print(f"  PASS [{number:02d}] {description}")
        return True
    else:
        print(f"  FAIL [{number:02d}] {description}{': ' + detail if detail else ''}")
        return False


# ---------------------------------------------------------------------------
# Test functions
# ---------------------------------------------------------------------------

def test_01_invalid_format_exit2():
    """Assertion 1: Invalid format → exit 2."""
    result = run(["--format", "bogus"], stdin_text="test\n")
    return assert_test(1, "Invalid format → exit 2",
                       result.returncode == 2,
                       f"got exit code {result.returncode}")


def test_02_syslog_iso8601_timestamp():
    """Assertion 2: syslog parse → ISO8601 timestamp."""
    fixture = os.path.join(FIXTURES_DIR, "syslog.log")
    with open(fixture) as f:
        data = f.read()
    result = run(["--format", "syslog"], stdin_text=data)
    if result.returncode != 0:
        return assert_test(2, "syslog parse → ISO8601 timestamp",
                           False, f"exit {result.returncode}: {result.stderr}")
    records = parse_jsonl(result.stdout)
    if not records:
        return assert_test(2, "syslog parse → ISO8601 timestamp",
                           False, "no output records")
    ts = records[0].get("timestamp", "")
    import re
    ok = ts is not None and bool(re.match(r"^\d{4}-", ts))
    return assert_test(2, "syslog parse → ISO8601 timestamp", ok,
                       f"timestamp={ts!r}")


def test_03_nginx_200_info():
    """Assertion 3: nginx 200 → level=info."""
    line = '127.0.0.1 - - [01/Jan/2000:00:00:00 +0000] "GET / HTTP/1.1" 200 100 "-" "-"\n'
    result = run(["--format", "nginx"], stdin_text=line)
    if result.returncode != 0:
        return assert_test(3, "nginx 200 → level=info",
                           False, f"exit {result.returncode}: {result.stderr}")
    records = parse_jsonl(result.stdout)
    ok = bool(records) and records[0].get("level") == "info"
    return assert_test(3, "nginx 200 → level=info", ok,
                       f"level={records[0].get('level') if records else 'NO RECORDS'!r}")


def test_04_nginx_500_error():
    """Assertion 4: nginx 500 → level=error."""
    line = '127.0.0.1 - - [01/Jan/2000:00:00:00 +0000] "GET / HTTP/1.1" 500 0 "-" "-"\n'
    result = run(["--format", "nginx"], stdin_text=line)
    if result.returncode != 0:
        return assert_test(4, "nginx 500 → level=error",
                           False, f"exit {result.returncode}: {result.stderr}")
    records = parse_jsonl(result.stdout)
    ok = bool(records) and records[0].get("level") == "error"
    return assert_test(4, "nginx 500 → level=error", ok,
                       f"level={records[0].get('level') if records else 'NO RECORDS'!r}")


def test_05_parse_error_emitted():
    """Assertion 5: Parse error → emit with parse_error set (strict=false)."""
    result = run(["--format", "syslog"], stdin_text="garbage line not syslog\n")
    if result.returncode != 0:
        return assert_test(5, "Parse error → parse_error field non-null",
                           False, f"exit {result.returncode}")
    records = parse_jsonl(result.stdout)
    ok = bool(records) and records[0].get("parse_error") is not None
    return assert_test(5, "Parse error → parse_error field non-null", ok,
                       f"parse_error={records[0].get('parse_error') if records else 'NO RECORDS'!r}")


def test_06_strict_parse_failure_exit1():
    """Assertion 6: Strict mode parse failure → exit 1."""
    result = run(["--format", "syslog", "--strict"], stdin_text="garbage\n")
    return assert_test(6, "Strict mode parse failure → exit 1",
                       result.returncode == 1,
                       f"got exit code {result.returncode}")


def test_07_empty_line_parse_error_exit0():
    """Assertion 7: Empty line → parse_error set, exit 0."""
    result = run(["--format", "nginx"], stdin_text="\n")
    records = parse_jsonl(result.stdout)
    exit_ok = result.returncode == 0
    has_error = bool(records) and records[0].get("parse_error") is not None
    ok = exit_ok and has_error
    return assert_test(7, "Empty line → parse_error set, exit 0", ok,
                       f"exit={result.returncode}, parse_error={records[0].get('parse_error') if records else 'NO RECORDS'!r}")


def test_08_determinism():
    """Assertion 8: Same input → byte-identical output (run twice)."""
    fixture = os.path.join(FIXTURES_DIR, "nginx.log")
    with open(fixture) as f:
        data = f.read()
    r1 = run(["--format", "nginx"], stdin_text=data)
    r2 = run(["--format", "nginx"], stdin_text=data)
    ok = r1.stdout == r2.stdout and r1.returncode == r2.returncode
    return assert_test(8, "Determinism: same input → byte-identical output", ok,
                       "outputs differ" if not ok else "")


def test_09_syslog_pri34_severity_crit_error():
    """Assertion 9: PRI=34 → severity=2 (crit) → level=error."""
    # PRI=34 → 34 % 8 = 2 → crit → error
    line = "<34>Oct 11 22:14:15 mymachine su[1234]: test message\n"
    result = run(["--format", "syslog"], stdin_text=line)
    if result.returncode != 0:
        return assert_test(9, "syslog PRI=34 → level=error",
                           False, f"exit {result.returncode}: {result.stderr}")
    records = parse_jsonl(result.stdout)
    level = records[0].get("level") if records else None
    ok = level == "error"
    return assert_test(9, "syslog PRI=34 → level=error", ok,
                       f"level={level!r} (PRI=34, 34%8=2=crit)")


def test_10_json_warning_normalized():
    """Assertion 10: json format normalizes WARNING → warn."""
    line = '{"level":"WARNING","message":"test"}\n'
    result = run(["--format", "json"], stdin_text=line)
    if result.returncode != 0:
        return assert_test(10, "json WARNING → level=warn",
                           False, f"exit {result.returncode}: {result.stderr}")
    records = parse_jsonl(result.stdout)
    level = records[0].get("level") if records else None
    ok = level == "warn"
    return assert_test(10, "json WARNING → level=warn", ok,
                       f"level={level!r}")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

TESTS = [
    test_01_invalid_format_exit2,
    test_02_syslog_iso8601_timestamp,
    test_03_nginx_200_info,
    test_04_nginx_500_error,
    test_05_parse_error_emitted,
    test_06_strict_parse_failure_exit1,
    test_07_empty_line_parse_error_exit0,
    test_08_determinism,
    test_09_syslog_pri34_severity_crit_error,
    test_10_json_warning_normalized,
]


def main():
    print(f"\n=== Herald Test Suite ({len(TESTS)} assertions) ===\n")
    passed = 0
    failed = 0
    for test_fn in TESTS:
        ok = test_fn()
        if ok:
            passed += 1
        else:
            failed += 1
    total = passed + failed
    print(f"\n{'PASS' if failed == 0 else 'FAIL'} {passed}/{total}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

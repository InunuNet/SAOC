#!/usr/bin/env python3
"""
test_relay.py — 10 binary assertions for relay.py per SPEC.md
Uses subprocess + tempfile for full hermetic testing.
"""
import json
import os
import subprocess
import sys
import tempfile

RELAY = os.path.join(os.path.dirname(__file__), "..", "relay.py")
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def run_relay(*args, **kwargs):
    """Run relay.py with given args, return CompletedProcess."""
    cmd = [sys.executable, RELAY] + list(args)
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def parse_jsonl(output: str) -> list:
    """Parse JSONL output into list of dicts."""
    results = []
    for line in output.strip().splitlines():
        line = line.strip()
        if line:
            results.append(json.loads(line))
    return results


results_summary = []


def assert_test(num: int, description: str, passed: bool):
    status = "PASS" if passed else "FAIL"
    results_summary.append((num, description, passed))
    print(f"  [{status}] {num:02d}: {description}")
    return passed


def test_01_missing_config():
    """Missing config → exit 1"""
    proc = run_relay("--config", "/nope_does_not_exist_relay.yaml")
    return assert_test(1, "Missing config → exit 1", proc.returncode == 1)


def test_02_invalid_type():
    """Invalid config type → exit 1"""
    fixture = os.path.join(FIXTURES, "invalid_type.yaml")
    proc = run_relay("--config", fixture)
    return assert_test(2, "Invalid config type → exit 1", proc.returncode == 1)


def test_03_all_healthy_exit_0():
    """All healthy → exit 0"""
    fixture = os.path.join(FIXTURES, "all_healthy.yaml")
    proc = run_relay("--config", fixture)
    return assert_test(3, "All healthy → exit 0", proc.returncode == 0)


def test_04_one_down_exit_2():
    """One down → exit 2"""
    fixture = os.path.join(FIXTURES, "one_down.yaml")
    proc = run_relay("--config", fixture)
    return assert_test(4, "One down → exit 2", proc.returncode == 2)


def test_05_file_exists_passes():
    """file_exists passes when file is present"""
    with tempfile.TemporaryDirectory() as tmpdir:
        target = os.path.join(tmpdir, "marker.pid")
        with open(target, "w") as f:
            f.write("running")
        config = {
            "services": [
                {"name": "db", "type": "file_exists", "path": target, "timeout_ms": 500}
            ]
        }
        import yaml
        config_path = os.path.join(tmpdir, "config.yaml")
        with open(config_path, "w") as f:
            yaml.dump(config, f)
        proc = run_relay("--config", config_path)
        objects = parse_jsonl(proc.stdout)
        svc = next((o for o in objects if o.get("name") == "db"), None)
        passed = svc is not None and svc["status"] == "up"
        return assert_test(5, "file_exists passes when file present", passed)


def test_06_file_exists_fails():
    """file_exists fails when file absent"""
    with tempfile.TemporaryDirectory() as tmpdir:
        absent = os.path.join(tmpdir, "missing.pid")
        config = {
            "services": [
                {"name": "db", "type": "file_exists", "path": absent, "timeout_ms": 500}
            ]
        }
        import yaml
        config_path = os.path.join(tmpdir, "config.yaml")
        with open(config_path, "w") as f:
            yaml.dump(config, f)
        proc = run_relay("--config", config_path)
        objects = parse_jsonl(proc.stdout)
        svc = next((o for o in objects if o.get("name") == "db"), None)
        passed = svc is not None and svc["status"] == "down"
        return assert_test(6, "file_exists fails when file absent", passed)


def test_07_file_contains_passes():
    """file_contains passes with correct string"""
    with tempfile.TemporaryDirectory() as tmpdir:
        target = os.path.join(tmpdir, "api.status")
        with open(target, "w") as f:
            f.write("status: OK\n")
        config = {
            "services": [
                {
                    "name": "api",
                    "type": "file_contains",
                    "path": target,
                    "expected_content": "OK",
                    "timeout_ms": 500,
                }
            ]
        }
        import yaml
        config_path = os.path.join(tmpdir, "config.yaml")
        with open(config_path, "w") as f:
            yaml.dump(config, f)
        proc = run_relay("--config", config_path)
        objects = parse_jsonl(proc.stdout)
        svc = next((o for o in objects if o.get("name") == "api"), None)
        passed = svc is not None and svc["status"] == "up"
        return assert_test(7, "file_contains passes with correct string", passed)


def test_08_file_contains_fails():
    """file_contains fails with wrong string"""
    with tempfile.TemporaryDirectory() as tmpdir:
        target = os.path.join(tmpdir, "api.status")
        with open(target, "w") as f:
            f.write("status: ERROR\n")
        config = {
            "services": [
                {
                    "name": "api",
                    "type": "file_contains",
                    "path": target,
                    "expected_content": "OK",
                    "timeout_ms": 500,
                }
            ]
        }
        import yaml
        config_path = os.path.join(tmpdir, "config.yaml")
        with open(config_path, "w") as f:
            yaml.dump(config, f)
        proc = run_relay("--config", config_path)
        objects = parse_jsonl(proc.stdout)
        svc = next((o for o in objects if o.get("name") == "api"), None)
        passed = svc is not None and svc["status"] == "down"
        return assert_test(8, "file_contains fails with wrong string", passed)


def test_09_parallel_sorted_by_name():
    """--parallel output is sorted by name"""
    fixture = os.path.join(FIXTURES, "parallel_test.yaml")
    proc = run_relay("--config", fixture, "--parallel")
    objects = parse_jsonl(proc.stdout)
    # Exclude summary object
    service_objects = [o for o in objects if not o.get("summary")]
    names = [o["name"] for o in service_objects]
    expected_names = sorted(names)
    passed = names == expected_names
    return assert_test(9, "Parallel output sorted by name", passed)


def test_10_summary_is_last():
    """Summary object is the last line"""
    fixture = os.path.join(FIXTURES, "all_healthy.yaml")
    proc = run_relay("--config", fixture)
    objects = parse_jsonl(proc.stdout)
    if not objects:
        return assert_test(10, "Summary is last line", False)
    last = objects[-1]
    passed = last.get("summary") is True
    return assert_test(10, "Summary is last line", passed)


def main():
    print("Running Relay test suite (10 assertions)...")
    print()

    tests = [
        test_01_missing_config,
        test_02_invalid_type,
        test_03_all_healthy_exit_0,
        test_04_one_down_exit_2,
        test_05_file_exists_passes,
        test_06_file_exists_fails,
        test_07_file_contains_passes,
        test_08_file_contains_fails,
        test_09_parallel_sorted_by_name,
        test_10_summary_is_last,
    ]

    for t in tests:
        try:
            t()
        except Exception as e:
            num = int(t.__name__.split("_")[1])
            desc = t.__doc__ or t.__name__
            results_summary.append((num, desc, False))
            print(f"  [FAIL] {num:02d}: {desc} — EXCEPTION: {e}")

    total = len(results_summary)
    passed = sum(1 for _, _, ok in results_summary if ok)
    print()
    print(f"Results: {passed}/{total} passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()

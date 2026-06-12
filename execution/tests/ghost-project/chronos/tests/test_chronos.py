#!/usr/bin/env python3
"""
Chronos test suite — 12 assertions per SPEC.md.
Each test is independent and uses subprocess.run.
"""

import json
import os
import subprocess
import sys
import tempfile

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "chronos.py")
FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")
NOW = "2026-05-11T12:00:00Z"  # epoch: 1778500800


def run(args, **kwargs):
    return subprocess.run(
        [sys.executable, SCRIPT] + args,
        capture_output=True,
        text=True,
        **kwargs,
    )


def test_1_plan_sorted_by_next_run():
    """Plan output sorted by next_run, lex tiebreak on id."""
    r = run(["plan", "--jobs", f"{FIXTURES}/basic.json", "--now", NOW])
    assert r.returncode == 0, f"Expected exit 0, got {r.returncode}: {r.stderr}"
    data = json.loads(r.stdout)
    ids = [j["id"] for j in data]
    # Expected order: a (1778500400), c (1778500800), b (1778502600)
    assert ids == ["a", "c", "b"], f"Expected ['a','c','b'], got {ids}"
    next_runs = [j["next_run"] for j in data]
    assert next_runs == sorted(next_runs), f"next_run not ascending: {next_runs}"


def test_2_overdue_detection():
    """Overdue job correctly detected."""
    r = run(["plan", "--jobs", f"{FIXTURES}/basic.json", "--now", NOW])
    assert r.returncode == 0
    data = json.loads(r.stdout)
    job_a = next(j for j in data if j["id"] == "a")
    assert job_a["status"] == "overdue", f"Expected 'overdue', got {job_a['status']}"


def test_3_seconds_overdue_correct():
    """seconds_overdue value is correct."""
    r = run(["plan", "--jobs", f"{FIXTURES}/basic.json", "--now", NOW])
    assert r.returncode == 0
    data = json.loads(r.stdout)
    job_a = next(j for j in data if j["id"] == "a")
    # now_epoch(1778500800) - last_run_epoch(1778496800) - interval(3600) = 400
    assert job_a["seconds_overdue"] == 400, (
        f"Expected seconds_overdue=400, got {job_a['seconds_overdue']}"
    )


def test_4_null_last_run_status_due():
    """Null last_run produces status 'due'."""
    r = run(["plan", "--jobs", f"{FIXTURES}/basic.json", "--now", NOW])
    assert r.returncode == 0
    data = json.loads(r.stdout)
    job_c = next(j for j in data if j["id"] == "c")
    assert job_c["status"] == "due", f"Expected 'due', got {job_c['status']}"
    # next_run should equal now_epoch
    assert job_c["next_run"] == 1778500800, (
        f"Expected next_run=1778500800, got {job_c['next_run']}"
    )


def test_5_catchup_missed_runs_count():
    """Catchup emits correct number of missed runs."""
    r = run(
        ["catchup", "--jobs", f"{FIXTURES}/catchup.json", "--now", NOW, "--window", "1000"]
    )
    assert r.returncode == 0, f"Exit {r.returncode}: {r.stderr}"
    data = json.loads(r.stdout)
    assert len(data) == 1, f"Expected 1 job, got {len(data)}"
    missed = data[0]["missed_runs"]
    # anchor=1778499800, interval=300
    # t=1778500100, t=1778500400, t=1778500700 — all within window_start=1778499800
    assert len(missed) == 3, f"Expected 3 missed runs, got {len(missed)}"
    assert missed == [1778500100, 1778500400, 1778500700], f"Unexpected missed_runs: {missed}"


def test_6_catchup_cap_exit_12():
    """Catchup cap (>1000 entries) → exit 12."""
    r = run(
        [
            "catchup",
            "--jobs",
            f"{FIXTURES}/cap_test.json",
            "--now",
            NOW,
            "--window",
            "99999999",
        ]
    )
    assert r.returncode == 12, f"Expected exit 12, got {r.returncode}"


def test_7_nonz_timestamp_exit_13():
    """Non-Z timestamp format → exit 13."""
    r = run(["plan", "--jobs", f"{FIXTURES}/nonz.json", "--now", NOW])
    assert r.returncode == 13, f"Expected exit 13, got {r.returncode}"


def test_8_zero_interval_exit_14():
    """Zero interval_seconds → exit 14."""
    r = run(["plan", "--jobs", f"{FIXTURES}/zero_interval.json", "--now", NOW])
    assert r.returncode == 14, f"Expected exit 14, got {r.returncode}"


def test_9_idempotency_advance_now():
    """Re-plan after advancing now past one next_run yields the next-next schedule."""
    # Use basic.json: job "a" next_run=1778500400
    # Advance now to 1778500400+1 (one second after a's next_run)
    # Job a's new next_run should be 1778500400+3600=1778504000 (not overdue yet)
    now2 = "2026-05-11T12:00:41Z"  # epoch 1778500841, past a's next_run of 1778500400
    r = run(["plan", "--jobs", f"{FIXTURES}/basic.json", "--now", now2])
    assert r.returncode == 0, f"Exit {r.returncode}: {r.stderr}"
    data = json.loads(r.stdout)
    job_a = next(j for j in data if j["id"] == "a")
    # next_run for a is always last_run_epoch+interval = 1778496800+3600=1778500400
    # It's overdue since now(1778500841) - last_run(1778496800) = 4041 > 3660
    assert job_a["status"] == "overdue", f"Expected overdue at t+41, got {job_a['status']}"

    # Create a synthetic fixture where job "a" was re-run at its next_run time
    synthetic = [
        {
            "id": "a",
            "interval_seconds": 3600,
            "last_run": "2026-05-11T11:53:20Z",  # epoch=1778500400 (prior next_run)
            "max_skew_seconds": 60,
        }
    ]
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as tf:
        json.dump(synthetic, tf)
        tf_path = tf.name

    try:
        r2 = run(["plan", "--jobs", tf_path, "--now", now2])
        assert r2.returncode == 0
        data2 = json.loads(r2.stdout)
        job_a2 = data2[0]
        # next_run = 1778500400 + 3600 = 1778504000
        assert job_a2["next_run"] == 1778504000, (
            f"Expected next_run=1778504000, got {job_a2['next_run']}"
        )
        assert job_a2["status"] == "ok", f"Expected status=ok, got {job_a2['status']}"
    finally:
        os.unlink(tf_path)


def test_10_no_system_clock_calls():
    """Source code must not call any forbidden system clock functions."""
    source = open(SCRIPT).read()
    assert "time.time()" not in source, "FORBIDDEN: time.time() found in chronos.py"
    assert "datetime.now()" not in source, "FORBIDDEN: datetime.now() found in chronos.py"
    assert "datetime.utcnow()" not in source, "FORBIDDEN: datetime.utcnow() found in chronos.py"
    assert "time.monotonic()" not in source, "FORBIDDEN: time.monotonic() found in chronos.py"


def test_11_integer_only_output():
    """All next_run values are integers, no floats."""
    r = run(["plan", "--jobs", f"{FIXTURES}/basic.json", "--now", NOW])
    assert r.returncode == 0
    data = json.loads(r.stdout)
    for job in data:
        val = job["next_run"]
        assert isinstance(val, int) and not isinstance(val, float), (
            f"next_run for {job['id']} is not int: {val!r} (type={type(val).__name__})"
        )
        # Also verify no decimal point in the JSON representation
        raw = r.stdout
        # Find each next_run value in raw JSON — it must not have a decimal point
        import re
        matches = re.findall(r'"next_run"\s*:\s*([0-9.]+)', raw)
        for m in matches:
            assert "." not in m, f"next_run has decimal point in JSON: {m}"


def test_12_year_2099_works():
    """Year 2099 input parses and computes correctly."""
    now_2099 = "2099-01-01T00:00:00Z"
    r = run(["plan", "--jobs", f"{FIXTURES}/basic.json", "--now", now_2099])
    assert r.returncode == 0, f"Exit {r.returncode}: {r.stderr}"
    data = json.loads(r.stdout)
    assert len(data) == 3, f"Expected 3 jobs, got {len(data)}"
    # null last_run job "c" should have next_run = 2099-01-01T00:00:00Z epoch
    job_c = next(j for j in data if j["id"] == "c")
    assert job_c["status"] == "due"
    # epoch for 2099-01-01T00:00:00Z
    from datetime import datetime
    expected = int(datetime.fromisoformat("2099-01-01T00:00:00+00:00").timestamp())
    assert job_c["next_run"] == expected, (
        f"Expected next_run={expected}, got {job_c['next_run']}"
    )
    # All values should be integers
    for job in data:
        assert isinstance(job["next_run"], int), f"next_run not int for {job['id']}"


def main():
    tests = [
        test_1_plan_sorted_by_next_run,
        test_2_overdue_detection,
        test_3_seconds_overdue_correct,
        test_4_null_last_run_status_due,
        test_5_catchup_missed_runs_count,
        test_6_catchup_cap_exit_12,
        test_7_nonz_timestamp_exit_13,
        test_8_zero_interval_exit_14,
        test_9_idempotency_advance_now,
        test_10_no_system_clock_calls,
        test_11_integer_only_output,
        test_12_year_2099_works,
    ]

    passed = 0
    failed = 0
    failures = []

    for test_fn in tests:
        name = test_fn.__name__
        try:
            test_fn()
            print(f"  PASS  {name}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {name}: {e}")
            failed += 1
            failures.append(name)

    total = passed + failed
    print(f"\n{'PASS' if failed == 0 else 'FAIL'} {passed}/{total}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

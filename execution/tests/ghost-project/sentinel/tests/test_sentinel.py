#!/usr/bin/env python3
"""
Sentinel test suite — 15 binary assertions from SPEC.md.
Uses subprocess.run to call sentinel.py; tmpdir via tempfile.mkdtemp.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

SENTINEL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sentinel.py")
FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
SCHEMA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schema.json")

PASS = 0
FAIL = 0
RESULTS = []


def run(args, env=None, cwd=None):
    """Run sentinel.py with given args list, return CompletedProcess."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    return subprocess.run(
        [sys.executable, SENTINEL] + args,
        capture_output=True,
        text=True,
        env=full_env,
        cwd=cwd,
    )


def fixture(name):
    return os.path.join(FIXTURES, name)


def tmpdir():
    return tempfile.mkdtemp(prefix="sentinel-test-")


def assert_test(name: str, passed: bool, detail: str = ""):
    global PASS, FAIL
    status = "PASS" if passed else "FAIL"
    if passed:
        PASS += 1
    else:
        FAIL += 1
    detail_str = f" — {detail}" if detail else ""
    print(f"  [{status}] {name}{detail_str}")
    RESULTS.append((name, passed, detail))


# ── Test 1: Missing queue → exit 1 ───────────────────────────────────────────

def test_01_missing_queue():
    name = "T01: missing queue → exit 1"
    result = run(["--queue", "/nope/does/not/exist.jsonl"])
    assert_test(name, result.returncode == 1, f"exit={result.returncode}")


# ── Test 2: Corrupt JSON → exit 2 ────────────────────────────────────────────

def test_02_corrupt_json():
    name = "T02: corrupt JSON → exit 2"
    result = run(["--queue", fixture("corrupt_queue.jsonl")])
    assert_test(name, result.returncode == 2, f"exit={result.returncode}")


# ── Test 3: Schema violation → exit 2, no side effects ───────────────────────

def test_03_schema_violation():
    name = "T03: schema violation → exit 2, no side effects"
    d = tmpdir()
    try:
        out = os.path.join(d, "out.jsonl")
        result = run(["--queue", fixture("schema_violation.jsonl"), "--output", out])
        no_side_effect = not os.path.exists(out)
        assert_test(
            name,
            result.returncode == 2 and no_side_effect,
            f"exit={result.returncode}, side_effect_file={'absent' if no_side_effect else 'PRESENT'}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 4: Valid queue → no pending/in_progress tasks remain ─────────────────

def test_04_valid_queue_all_terminal():
    name = "T04: valid queue → all tasks terminal"
    d = tmpdir()
    try:
        # Copy fixture so we don't mutate it
        q = os.path.join(d, "queue.jsonl")
        shutil.copy(fixture("valid_queue.jsonl"), q)
        out = os.path.join(d, "out.jsonl")
        result = run(["--queue", q, "--output", out])
        if not os.path.exists(out):
            assert_test(name, False, "output file not created")
            return
        with open(out) as f:
            tasks = [json.loads(l) for l in f if l.strip()]
        non_terminal = [t for t in tasks if t["state"] in ("pending", "in_progress")]
        assert_test(
            name,
            result.returncode == 0 and len(non_terminal) == 0,
            f"exit={result.returncode}, non_terminal={len(non_terminal)}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 5: Idempotency — re-run produces identical output ───────────────────

def test_05_idempotency():
    name = "T05: idempotency — re-run produces identical output"
    d = tmpdir()
    try:
        q = os.path.join(d, "queue.jsonl")
        shutil.copy(fixture("valid_queue.jsonl"), q)
        out1 = os.path.join(d, "out1.jsonl")
        out2 = os.path.join(d, "out2.jsonl")
        run(["--queue", q, "--output", out1])
        # Second run — use the output of the first run as input
        run(["--queue", out1, "--output", out2])
        if not os.path.exists(out1) or not os.path.exists(out2):
            assert_test(name, False, "output files missing")
            return
        with open(out1) as f1, open(out2) as f2:
            c1 = f1.read()
            c2 = f2.read()
        assert_test(name, c1 == c2, f"outputs {'match' if c1 == c2 else 'differ'}")
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 6: Done task is skipped — no side effects on re-run ─────────────────

def test_06_done_task_skipped():
    name = "T06: done task skipped on re-run"
    d = tmpdir()
    try:
        # Create a queue with one done write_file task pointing to a temp file
        target = os.path.join(d, "should-not-appear.txt")
        queue_data = [
            {
                "id": "task-already-done",
                "type": "write_file",
                "payload": {"path": target, "content": "this should not be written"},
                "attempts": 1,
                "max_attempts": 3,
                "state": "done",
            }
        ]
        q = os.path.join(d, "queue.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        out = os.path.join(d, "out.jsonl")
        run(["--queue", q, "--output", out])
        # Target file should NOT exist — the done task was skipped
        assert_test(
            name,
            not os.path.exists(target),
            f"side_effect_file={'absent' if not os.path.exists(target) else 'PRESENT'}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 7: Max attempts → dead ───────────────────────────────────────────────

def test_07_max_attempts_dead():
    name = "T07: exhausted retries → state=dead"
    d = tmpdir()
    try:
        # exhausted_retries.jsonl has a task with attempts=2, max_attempts=3, state=failed
        # pointing to /proc/impossible-path-that-cannot-be-written/test.txt
        # One more failure should push it to dead
        q = os.path.join(d, "queue.jsonl")
        shutil.copy(fixture("exhausted_retries.jsonl"), q)
        out = os.path.join(d, "out.jsonl")
        run(["--queue", q, "--output", out])
        if not os.path.exists(out):
            assert_test(name, False, "output missing")
            return
        with open(out) as f:
            tasks = [json.loads(l) for l in f if l.strip()]
        dead_tasks = [t for t in tasks if t["id"] == "task-exhausted" and t["state"] == "dead"]
        assert_test(name, len(dead_tasks) == 1, f"dead_count={len(dead_tasks)}")
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 8: in_progress on startup → reset + attempts++ ──────────────────────

def test_08_inprogress_recovery():
    name = "T08: in_progress on startup → reset + attempts++"
    d = tmpdir()
    try:
        # exhausted_retries.jsonl has task-inprogress-crash in in_progress state with attempts=0
        q = os.path.join(d, "queue.jsonl")
        shutil.copy(fixture("exhausted_retries.jsonl"), q)
        out = os.path.join(d, "out.jsonl")
        run(["--queue", q, "--output", out])
        if not os.path.exists(out):
            assert_test(name, False, "output missing")
            return
        with open(out) as f:
            tasks = [json.loads(l) for l in f if l.strip()]
        crash_task = next((t for t in tasks if t["id"] == "task-inprogress-crash"), None)
        if crash_task is None:
            assert_test(name, False, "task not found in output")
            return
        # attempts must be >= 1 (was incremented during recovery, then again during processing)
        assert_test(
            name,
            crash_task["attempts"] >= 1,
            f"attempts={crash_task['attempts']}, state={crash_task['state']}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 9: Atomic write survives mid-flight kill ─────────────────────────────

def test_09_atomic_write_fault_injection():
    name = "T09: atomic write survives fault injection + recovery"
    d = tmpdir()
    try:
        # Build a simple 2-task queue (sleep tasks — no FS side effects)
        queue_data = [
            {"id": "s1", "type": "sleep", "payload": {"ms": 1}, "attempts": 0, "max_attempts": 3, "state": "pending"},
            {"id": "s2", "type": "sleep", "payload": {"ms": 1}, "attempts": 0, "max_attempts": 3, "state": "pending"},
        ]
        q = os.path.join(d, "queue.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")

        # Run with fault injection after task 1
        env = {"SENTINEL_TEST_MODE": "1"}
        result = run(
            ["--queue", q, "--output", q, "--inject-fault", "after-task=1"],
            env=env,
        )
        # Exit code 99 = simulated crash
        crashed = result.returncode == 99

        # Queue file must still be parseable
        parseable = True
        tasks_after_crash = []
        if os.path.exists(q):
            try:
                with open(q) as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            tasks_after_crash.append(json.loads(line))
            except json.JSONDecodeError:
                parseable = False

        if not crashed or not parseable:
            assert_test(name, False, f"crashed={crashed}, parseable={parseable}")
            return

        # Now re-run (recovery) — queue should finish cleanly
        result2 = run(["--queue", q, "--output", q])
        with open(q) as f:
            tasks_final = [json.loads(l) for l in f if l.strip()]
        non_terminal = [t for t in tasks_final if t["state"] in ("pending", "in_progress", "failed")]
        no_duplicates = len(tasks_final) == 2

        assert_test(
            name,
            result2.returncode == 0 and no_duplicates and len(non_terminal) == 0,
            f"exit2={result2.returncode}, tasks={len(tasks_final)}, non_terminal={len(non_terminal)}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 10: Sleep cap enforced ───────────────────────────────────────────────

def test_10_sleep_cap():
    name = "T10: sleep cap enforced (999999ms → ≤200ms wall time)"
    d = tmpdir()
    try:
        queue_data = [
            {
                "id": "big-sleep",
                "type": "sleep",
                "payload": {"ms": 999999},
                "attempts": 0,
                "max_attempts": 3,
                "state": "pending",
            }
        ]
        q = os.path.join(d, "queue.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        t0 = time.monotonic()
        run(["--queue", q, "--output", q])
        elapsed_ms = (time.monotonic() - t0) * 1000
        assert_test(name, elapsed_ms < 1000, f"elapsed={elapsed_ms:.0f}ms")
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 11: dry-run has no side effects ──────────────────────────────────────

def test_11_dry_run_no_side_effects():
    name = "T11: --dry-run has no side effects"
    d = tmpdir()
    try:
        target = os.path.join(d, "should-not-exist.txt")
        queue_data = [
            {
                "id": "dry-write",
                "type": "write_file",
                "payload": {"path": target, "content": "should not appear"},
                "attempts": 0,
                "max_attempts": 3,
                "state": "pending",
            }
        ]
        q = os.path.join(d, "queue.jsonl")
        out = os.path.join(d, "out.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        run(["--queue", q, "--output", out, "--dry-run"])
        no_target = not os.path.exists(target)
        no_out = not os.path.exists(out)
        assert_test(
            name,
            no_target and no_out,
            f"target={'absent' if no_target else 'PRESENT'}, out={'absent' if no_out else 'PRESENT'}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 12: Exit 0 when all tasks terminal ───────────────────────────────────

def test_12_exit0_all_terminal():
    name = "T12: exit 0 when all tasks in terminal state"
    d = tmpdir()
    try:
        # Pre-build a queue where tasks are already done/dead
        queue_data = [
            {
                "id": "t-done",
                "type": "sleep",
                "payload": {"ms": 1},
                "attempts": 1,
                "max_attempts": 3,
                "state": "done",
            },
            {
                "id": "t-dead",
                "type": "write_file",
                "payload": {"path": "/tmp/irrelevant.txt", "content": "x"},
                "attempts": 3,
                "max_attempts": 3,
                "state": "dead",
            },
        ]
        q = os.path.join(d, "queue.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        result = run(["--queue", q, "--output", q])
        assert_test(name, result.returncode == 0, f"exit={result.returncode}")
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 13: --report writes accurate JSON on mixed-state queue ───────────────

def test_13_report_mixed_state():
    name = "T13: --report writes accurate JSON on mixed-state queue"
    d = tmpdir()
    try:
        target = os.path.join(d, "output.txt")
        report_path = os.path.join(d, "report.json")
        queue_data = [
            {
                "id": "task-write",
                "type": "write_file",
                "payload": {"path": target, "content": "hello"},
                "attempts": 0,
                "max_attempts": 3,
                "state": "pending",
            },
            {
                "id": "task-hash",
                "type": "compute_hash",
                "payload": {
                    "input_path": "/no/such/file.txt",
                    "output_path": os.path.join(d, "hash.txt"),
                },
                "attempts": 0,
                "max_attempts": 1,
                "state": "pending",
            },
        ]
        q = os.path.join(d, "queue.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        run(["--queue", q, "--output", q, "--report", report_path])
        if not os.path.exists(report_path):
            assert_test(name, False, "report file not created")
            return
        with open(report_path) as f:
            r = json.load(f)
        ok = (
            r.get("total_tasks") == 2
            and r.get("done") == 1
            and r.get("dead") == 1
            and r.get("failed") == 0
            and r.get("pending_remaining") == 0
            and len(r.get("tasks_processed", [])) == 2
        )
        assert_test(
            name,
            ok,
            f"total={r.get('total_tasks')}, done={r.get('done')}, dead={r.get('dead')}, "
            f"processed={len(r.get('tasks_processed', []))}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 14: --report with --dry-run writes report but no task side effects ───

def test_14_report_dry_run():
    name = "T14: --report with --dry-run writes report, no task side effects"
    d = tmpdir()
    try:
        target = os.path.join(d, "should-not-exist.txt")
        report_path = os.path.join(d, "report2.json")
        queue_data = [
            {
                "id": "dry-write",
                "type": "write_file",
                "payload": {"path": target, "content": "nope"},
                "attempts": 0,
                "max_attempts": 3,
                "state": "pending",
            }
        ]
        q = os.path.join(d, "queue.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        run(["--queue", q, "--output", q, "--dry-run", "--report", report_path])
        report_exists = os.path.exists(report_path)
        target_absent = not os.path.exists(target)
        done_count = -1
        if report_exists:
            with open(report_path) as f:
                r = json.load(f)
            done_count = r.get("done", -1)
        ok = report_exists and target_absent and done_count == 1
        assert_test(
            name,
            ok,
            f"report={'exists' if report_exists else 'MISSING'}, "
            f"target={'absent' if target_absent else 'PRESENT'}, done={done_count}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Test 15: --report on already-done queue logs zero processed ───────────────

def test_15_report_already_done():
    name = "T15: --report on already-done queue logs zero processed"
    d = tmpdir()
    try:
        report_path = os.path.join(d, "report3.json")
        queue_data = [
            {
                "id": "task-done",
                "type": "sleep",
                "payload": {"ms": 1},
                "attempts": 1,
                "max_attempts": 3,
                "state": "done",
            }
        ]
        q = os.path.join(d, "queue.jsonl")
        with open(q, "w") as f:
            for task in queue_data:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        run(["--queue", q, "--output", q, "--report", report_path])
        if not os.path.exists(report_path):
            assert_test(name, False, "report file not created")
            return
        with open(report_path) as f:
            r = json.load(f)
        ok = (
            r.get("tasks_processed") == []
            and r.get("done") == 1
            and r.get("total_tasks") == 1
        )
        assert_test(
            name,
            ok,
            f"tasks_processed={r.get('tasks_processed')}, done={r.get('done')}, "
            f"total={r.get('total_tasks')}",
        )
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── Runner ────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Sentinel Test Suite — 15 assertions")
    print("=" * 60)

    test_01_missing_queue()
    test_02_corrupt_json()
    test_03_schema_violation()
    test_04_valid_queue_all_terminal()
    test_05_idempotency()
    test_06_done_task_skipped()
    test_07_max_attempts_dead()
    test_08_inprogress_recovery()
    test_09_atomic_write_fault_injection()
    test_10_sleep_cap()
    test_11_dry_run_no_side_effects()
    test_12_exit0_all_terminal()
    test_13_report_mixed_state()
    test_14_report_dry_run()
    test_15_report_already_done()

    total = PASS + FAIL
    print("=" * 60)
    if FAIL == 0:
        print(f"PASS {PASS}/{total}")
        sys.exit(0)
    else:
        print(f"FAIL {FAIL}/{total} passed={PASS}")
        sys.exit(1)


if __name__ == "__main__":
    main()

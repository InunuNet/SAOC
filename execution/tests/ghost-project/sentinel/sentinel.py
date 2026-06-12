#!/usr/bin/env python3
"""
Sentinel — Deterministic JSONL Dead-Letter Queue Processor
Spec: SPEC.md | Schema: schema.json
"""

import argparse
import hashlib
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone

# ── optional dependency ──────────────────────────────────────────────────────
try:
    import jsonschema
    from jsonschema import validate, ValidationError
except ImportError:
    print("ERROR: jsonschema not installed. Run: pip install jsonschema", file=sys.stderr)
    sys.exit(1)


# ── helpers ──────────────────────────────────────────────────────────────────

def load_schema(schema_path: str) -> dict:
    """Load JSON Schema from disk."""
    try:
        with open(schema_path) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot load schema {schema_path}: {exc}", file=sys.stderr)
        sys.exit(1)


def load_queue(queue_path: str) -> list[dict]:
    """
    Read JSONL file.  Returns list of dicts.
    Exits 1 if file missing, exits 2 if any line is not valid JSON.
    Note: schema validation is a separate step performed after this.
    """
    if not os.path.exists(queue_path):
        print(f"ERROR: queue file not found: {queue_path}", file=sys.stderr)
        sys.exit(1)
    tasks = []
    try:
        with open(queue_path) as f:
            for lineno, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    tasks.append(json.loads(line))
                except json.JSONDecodeError as exc:
                    print(
                        f"ERROR: invalid JSON on line {lineno}: {exc}",
                        file=sys.stderr,
                    )
                    sys.exit(2)
    except OSError as exc:
        print(f"ERROR: cannot read queue {queue_path}: {exc}", file=sys.stderr)
        sys.exit(1)
    return tasks


def validate_queue(tasks: list[dict], schema: dict) -> None:
    """
    Validate ALL tasks against schema before any execution.
    Exit 2 on first violation (no side effects).
    """
    validator = jsonschema.Draft7Validator(schema)
    for i, task in enumerate(tasks):
        errors = list(validator.iter_errors(task))
        if errors:
            task_id = task.get("id", f"<index {i}>")
            msgs = "; ".join(e.message for e in errors[:3])
            print(
                f"ERROR: schema validation failed for task {task_id!r}: {msgs}",
                file=sys.stderr,
            )
            sys.exit(2)


def atomic_write_queue(tasks: list[dict], output_path: str) -> None:
    """
    Write tasks as JSONL to a temp file then os.replace → atomic on POSIX.
    Never uses shutil.move.
    """
    tmp_path = output_path + ".tmp"
    try:
        with open(tmp_path, "w") as f:
            for task in tasks:
                f.write(json.dumps(task, sort_keys=True) + "\n")
        os.replace(tmp_path, output_path)
    except OSError as exc:
        print(f"ERROR: I/O error during atomic write to {output_path}: {exc}", file=sys.stderr)
        # clean up temp if it exists
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        sys.exit(3)


# ── crash recovery ────────────────────────────────────────────────────────────

def recover_in_progress(tasks: list[dict], verbose: bool = False) -> list[dict]:
    """
    On startup: any task in in_progress was interrupted.
    Reset to pending only — attempt count is incremented at pickup.
    Must happen BEFORE processing.
    """
    for task in tasks:
        if task["state"] == "in_progress":
            task["state"] = "pending"
            if verbose:
                print(
                    f"[RECOVER] task {task['id']!r}: in_progress → pending "
                    f"(attempts unchanged at {task['attempts']})"
                )
    return tasks


# ── task handlers ─────────────────────────────────────────────────────────────

SLEEP_CAP_MS = 100  # hard cap per spec


def handle_write_file(task: dict, dry_run: bool = False, verbose: bool = False) -> None:
    """Write content to path.  Raises on failure."""
    path = task["payload"]["path"]
    content = task["payload"]["content"]
    if dry_run:
        if verbose:
            print(f"[DRY-RUN] write_file would write {len(content)} bytes to {path!r}")
        return
    # Ensure parent directory exists
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    if verbose:
        print(f"[write_file] wrote {len(content)} bytes to {path!r}")


def handle_compute_hash(task: dict, dry_run: bool = False, verbose: bool = False) -> None:
    """
    SHA256 of input_path, write hex digest to output_path.
    Missing input → raise FileNotFoundError so caller can set state=dead.
    """
    input_path = task["payload"]["input_path"]
    output_path = task["payload"]["output_path"]

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"input_path not found: {input_path!r}")

    sha = hashlib.sha256()
    with open(input_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha.update(chunk)
    digest = sha.hexdigest()

    if dry_run:
        if verbose:
            print(f"[DRY-RUN] compute_hash would write digest {digest[:8]}... to {output_path!r}")
        return

    parent = os.path.dirname(output_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(output_path, "w") as f:
        f.write(digest)
    if verbose:
        print(f"[compute_hash] wrote digest {digest[:8]}... to {output_path!r}")


def handle_sleep(task: dict, dry_run: bool = False, verbose: bool = False) -> None:
    """Sleep N ms — HARD CAP at 100ms regardless of payload."""
    ms = task["payload"]["ms"]
    capped_ms = min(ms, SLEEP_CAP_MS)
    if dry_run:
        if verbose:
            print(f"[DRY-RUN] sleep would sleep {capped_ms}ms (requested {ms}ms)")
        return
    if verbose and ms != capped_ms:
        print(f"[sleep] capping {ms}ms → {capped_ms}ms")
    time.sleep(capped_ms / 1000.0)
    if verbose:
        print(f"[sleep] slept {capped_ms}ms")


HANDLERS = {
    "write_file": handle_write_file,
    "compute_hash": handle_compute_hash,
    "sleep": handle_sleep,
}


# ── fault injection (test-only) ───────────────────────────────────────────────

def maybe_inject_fault(inject_after: int | None, tasks_done: int, output_path: str, tasks: list[dict]) -> None:
    """
    When SENTINEL_TEST_MODE=1 and --inject-fault=after-task=N is set,
    simulate a crash after N tasks have been processed.
    We write to .tmp but raise SystemExit BEFORE os.replace completes.
    """
    if inject_after is None:
        return
    if tasks_done >= inject_after:
        tmp_path = output_path + ".tmp"
        try:
            with open(tmp_path, "w") as f:
                for task in tasks:
                    f.write(json.dumps(task, sort_keys=True) + "\n")
            # Simulate crash BEFORE the replace — .tmp exists, original unchanged
        except OSError:
            pass
        print(
            f"[FAULT INJECTION] simulating crash after {tasks_done} tasks "
            f"(wrote {tmp_path}, skipping os.replace)",
            file=sys.stderr,
        )
        raise SystemExit(99)


# ── main processing loop ──────────────────────────────────────────────────────

def write_report(tasks: list[dict], tasks_processed_log: list[dict], report_path: str) -> None:
    """Write JSON execution report atomically."""
    report = {
        "dead": sum(1 for t in tasks if t["state"] == "dead"),
        "done": sum(1 for t in tasks if t["state"] == "done"),
        "failed": sum(1 for t in tasks if t["state"] == "failed"),
        "pending_remaining": sum(1 for t in tasks if t["state"] in ("pending", "in_progress")),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "tasks_processed": tasks_processed_log,
        "total_tasks": len(tasks),
    }
    parent = os.path.dirname(report_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    tmp_path = report_path + ".tmp"
    try:
        with open(tmp_path, "w") as f:
            f.write(json.dumps(report, indent=2, sort_keys=True))
        os.replace(tmp_path, report_path)
    except OSError as exc:
        print(f"ERROR: I/O error writing report to {report_path}: {exc}", file=sys.stderr)
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        sys.exit(3)


def process_queue(
    tasks: list[dict],
    output_path: str,
    dry_run: bool = False,
    max_tasks: int | None = None,
    verbose: bool = False,
    inject_after: int | None = None,
) -> tuple[int, list[dict]]:
    """
    Main state-machine loop.
    Returns (exit_code, tasks_processed_log): exit_code 0 = all terminal.
    """
    tasks_processed = 0
    tasks_processed_log: list[dict] = []

    for task in tasks:
        state = task["state"]

        # Skip terminal states
        if state in ("done", "dead"):
            if verbose:
                print(f"[SKIP] task {task['id']!r} already in terminal state {state!r}")
            continue

        # Max tasks guard (only counts tasks we actually attempt)
        if max_tasks is not None and tasks_processed >= max_tasks:
            if verbose:
                print(f"[LIMIT] reached --max-tasks={max_tasks}, stopping")
            break

        state_before = state

        # Transition: pending|failed → in_progress (increment attempts)
        # 'failed' with remaining attempts is equivalent to 'pending' for pickup
        if state in ("pending", "failed"):
            task["state"] = "in_progress"
            task["attempts"] += 1
            if verbose:
                print(
                    f"[PICKUP] task {task['id']!r}: {state} → in_progress "
                    f"(attempt {task['attempts']}/{task['max_attempts']})"
                )
            if not dry_run:
                atomic_write_queue(tasks, output_path)

        # Execute handler
        handler = HANDLERS.get(task["type"])
        dead_immediately = False
        success = False
        error_msg = ""

        try:
            handler(task, dry_run=dry_run, verbose=verbose)
            success = True
        except FileNotFoundError as exc:
            # compute_hash on missing input → dead immediately
            error_msg = str(exc)
            dead_immediately = True
        except Exception as exc:
            error_msg = str(exc)

        # Determine next state
        if success:
            task["state"] = "done"
            if verbose:
                print(f"[DONE] task {task['id']!r}: in_progress → done")
        elif dead_immediately:
            task["state"] = "dead"
            if verbose:
                print(f"[DEAD] task {task['id']!r}: dead immediately — {error_msg}")
        else:
            # failed — check attempts
            if task["attempts"] >= task["max_attempts"]:
                task["state"] = "dead"
                if verbose:
                    print(
                        f"[DEAD] task {task['id']!r}: exhausted "
                        f"{task['attempts']}/{task['max_attempts']} attempts — {error_msg}"
                    )
            else:
                task["state"] = "pending"
                if verbose:
                    print(
                        f"[RETRY] task {task['id']!r}: attempt "
                        f"{task['attempts']}/{task['max_attempts']} failed — {error_msg}"
                    )

        if not dry_run:
            atomic_write_queue(tasks, output_path)

        tasks_processed_log.append({
            "attempts": task["attempts"],
            "id": task["id"],
            "state_after": task["state"],
            "state_before": state_before,
            "type": task["type"],
        })
        tasks_processed += 1

        # Fault injection (test only)
        maybe_inject_fault(inject_after, tasks_processed, output_path, tasks)

    # Determine exit code
    non_terminal = [t for t in tasks if t["state"] in ("pending", "in_progress", "failed")]
    return (0 if not non_terminal else 1), tasks_processed_log


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Sentinel — JSONL dead-letter queue processor"
    )
    parser.add_argument("--queue", required=True, help="Path to input JSONL queue file")
    parser.add_argument("--output", help="Path to output JSONL file (default: in-place)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without side effects")
    parser.add_argument("--max-tasks", type=int, help="Process at most N tasks per run")
    parser.add_argument(
        "--schema",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.json"),
        help="Path to JSON Schema file (default: schema.json next to sentinel.py)",
    )
    parser.add_argument("--verbose", action="store_true", help="Log each task state transition")
    parser.add_argument("--report", metavar="PATH", help="Write JSON execution report to PATH after processing")
    # Test-only flag — only available when SENTINEL_TEST_MODE=1
    if os.environ.get("SENTINEL_TEST_MODE") == "1":
        parser.add_argument(
            "--inject-fault",
            metavar="after-task=N",
            help="(test only) Crash after N tasks, before os.replace",
        )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    # Resolve output path
    output_path = args.output if args.output else args.queue

    # Determine inject_after (test mode only)
    inject_after = None
    if os.environ.get("SENTINEL_TEST_MODE") == "1" and hasattr(args, "inject_fault") and args.inject_fault:
        raw = args.inject_fault
        try:
            _, n_str = raw.split("=")
            inject_after = int(n_str)
        except (ValueError, AttributeError):
            print(f"ERROR: --inject-fault must be 'after-task=N', got: {raw!r}", file=sys.stderr)
            sys.exit(1)

    # Load schema
    schema = load_schema(args.schema)

    # Load queue (parse errors → exit 2)
    tasks = load_queue(args.queue)

    # Full schema validation BEFORE any execution
    validate_queue(tasks, schema)

    # Crash recovery: in_progress → pending + attempts++
    tasks = recover_in_progress(tasks, verbose=args.verbose)

    # If output differs from queue, seed the output file with the (recovered) queue
    # so atomic_write_queue always writes to output_path
    if not args.dry_run and output_path != args.queue:
        # Write recovered state to output before processing
        atomic_write_queue(tasks, output_path)

    # Process
    exit_code, tasks_processed_log = process_queue(
        tasks=tasks,
        output_path=output_path,
        dry_run=args.dry_run,
        max_tasks=args.max_tasks,
        verbose=args.verbose,
        inject_after=inject_after,
    )

    if args.report:
        write_report(tasks, tasks_processed_log, args.report)

    if args.verbose:
        terminal = [t for t in tasks if t["state"] in ("done", "dead")]
        non_terminal = [t for t in tasks if t["state"] not in ("done", "dead")]
        print(
            f"[SUMMARY] {len(terminal)} terminal, {len(non_terminal)} non-terminal. "
            f"Exit code: {exit_code}"
        )

    sys.exit(exit_code)


if __name__ == "__main__":
    main()

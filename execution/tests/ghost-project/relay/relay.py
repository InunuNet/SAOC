#!/usr/bin/env python3
"""
Relay — Config-driven health checker (file-based, hermetic).
Usage: python3 relay.py --config <health.yaml> [--parallel] [--format jsonl|table] [--fail-fast]
"""
import argparse
import json
import os
import sys
import threading
import time
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

VALID_TYPES = {"file_exists", "file_contains", "always_up", "always_down"}
REQUIRED_FIELDS = {"name", "type"}


def load_config(path: str) -> list:
    """Load and validate config. Returns list of service dicts. Raises SystemExit(1) on error."""
    if not os.path.exists(path):
        print(f"Config file not found: {path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(f"Invalid YAML: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(data, dict) or "services" not in data:
        print("Config must have a top-level 'services' key.", file=sys.stderr)
        sys.exit(1)

    services = data["services"]
    if not isinstance(services, list):
        print("'services' must be a list.", file=sys.stderr)
        sys.exit(1)

    # Validate all services BEFORE running any checks
    for i, svc in enumerate(services):
        if not isinstance(svc, dict):
            print(f"Service at index {i} is not a mapping.", file=sys.stderr)
            sys.exit(1)
        for field in REQUIRED_FIELDS:
            if field not in svc:
                print(f"Service at index {i} missing required field '{field}'.", file=sys.stderr)
                sys.exit(1)
        if svc["type"] not in VALID_TYPES:
            print(
                f"Service '{svc.get('name', i)}' has unknown type '{svc['type']}'. "
                f"Valid types: {sorted(VALID_TYPES)}",
                file=sys.stderr,
            )
            sys.exit(1)
        # file_contains requires expected_content
        if svc["type"] == "file_contains" and not svc.get("expected_content"):
            print(
                f"Service '{svc['name']}' of type 'file_contains' requires 'expected_content'.",
                file=sys.stderr,
            )
            sys.exit(1)

    return services


def run_check(svc: dict) -> dict:
    """Run a single health check. Returns result dict."""
    name = svc["name"]
    stype = svc["type"]
    timeout_ms = svc.get("timeout_ms", 5000)
    timeout_s = timeout_ms / 1000.0

    checked_at = datetime.now(timezone.utc).isoformat()
    start = time.monotonic()

    result = {"name": name, "status": "down", "checked_at": checked_at, "duration_ms": 0, "detail": None}

    def do_check():
        if stype == "always_up":
            result["status"] = "up"
        elif stype == "always_down":
            result["status"] = "down"
            result["detail"] = "always_down service"
        elif stype == "file_exists":
            path = svc.get("path", "")
            if os.path.exists(path):
                result["status"] = "up"
            else:
                result["status"] = "down"
                result["detail"] = f"path not found: {path}"
        elif stype == "file_contains":
            path = svc.get("path", "")
            expected = svc.get("expected_content", "")
            if not os.path.exists(path):
                result["status"] = "down"
                result["detail"] = f"path not found: {path}"
            else:
                try:
                    with open(path, "r") as f:
                        content = f.read()
                    if expected in content:
                        result["status"] = "up"
                    else:
                        result["status"] = "down"
                        result["detail"] = f"expected_content not found in file"
                except OSError as e:
                    result["status"] = "down"
                    result["detail"] = str(e)

    # Run check with per-check timeout using threading
    t = threading.Thread(target=do_check)
    t.start()
    t.join(timeout=timeout_s)
    if t.is_alive():
        result["status"] = "timeout"
        result["detail"] = f"timed out after {timeout_ms}ms"

    elapsed_ms = int((time.monotonic() - start) * 1000)
    result["duration_ms"] = elapsed_ms
    return result


def format_table(results: list, summary: dict) -> str:
    """Format results as ASCII table."""
    lines = []
    header = f"{'NAME':<25} {'STATUS':<10} {'DURATION_MS':>12}  DETAIL"
    lines.append(header)
    lines.append("-" * 70)
    for r in results:
        detail = r["detail"] or ""
        lines.append(f"{r['name']:<25} {r['status']:<10} {r['duration_ms']:>12}  {detail}")
    lines.append("-" * 70)
    lines.append(
        f"Total: {summary['total']}  Up: {summary['up']}  Down: {summary['down']}  "
        f"All Healthy: {summary['all_healthy']}"
    )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Relay — config-driven health checker")
    parser.add_argument("--config", required=True, help="Path to health.yaml config file")
    parser.add_argument("--parallel", action="store_true", help="Run checks concurrently")
    parser.add_argument("--format", choices=["jsonl", "table"], default="jsonl", dest="fmt")
    parser.add_argument("--fail-fast", action="store_true", dest="fail_fast",
                        help="Stop after first down/timeout (serial only)")
    args = parser.parse_args()

    services = load_config(args.config)

    results = []

    if args.parallel:
        # Parallel mode: ignore fail-fast, run all checks concurrently
        threads = []
        result_slots = [None] * len(services)

        def check_and_store(idx, svc):
            result_slots[idx] = run_check(svc)

        for i, svc in enumerate(services):
            t = threading.Thread(target=check_and_store, args=(i, svc))
            threads.append(t)
            t.start()
        for t in threads:
            t.join()

        results = [r for r in result_slots if r is not None]
        # Sort by name for deterministic output (trap 1)
        results.sort(key=lambda r: r["name"])
    else:
        # Serial mode
        for svc in services:
            r = run_check(svc)
            results.append(r)
            if args.fail_fast and r["status"] in ("down", "timeout"):
                # Print partial results then exit
                up_count = sum(1 for x in results if x["status"] == "up")
                down_count = sum(1 for x in results if x["status"] != "up")
                summary = {
                    "summary": True,
                    "total": len(results),
                    "up": up_count,
                    "down": down_count,
                    "all_healthy": False,
                }
                if args.fmt == "jsonl":
                    for res in results:
                        print(json.dumps(res))
                    print(json.dumps(summary))
                else:
                    print(format_table(results, summary))
                sys.exit(2)

    # Build summary
    up_count = sum(1 for r in results if r["status"] == "up")
    down_count = len(results) - up_count
    summary = {
        "summary": True,
        "total": len(results),
        "up": up_count,
        "down": down_count,
        "all_healthy": down_count == 0,
    }

    # Output (summary always last — trap 4)
    if args.fmt == "jsonl":
        for r in results:
            print(json.dumps(r))
        print(json.dumps(summary))
    else:
        print(format_table(results, summary))

    # Exit codes
    if down_count > 0:
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()

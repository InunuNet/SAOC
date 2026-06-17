#!/usr/bin/env python3
"""Smoke tests for comms_buddy.py watch enhancements."""
import sys
import ast
import pathlib
import tempfile
import subprocess
import argparse

ROOT = pathlib.Path(__file__).resolve().parents[3]
SOURCE = ROOT / "execution" / "comms_buddy.py"


def check_no_trim():
    """Verify trim() is not called inside the watch() function body."""
    src = SOURCE.read_text()
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "watch":
            func_src = ast.get_source_segment(src, node) or ""
            assert "trim(" not in func_src, f"trim() found in watch(): {func_src[:200]}"
            print("A4 PASS: trim() not in watch()")
            return 0
    print("FAIL: watch() function not found")
    return 1


def check_once():
    """Verify --once exits after one poll without looping, watching a controlled file."""
    import time
    with tempfile.TemporaryDirectory() as d:
        test_file = pathlib.Path(d) / "test_comms.md"
        test_file.write_text("initial content")
        # Start subprocess watching the test file via --file flag
        proc = subprocess.Popen(
            [sys.executable, str(SOURCE), "watch", "--interval", "0.1",
             "--once", "--file", str(test_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        # Modify the file while subprocess is sleeping
        time.sleep(0.05)
        test_file.write_text("modified content")
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            print("FAIL: watch --once hung (did not exit)")
            return 1
        rc = proc.returncode
        # Should detect change and return 0
        if rc != 0:
            print(f"FAIL: expected exit 0 (change detected), got {rc}")
            print("stdout:", proc.stdout.read().decode())
            return 1
        print(f"A5 PASS: watch --once detected file change, exit code {rc}")
        return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--check-no-trim", action="store_true")
    p.add_argument("--check-once", action="store_true")
    args = p.parse_args()
    if args.check_no_trim:
        sys.exit(check_no_trim())
    if args.check_once:
        sys.exit(check_once())
    # Run all checks
    sys.exit(max(check_no_trim(), check_once()))

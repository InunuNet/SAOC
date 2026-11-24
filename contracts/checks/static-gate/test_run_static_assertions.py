#!/usr/bin/env python3
"""Tests for run_static_assertions.py: allowlist shape errors exit 2, timeouts kill grandchildren.

Run: python3 contracts/checks/static-gate/test_run_static_assertions.py
"""
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import run_static_assertions as runner  # noqa: E402

GOOD_ENTRY = {"contract": "c.yaml", "id": "A1"}
POLL_SECONDS = 0.1
SETTLE_SECONDS = 5
TEST_TIMEOUT_SECONDS = 1
TEST_REAP_SECONDS = 1
HANG_SLACK_SECONDS = 4


def pid_alive(pid):
    return subprocess.run(["kill", "-0", str(pid)], capture_output=True).returncode == 0


class AllowlistShapeTest(unittest.TestCase):
    def exit_code(self, payload, raw=False):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "allowlist.json"
            path.write_text(payload if raw else json.dumps(payload), encoding="utf-8")
            with mock.patch("sys.stderr"), mock.patch("sys.stdout"):
                return runner.main(["--allowlist", str(path), "--list"])

    def test_wrong_shapes_exit_2(self):
        schema = runner.ALLOWLIST_SCHEMA
        bad = [
            [], [GOOD_ENTRY], "text", None, 7,
            {"schema": schema},
            {"schema": schema, "assertions": "x"},
            {"schema": schema, "assertions": []},
            {"schema": schema, "assertions": ["x"]},
            {"schema": schema, "assertions": [None]},
            {"schema": schema, "assertions": [{"contract": 1, "id": "A1"}]},
            {"schema": schema, "assertions": [GOOD_ENTRY, GOOD_ENTRY]},
            {"schema": "wrong", "assertions": [GOOD_ENTRY]},
        ]
        for payload in bad:
            self.assertEqual(self.exit_code(payload), 2, payload)
        self.assertEqual(self.exit_code("{not json", raw=True), 2)

    def test_valid_shape_exits_0(self):
        self.assertEqual(self.exit_code(
            {"schema": runner.ALLOWLIST_SCHEMA, "assertions": [GOOD_ENTRY]}), 0)


class TimeoutKillsGroupTest(unittest.TestCase):
    def test_grandchild_dies_on_timeout(self):
        with tempfile.TemporaryDirectory() as tmp:
            pidfile = Path(tmp) / "pid"
            command = f"sleep 300 & echo $! > {pidfile}; wait"
            with mock.patch.object(runner, "TIMEOUT_SECONDS", TEST_TIMEOUT_SECONDS):
                code, _ = runner.run_command(tmp, command)
            self.assertEqual(code, "timeout")
            pid = int(pidfile.read_text().strip())
            deadline = time.monotonic() + SETTLE_SECONDS
            while pid_alive(pid) and time.monotonic() < deadline:
                time.sleep(POLL_SECONDS)
            self.assertFalse(pid_alive(pid), f"grandchild {pid} survived the timeout")

    def test_killpg_lookup_error_still_reports_timeout(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(runner, "TIMEOUT_SECONDS", TEST_TIMEOUT_SECONDS), \
                    mock.patch.object(runner.os, "killpg", side_effect=ProcessLookupError):
                code, _ = runner.run_command(tmp, "sleep 300")
            self.assertEqual(code, "timeout")

    def test_killpg_permission_error_still_reports_timeout(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(runner, "TIMEOUT_SECONDS", TEST_TIMEOUT_SECONDS), \
                    mock.patch.object(runner.os, "killpg", side_effect=PermissionError):
                code, _ = runner.run_command(tmp, "sleep 300")
            self.assertEqual(code, "timeout")

    def test_setsid_escaped_grandchild_does_not_hang(self):
        with tempfile.TemporaryDirectory() as tmp:
            pidfile = Path(tmp) / "pid"
            escape = "import os; os.setsid(); os.execvp('sleep', ['sleep', '300'])"
            command = f"python3 -c \"{escape}\" & echo $! > {pidfile}; wait"
            started = time.monotonic()
            try:
                with mock.patch.object(runner, "TIMEOUT_SECONDS", TEST_TIMEOUT_SECONDS), \
                        mock.patch.object(runner, "REAP_SECONDS", TEST_REAP_SECONDS):
                    code, _ = runner.run_command(tmp, command)
                elapsed = time.monotonic() - started
            finally:
                if pidfile.exists():
                    try:
                        os.kill(int(pidfile.read_text().strip()), signal.SIGKILL)
                    except ProcessLookupError:
                        pass
            self.assertEqual(code, "timeout")
            limit = TEST_TIMEOUT_SECONDS + TEST_REAP_SECONDS + HANG_SLACK_SECONDS
            self.assertLess(elapsed, limit, "runner hung on an escaped grandchild")

    def test_normal_command_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(runner.run_command(tmp, "echo hi; exit 3"), (3, "hi"))
            self.assertEqual(runner.run_command(tmp, "true"), (0, ""))


if __name__ == "__main__":
    unittest.main()

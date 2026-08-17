#!/usr/bin/env python3
"""verify_timeout_reaches_subprocess.py -- contract-timeout-honored F1.

DECISION.md F1: normalize_contract() must copy a check's declared
timeout_seconds into the internal verify dict. Asserting the declaration
survives normalize_contract() is not enough -- the value must actually
reach subprocess.run's timeout= kwarg, or the fix is inert (exactly the
SAOC failure mode: the field was dropped in transit while the yaml
declaration still "looked" correct).

Monkeypatches subprocess.run to capture the `timeout` kwarg it is called
with (returns a fake 0-exit CompletedProcess, never actually sleeps), then
calls the real contract.check_cmd() for A1/A2/A3 against
goldens/fixture_timeout_reaches_subprocess.yaml under a fixed CLI
--timeout-seconds value. Expected captured timeouts:
  A1: 120 (declared)
  A2: 150 (declared)
  A3: <CLI value>  -- no declaration, must inherit the CLI default, not
                      cross-contaminate from A1/A2.
"""
import argparse
import sys
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

import contract  # noqa: E402

FIXTURE = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / \
    "contract-timeout-honored" / "goldens" / "fixture_timeout_reaches_subprocess.yaml"
CLI_TIMEOUT = 45
EXPECTED = {"A1": 120, "A2": 150, "A3": CLI_TIMEOUT}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if not FIXTURE.exists():
        fail(f"fixture not found: {FIXTURE}")

    captured = {}

    def fake_run(*args, **kwargs):
        # Record which assertion is currently under test via the tempfile
        # script path is opaque, so instead we key on call order and match
        # against the phase_assertions iteration order below.
        captured["last_timeout"] = kwargs.get("timeout")
        import subprocess as _sp
        return _sp.CompletedProcess(args=args, returncode=0, stdout="", stderr="")

    results = {}
    with mock.patch.object(contract.subprocess, "run", side_effect=fake_run):
        for aid in ("A1", "A2", "A3"):
            check_args = argparse.Namespace(
                contract=str(FIXTURE),
                assertion=aid,
                handoff=None,
                timeout_seconds=CLI_TIMEOUT,
            )
            try:
                contract.check_cmd(check_args)
            except SystemExit:
                pass
            results[aid] = captured.get("last_timeout")

    mismatches = [
        f"{aid}: expected timeout={EXPECTED[aid]}, got {results.get(aid)!r}"
        for aid in EXPECTED
        if results.get(aid) != EXPECTED[aid]
    ]
    if mismatches:
        fail("declared/inherited timeout_seconds did not reach subprocess.run: "
             + "; ".join(mismatches))

    print(f"PASS: subprocess.run received timeout={EXPECTED} for A1/A2/A3")
    sys.exit(0)


if __name__ == "__main__":
    main()

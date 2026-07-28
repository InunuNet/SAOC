#!/usr/bin/env python3
"""F3 behavioral check — per-job token ceiling abort decision.

Exit 0 iff:
  1. MAX_TOKENS_PER_JOB=1 -> token_cap_abort_reason(ticket) is truthy (abort)
  2. MAX_TOKENS_PER_JOB=500000 -> token_cap_abort_reason(ticket) is None (allow)
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # execution/
import pulse_dispatcher as pd  # noqa: E402


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def main() -> int:
    if not hasattr(pd, "token_cap_abort_reason"):
        fail("pulse_dispatcher.token_cap_abort_reason is not defined")

    ticket = {
        "id": "t-f3",
        "dedupe_key": "k-f3",
        "provider": "claude-code",
        "project_path": "/tmp",
        "prompt": "x",
        "max_turns": 1,
        "max_tokens": 20000,
    }

    os.environ["MAX_TOKENS_PER_JOB"] = "1"
    reason = pd.token_cap_abort_reason(ticket)
    if not reason:
        fail("MAX_TOKENS_PER_JOB=1 should abort (non-empty reason)")

    os.environ["MAX_TOKENS_PER_JOB"] = "500000"
    reason = pd.token_cap_abort_reason(ticket)
    if reason is not None:
        fail(f"MAX_TOKENS_PER_JOB=500000 should not abort, got: {reason!r}")

    print("PASS: F3 token-cap abort decision")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

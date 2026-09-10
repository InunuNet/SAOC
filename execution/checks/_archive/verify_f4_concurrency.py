#!/usr/bin/env python3
"""F4 behavioral check — cross-workspace concurrency slot pool.

Exit 0 iff, with max_slots=2 against an isolated temp base:
  1. acquire #1 -> handle
  2. acquire #2 -> handle
  3. acquire #3 -> None (cap reached)
  4. release #1, acquire -> handle
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # execution/
import pulse_dispatcher as pd  # noqa: E402


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def main() -> int:
    if not hasattr(pd, "acquire_concurrency_slot"):
        fail("pulse_dispatcher.acquire_concurrency_slot is not defined")

    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        s1 = pd.acquire_concurrency_slot(2, base)
        if s1 is None:
            fail("acquire #1 should succeed")
        s2 = pd.acquire_concurrency_slot(2, base)
        if s2 is None:
            fail("acquire #2 should succeed")
        s3 = pd.acquire_concurrency_slot(2, base)
        if s3 is not None:
            fail("acquire #3 should be None (cap reached)")
        s1.release()
        s4 = pd.acquire_concurrency_slot(2, base)
        if s4 is None:
            fail("acquire after release should succeed")
        s2.release()
        s4.release()

    print("PASS: F4 concurrency slot pool")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

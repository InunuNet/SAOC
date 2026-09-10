#!/usr/bin/env python3
"""F2 behavioral check — dedupe TTL staleness.

Exit 0 iff:
  1. first reserve_dedupe(key) -> True
  2. second reserve_dedupe(key) within TTL -> False
  3. after backdating marker mtime >TTL, reserve_dedupe(key) -> True (stale refresh)
"""
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # execution/
import pulse_dispatcher as pd  # noqa: E402


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def main() -> int:
    os.environ["ATHANOR_PULSE_DEDUPE_TTL_SECONDS"] = "86400"
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        paths = pd.Paths.from_root(root)
        ticket = {"id": "t1", "dedupe_key": "k-f2-test"}

        if pd.reserve_dedupe(paths, ticket) is not True:
            fail("first reserve should be True")

        ticket2 = {"id": "t2", "dedupe_key": "k-f2-test"}
        if pd.reserve_dedupe(paths, ticket2) is not False:
            fail("second reserve within TTL should be False")

        marker = pd.dedupe_marker(paths, "k-f2-test")
        if not marker.exists():
            fail("marker should exist after reserve")
        old = time.time() - 25 * 3600
        os.utime(marker, (old, old))

        if pd.reserve_dedupe(paths, ticket2) is not True:
            fail("reserve after >TTL staleness should be True (refresh)")

        # marker mtime should now be fresh again
        age = time.time() - marker.stat().st_mtime
        if age > 60:
            fail("stale refresh should bump marker mtime to now")

    print("PASS: F2 dedupe TTL staleness")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

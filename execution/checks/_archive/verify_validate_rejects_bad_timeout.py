#!/usr/bin/env python3
"""verify_validate_rejects_bad_timeout.py -- contract-timeout-honored F4.

DECISION.md F4: validate_cmd() must reject non-positive, non-int, and
over-MAX_TIMEOUT_SECONDS timeout_seconds declarations. bool must be
excluded explicitly (isinstance(True, int) is True in Python) or `true`/
`false` silently pass as 1/0.

Usage:
  verify_validate_rejects_bad_timeout.py <fixture.yaml> reject|accept

reject mode: shell out to `contract.py validate <fixture>`, assert
returncode == 1 and stdout contains all four error markers (V_BOOL, V_NEG,
V_STR, V_HUGE) -- used against fixture_validate_bad_timeouts.yaml.

accept mode: assert returncode == 0 -- used against
fixture_validate_good_timeout.yaml (declared 200s) as the regression check
that legitimate declarations aren't collaterally rejected.
"""
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
REQUIRED_MARKERS = ("V_BOOL", "V_NEG", "V_STR", "V_HUGE")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[2] not in ("reject", "accept"):
        fail("usage: verify_validate_rejects_bad_timeout.py <fixture.yaml> reject|accept")

    fixture = Path(sys.argv[1])
    mode = sys.argv[2]

    if not fixture.exists():
        fail(f"fixture not found: {fixture}")

    proc = subprocess.run(
        [sys.executable, str(CONTRACT_PY), "validate", str(fixture)],
        cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=30,
    )

    if mode == "reject":
        if proc.returncode != 1:
            fail(f"expected validate to exit 1 against a contract with bad "
                 f"timeout_seconds declarations, got {proc.returncode}. "
                 f"stdout={proc.stdout!r} stderr={proc.stderr!r}")
        missing = [m for m in REQUIRED_MARKERS if m not in proc.stdout]
        if missing:
            fail(f"validate exited 1 but stdout is missing assertion id markers "
                 f"{missing}: stdout={proc.stdout!r}")
        print(f"PASS: validate rejected {fixture.name} (exit 1) naming all of "
              f"{REQUIRED_MARKERS}")
    else:
        if proc.returncode != 0:
            fail(f"expected validate to exit 0 against a legitimately-declared "
                 f"timeout_seconds, got {proc.returncode}. "
                 f"stdout={proc.stdout!r} stderr={proc.stderr!r}")
        print(f"PASS: validate accepted {fixture.name} (exit 0), no false positive")

    sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""GOLDEN -- place at execution/checks/verify_version_regression_guard.py.

Mechanical proof for contract A-checks: imports the real, patched
_check_version_regression() (plus its _parse_dotted_version() /
_compare_dotted_versions() helpers) from execution/update_template.py and
runs it against every case in fixture/version_cases.json.

Exercises the exact bug this feature closes: `update_template.py --apply`
previously installed a payload whose declared template version was OLDER
than the installed version with no refusal, unless --force was passed
proactively. It also exercises the specific footgun named in the mission --
"3.7.9" vs "3.7.10" must compare as 3.7.9 < 3.7.10 numerically, NOT as
strings (lexicographically "3.7.9" > "3.7.10" because '9' > '1').

Exits 0 and prints OK on success. Exits 1 with a diagnostic on the first
failing case -- never silently passes.
"""
import contextlib
import io
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

FIXTURE_PATH = (
    REPO_ROOT
    / ".agent/memory/project/specs/update-template-write-safety-hardening"
    / "goldens/fixture/version_cases.json"
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def main() -> int:
    import update_template  # noqa: E402  (path inserted above)

    if not hasattr(update_template, "_check_version_regression"):
        fail("update_template._check_version_regression is missing")
    if not hasattr(update_template, "_parse_dotted_version"):
        fail("update_template._parse_dotted_version is missing")
    if not hasattr(update_template, "_compare_dotted_versions"):
        fail("update_template._compare_dotted_versions is missing")

    # Numeric-not-lexicographic comparison, asserted directly against the
    # comparison primitive before it's ever wrapped in the refusal logic.
    cmp_result = update_template._compare_dotted_versions("3.7.9", "3.7.10")
    if cmp_result is None or cmp_result >= 0:
        fail(
            "_compare_dotted_versions('3.7.9', '3.7.10') must report 3.7.9 as "
            f"OLDER (negative result); got {cmp_result!r} -- looks like a "
            "lexicographic string comparison, not a numeric one"
        )

    cases = json.loads(FIXTURE_PATH.read_text())
    for case in cases:
        stderr_buf = io.StringIO()
        refused = False
        exit_code = None
        try:
            with contextlib.redirect_stderr(stderr_buf):
                update_template._check_version_regression(
                    case["payload"], case["installed"], force=case["force"]
                )
        except SystemExit as e:
            refused = True
            exit_code = e.code

        if refused != case["expect_refusal"]:
            fail(
                f"case {case['name']!r}: expected refusal={case['expect_refusal']}, "
                f"got refusal={refused} (payload={case['payload']!r}, "
                f"installed={case['installed']!r}, force={case['force']!r})"
            )

        if refused:
            if exit_code == 0 or exit_code is None:
                fail(f"case {case['name']!r}: refusal must exit non-zero, got {exit_code!r}")
            stderr_text = stderr_buf.getvalue()
            if str(case["payload"]) not in stderr_text or str(case["installed"]) not in stderr_text:
                fail(
                    f"case {case['name']!r}: refusal message must name both the "
                    f"payload ({case['payload']!r}) and installed "
                    f"({case['installed']!r}) versions -- got: {stderr_text!r}"
                )

    print(f"OK: {len(cases)} version-regression-guard cases behaved as expected")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""verify_selftest_coverage.py -- assertion-shape-sweep F5.

verify_invocation_helpers_selftest.py's 18 fixtures make it load-bearing
harness infrastructure (the two generic helpers it exercises now back
every wiring/safety assertion this mission produced). Nothing observed
whether the self-test's own fixture-discovery glob could silently narrow
without anyone noticing -- the exact "canary passes N/N while nothing
feeds it real cases" shape this mission's own F4 already fixed one level
down (verify_all_contracts_parse.py's boot wiring), reproduced one level
up, at the self-test's own coverage.

This checker cross-checks the self-test's OWN reported `fixtures_found`
count (from its `SELFTEST: fixtures_found=<N> ...` summary line) against
an INDEPENDENT count taken a different way -- a fresh glob over
goldens/helper_selftest_fixtures/ performed by THIS script, never a
re-read of the self-test's source code. A mismatch means the self-test's
discovery glob and the actual fixture set have desynced.

Checks, per goldens/f5_selftest_coverage_spec.md:
  1. Run the self-test for real, capture stdout, parse the SELFTEST:
     summary line. FAIL loudly if it's missing or malformed.
  2. Independently glob goldens/helper_selftest_fixtures/ for fixture
     files.
  3. Assert self-test's fixtures_found == independent file count.
  4. Assert the independent count is >= 18 (a floor, not a ceiling --
     raise it if fixtures are legitimately added later, never lower it
     without recording why in DECISION.md).
  5. Assert cases_run == fixtures_found and failed == 0.
  6. Assert the self-test's own PROCESS EXIT CODE is 0 -- an INDEPENDENT
     check from #5, not a restatement of it. @qa (round 4) found the
     tally the self-test prints (failed = cases_run - passed_count) is
     computed strictly from the 18 per-fixture results, while the
     process's exit code also reflects two things the tally cannot see:
     AUX sanity-check failures (never counted in cases_run/passed/failed
     by design -- see verify_invocation_helpers_selftest.py's own
     docstring) and a fixture_table_integrity desync (fixtures_found and
     cases_run can drop by the same amount and still "match" each other
     while the process is correctly reporting a problem via its exit
     code). A checker that trusts only the self-reported tally while
     ignoring the process's own verdict about itself is the exact
     "canary passes N/N while nothing feeds it real cases" shape this
     checker's own docstring claims to catch, one level up. Neither this
     check nor #3-#5 subsumes the other -- the count checks catch a
     silently-narrowed suite that still exits 0; this check catches
     failures the tally structurally cannot represent. Both are mandatory.
"""
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SELFTEST = REPO_ROOT / "execution" / "checks" / "verify_invocation_helpers_selftest.py"
FIXTURES_DIR = (
    REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "assertion-shape-sweep"
    / "goldens" / "helper_selftest_fixtures"
)
MINIMUM_FIXTURE_COUNT = 18  # floor as of assertion-shape-sweep F5 -- see module docstring

SUMMARY_RE = re.compile(
    r"^SELFTEST:\s+fixtures_found=(\d+)\s+cases_run=(\d+)\s+passed=(\d+)\s+failed=(\d+)\s*$",
    re.MULTILINE,
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    result = subprocess.run(
        [sys.executable, str(SELFTEST)], cwd=str(REPO_ROOT), capture_output=True, text=True,
    )
    combined = result.stdout + result.stderr

    match = SUMMARY_RE.search(combined)
    if not match:
        fail(
            f"self-test ({SELFTEST}) produced no parseable "
            f"'SELFTEST: fixtures_found=<N> cases_run=<N> passed=<N> failed=<N>' summary line "
            f"(exit={result.returncode}). Output:\n{combined}"
        )

    reported_found, reported_cases_run, reported_passed, reported_failed = (
        int(x) for x in match.groups()
    )

    # Check #6 (independent of the tally checks below -- see module
    # docstring): the self-test's own PROCESS EXIT CODE, which reflects
    # AUX-check failures and fixture_table_integrity desyncs that the
    # SELFTEST: summary line's four integers cannot represent. A clean
    # summary line with failed=0 does NOT imply the process exited 0.
    if result.returncode != 0:
        fail(
            f"self-test ({SELFTEST}) exited {result.returncode} (non-zero) even though its "
            f"parsed summary line reports fixtures_found={reported_found} "
            f"cases_run={reported_cases_run} passed={reported_passed} failed={reported_failed} "
            f"-- something outside the per-fixture tally failed (an AUX sanity check, or a "
            f"fixture_table_integrity desync neither fixtures_found nor cases_run can represent "
            f"on its own). Full output:\n{combined}"
        )

    if not FIXTURES_DIR.is_dir():
        fail(f"fixture directory not found: {FIXTURES_DIR}")

    independent_files = sorted(p for p in FIXTURES_DIR.iterdir() if p.is_file())
    independent_count = len(independent_files)

    if reported_found != independent_count:
        fail(
            f"self-test's own reported fixtures_found={reported_found} does NOT match an "
            f"independent glob of {FIXTURES_DIR} (found {independent_count} file(s): "
            f"{[p.name for p in independent_files]}) -- the self-test's discovery glob and "
            f"the actual fixture set have desynced."
        )

    if independent_count < MINIMUM_FIXTURE_COUNT:
        fail(
            f"independently-counted fixture file total ({independent_count}) is below the "
            f"floor of {MINIMUM_FIXTURE_COUNT} (assertion-shape-sweep F5) -- see this file's "
            f"module docstring; do not lower MINIMUM_FIXTURE_COUNT without recording why in "
            f"DECISION.md."
        )

    if reported_cases_run != reported_found:
        fail(
            f"self-test reported cases_run={reported_cases_run} != fixtures_found={reported_found} "
            f"-- not every discovered fixture actually ran as a case."
        )

    if reported_failed != 0:
        fail(
            f"self-test reported failed={reported_failed} (of {reported_cases_run} cases run) -- "
            f"the self-test itself is not currently green; fix it before trusting its coverage."
        )

    print(
        f"PASS: self-test exited 0, its reported fixtures_found={reported_found} matches an "
        f"independent glob of {FIXTURES_DIR} ({independent_count} file(s), >= "
        f"{MINIMUM_FIXTURE_COUNT}), cases_run={reported_cases_run} == fixtures_found, failed=0."
    )
    sys.exit(0)


if __name__ == "__main__":
    main()

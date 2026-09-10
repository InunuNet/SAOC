#!/usr/bin/env python3
"""verify_invocation_helpers_selftest.py -- fixture-driven self-test for
BOTH generic wiring-check helpers introduced by assertion-shape-sweep:
  - execution/checks/verify_yaml_check_command_contains.py
  - execution/checks/verify_shell_invocation_line.py

Why this exists: both helpers are now load-bearing for every future
contract's wiring/safety checks. Until F5, their correctness was only ever
demonstrated in a build transcript -- nothing in the gate observed whether
they actually work. A checker whose correctness is only ever shown once, by
hand, is a checker nobody is watching.

Fixtures live under
.agent/memory/project/specs/assertion-shape-sweep/goldens/helper_selftest_fixtures/
(committed, reviewable -- not a temp dir), one FILE per fixture, discovered
at run time by this script's own glob (never a hardcoded count -- see
DECISION.md Defect 4/F5 and goldens/f5_selftest_coverage_spec.md). This is
what lets execution/checks/verify_selftest_coverage.py independently
cross-check the reported count against a fresh glob taken a different way
and catch a discovery glob silently narrowing to zero.

Required output contract (goldens/f5_selftest_coverage_spec.md):
  1. Default (no --case) run prints, once:
       SELFTEST: fixtures_found=<N> cases_run=<N> passed=<N> failed=<N>
     fixtures_found is derived from this script's OWN fixture-discovery
     glob at run time.
  2. Hard empty-suite guard: fixtures_found == 0 prints
       SELFTEST: FAIL — zero fixtures discovered, refusing to report a trivial pass
     and exits non-zero.
  3. `--case <fixture_name>` runs exactly that one fixture (skips the rest,
     skips the auxiliary sanity checks below, skips the SELFTEST: summary
     line) and prints:
       CASE <fixture_name>: expected=<PASS|FAIL> observed=<PASS|FAIL> reason="<verbatim reason text from the helper under test>"
     `reason` is the underlying helper's own stderr/stdout, never a
     self-test paraphrase -- this is what lets a gate assertion grep the
     REAL RUNTIME OUTPUT of the real mechanism (legitimate, bucket B
     applied to output) rather than any file's source text (bucket C).

In addition to the 18 fixture-file-backed cases, a handful of AUXILIARY
sanity checks run against real, non-fixture targets (a nonexistent path,
and the actual live full_boot.sh / mission-py-gate-fix/contract-f1.yaml)
-- these still fail the overall self-test on regression, but are printed
as `AUX [name]: ...` and are NOT counted in fixtures_found/cases_run
(they aren't backed by a discoverable fixture FILE, so counting them would
break the file-count-based coverage cross-check in verify_selftest_coverage.py).
"""
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECKS_DIR = REPO_ROOT / "execution" / "checks"
GOLDENS = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "assertion-shape-sweep" / "goldens"
FIXTURES_DIR = GOLDENS / "helper_selftest_fixtures"

SHELL_HELPER = CHECKS_DIR / "verify_shell_invocation_line.py"
YAML_HELPER = CHECKS_DIR / "verify_yaml_check_command_contains.py"

FAILURES = []

# --- Fixture table -----------------------------------------------------
# One entry per fixture FILE under FIXTURES_DIR. "case" is the name used
# with --case (must be unique). "helper_args" is everything after the
# fixture's own path on the helper's command line. "expect_pass": whether
# the helper should exit 0. "reason_contains": optional substring
# (case-insensitive) that must appear in the helper's combined output --
# required for the desync_quote_span_comment regression fixture per
# team-lead's ruling; used elsewhere too to pin the FAILURE REASON, not
# just the exit code, per this file's own governing rule (assertion-shape:
# observe the mechanism, not just a ritual exit code).
FIXTURES = [
    # -- shell helper --
    {
        "case": "shell_clean_invocation",
        "file": "fixture_shell_clean_invocation.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-contain", "|| true"],
        "expect_pass": True,
        # Pin the SPECIFIC located line (:6:) and its unique trailing
        # comment, not just a generic "PASS:" -- a wrong-but-PASS-shaped
        # result (e.g. located a different line by accident) would still
        # have satisfied a bare "PASS:" check.
        "reason_contains": [":6:", "some trailing comment"],
    },
    {
        "case": "shell_clean_invocation_no_forbidden",
        "file": "fixture_shell_clean_invocation_no_forbidden.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-not-contain", "launchctl"],
        "expect_pass": True,
        "reason_contains": [":2:", "no forbidden constructs on this line"],
    },
    {
        "case": "shell_multiline_quote",
        "file": "fixture_shell_multiline_quote.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-contain", "|| true"],
        "expect_pass": True,
        # Must resolve to the REAL trailing invocation line (:15:), never
        # anything inside the multi-line python3 -c "..." block above it.
        "reason_contains": [":15:", "Fixture wiring comment"],
    },
    {
        # The @qa-exploited false PASS (DECISION.md Defect 4): a comment
        # line inside a multi-line quoted string, misclassified as a real
        # invocation before team-lead's ruling. Name and reason text are
        # mandated exactly by goldens/f5_selftest_coverage_spec.md.
        "case": "desync_quote_span_comment",
        "file": "fixture_desync_quote_span_comment.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-contain", "|| true"],
        "expect_pass": False,
        "reason_contains": "quote span",
    },
    {
        "case": "shell_comment_only",
        "file": "fixture_shell_comment_only.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py"],
        "expect_pass": False,
        "reason_contains": "not actually invoked anywhere",
    },
    {
        "case": "shell_ambiguous",
        "file": "fixture_shell_ambiguous.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py"],
        "expect_pass": False,
        "reason_contains": "> 1 lines",
    },
    {
        "case": "shell_hash_in_quote",
        "file": "fixture_shell_hash_in_quote.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py"],
        "expect_pass": True,
        "reason_contains": [":1:", "not a comment and mentions"],
    },
    {
        "case": "shell_escaped_quote",
        "file": "fixture_shell_escaped_quote.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-contain", "|| true"],
        "expect_pass": True,
        "reason_contains": [":2:", "escaped-quote fixture wiring"],
    },
    {
        "case": "shell_dollar_paren_apostrophe",
        "file": "fixture_shell_dollar_paren_apostrophe.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-contain", "|| true"],
        "expect_pass": True,
        "reason_contains": [":2:", "dollar-paren-apostrophe fixture wiring"],
    },
    {
        "case": "shell_unterminated_file",
        "file": "fixture_shell_unterminated_file.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py"],
        "expect_pass": False,
        "reason_contains": "unterminated quote",
    },
    {
        "case": "shell_forbidden_word_present",
        "file": "fixture_shell_forbidden_word_present.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-not-contain", "launchctl"],
        "expect_pass": False,
        "reason_contains": "forbidden substring",
    },
    {
        "case": "shell_missing_must_contain",
        "file": "fixture_shell_missing_must_contain.sh",
        "helper": "shell",
        "helper_args": ["some_checker.py", "--must-contain", "|| true"],
        "expect_pass": False,
        "reason_contains": "missing required substring",
    },
    # -- yaml helper --
    {
        "case": "yaml_valid",
        "file": "fixture_yaml_valid.yaml",
        "helper": "yaml",
        "helper_args": ["A1", "some_checker.py"],
        "expect_pass": True,
        # Pin the specific check id and substring, not just a generic
        # "PASS:" -- a wrong-but-PASS-shaped result (e.g. matched the
        # wrong check id by accident) would still satisfy a bare check.
        "reason_contains": ["id='A1'", "'some_checker.py'"],
    },
    {
        "case": "yaml_substring_absent",
        "file": "fixture_yaml_substring_absent.yaml",
        "helper": "yaml",
        "helper_args": ["A1", "some_checker.py"],
        "expect_pass": False,
        "reason_contains": "does not contain",
    },
    {
        "case": "yaml_unknown_check",
        "file": "fixture_yaml_unknown_check.yaml",
        "helper": "yaml",
        "helper_args": ["ZZZ", "anything"],
        "expect_pass": False,
        "reason_contains": "no check with id=",
    },
    {
        "case": "yaml_empty_command",
        "file": "fixture_yaml_empty_command.yaml",
        "helper": "yaml",
        "helper_args": ["A1", "anything"],
        "expect_pass": False,
        "reason_contains": "has no (or an empty) command",
    },
    {
        "case": "yaml_no_checks",
        "file": "fixture_yaml_no_checks.yaml",
        "helper": "yaml",
        "helper_args": ["A1", "anything"],
        "expect_pass": False,
        "reason_contains": "no assertions.checks list found",
    },
    {
        "case": "yaml_malformed",
        "file": "fixture_yaml_malformed.yaml",
        "helper": "yaml",
        "helper_args": ["A1", "anything"],
        "expect_pass": False,
        "reason_contains": "does not parse as yaml",
    },
]


def _discover_fixture_files() -> list[Path]:
    """Fresh glob over FIXTURES_DIR at run time -- never a hardcoded
    count. This is the count verify_selftest_coverage.py independently
    cross-checks against."""
    if not FIXTURES_DIR.is_dir():
        return []
    return sorted(p for p in FIXTURES_DIR.iterdir() if p.is_file())


def _run_helper(entry: dict) -> subprocess.CompletedProcess:
    fixture_path = FIXTURES_DIR / entry["file"]
    if entry["helper"] == "shell":
        helper = SHELL_HELPER
    elif entry["helper"] == "yaml":
        helper = YAML_HELPER
    else:
        raise ValueError(f"unknown helper kind: {entry['helper']!r}")
    return subprocess.run(
        [sys.executable, str(helper), str(fixture_path), *entry["helper_args"]],
        cwd=str(REPO_ROOT), capture_output=True, text=True,
    )


def _missing_reason_substrings(entry: dict, combined: str) -> list[str]:
    """reason_contains may be a single substring or a list of required
    substrings (all case-insensitive, all required). Returns the ones NOT
    found in `combined` (empty list = fully satisfied)."""
    reason_contains = entry.get("reason_contains")
    if reason_contains is None:
        return []
    required = [reason_contains] if isinstance(reason_contains, str) else list(reason_contains)
    combined_lower = combined.lower()
    return [substr for substr in required if substr.lower() not in combined_lower]


def _evaluate(entry: dict) -> tuple[bool, str, str]:
    """Run one fixture entry. Returns (ok, observed_verdict, reason_text)."""
    result = _run_helper(entry)
    combined = (result.stdout + result.stderr).strip()
    observed_pass = result.returncode == 0
    ok = observed_pass == entry["expect_pass"]

    if _missing_reason_substrings(entry, combined):
        ok = False

    return ok, ("PASS" if observed_pass else "FAIL"), combined


def run_case(entry: dict, isolated: bool) -> bool:
    ok, observed, reason = _evaluate(entry)
    expected = "PASS" if entry["expect_pass"] else "FAIL"
    print(f'CASE {entry["case"]}: expected={expected} observed={observed} reason="{reason}"')
    if not ok:
        detail = f"expected={expected} observed={observed}"
        missing = _missing_reason_substrings(entry, reason)
        if missing:
            detail += f", required reason substring(s) not found: {missing!r}"
        fail(entry["case"], detail)
    return ok


def fail(name, msg):
    FAILURES.append(f"{name}: {msg}")
    print(f"FAIL [{name}]: {msg}", file=sys.stderr)


def ok(name, msg):
    print(f"OK [{name}]: {msg}")


def aux_check(name, helper, args, expect_pass, must_contain_in_output=()):
    """Auxiliary sanity check against a non-fixture-file target (a
    nonexistent path, or a real live repo file). Not counted toward
    fixtures_found/cases_run -- see module docstring."""
    result = subprocess.run(
        [sys.executable, str(helper), *args], cwd=str(REPO_ROOT), capture_output=True, text=True,
    )
    combined = result.stdout + result.stderr
    actual_pass = result.returncode == 0

    if actual_pass != expect_pass:
        return fail(
            f"aux:{name}",
            f"expected {'PASS' if expect_pass else 'FAIL'}, got exit={result.returncode}\n{combined}",
        )
    for substr in must_contain_in_output:
        if substr not in combined:
            return fail(f"aux:{name}", f"expected output to contain {substr!r}, got:\n{combined}")
    ok(f"aux:{name}", f"exit={result.returncode} as expected")


def run_aux_checks():
    aux_check(
        "shell_missing_file",
        SHELL_HELPER,
        [str(REPO_ROOT / "does" / "not" / "exist.sh"), "some_checker.py"],
        expect_pass=False,
        must_contain_in_output=["script not found"],
    )
    aux_check(
        "yaml_missing_file",
        YAML_HELPER,
        [str(REPO_ROOT / "does" / "not" / "exist.yaml"), "A1", "anything"],
        expect_pass=False,
        must_contain_in_output=["contract file not found"],
    )
    # Real-repo sanity: not fixture-only -- the live targets these helpers
    # actually gate in contract-f4.yaml / mission-py-gate-fix/contract-f1.yaml.
    aux_check(
        "shell_real_repo_full_boot_sh",
        SHELL_HELPER,
        ["execution/hooks/full_boot.sh", "verify_all_contracts_parse.py", "--must-contain", "|| true"],
        expect_pass=True,
        must_contain_in_output=["PASS:"],
    )
    aux_check(
        "yaml_real_repo_mission_py_gate_fix",
        YAML_HELPER,
        [
            ".agent/memory/project/specs/mission-py-gate-fix/contract-f1.yaml",
            "A1",
            "verify_mission_gate_phase_coverage.py",
        ],
        expect_pass=True,
        must_contain_in_output=["PASS:"],
    )


def main():
    argv = sys.argv[1:]
    case_filter = None
    if argv:
        if argv[0] == "--case" and len(argv) >= 2:
            case_filter = argv[1]
        else:
            print(f"usage: {sys.argv[0]} [--case <fixture_name>]", file=sys.stderr)
            sys.exit(2)

    fixture_files_on_disk = _discover_fixture_files()
    fixtures_found = len(fixture_files_on_disk)

    by_case = {entry["case"]: entry for entry in FIXTURES}

    if case_filter is not None:
        entry = by_case.get(case_filter)
        if entry is None:
            print(f"FAIL: no fixture case named {case_filter!r} (known: {sorted(by_case)})", file=sys.stderr)
            sys.exit(1)
        passed = run_case(entry, isolated=True)
        sys.exit(0 if passed else 1)

    if fixtures_found == 0:
        print("SELFTEST: FAIL — zero fixtures discovered, refusing to report a trivial pass", file=sys.stderr)
        sys.exit(1)

    # Sanity: every FIXTURES table entry must correspond to a file actually
    # present on disk, and every file on disk must have a table entry --
    # otherwise fixtures_found (disk) and cases_run (table) would silently
    # desync from each other even before verify_selftest_coverage.py's
    # independent cross-check gets a chance to catch it.
    disk_names = {p.name for p in fixture_files_on_disk}
    table_names = {entry["file"] for entry in FIXTURES}
    missing_from_disk = table_names - disk_names
    missing_from_table = disk_names - table_names
    if missing_from_disk:
        fail("fixture_table_integrity", f"FIXTURES table references file(s) not on disk: {sorted(missing_from_disk)}")
    if missing_from_table:
        fail("fixture_table_integrity", f"file(s) on disk have no FIXTURES table entry: {sorted(missing_from_table)}")

    cases_run = 0
    passed_count = 0
    for entry in FIXTURES:
        if entry["file"] not in disk_names:
            continue  # already reported above
        cases_run += 1
        if run_case(entry, isolated=False):
            passed_count += 1

    run_aux_checks()

    failed_count = cases_run - passed_count
    print(
        f"SELFTEST: fixtures_found={fixtures_found} cases_run={cases_run} "
        f"passed={passed_count} failed={failed_count}"
    )

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s).", file=sys.stderr)
        sys.exit(1)
    print("PASS: both invocation-check helpers behave correctly across all fixture cases.")
    sys.exit(0)


if __name__ == "__main__":
    main()

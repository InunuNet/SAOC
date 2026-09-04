#!/usr/bin/env python3
"""F1 (mission verification-triad-gate) -- proves the `browser_deployed_check`
assertion kind's discriminator, once @dev implements execution/browser_deployed_check.sh
per the golden spec (see goldens/README.md), actually rejects every failure shape
this kind exists to catch -- not just accepts a well-formed manifest.

Design under test (golden spec, not yet implemented as of this check's authoring):
  execution/browser_deployed_check.sh <manifest.json>
    exit 0  -- manifest verified: real deployed-origin evidence, fresh, commit-bound
    exit 1  -- manifest present and parseable, but evidence FAILS a real check
               (forbidden origin, stale commit, stale timestamp, missing screenshot)
    exit 2  -- wrapper/usage error (manifest missing/unparseable, tool unavailable)

This check runs the script against six fixtures under goldens/fixtures/ and asserts,
for each, BOTH the exit code AND that the failure reason is the one that fixture is
supposed to isolate -- not exit code alone. Exit code alone let a real defect through
once already (see 2026-09-04 fix note below): several "bad" fixtures were passing
this check's exit-code assertion for the WRONG reason (a shared stale/frozen field
tripped an earlier check in the script before the fixture's own target check was ever
reached), which is precisely the vacuous-assertion defect class this project audits
for, sitting inside this mission's own goldens.

2026-09-04 fix note (retry 2, Codex GPT-5.5 finding + team-lead verification):
Every fixture in this file used to hardcode BOTH `commit_sha` (to a literal sha) and
`timestamp` (to a fixed past instant). Only `browser_manifest_good.json`'s commit_sha
was a placeholder, materialized against real HEAD at test time; every OTHER fixture's
`commit_sha` happened to equal HEAD only by coincidence (the commit at authoring time),
and every fixture's `timestamp` ages past the script's real 4h freshness default as
calendar time passes. Two concrete failures resulted:
  - `browser_manifest_bad_missing_screenshot.json` was, as of this fix, already failing
    on staleness ("timestamp ... is 116107s old, outside the 14400s freshness window")
    -- never reaching the screenshot-artefact check it exists to prove. The case
    proved nothing about screenshot handling.
  - Every fixture with a frozen `commit_sha` would go vacuous a second, different way
    the moment this mission's own diff commits and HEAD moves: `browser_deployed_check.sh`
    checks commit-binding before staleness, so a fixture whose target check comes after
    commit-binding would then fail on commit-mismatch instead of its own target defect.
Fix: every fixture except `browser_manifest_bad_stale_commit.json` gets its `commit_sha`
materialized against the real, current HEAD at test-execution time (same mechanism
`browser_manifest_good.json` already used); every fixture except
`browser_manifest_bad_stale_timestamp.json` gets a per-fixture freshness-window
override wide enough to accept its own (otherwise-aging) recorded timestamp. Each bad
fixture now isolates exactly the one field it exists to test -- everything else about
it is kept valid at test time. And exit-code-only assertion is no longer trusted on
its own: EXPECTED_MESSAGE_SUBSTRING below pins the literal diagnostic
browser_deployed_check.sh emits for each failure reason, so a case that starts failing
for an unrelated reason goes red (message mismatch) instead of silently reading as ok.

Until execution/browser_deployed_check.sh exists, every fixture that expects exit 0
or exit 1 instead gets exit 127 (command not found under `subprocess.run`, surfaced
here as a FileNotFoundError) -- this check is EXPECTED to fail end-to-end (RED) until
@dev implements the script. That is the point: an assertion that could not possibly
fail today would be exactly the vacuous-assertion defect class this project has
repeatedly audited.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "execution" / "browser_deployed_check.sh"
FIXTURES = (
    ROOT / ".agent" / "memory" / "project" / "specs" / "verification-triad-gate"
    / "goldens" / "fixtures"
)

# Buffer on top of a fixture's own measured age when computing its per-fixture
# freshness override below -- absorbs clock skew and however long this check
# itself takes to run, nothing more.
FRESHNESS_ENV_BUFFER_SECONDS = 3600

# Every fixture except this one freezes commit_sha to this placeholder in its
# JSON on disk; each is materialized against the real, current `git rev-parse
# HEAD` at test-execution time (see module docstring, 2026-09-04 fix note). A
# frozen real sha would go stale the moment this mission's own diff is
# committed -- HEAD moves, the commit-binding check in browser_deployed_check.sh
# correctly starts rejecting the fixture, and its case goes red for a reason
# unrelated to the property it actually tests.
COMMIT_SHA_PLACEHOLDER = "COMMIT_SHA_AT_TEST_TIME"

# The one fixture that deliberately keeps a hardcoded, permanently-wrong
# commit_sha -- it must NEVER be materialized against HEAD, or the one check
# it exists to prove (commit-binding rejection) could never be exercised.
COMMIT_FROZEN_FIXTURE = "browser_manifest_bad_stale_commit.json"

# The one fixture that deliberately keeps its real recorded (aging) timestamp
# -- it must NEVER get a widened freshness window, or the one check it exists
# to prove (staleness rejection) could never be exercised. Every other
# fixture's timestamp is incidental to what it's testing, so it gets a
# generous per-fixture override computed from its own measured age, same
# mechanism previously applied only to the "good" fixture.
TIMESTAMP_FROZEN_FIXTURE = "browser_manifest_bad_stale_timestamp.json"

FAILURES: list = []


def current_head_sha() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=str(ROOT), capture_output=True, text=True, timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git rev-parse HEAD failed: {result.stderr.strip()}")
    return result.stdout.strip()


def materialize_fixture(fixture: str) -> Path:
    """Return a path to a throwaway copy of `fixture` with commit_sha replaced
    by the real, current HEAD sha -- for every fixture except
    COMMIT_FROZEN_FIXTURE. Raises if the fixture on disk has been hand-edited
    back to a frozen sha instead of the expected placeholder -- that would
    silently reintroduce the self-destructing-golden defect this function
    exists to prevent.

    The copy is written *inside* FIXTURES (not an unrelated tmp dir) because
    browser_deployed_check.sh resolves a manifest's screenshot_path relative to
    the manifest's own directory (see execution/browser_deployed_check.sh's
    screenshot_candidates) -- moving the manifest elsewhere would break that
    resolution for a reason that has nothing to do with the property under test.
    """
    src = FIXTURES / fixture
    data = json.loads(src.read_text())
    if data.get("commit_sha") != COMMIT_SHA_PLACEHOLDER:
        raise ValueError(
            f"{src} commit_sha is {data.get('commit_sha')!r}, expected the placeholder "
            f"{COMMIT_SHA_PLACEHOLDER!r} -- has it been frozen back to a literal sha? "
            f"That reintroduces the self-destructing-golden defect (see fix note "
            f"2026-09-04)."
        )
    data["commit_sha"] = current_head_sha()
    dst = FIXTURES / f".{fixture}.materialized.tmp.json"
    dst.write_text(json.dumps(data, indent=2))
    return dst


def fresh_env_for_fixture(fixture_path: Path) -> dict:
    """browser_deployed_check.sh's real production default
    (BROWSER_CHECK_MAX_AGE_SECONDS unset -> 14400s / 4h, per goldens/README.md
    design answer 2) will reject any of this project's own frozen-timestamp
    fixtures once enough calendar time has passed since it was authored --
    that is fixture drift, not a real staleness finding, and belongs in this
    test harness rather than in a loosened production default (see 2026-09-04
    fix note above: a stale "good" fixture and, separately, a stale
    "bad_missing_screenshot" fixture were both exactly this drift). Compute
    the fixture's actual age from its own `timestamp` field and hand the
    script an override just generous enough to accept it, so every case that
    isn't itself testing staleness keeps passing indefinitely without ever
    loosening the real default that ships to production."""
    data = json.loads(fixture_path.read_text())
    ts = data.get("timestamp", "")
    parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    age_seconds = int((datetime.now(timezone.utc) - parsed).total_seconds())
    env = os.environ.copy()
    env["BROWSER_CHECK_MAX_AGE_SECONDS"] = str(max(age_seconds, 0) + FRESHNESS_ENV_BUFFER_SECONDS)
    return env


# (fixture filename, expected exit code, human label, expected failure-reason
# substring). The substring is matched case-insensitively against the
# script's combined stdout+stderr and is the literal diagnostic text
# execution/browser_deployed_check.sh emits for that failure (see its
# fail_check calls) -- None for the one case that's expected to PASS.
# Pinning this text is what makes a case go red when it starts failing for
# the WRONG reason instead of silently reading as "ok, exit code matched"
# (see module docstring, 2026-09-04 fix note).
CASES = [
    ("browser_manifest_good.json", 0, "valid deployed-origin evidence", None),
    ("browser_manifest_bad_hostedapp.json", 1,
     "*.hosted.app origin (the SITE_URL incident shape)", "denylisted *.hosted.app"),
    ("browser_manifest_bad_runapp.json", 1,
     "*.run.app origin", "denylisted *.run.app"),
    ("browser_manifest_bad_stale_commit.json", 1,
     "commit_sha does not match current HEAD", "does not match current head"),
    ("browser_manifest_bad_stale_timestamp.json", 1,
     "timestamp outside max_age_seconds window", "freshness window"),
    ("browser_manifest_bad_missing_screenshot.json", 1,
     "referenced screenshot artefact absent", "screenshot artefact"),
]


def check(name: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        FAILURES.append(name)


def run_case(fixture: str, expected_rc: int, label: str, expected_reason: str | None) -> None:
    manifest = FIXTURES / fixture
    check(f"fixture exists: {fixture}", manifest.is_file())
    if not manifest.is_file():
        return
    try:
        json.loads(manifest.read_text())
    except json.JSONDecodeError as exc:
        check(f"fixture is valid JSON: {fixture}", False, str(exc))
        return

    if not SCRIPT.is_file():
        check(
            f"discriminator case [{label}] -> exit {expected_rc}",
            False,
            f"execution/browser_deployed_check.sh does not exist yet -- cannot invoke "
            f"(this is the expected RED state for an un-implemented kind)",
        )
        return

    # Materialize commit_sha against real HEAD for every fixture except the
    # one deliberately testing commit-mismatch; widen the freshness window for
    # every fixture except the one deliberately testing staleness. See
    # COMMIT_FROZEN_FIXTURE / TIMESTAMP_FROZEN_FIXTURE docstrings above.
    invoke_path = manifest
    materialized: Path | None = None
    run_env = None
    try:
        if fixture != COMMIT_FROZEN_FIXTURE:
            invoke_path = materialized = materialize_fixture(fixture)
        if fixture != TIMESTAMP_FROZEN_FIXTURE:
            run_env = fresh_env_for_fixture(invoke_path)

        result = subprocess.run(
            [str(SCRIPT), str(invoke_path)],
            cwd=str(ROOT), capture_output=True, text=True, timeout=30, env=run_env,
        )
    finally:
        if materialized is not None:
            materialized.unlink(missing_ok=True)

    combined_output = f"{result.stdout}\n{result.stderr}"
    check(
        f"discriminator case [{label}] -> exit {expected_rc}",
        result.returncode == expected_rc,
        f"got exit {result.returncode}; stdout={result.stdout.strip()[:200]!r} "
        f"stderr={result.stderr.strip()[:200]!r}",
    )
    if expected_reason is not None:
        check(
            f"discriminator case [{label}] fails for its OWN target reason "
            f"(expected substring: {expected_reason!r})",
            expected_reason.lower() in combined_output.lower(),
            f"got exit {result.returncode}; stdout={result.stdout.strip()[:300]!r} "
            f"stderr={result.stderr.strip()[:300]!r}",
        )


def main() -> int:
    check("execution/browser_deployed_check.sh exists", SCRIPT.is_file(),
          f"missing {SCRIPT} -- not yet implemented by @dev")
    for fixture, expected_rc, label, expected_reason in CASES:
        run_case(fixture, expected_rc, label, expected_reason)

    # Usage-error path: script invoked with a manifest path that does not exist at all.
    if SCRIPT.is_file():
        result = subprocess.run(
            [str(SCRIPT), str(FIXTURES / "does_not_exist.json")],
            cwd=str(ROOT), capture_output=True, text=True, timeout=30,
        )
        check("missing-manifest path -> exit 2 (usage error, not silent pass)",
              result.returncode == 2, f"got exit {result.returncode}")
    else:
        check("missing-manifest path -> exit 2 (usage error, not silent pass)", False,
              "script does not exist yet")

    if FAILURES:
        print(f"\n{len(FAILURES)} discriminator case(s) failed: {FAILURES}")
        return 1
    print("\nAll browser_deployed_check discriminator cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

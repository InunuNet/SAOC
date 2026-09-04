#!/usr/bin/env python3
"""F1 (mission verification-triad-gate) -- proves the `gws_inbox_check` assertion
kind's discriminator, once @dev implements execution/gws_inbox_check.sh per the
golden spec (see goldens/README.md), rejects every failure shape this kind exists
to catch, and is structurally incapable of a write operation against the mailbox.

Design under test (golden spec, not yet implemented as of this check's authoring):
  execution/gws_inbox_check.sh <manifest.json>
    exit 0  -- manifest verified: real message re-confirmed present in the live
               inbox via a read-only `gws mail read/get <message_id>` call
    exit 1  -- manifest present and parseable, but evidence FAILS a real check
               (write-verb subcommand, stale timestamp, no message_id to re-verify)
    exit 2  -- wrapper/usage error (manifest missing/unparseable, `gws` unavailable)

Two independent things are asserted:
  1. The discriminator's PASS/FAIL/ERROR behaviour against six fixtures.
  2. The READ-ONLY guarantee, checked structurally against the script's own
     source (not just its runtime behaviour on these fixtures) -- grepping for
     any write-verb token (send/reply/delete/trash/modify/draft/forward) that
     would mean the script is even capable of a write call, and confirming the
     script never interpolates a manifest-supplied string directly into the
     `gws` argv (which would make the read-only guarantee only as strong as
     whatever a compromised/malformed manifest claims about itself).

Until execution/gws_inbox_check.sh exists, this check is EXPECTED to fail (RED).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "execution" / "gws_inbox_check.sh"
FIXTURES = (
    ROOT / ".agent" / "memory" / "project" / "specs" / "verification-triad-gate"
    / "goldens" / "fixtures"
)

# Buffer on top of the good fixture's own measured age when computing the
# per-fixture freshness override below -- absorbs clock skew and however long
# this check itself takes to run, nothing more.
FRESHNESS_ENV_BUFFER_SECONDS = 3600

FAILURES: list = []

CASES = [
    ("gws_manifest_good.json", 0, "valid read-only inbox evidence"),
    ("gws_manifest_bad_write_verb.json", 1, "gws_subcommand is a write verb (send)"),
    ("gws_manifest_bad_stale_timestamp.json", 1, "timestamp outside max_age_seconds window"),
    ("gws_manifest_bad_missing_message_id.json", 1, "no message_id to re-verify against the live inbox"),
]


def discriminator_env(fixture_path: Path, *, is_good_fixture: bool) -> dict:
    """Env for one discriminator invocation.

    GWS_CHECK_LIVE_RECHECK=0 is set for EVERY case here (good and bad alike):
    gws_inbox_check.sh now defaults the live inbox re-check ON in production
    (see gws_inbox_check.sh), because that live lookup is Layer 3's entire
    reason to exist. Every fixture in this discriminator uses a synthetic
    message_id by design (each isolates one structural rejection reason) that
    will never resolve against a real inbox, so this discriminator explicitly
    opts OUT of the live check for all of them -- it is proving the
    structural rejections, not the live-inbox path.

    GWS_CHECK_MAX_AGE_SECONDS is only widened for the "good" fixture, and
    only to that fixture's own measured age plus a buffer -- see
    verify_browser_deployed_check_discriminator.py's fresh_env_for_fixture
    for the identical rationale (real production default rightly rejects an
    aging golden fixture; that's fixture drift, not a real finding, and
    belongs here). Every other fixture, including bad_stale_timestamp, is
    left on the script's real strict default so staleness detection stays
    genuinely exercised -- computing a widened window from ITS OWN
    deliberately-old timestamp would trivially defeat that case.
    """
    env = os.environ.copy()
    env["GWS_CHECK_LIVE_RECHECK"] = "0"
    if is_good_fixture:
        data = json.loads(fixture_path.read_text())
        ts = data.get("timestamp", "")
        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        age_seconds = int((datetime.now(timezone.utc) - parsed).total_seconds())
        env["GWS_CHECK_MAX_AGE_SECONDS"] = str(max(age_seconds, 0) + FRESHNESS_ENV_BUFFER_SECONDS)
    return env

# Any of these tokens appearing in the script source means the script is at
# least capable of a write call -- structurally disqualifying, regardless of
# whether today's fixtures happen to exercise that path.
#
# gws_inbox_check.sh's actual read-only invocation is the API-style form
# `gws gmail users messages get` (see execution/gws_inbox_check.sh), not the
# `gws mail <verb>` shape this pattern originally covered. A guard that only
# knows the `mail` shape passes today by luck -- it never actually exercises
# the shape the real script uses, so a future edit introducing
# `gws gmail users messages delete` or `...trash` would sail straight
# through. `(?:[ \t]+[\w.]+){0,6}?` allows any number (up to 6) of
# intervening space-separated tokens between `gws` and the write verb --
# covering both `gws mail send` and `gws gmail users messages delete` (and
# any other subresource path gws exposes) -- while `[ \t]` (not `\s`) keeps
# the match on a single line so two unrelated `gws` mentions on separate
# lines/comments can't spuriously combine into one match.
WRITE_VERB_TOKENS = re.compile(
    r"\bgws\b(?:[ \t]+[\w.]+){0,6}?[ \t]+(send|reply|delete|trash|forward|draft|modify|remove)\b",
    re.IGNORECASE,
)


def check(name: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        FAILURES.append(name)


def run_case(fixture: str, expected_rc: int, label: str) -> None:
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
            "execution/gws_inbox_check.sh does not exist yet -- cannot invoke "
            "(expected RED state for an un-implemented kind)",
        )
        return

    run_env = discriminator_env(manifest, is_good_fixture=(fixture == "gws_manifest_good.json"))
    result = subprocess.run(
        [str(SCRIPT), str(manifest)], cwd=str(ROOT), capture_output=True, text=True, timeout=30,
        env=run_env,
    )
    check(
        f"discriminator case [{label}] -> exit {expected_rc}",
        result.returncode == expected_rc,
        f"got exit {result.returncode}; stdout={result.stdout.strip()[:200]!r} "
        f"stderr={result.stderr.strip()[:200]!r}",
    )


def check_structural_readonly_guard() -> None:
    if not SCRIPT.is_file():
        check("structural read-only guard: no write-verb token in script source", False,
              "script does not exist yet")
        check("structural read-only guard: no free-form argv interpolation from manifest", False,
              "script does not exist yet")
        return

    src = SCRIPT.read_text(encoding="utf-8", errors="replace")
    write_hits = WRITE_VERB_TOKENS.findall(src)
    check("structural read-only guard: no write-verb token in script source",
          not write_hits, f"found write-verb reference(s): {write_hits}")

    # A manifest-supplied field fed straight into a `gws ...` command line (e.g.
    # via eval/$(...) built from jq-extracted manifest fields) would let a
    # malformed or adversarial manifest choose the subcommand at runtime,
    # defeating the hardcoded-allowlist guarantee even with today's fixtures
    # all being well-formed. This is a heuristic (see goldens/README.md
    # limitations) -- it flags the two riskiest shell patterns, not a formal
    # proof of no injection path.
    risky_patterns = [r"\beval\b", r"gws\s+\$\("]
    risky_hits = [p for p in risky_patterns if re.search(p, src)]
    check("structural read-only guard: no eval / dynamically-built gws invocation",
          not risky_hits, f"found risky pattern(s): {risky_hits}")


def check_write_verb_regex_catches_api_style_form() -> None:
    """Regression for the 2026-09-04 Codex finding: the original
    WRITE_VERB_TOKENS pattern only matched the `gws mail <verb>` shape, but
    the real script uses the API-style form `gws gmail users messages get`
    (see execution/gws_inbox_check.sh). That meant the guard passed today by
    luck -- it had never actually been proven to catch the shape the script
    is built from. This asserts, against a synthetic source string (not the
    real script, which is and must stay clean), that an API-style write verb
    is rejected -- the deliverable the finding asked for, not just the regex
    edit above.
    """
    malicious_sources = {
        "gws gmail users messages delete": (
            "#!/usr/bin/env bash\n"
            'lookup_output="$(gws gmail users messages delete --params "$params" 2>&1)"\n'
        ),
        "gws gmail users messages trash": (
            "#!/usr/bin/env bash\n"
            'lookup_output="$(gws gmail users messages trash --params "$params" 2>&1)"\n'
        ),
        "gws mail send (original shape, must stay caught)": (
            "#!/usr/bin/env bash\n"
            'gws mail send --to someone@example.com\n'
        ),
    }
    for label, source in malicious_sources.items():
        hits = WRITE_VERB_TOKENS.findall(source)
        check(f"regression: write-verb source '{label}' is REJECTED by the guard regex",
              bool(hits), f"expected a match, got none for source: {source!r}")

    # And the read-only form the real script actually uses must NOT trip the
    # guard -- otherwise the guard would reject the very script it exists to
    # clear.
    readonly_source = (
        "#!/usr/bin/env bash\n"
        'lookup_output="$(gws gmail users messages get --params "$params" 2>&1)"\n'
    )
    hits = WRITE_VERB_TOKENS.findall(readonly_source)
    check("regression: read-only form 'gws gmail users messages get' does NOT trip the guard",
          not hits, f"expected no match, got: {hits}")


def main() -> int:
    check("execution/gws_inbox_check.sh exists", SCRIPT.is_file(),
          f"missing {SCRIPT} -- not yet implemented by @dev")
    for fixture, expected_rc, label in CASES:
        run_case(fixture, expected_rc, label)
    check_structural_readonly_guard()
    check_write_verb_regex_catches_api_style_form()

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
    print("\nAll gws_inbox_check discriminator cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

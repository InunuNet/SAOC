#!/usr/bin/env python3
"""F3 drift check: compares the alembic_version stamped in .agent/skills/alembic.md's
frontmatter against the version reported live by the running Alembic proxy
(`curl -s -H "Accept: application/json" http://localhost:7077/` -> top-level
"version"). This is the ONE sanctioned exception to routing fetches through the
Alembic proxy in this project — it is a liveness/version probe of the proxy itself,
not content retrieval.

Stamp semantic (load-bearing — this is the defect the mission exists to eliminate):
alembic_version means "the Alembic build this skill's content was AUDITED AGAINST,"
NOT "the version you should be running." As "audited against," a mismatch is useful
information handed to Alembic; as "current version" it would be a hardcoded claim
with a release-length half life — exactly how the skill came to describe v1.0 while
v1.68.0 was running. The failure message below states this explicitly, not just this
docstring, per the settled interface contract.

A stamp/live mismatch cannot structurally distinguish two different causes: (a)
Athanor's canonical genuinely lags the latest Alembic release, or (b) this project
simply never received Athanor's already-current canonical (a propagation gap, not a
content gap). Both produce an identical mismatch, so the failure message sequences
remediation cheapest-first: try `make update-template` in this project before
concluding Alembic itself needs to re-audit and republish.

F3 is the drift check, NOT the propagation check (see verify_skill_propagation.py).
FAIL here means "the content is stale everywhere, canonical included" — fix is
Alembic re-auditing and republishing. It never means a file failed to propagate to
this install; that is F2's job, with the opposite remediation. Keep the two separate.

Proxy-down is the expected common case (most fleet projects will not have the daemon
up when `make audit` runs) and MUST NOT fail this check — connection refused,
timeout, or a non-JSON/unparseable response is "unknown," not "stale." A check that
fails whenever the proxy is merely offline gets disabled within a week, and a
disabled check is worse than no check — it looks like coverage it doesn't provide.

Both stay SKIP, but the message is split by cause so debugging isn't misdirected:
a connection-level failure (refused/timeout/DNS — no response reached us at all)
prints "Alembic proxy not running"; a reachable-but-unusable response (non-2xx,
non-JSON, or missing/malformed `.version`) prints a distinct message saying the
proxy answered but the reply couldn't be used.

Exit code contract (deliberately 4-way, not binary — SKIP and PASS must never
collide on the same code, or anything reading exit codes alone cannot tell
"verified current" from "verified nothing"):
  0  -> PASS: proxy reachable and its version matches the stamp.
  1  -> FAIL: proxy reachable AND reports a version that differs from the stamp.
  2  -> bad invocation (argparse's own default: unknown flag, bad value, etc.) —
        vacated deliberately, matching normal UNIX/argparse convention. NOT
        caught or remapped here; a typo'd flag or moved script must fail loud,
        not be silently folded into SKIP or PASS.
  77 -> SKIP: proxy unreachable, proxy answered but the reply was unusable, or
        the skill's alembic_version stamp itself could not be read. "Unknown,"
        not "stale." 77 is Athanor's own reserved skip signal — the identical
        autotools convention execution/contract.py's `check`/`gate` machinery
        already recognizes natively (verdict=skip, kept out of the pass count,
        blocks a `contract.py gate` run by default unless --allow-skips, hard-
        overridden to a failure if the assertion is required:true) — see
        mission verification-integrity, GH #1322. Using the SAME code here
        means this script's SKIP is correctly understood whether it's invoked
        directly, from `make audit` (which must branch on it explicitly — see
        the Makefile wiring in this mission's F5 golden — since `make` treats
        ANY nonzero recipe exit as a target failure unless told otherwise), or
        wired straight into a contract.py assertion, without inventing a
        second, competing "skip" convention understood by only one of the two
        consumers.
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_FILE = ".agent/skills/alembic.md"
DEFAULT_ENDPOINT = "http://localhost:7077/"
TIMEOUT_SECONDS = 2.0


def extract_frontmatter(text: str) -> str:
    """Return only the YAML frontmatter block (between the first pair of '---'
    lines) — never body prose. The stamp is frontmatter-only by contract: Alembic's
    own no-hardcoded-version guard exists precisely to keep version strings out of
    skill body prose, so a check that read the body would be looking in the wrong
    place even if it happened to find a match there."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return ""
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "\n".join(lines[1:i])
    return ""


def read_stamped_version(skill_path: Path) -> str | None:
    if not skill_path.is_file():
        return None
    frontmatter = extract_frontmatter(skill_path.read_text(errors="replace"))
    match = re.search(r"^alembic_version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$", frontmatter, re.MULTILINE)
    return match.group(1) if match else None


SKIP_CONNECTION = "connection"  # daemon down/unreachable — no response at all
SKIP_RESPONSE = "response"  # daemon answered, but the reply couldn't be used

EXIT_PASS = 0
EXIT_FAIL = 1
# EXIT_BAD_INVOCATION = 2 is argparse's own default (unmapped, deliberately)
EXIT_SKIP = 77  # Athanor's reserved skip code (autotools convention) — see contract.py


def fetch_live_version(endpoint: str) -> tuple[str | None, str | None]:
    """Return (version, None) on success, or (None, skip_reason) if the version
    could not be obtained — skip_reason distinguishes SKIP_CONNECTION (no
    response reached us at all: refused, timed out, DNS failure) from
    SKIP_RESPONSE (the proxy answered, but the body was unusable: non-JSON,
    missing/malformed `.version`). Both are SKIP, never FAIL, to the caller —
    this split only selects which message to print."""
    req = urllib.request.Request(endpoint, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            body = resp.read()
    except (urllib.error.URLError, ConnectionError, TimeoutError, OSError):
        return None, SKIP_CONNECTION
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None, SKIP_RESPONSE
    version = data.get("version") if isinstance(data, dict) else None
    if not isinstance(version, str) or not version.strip():
        return None, SKIP_RESPONSE
    return version.strip(), None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(REPO_ROOT), help="Project root (default: this repo's root)")
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="Alembic health endpoint")
    args = parser.parse_args()
    root = Path(args.root).resolve()

    skill_path = root / SKILL_FILE
    stamped = read_stamped_version(skill_path)
    if stamped is None:
        print(
            f"Alembic drift check skipped (unknown, not stale): could not read "
            f"alembic_version from {skill_path} frontmatter."
        )
        return EXIT_SKIP

    live, skip_reason = fetch_live_version(args.endpoint)
    if live is None:
        if skip_reason == SKIP_RESPONSE:
            print(
                "Alembic proxy answered but the response could not be used "
                "(non-2xx status, non-JSON body, or missing/malformed `.version` "
                "key) — drift check skipped (unknown, not stale)."
            )
        else:
            print("Alembic proxy not running — drift check skipped (unknown, not stale).")
        return EXIT_SKIP

    if live == stamped:
        print(
            f"drift check PASSED: skill content audited against Alembic {stamped}; "
            f"running proxy reports {live} — versions match."
        )
        return EXIT_PASS

    print(
        f"this skill's content was audited against Alembic {stamped}; the running "
        f"proxy is {live} — the documented behaviour may not match your build. "
        f"Try `make update-template` in this project first — the mismatch is most "
        f"often this project never receiving Athanor's already-current canonical. "
        f"If the mismatch persists after that, the documented content itself is "
        f"behind the released Alembic build; that is not evidence the skill file "
        f"failed to propagate, it means Alembic should re-audit and republish.",
        file=sys.stderr,
    )
    return EXIT_FAIL


if __name__ == "__main__":
    sys.exit(main())

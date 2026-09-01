#!/usr/bin/env python3
"""quota.py — project-local quota oracle (mission quota-aware-execution F1).

Reads ONLY the project-local mirror file written by
execution/hooks/inject_pressure.sh on every UserPromptSubmit turn
(default .agent/memory/scratch/.quota_status.json). NEVER reads the global
Claude usage cache under the user's home directory, directly or via
subprocess — that path is sanctioned for inject_pressure.sh alone (see
.claude/rules/scope.md).

Provider-aware (GH #1368): the mirror is only ever trusted inside a genuine
Claude Code session (CLAUDECODE=1, set by the real CLI binary itself). In any
other session (e.g. Grok CLI) read_status() reports state=unknown with
reason "non_claude_code_session" before the mirror file is even opened, so a
foreign/stale Anthropic usage percentage is never surfaced as belonging to
the current session.

Degrades to state=unknown (never a fabricated used_pct) when the mirror is
missing, stale (captured_at older than STALE_SECONDS), or malformed.

Exit codes: always 0 for a successful `status` read, ok or unknown alike —
an unreadable quota signal is a normal degrade path, not a program error.
Exit 2 is reserved for CLI usage errors (bad flags).
"""
import argparse
import datetime
import json
import os
import sys
from pathlib import Path

SCHEMA = "athanor.quota/v1"
STALE_SECONDS = 900
DEFAULT_MIRROR_PATH = ".agent/memory/scratch/.quota_status.json"
REQUIRED_FIELDS = ("used_pct", "resets_at", "seconds_to_reset", "captured_at")

# Band thresholds (mission quota-aware-pause-resume F1). Named constants so
# all three live in one place — 85 and 90 already back other load-bearing
# behaviour (admission control, the high-water checkpoint); 95 is new.
BAND_TIGHT_PCT = 85
BAND_CRITICAL_PCT = 90
BAND_PAUSE_PCT = 95


def compute_band(state, used_pct):
    """Return the discrete band word for a reading. Never a percentage.

    Fail-open: any state other than "ok", or a missing used_pct, always
    yields "unknown" — the oracle must not look confident about data it
    does not have. Boundaries are inclusive at the lower bound.
    """
    if state != "ok" or used_pct is None:
        return "unknown"
    if used_pct >= BAND_PAUSE_PCT:
        return "pause"
    if used_pct >= BAND_CRITICAL_PCT:
        return "critical"
    if used_pct >= BAND_TIGHT_PCT:
        return "tight"
    return "healthy"


def _unknown(reason):
    return {
        "schema": SCHEMA,
        "state": "unknown",
        "used_pct": None,
        "resets_at": None,
        "seconds_to_reset": None,
        "captured_at": None,
        "age_seconds": None,
        "reason": reason,
        "band": "unknown",
    }


def read_status(mirror_path):
    """Read and validate the project-local quota mirror. Never raises."""
    if os.environ.get("CLAUDECODE") != "1":
        return _unknown("non_claude_code_session")

    path = Path(mirror_path)
    if not path.is_file():
        return _unknown("missing_mirror")

    try:
        raw = path.read_text()
        data = json.loads(raw)
    except (OSError, json.JSONDecodeError):
        return _unknown("malformed")

    if not isinstance(data, dict) or not all(k in data for k in REQUIRED_FIELDS):
        return _unknown("malformed")

    try:
        captured_at_raw = data["captured_at"]
        captured_at = datetime.datetime.fromisoformat(
            str(captured_at_raw).replace("Z", "+00:00")
        )
        if captured_at.tzinfo is None:
            captured_at = captured_at.replace(tzinfo=datetime.timezone.utc)
        used_pct = int(data["used_pct"])
        resets_at_raw = data["resets_at"]
        seconds_to_reset_raw = data["seconds_to_reset"]

        if resets_at_raw is None and seconds_to_reset_raw is None:
            is_partial = True
            seconds_to_reset = None
        elif resets_at_raw is not None and seconds_to_reset_raw is not None:
            is_partial = False
            seconds_to_reset = float(seconds_to_reset_raw)
        else:
            return _unknown("malformed")
    except (TypeError, ValueError):
        return _unknown("malformed")

    now = datetime.datetime.now(datetime.timezone.utc)
    age_seconds = (now - captured_at).total_seconds()

    if age_seconds > STALE_SECONDS:
        return _unknown("stale")

    state = "partial" if is_partial else "ok"
    return {
        "schema": SCHEMA,
        "state": state,
        "used_pct": used_pct,
        "resets_at": resets_at_raw,
        "seconds_to_reset": seconds_to_reset,
        "captured_at": captured_at_raw,
        "age_seconds": age_seconds,
        "reason": None,
        "band": compute_band(state, used_pct),
    }


def format_text(status):
    band = status.get("band", "unknown")
    if status["state"] == "ok":
        resets_hrs = status["seconds_to_reset"] / 3600.0
        return (
            f"quota: state=ok used={status['used_pct']}% "
            f"resets_in={resets_hrs:.1f}h band={band}"
        )
    if status["state"] == "partial":
        return (
            f"quota: state=partial used={status['used_pct']}% "
            f"resets_in=unknown band={band}"
        )
    return f"quota: state=unknown reason={status['reason']} band={band}"


def cmd_status(args):
    status = read_status(args.mirror_path)
    if args.json:
        print(json.dumps(status))
    else:
        print(format_text(status))
    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="quota.py",
        description="Project-local quota oracle — reads only the local mirror.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    status_parser = subparsers.add_parser(
        "status", help="Report current quota state from the project-local mirror"
    )
    status_parser.add_argument(
        "--json", action="store_true", help="Emit machine-readable JSON"
    )
    status_parser.add_argument(
        "--mirror-path",
        default=DEFAULT_MIRROR_PATH,
        help=f"Path to the mirror file (default: {DEFAULT_MIRROR_PATH})",
    )
    status_parser.set_defaults(func=cmd_status)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""quota.py — project-local quota oracle (mission quota-aware-execution F1).

Reads the project-local mirror file (default
.agent/memory/scratch/.quota_status.json). Self-refresh: when `status` finds the
mirror missing or stale it asks execution/statusline.py to rewrite the mirror
from the global usage cache, but only if that cache is itself fresh; the only
reader of the global cache is statusline.py's own loader, never this file.

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
import importlib.util
import json
import os
import sys
from pathlib import Path

SCHEMA = "athanor.quota/v1"
STALE_SECONDS = 900
DEFAULT_MIRROR_PATH = ".agent/memory/scratch/.quota_status.json"
MIRROR_SCRATCH_PARTS = (".agent", "memory", "scratch")
MIRROR_FILENAME = ".quota_status.json"
REFRESHABLE_REASONS = ("missing_mirror", "stale")
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
        "windows": {},
    }


def _parse_windows(raw):
    """Parse the optional per-window map; malformed entries are skipped."""
    out = {}
    if not isinstance(raw, dict):
        return out
    for name, win in raw.items():
        try:
            used = max(0, min(100, int(win["used_pct"])))
            secs = win.get("seconds_to_reset")
            out[name] = {"used_pct": used, "resets_at": win.get("resets_at"),
                         "seconds_to_reset": None if secs is None else float(secs)}
        except (TypeError, ValueError, KeyError, AttributeError):
            continue
    return out


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
        # Clamp: overage can report >100, and left must never go negative.
        used_pct = max(0, min(100, int(data["used_pct"])))
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
        "windows": _parse_windows(data.get("windows")),
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


def _left(used_pct):
    """Quota counts UP from 0%; print what remains so nobody inverts it."""
    return 100 - int(used_pct)


WINDOW_LABELS = {"five_hour": "5h", "seven_day": "week"}


def format_windows(status):
    """One line per window, only when the status is readable."""
    lines = []
    if status["state"] not in ("ok", "partial"):
        return lines
    for name, win in status.get("windows", {}).items():
        secs = win["seconds_to_reset"]
        resets = "unknown" if secs is None else f"{secs / 3600.0:.1f}h"
        lines.append(
            f"quota window={name} label={WINDOW_LABELS.get(name, name)} "
            f"used={win['used_pct']}% left={_left(win['used_pct'])}% resets_in={resets}")
    return lines


def format_text(status):
    return "\n".join([_format_legacy(status)] + format_windows(status))


def _format_legacy(status):
    band = status.get("band", "unknown")
    if status["state"] == "ok":
        resets_hrs = status["seconds_to_reset"] / 3600.0
        return (
            f"quota: state=ok used={status['used_pct']}% left={_left(status['used_pct'])}% "
            f"resets_in={resets_hrs:.1f}h band={band}"
        )
    if status["state"] == "partial":
        return (
            f"quota: state=partial used={status['used_pct']}% left={_left(status['used_pct'])}% "
            f"resets_in=unknown band={band}"
        )
    return f"quota: state=unknown reason={status['reason']} band={band}"


def _load_statusline():
    path = Path(__file__).resolve().parent / "statusline.py"
    spec = importlib.util.spec_from_file_location("statusline", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    override = os.environ.get("QUOTA_GLOBAL_STATE")
    if override:
        mod.GLOBAL_STATE = Path(override)
    return mod


def _project_root_for(mirror_path):
    """Project root owning a standard mirror path, else None (no refresh)."""
    path = Path(mirror_path).resolve()
    if path.name != MIRROR_FILENAME or path.parent.parts[-3:] != MIRROR_SCRATCH_PARTS:
        return None
    return path.parents[3]


def refresh_from_global(mirror_path):
    """Rewrite the mirror from a fresh global cache. Returns the failure reason or None."""
    root = _project_root_for(mirror_path)
    if root is None:
        return "stale"
    try:
        sl = _load_statusline()
        age = sl.global_age(sl.USAGE_CACHE_NAME)
        if age is None:
            return "missing_cache"
        cache = sl.global_json(sl.USAGE_CACHE_NAME)
        if age > STALE_SECONDS or cache is None:
            return "stale"
        sl.mirror_quota_all(root, cache)
    except Exception:
        return "stale"
    return None


def current_status(mirror_path):
    status = read_status(mirror_path)
    if status["state"] != "unknown" or status["reason"] not in REFRESHABLE_REASONS:
        return status
    failure = refresh_from_global(mirror_path)
    if failure is not None:
        return _unknown(failure)
    return read_status(mirror_path)


def cmd_status(args):
    status = current_status(args.mirror_path)
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
        "--mirror-path", "--mirror",
        default=DEFAULT_MIRROR_PATH,
        help=f"Path to the mirror file (default: {DEFAULT_MIRROR_PATH})",
    )
    status_parser.set_defaults(func=cmd_status)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

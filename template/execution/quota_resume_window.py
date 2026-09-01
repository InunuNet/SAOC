#!/usr/bin/env python3
"""quota_resume_window.py — the single resolver for "has the quota window
reopened?" (mission quota-aware-pause-resume F2).

Both halves of the resume monitor (execution/quota_resume_notice.sh,
execution/pulse_quota_resume.sh) call this instead of duplicating the
precedence logic below — duplicating it across two bash scripts guarantees
they drift (DECISIONS D-10).

THE BUG THIS FIXES (DECISIONS D-6): `execution/pulse_quota_resume.sh`, as
shipped, requires `quota.py status` to report `state == "ok"` and reads
`resets_at` from the LIVE mirror. But the mirror is only written by
`inject_pressure.sh` on a `UserPromptSubmit`, and it goes stale after 900s.
A paused session produces no turns, so in the exact scenario this script
exists for, the live oracle is ALWAYS `unknown` within 15 minutes and the
resume primitive can never fire.

Precedence (goldens/quota_bands_spec.md §6.1):
  1. live oracle `state == "ok"` with `resets_at` present -> use it (and,
     once the boundary has passed, additionally require
     `used_pct <= ATHANOR_QUOTA_RESUME_CEILING` (default 10) -- a guard
     against resuming into an already-hot window, never the primary
     trigger);
  2. else the checkpoint's OWN recorded `resets_at` -> use it. This is not
     optimism about an unreadable signal: it was read, at pause time, by
     the single sanctioned reader (F1/inject_pressure.sh), and
     self-recorded. Combined with wall-clock, "an absolute deadline we
     wrote down ourselves has passed" is a fact, not an inference;
  3. else -> NONE. An absent deadline is not a passed deadline.

This resolver never reads the live quota oracle a second, independent way —
it shells out to `execution/quota.py status` (F1's sanctioned reader) rather
than re-implementing mirror parsing, and never touches ~/.claude/** itself;
only inject_pressure.sh may cross that boundary (.claude/rules/scope.md).

Always exits 0 (it runs inside the Pulse cycle — a resolver must never
break it) and prints exactly one line:

    <READY|WAIT|NONE> <resets_at|-> <live|checkpoint|none>

A future-dated checkpoint `timestamp` (the pause record itself claiming to
be from the future) is impossible state, not extra freshness — it is
rejected as NONE with a WARN on stderr (mirrors the F4/A14 precedent that
impossible state is a genuine error, even though the exit code stays 0).
"""
import argparse
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

DEFAULT_CHECKPOINT_PATH = ".agent/memory/scratch/.quota_death_checkpoint.json"
DEFAULT_CEILING = 10


def _parse_iso(value):
    """Parse an ISO-8601 timestamp into an aware UTC datetime, or None."""
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt


def _read_live(mirror_path):
    """Consult F1's oracle (execution/quota.py) — never a second reader."""
    quota_py = Path(__file__).resolve().parent / "quota.py"
    args = [sys.executable, str(quota_py), "status", "--json"]
    if mirror_path:
        args += ["--mirror-path", str(mirror_path)]
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return json.loads(proc.stdout)
    except Exception:
        return {"state": "unknown"}


def _load_checkpoint(path):
    """Read + parse the checkpoint. Returns a dict, or None on any error."""
    if not path:
        return None
    try:
        data = json.loads(Path(path).read_text())
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    return data


def resolve(checkpoint_path, mirror_path, ceiling):
    """Return (verdict, resets_at, source, warnings)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    warnings = []

    # --- 1. live oracle, when it is actually usable -------------------
    live = _read_live(mirror_path)
    if live.get("state") == "ok":
        live_resets_at = live.get("resets_at")
        live_resets_epoch = _parse_iso(live_resets_at)
        if live_resets_epoch is not None:
            if now < live_resets_epoch:
                return "WAIT", live_resets_at, "live", warnings
            used_pct = live.get("used_pct")
            if used_pct is not None and used_pct <= ceiling:
                return "READY", live_resets_at, "live", warnings
            return "WAIT", live_resets_at, "live", warnings

    # --- 2. fallback: the checkpoint's own recorded resets_at (D-6) ----
    checkpoint = _load_checkpoint(checkpoint_path)
    if checkpoint is None:
        return "NONE", None, "none", warnings

    checkpoint_ts = _parse_iso(checkpoint.get("timestamp"))
    if checkpoint_ts is None:
        return "NONE", None, "none", warnings
    if checkpoint_ts > now:
        warnings.append(
            "WARN: quota_resume_window: checkpoint timestamp is in the "
            "future (clock skew or impossible/corrupted state) -- rejecting"
        )
        return "NONE", None, "none", warnings

    checkpoint_resets_at = checkpoint.get("resets_at")
    checkpoint_resets_epoch = _parse_iso(checkpoint_resets_at)
    if checkpoint_resets_epoch is None:
        return "NONE", None, "none", warnings

    if now >= checkpoint_resets_epoch:
        return "READY", checkpoint_resets_at, "checkpoint", warnings
    return "WAIT", checkpoint_resets_at, "checkpoint", warnings


def _ceiling_from_env():
    try:
        return int(os.environ.get("ATHANOR_QUOTA_RESUME_CEILING", DEFAULT_CEILING))
    except ValueError:
        return DEFAULT_CEILING


def main():
    parser = argparse.ArgumentParser(
        description="Resolve whether the quota window has reopened.",
    )
    parser.add_argument("--checkpoint", default=DEFAULT_CHECKPOINT_PATH)
    parser.add_argument("--mirror-path", default=None)
    parser.add_argument("--ceiling", type=int, default=None)
    args = parser.parse_args()

    ceiling = args.ceiling if args.ceiling is not None else _ceiling_from_env()
    verdict, resets_at, source, warnings = resolve(
        args.checkpoint, args.mirror_path, ceiling
    )
    for warning in warnings:
        print(warning, file=sys.stderr)
    print(f"{verdict} {resets_at or '-'} {source}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

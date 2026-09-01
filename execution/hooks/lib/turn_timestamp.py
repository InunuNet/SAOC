#!/usr/bin/env python3
"""Turn-timestamp formatting + state helpers -- shared by inject_pressure.sh
(START, UserPromptSubmit), turn_end_stamp.sh (END, Stop), and full_boot.sh
(SessionStart away-report).

Mission: turn-timestamps F1 (see
.agent/memory/project/specs/turn-timestamps/SPEC.md and DECISIONS.md D1/D2).
Grammar/case tables this module is built against:
.agent/memory/project/specs/turn-timestamps/goldens/turn_timestamp_spec.md,
verified by goldens/format_turn_line_cases.py.

Two independent lines, not one shared "elapsed" concept:
  - START/END answer "when did this turn run, and did it finish" --
    format_duration() has NO trivial-value suppression floor (0s is real
    information, not noise).
  - SessionStart's away-report answers "has this workspace been abandoned"
    -- format_gap_for_away() keeps the original <10s suppression floor.

Every failure mode (missing file, corrupt/non-JSON content, non-integer or
negative stored epoch, negative computed duration/gap) collapses to ONE
outcome: the figure is omitted, never guessed or wrong (D3). This module is
the single choke point for that rule -- callers never re-implement it.
"""
import json
import os
import time


def format_duration(seconds):
    """END line duration. None on missing/negative input -- never suppressed
    for being merely small (0s/3s/9s all render; see turn_timestamp_spec.md
    section 1 and anti-case A6.7)."""
    if seconds is None:
        return None
    try:
        seconds = int(seconds)
    except (TypeError, ValueError):
        return None
    if seconds < 0:
        return None
    return _bucket(seconds)


def format_gap_for_away(seconds):
    """SessionStart away-gap. Keeps the original <10s suppression floor --
    a workspace restarting within 10s of its last activity is not
    "abandoned" (turn_timestamp_spec.md section 3)."""
    if seconds is None:
        return None
    try:
        seconds = int(seconds)
    except (TypeError, ValueError):
        return None
    if seconds < 10:
        return None
    return _bucket(seconds)


def _bucket(seconds):
    """Shared NhMm/Nm/Ns bucketing (M omitted when exactly zero). Caller has
    already validated seconds is a non-negative int past its own floor."""
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours}h" if minutes == 0 else f"{hours}h{minutes}m"


def format_absolute(epoch=None):
    """HH:MM:SS <tz-abbrev>, local system clock, 24-hour, zero-padded,
    seconds included. Falls back to a UTC-offset form when no zone
    abbreviation resolves -- a timestamp with no zone marker at all is
    ambiguous the moment Brad is on a different machine."""
    if epoch is None:
        epoch = time.time()
    lt = time.localtime(epoch)
    clock = time.strftime("%H:%M:%S", lt)
    tz = time.strftime("%Z", lt)
    if not tz:
        offset_seconds = -time.timezone if not lt.tm_isdst else -time.altzone
        sign = "+" if offset_seconds >= 0 else "-"
        offset_seconds = abs(offset_seconds)
        tz = f"{sign}{offset_seconds // 3600:02d}:{(offset_seconds % 3600) // 60:02d}"
    return f"{clock} {tz}"


def format_start_line(epoch):
    """Always bare -- no duration, no gap. Deliberately the simplest
    possible line (D1)."""
    return f"START {format_absolute(epoch)}"


def format_end_line(epoch, duration_seconds):
    """Duration appended only when format_duration() returns non-None --
    never fabricated when no matching START record exists."""
    line = f"END {format_absolute(epoch)}"
    dur = format_duration(duration_seconds)
    if dur is not None:
        line += f" ({dur})"
    return line


def format_session_start_line(epoch, away_seconds):
    """'Session started ...' with an optional ' -- away <gap>' suffix. The
    <10s-suppressed case renders identically to the no-prior-record case --
    intentional (turn_timestamp_spec.md section on SessionStart)."""
    line = f"Session started {format_absolute(epoch)}"
    gap = format_gap_for_away(away_seconds)
    if gap is not None:
        line += f" — away {gap}"
    return line


# --- State: per-session START record --------------------------------------

def session_state_path(session_id, scratch_dir):
    """Path for the per-session turn-timestamp file. session_id keys the
    filename (never a fixed/global name) to isolate concurrent sessions
    sharing one workspace -- the Pulse-label collision class (D2)."""
    return os.path.join(str(scratch_dir), f".turn_ts_{session_id}.json")


def read_last_start_epoch(path):
    """None on missing/corrupt/non-int/negative -- D3's single failure
    bucket. Never raises."""
    try:
        with open(path) as f:
            data = json.load(f)
        epoch = data.get("last_start_epoch")
        if not isinstance(epoch, (int, float)) or isinstance(epoch, bool):
            return None
        epoch = int(epoch)
        if epoch < 0:
            return None
        return epoch
    except Exception:
        return None


def write_last_start_epoch(path, epoch):
    """Atomic tmp+rename write. Never raises -- returns False on any
    failure (unwritable dir, etc.) so the caller can keep going."""
    try:
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        tmp_path = f"{path}.tmp.{os.getpid()}"
        with open(tmp_path, "w") as f:
            json.dump({"last_start_epoch": int(epoch)}, f)
        os.replace(tmp_path, path)
        return True
    except Exception:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        return False


# --- State: cross-session workspace-activity record -----------------------

def last_activity_path(scratch_dir):
    """Unkeyed, last-write-wins -- deliberately NOT session-id-keyed, since
    its job is "when did ANY session last touch this workspace" (D2)."""
    return os.path.join(str(scratch_dir), ".last_activity.json")


def touch_last_activity(path, epoch):
    """Same atomic tmp+rename idiom as write_last_start_epoch(). Written by
    both the START and END hooks -- either counts as activity."""
    try:
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        tmp_path = f"{path}.tmp.{os.getpid()}"
        with open(tmp_path, "w") as f:
            json.dump({"last_seen_epoch": int(epoch)}, f)
        os.replace(tmp_path, path)
        return True
    except Exception:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        return False


def read_last_activity(path):
    """None on missing/corrupt/non-int/negative -- same D3 bucket."""
    try:
        with open(path) as f:
            data = json.load(f)
        epoch = data.get("last_seen_epoch")
        if not isinstance(epoch, (int, float)) or isinstance(epoch, bool):
            return None
        epoch = int(epoch)
        if epoch < 0:
            return None
        return epoch
    except Exception:
        return None

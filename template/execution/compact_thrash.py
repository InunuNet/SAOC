#!/usr/bin/env python3
"""Compaction thrash detector, wired to SessionStart.

Claude Code reads autoCompactWindow only at process start, so a session started before a
harness update keeps the old window and can compact every minute or two for hours. SessionStart
fires with source=compact after each compaction; this hook records it and, at THRASH_COUNT
compactions of one session inside WINDOW_SECONDS, prints a restart banner.

Usage: compact_thrash.py hook   (reads the SessionStart JSON from stdin)
Always exits 0 and never prints a traceback: a SessionStart hook must never break boot.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

LOG_REL = Path(".agent/memory/scratch/compact-log.jsonl")
WINDOW_SECONDS = 1200
THRASH_COUNT = 3
MAX_LOG_LINES = 500
MAX_PER_SESSION = 10
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def project_dir():
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env and Path(env).is_dir():
        return Path(env)
    return Path.cwd()


def read_entries(log):
    entries = []
    try:
        text = log.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return entries
    for line in text.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if (isinstance(e, dict) and isinstance(e.get("session_id"), str)
                and isinstance(e.get("ts"), (int, float)) and not isinstance(e["ts"], bool)):
            entries.append({"ts": float(e["ts"]), "session_id": e["session_id"]})
    return entries


def write_atomic(log, entries):
    tmp = log.with_name(log.name + ".tmp")
    tmp.write_text("".join(json.dumps(e) + "\n" for e in entries), encoding="utf-8")
    os.replace(tmp, log)


def trim(entries, now):
    """Keep the newest MAX_PER_SESSION per session inside the window, capped globally."""
    kept, seen = [], {}
    for e in sorted(entries, key=lambda x: x["ts"], reverse=True):
        if now - e["ts"] > WINDOW_SECONDS:
            continue
        if seen.get(e["session_id"], 0) >= MAX_PER_SESSION:
            continue
        seen[e["session_id"]] = seen.get(e["session_id"], 0) + 1
        kept.append(e)
    return sorted(kept[:MAX_LOG_LINES], key=lambda x: x["ts"])


def banner(session_id, count):
    minutes = WINDOW_SECONDS // 60
    return (
        "COMPACTION THRASH: this session compacted "
        f"{count} compactions in the last {minutes} minutes (session {session_id}).\n"
        "Why: Claude Code reads autoCompactWindow only at start, so a session older than "
        "its last harness update keeps the old window.\n"
        "Agent: commit your work now, hold new work and tell the operator.\n"
        "Operator: restart with `claude --dangerously-skip-permissions --resume "
        f"{session_id}`; the restart is yours to do."
    )


def run(payload):
    if not isinstance(payload, dict) or payload.get("source") != "compact":
        return ""
    session_id = payload.get("session_id")
    if not isinstance(session_id, str) or not SESSION_ID_RE.fullmatch(session_id):
        return ""
    log = project_dir() / LOG_REL
    log.parent.mkdir(parents=True, exist_ok=True)
    now = time.time()
    entries = read_entries(log)
    entries.append({"ts": now, "session_id": session_id})
    entries = trim(entries, now)
    write_atomic(log, entries)
    count = sum(1 for e in entries
                if e["session_id"] == session_id and 0 <= now - e["ts"] <= WINDOW_SECONDS)
    return banner(session_id, count) if count >= THRASH_COUNT else ""


def main(argv):
    if len(argv) < 2 or argv[1] != "hook":
        return 0
    try:
        out = run(json.loads(sys.stdin.read()))
    except Exception as exc:  # a SessionStart hook must never break boot
        sys.stderr.write(f"compact_thrash: skipped ({type(exc).__name__})\n")
        return 0
    if out:
        sys.stdout.write(out + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

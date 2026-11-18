#!/usr/bin/env python3
"""dispatch_ledger.py: one JSONL row per delegated dispatch (QA reviewer run, dev run).

Ledger: .agent/memory/project/telemetry/dispatch.jsonl (override: ATHANOR_DISPATCH_LEDGER).
Schema athanor.dispatch/v1. See .agent/memory/project/specs/agy-delegation/DECISIONS.md s5.

Subcommands:
  append  --kind --mode --lead --provider --model --tier --verdict --rc --wall
          [--tokens-in N --tokens-out N --tokens-thinking N --tokens-cache-read N
           --tokens-total N] [--findings N] [--mission S] [--id S]
  next    --pair a,b     print the pair member that did NOT run last (alternation)
  summary                per-provider runs, FAIL rate, UNAVAILABLE rate, p50 wall, tokens

A failure to write warns on stderr and exits 0: a ledger problem never fails a review.
"""
import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path

try:
    import fcntl
except ImportError:  # Windows: no fcntl; the lock below uses msvcrt
    fcntl = None

SCHEMA = "athanor.dispatch/v1"
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LEDGER = ROOT / ".agent/memory/project/telemetry/dispatch.jsonl"
ACTIVE_MISSION = ROOT / ".agent/memory/project/missions/active.json"
ROTATING_MODES = ("alternate", "failover")
LOCK_DEADLINE_SECONDS = 30
LOCK_POLL_SECONDS = 0.05
TOKEN_KEYS = ("tokens_in", "tokens_out", "tokens_thinking", "tokens_cache_read", "tokens_total")
PERCENT = 100.0


def ledger_path():
    override = os.environ.get("ATHANOR_DISPATCH_LEDGER")
    return Path(override) if override else DEFAULT_LEDGER


def _lock(fd):
    """Exclusive lock: flock on POSIX, polled msvcrt.locking on Windows."""
    if fcntl is not None:
        fcntl.flock(fd, fcntl.LOCK_EX)
        return
    import msvcrt
    deadline = time.monotonic() + LOCK_DEADLINE_SECONDS
    while True:
        os.lseek(fd, 0, os.SEEK_SET)
        try:
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            return
        except OSError:
            if time.monotonic() >= deadline:
                raise TimeoutError("could not lock the dispatch ledger")
            time.sleep(LOCK_POLL_SECONDS)


def _unlock(fd):
    if fcntl is not None:
        fcntl.flock(fd, fcntl.LOCK_UN)
        return
    import msvcrt
    os.lseek(fd, 0, os.SEEK_SET)
    msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)


def active_mission():
    try:
        data = json.loads(ACTIVE_MISSION.read_text(encoding="utf-8"))
        return Path(str(data["mission"])).stem or None
    except (OSError, ValueError, KeyError):
        return None


def read_rows(path):
    rows = []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return rows
    for line in text.splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if isinstance(row, dict) and row.get("schema") == SCHEMA:
            rows.append(row)
    return rows


def build_row(args):
    row = {
        "schema": SCHEMA,
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "kind": args.kind,
        "mode": args.mode,
        "lead": args.lead,
        "provider": args.provider,
        "model": args.model or None,
        "tier": args.tier,
        "verdict": args.verdict,
        "rc": args.rc,
        "wall_seconds": args.wall,
    }
    for key in TOKEN_KEYS:
        row[key] = getattr(args, key)
    row["findings"] = args.findings
    row["confinement"] = args.confinement
    row["mission"] = args.mission if args.mission else active_mission()
    row["id"] = args.id
    return row


def cmd_append(args):
    path = ledger_path()
    line = json.dumps(build_row(args), separators=(",", ":")) + "\n"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        lock_fd = os.open(str(path) + ".lock", os.O_RDWR | os.O_CREAT, 0o644)
        try:
            _lock(lock_fd)
            fd = os.open(str(path), os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
            try:
                os.write(fd, line.encode("utf-8"))
            finally:
                os.close(fd)
            _unlock(lock_fd)
        finally:
            os.close(lock_fd)
    except (OSError, TimeoutError) as exc:
        print("dispatch_ledger.py: warning: could not append (%s: %s)"
              % (type(exc).__name__, exc), file=sys.stderr)
    return 0


def cmd_next(args):
    pair = [p for p in args.pair.split(",") if p]
    if len(pair) != 2 or pair[0] == pair[1]:
        print("dispatch_ledger.py: --pair needs two distinct providers", file=sys.stderr)
        return 2
    pick = pair[0]
    for row in reversed(read_rows(ledger_path())):
        if (row.get("kind") == "qa" and row.get("mode") in ROTATING_MODES
                and row.get("provider") in pair and row.get("verdict") != "UNAVAILABLE"):
            pick = pair[1] if row["provider"] == pair[0] else pair[0]
            break
    print(pick)
    return 0


def _percent(part, whole):
    return PERCENT * part / whole if whole else 0.0


def _p50(values):
    values = sorted(values)
    if not values:
        return None
    mid = len(values) // 2
    return values[mid] if len(values) % 2 else (values[mid - 1] + values[mid]) / 2


def cmd_summary(_args):
    rows = read_rows(ledger_path())
    if not rows:
        print("no dispatch rows in %s" % ledger_path())
        return 0
    by_provider = {}
    for row in rows:
        by_provider.setdefault(str(row.get("provider")), []).append(row)
    print("provider  runs  fail_rate  unavailable_rate  p50_wall_s  tokens_total")
    for provider in sorted(by_provider):
        group = by_provider[provider]
        runs = len(group)
        fails = sum(1 for r in group if r.get("verdict") == "FAIL")
        unavail = sum(1 for r in group if r.get("verdict") == "UNAVAILABLE")
        walls = [r["wall_seconds"] for r in group
                 if isinstance(r.get("wall_seconds"), (int, float))]
        tokens = sum(r["tokens_total"] for r in group
                     if isinstance(r.get("tokens_total"), (int, float)))
        p50 = _p50(walls)
        print("%s  runs=%d  fail_rate=%.0f%%  unavailable_rate=%.0f%%  p50_wall=%s  tokens=%d"
              % (provider, runs, _percent(fails, runs), _percent(unavail, runs),
                 "n/a" if p50 is None else "%.1fs" % p50, tokens))
    return 0


def _int_or_none(value):
    return None if value in (None, "", "null") else int(value)


def _float_or_none(value):
    return None if value in (None, "", "null") else float(value)


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    app = sub.add_parser("append")
    app.add_argument("--kind", required=True, choices=("qa", "dev"))
    app.add_argument("--mode", required=True,
                     choices=("alternate", "failover", "both", "direct"))
    app.add_argument("--lead", default="claude")
    app.add_argument("--provider", required=True)
    app.add_argument("--model", required=True)
    app.add_argument("--tier", default="standard", choices=("standard", "apex"))
    app.add_argument("--verdict", required=True)
    app.add_argument("--rc", type=int, default=0)
    app.add_argument("--wall", type=_float_or_none, default=None)
    for key in TOKEN_KEYS:
        app.add_argument("--" + key.replace("_", "-"), dest=key, type=_int_or_none,
                         default=None)
    app.add_argument("--findings", type=int, default=0)
    app.add_argument("--confinement", default=None,
                     choices=("sandbox-exec", "bwrap", "none", "codex-workspace-write"),
                     help="dev-run confinement used; null for QA rows")
    app.add_argument("--mission", default=None)
    app.add_argument("--id", default=None)
    nxt = sub.add_parser("next")
    nxt.add_argument("--pair", required=True)
    sub.add_parser("summary")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    return {"append": cmd_append, "next": cmd_next, "summary": cmd_summary}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())

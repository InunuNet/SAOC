#!/usr/bin/env python3
"""timesheet.py — the operator's time on a billable project, from prompt sessions.

Operator 2026-10-23: each project that runs Athanor says whether it is
billable, and the harness tracks the operator's time on it. Claude Code sees
only the moment a prompt is submitted, so time is measured in PROMPT
SESSIONS: a session starts at a prompt and continues while each next prompt
arrives within GAP_MIN minutes. Its time is last prompt - first prompt plus a
TAIL_MIN read tail. An agent left working for 45 minutes while the operator is
away is not billed: the gap ends the session. A day is the sum of the
sessions that start on it, in local time.

  hook          UserPromptSubmit: record the operator's prompt (ts + session id only)
  setup         record the billing answer in .agent/profile.json
  boot-check    print the billing question when the profile has no answer
  note TEXT     the project lead's note on what the day was spent on
  report        today's time (and the current session); rewrites timesheet.md

brain.py wrap-up calls wrap_up_report(), so every wrap-up shows the report,
including the time on the current feature mission. Answers to an agent's
AskUserQuestion count as operator time too (PostToolUse).
ATHANOR_TIMESHEET_DIR replaces the data directory (the goal probe's sandbox).
"""
import argparse
import json
import math
import os
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

GAP_MIN = 15  # operator 2026-10-23: enough to read, check, change a file and reply
TAIL_MIN = 5
NOTE_MAX = 160
PROFILE = Path(".agent/profile.json")
DATA_DIR = Path(".agent/memory/project/telemetry")
SHEET = Path(".agent/memory/project/timesheet.md")
MISSIONS = Path(".agent/memory/project/missions")
# Turns that reach UserPromptSubmit without the operator typing them.
NOT_OPERATOR = ("<cross-session-message", "<task-notification", "[SYSTEM NOTIFICATION",
                "<<autonomous-loop", "<system-reminder")


def paths(root: Path):
    override = os.environ.get("ATHANOR_TIMESHEET_DIR")
    if override:
        d = Path(override)
        return d / "prompts.jsonl", d / "timesheet_notes.jsonl", d / "timesheet.md"
    return (root / DATA_DIR / "prompts.jsonl", root / DATA_DIR / "timesheet_notes.jsonl",
            root / SHEET)


def load_profile(root: Path) -> dict:
    try:
        p = json.loads((root / PROFILE).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}
    return p if isinstance(p, dict) else {}


def billing(root: Path) -> dict | None:
    """The billing block when the project is billable, else None."""
    b = load_profile(root).get("billing")
    return b if isinstance(b, dict) and b.get("billable") is True else None


def read_jsonl(path: Path) -> list[dict]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    out = []
    for ln in lines:
        try:
            rec = json.loads(ln)
        except ValueError:
            continue
        if isinstance(rec, dict):
            out.append(rec)
    return out


def append_jsonl(path: Path, rec: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec) + "\n")


def is_operator(prompt) -> bool:
    return isinstance(prompt, str) and not prompt.lstrip().startswith(NOT_OPERATOR)


def operator_event(data: dict) -> bool:
    """An operator prompt, or the operator answering an agent's question.

    Answers to AskUserQuestion reach no UserPromptSubmit, yet they are the
    operator's time (trial 2026-10-23: 3 of 8 interactions on one feature).
    """
    if data.get("hook_event_name") == "PostToolUse" or "tool_name" in data:
        return data.get("tool_name") == "AskUserQuestion"
    return is_operator(data.get("prompt"))


def cmd_hook() -> int:
    # Never break a prompt: every failure is swallowed, nothing reaches stdout.
    try:
        data = json.loads(sys.stdin.read() or "null")
        if not isinstance(data, dict) or not operator_event(data):
            return 0
        root = Path(data.get("cwd") or Path.cwd())
        if billing(root) is None:
            return 0
        log, _, _ = paths(root)
        append_jsonl(log, {"ts": datetime.now(timezone.utc).isoformat(),
                           "session": str(data.get("session_id") or "")})
    except Exception as e:  # noqa: BLE001 - a hook must never fail the prompt
        print(f"timesheet hook: {type(e).__name__}", file=sys.stderr)
    return 0


def prompt_times(log: Path) -> list[datetime]:
    """Every recorded prompt, all sessions merged, in local time, sorted."""
    out = []
    for rec in read_jsonl(log):
        try:
            out.append(datetime.fromisoformat(rec["ts"]).astimezone())
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(out)


def sessions(times: list[datetime]) -> list[tuple[datetime, datetime, int]]:
    """(start, last prompt, billable minutes) per prompt session."""
    out = []
    for t in times:
        if out and t - out[-1][1] <= timedelta(minutes=GAP_MIN):
            out[-1][1] = t
        else:
            out.append([t, t])
    return [(s, e, round((e - s).total_seconds() / 60) + TAIL_MIN) for s, e in out]


def hm(minutes: int) -> str:
    return f"{minutes // 60}h{minutes % 60:02d}m"


def amount(minutes: int, b: dict) -> str:
    return f"{b.get('currency', '')} {minutes * float(b['rate']) / 60:.2f}".strip()


def notes_by_day(notes: Path) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for rec in read_jsonl(notes):
        if isinstance(rec.get("date"), str) and isinstance(rec.get("note"), str):
            out.setdefault(rec["date"], []).append(rec["note"])
    return out


def add_note(root: Path, text: str, day: str) -> None:
    _, notes, _ = paths(root)
    text = " ".join(text.split())[:NOTE_MAX]
    if text:
        append_jsonl(notes, {"date": day, "note": text,
                             "ts": datetime.now(timezone.utc).isoformat()})


def md_text(text: str) -> str:
    """A note as inert table text: no links, images, HTML or cell breaks."""
    for ch in "\\[]()<>!`*_|":
        text = text.replace(ch, "\\" + ch)
    return text


def render(root: Path, b: dict, by_day: dict) -> None:
    _, notes, sheet = paths(root)
    nd = notes_by_day(notes)
    name = load_profile(root).get("project_name") or root.name
    rows = [f"# Timesheet — {name}", "",
            f"Client: {b.get('client', '')} · rate {b.get('currency', '')} {b['rate']}/h. "
            f"Generated by `python3 execution/timesheet.py report`; prompt sessions end after "
            f"{GAP_MIN} min without a prompt, plus {TAIL_MIN} min per session.", "",
            "| Date | Sessions | Time | Amount | Worked on |", "|---|---|---|---|---|"]
    for day in sorted(set(by_day) | set(nd)):
        ss = by_day.get(day, [])
        mins = sum(m for _, _, m in ss)
        note = md_text("; ".join(nd.get(day, [])))
        rows.append(f"| {day} | {len(ss)} | {hm(mins)} | {amount(mins, b)} | {note} |")
    sheet.parent.mkdir(parents=True, exist_ok=True)
    sheet.write_text("\n".join(rows) + "\n", encoding="utf-8")


def mission_meta(path: Path) -> dict:
    """A mission file's frontmatter, or {} when it is missing or garbled."""
    try:
        import yaml
        import re
        m = re.match(r"---[ \t]*\n(.*?)\n---[ \t]*(\n|$)", path.read_text(encoding="utf-8"), re.S)
        if not m:
            return {}
        meta = yaml.safe_load(m.group(1))
    except Exception:  # noqa: BLE001 - a bad mission file never breaks the report
        return {}
    return meta if isinstance(meta, dict) else {}


def parse_ts(value) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value)).astimezone()
    except (ValueError, OverflowError):
        return None


def feature_window(root: Path, day: str, now: datetime):
    """(slug, start, end) of the feature mission: the active one, else the
    mission completed latest when that was on DAY. None when there is none."""
    missions = root / MISSIONS
    try:
        active = json.loads((missions / "active.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        active = {}
    rel = active.get("mission") if isinstance(active, dict) else None
    if isinstance(rel, str) and rel:
        meta = mission_meta(root / rel)
        start = parse_ts(meta.get("created_at"))
        if start:
            return (str(meta.get("slug") or Path(rel).stem), start,
                    parse_ts(meta.get("completed_at")) or now)
    latest = None
    for f in sorted(missions.glob("*.md")) if missions.is_dir() else []:
        meta = mission_meta(f)
        start, end = parse_ts(meta.get("created_at")), parse_ts(meta.get("completed_at"))
        if (start and end and end.date().isoformat() == day
                and (latest is None or end > latest[2])):
            latest = (str(meta.get("slug") or f.stem), start, end)
    return latest


def report(root: Path, day: str | None = None, now: datetime | None = None) -> str:
    b = billing(root)
    if b is None:
        return ""
    now = (now or datetime.now(timezone.utc)).astimezone()
    day = day or now.date().isoformat()
    log, _, _ = paths(root)
    all_sessions = sessions(prompt_times(log))
    by_day: dict[str, list] = {}
    for s in all_sessions:
        by_day.setdefault(s[0].date().isoformat(), []).append(s)
    render(root, b, by_day)
    today = by_day.get(day, [])
    mins = sum(m for _, _, m in today)
    lines = [f"⏱  Timesheet — {b.get('client', '')} ({b.get('currency', '')} {b['rate']}/h)"]
    if all_sessions:
        s, e, m = all_sessions[-1]
        state = "open" if now - e <= timedelta(minutes=GAP_MIN) else "closed"
        lines.append(f"   Current session: {s:%H:%M}–{e:%H:%M} · {hm(m)} ({state})")
    lines.append(f"   {day}: {len(today)} session{'s' if len(today) != 1 else ''} · "
                 f"{hm(mins)} · {amount(mins, b)}")
    feature = feature_window(root, day, now)
    if feature:
        slug, start, end = feature
        # a session overlaps through its billed read tail
        fmins = sum(m for s, e, m in all_sessions
                    if s <= end and e + timedelta(minutes=TAIL_MIN) >= start)
        lines.append(f"   Feature {slug}: {hm(fmins)} · {amount(fmins, b)}")
    return "\n".join(lines)


def wrap_up_report(summary: str) -> None:
    """Called by brain.py wrap-up: the summary becomes today's note, then the report."""
    root = Path.cwd()
    if billing(root) is None:
        return
    add_note(root, summary or "", date.today().isoformat())
    print(report(root))


def cmd_setup(args) -> int:
    root = Path.cwd()
    if args.billable == "no":
        block = {"billable": False}
    else:
        try:
            rate = float(args.rate)
        except (TypeError, ValueError):
            rate = -1.0
        if (not (args.client or "").strip() or not math.isfinite(rate) or not rate > 0
                or not (args.currency or "").strip()):
            print("ERROR: a billable project needs --client, --currency and a positive --rate",
                  file=sys.stderr)
            return 2
        block = {"billable": True, "client": args.client.strip(),
                 "rate": int(rate) if rate.is_integer() else rate,
                 "currency": args.currency.strip().upper()}
    # Refuse an unreadable profile rather than replace it with billing alone.
    try:
        prof = json.loads((root / PROFILE).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as e:
        print(f"ERROR: {PROFILE} unreadable ({type(e).__name__}); not changed", file=sys.stderr)
        return 2
    if not isinstance(prof, dict):
        print(f"ERROR: {PROFILE} is not a JSON object; not changed", file=sys.stderr)
        return 2
    prof["billing"] = block
    fd, tmp = tempfile.mkstemp(dir=root / PROFILE.parent, prefix=".profile.", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(json.dumps(prof, indent=2) + "\n")
    os.replace(tmp, root / PROFILE)
    print(f"billing: {block}")
    return 0


def cmd_boot_check() -> int:
    if "billing" not in load_profile(Path.cwd()):
        print("BILLING: not set. Ask the operator once whether this project is billable "
              "(and if so the client, hourly rate and currency), then record it: "
              "python3 execution/timesheet.py setup --billable yes --client NAME --rate N "
              "--currency ZAR  (or --billable no)")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("hook")
    sub.add_parser("boot-check")
    s = sub.add_parser("setup")
    s.add_argument("--billable", choices=("yes", "no"), required=True)
    s.add_argument("--client")
    s.add_argument("--rate")
    s.add_argument("--currency")
    n = sub.add_parser("note")
    n.add_argument("text")
    n.add_argument("--date")
    r = sub.add_parser("report")
    r.add_argument("--date")
    r.add_argument("--now", help=argparse.SUPPRESS)
    args = ap.parse_args(argv)
    if args.cmd == "hook":
        return cmd_hook()
    if args.cmd == "boot-check":
        return cmd_boot_check()
    if args.cmd == "setup":
        return cmd_setup(args)
    if args.cmd == "note":
        add_note(Path.cwd(), args.text, args.date or date.today().isoformat())
        return 0
    now = datetime.fromisoformat(args.now) if args.now else None
    out = report(Path.cwd(), args.date, now)
    if out:
        print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())

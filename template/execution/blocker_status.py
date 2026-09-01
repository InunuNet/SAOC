#!/usr/bin/env python3
"""blocker_status.py — per-workspace blocker-status oracle + reference renderer
(mission blocker-status-line F1).

Answers one question: is anything gating on Brad RIGHT NOW, and for how
long. NOT the same mechanism as `brain.py scan-blockers` (that mines the
semantic brain for recurring cross-session pain points over time — see
.agent/memory/project/specs/blocker-status-line/DECISIONS.md D0).

Closed 8-code taxonomy, 3 severities (SPEC.md). `compute_live_state()` is a
pure function of on-disk files (quota mirror, context mirror,
handoff_state.json, the active mission file) — safe to call from anywhere,
anytime. The transcript-derived pair (AWAITING_ANSWER/AWAITING_PLAN_APPROVAL)
is written exclusively by execution/hooks/blocker_scan.sh (the only site with
transcript access) and merged in by collect_all_blockers().

Same hard rule as execution/quota.py and execution/hooks/inject_pressure.sh:
every failure mode (missing file, corrupt JSON, unwritable scratch dir,
wrong type, expired signal) degrades to "no entry" / "unknown" — never a
crash, never a hang, never a guessed value.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

SCHEMA = "athanor.blocker/v1"

DEFAULT_SCRATCH_DIR = ".agent/memory/scratch"
DEFAULT_MISSIONS_DIR = ".agent/memory/project/missions"
DEFAULT_WIDTH = 36
DEFAULT_MAX_ROWS = 5

# D2 — reused verbatim from inject_pressure.sh's own CTX_TOKENS>=100000
# threshold. Never re-derived as a percentage (see DECISIONS.md D2).
CONTEXT_HIGH_THRESHOLD_TOKENS = 100000
CONTEXT_STALE_SECONDS = 900  # same 900s convention as quota.py's mirror

# D6 — backstop TTL for a killed session that never submits a next prompt.
TRANSCRIPT_SIGNAL_TTL_SECONDS = 4 * 3600

# --- D1: closed taxonomy ----------------------------------------------------

SEVERITY_ORDER = ["none", "yellow", "orange", "red"]

CODE_SEVERITY = {
    "AWAITING_ANSWER": "red",
    "AWAITING_PLAN_APPROVAL": "red",
    "GATE_BLOCKED": "red",
    "QUOTA_PAUSE": "red",
    "QUOTA_CRITICAL": "orange",
    "MISSION_PAUSED": "orange",
    "CONTEXT_HIGH": "orange",
    "QUOTA_TIGHT": "yellow",
}

# D8/D10 — closed, no-emoji vocabulary. Severity is carried by this word
# FIRST, colour second (D10) — the text alone must always be sufficient.
LABEL_FOR_CODE = {
    "AWAITING_ANSWER": "WAITING",
    "AWAITING_PLAN_APPROVAL": "WAITING",
    "GATE_BLOCKED": "BLOCKED",
    "QUOTA_PAUSE": "QUOTA",
    "QUOTA_CRITICAL": "QUOTA",
    "MISSION_PAUSED": "PAUSED",
    "CONTEXT_HIGH": "COMPACT",
    "QUOTA_TIGHT": "QUOTA",
}

# D10 — one muted 256-colour SGR per severity, with an 8-colour fallback.
_COLOR_256 = {"red": "38;5;167", "orange": "38;5;173", "yellow": "38;5;179", "none": "38;5;108"}
_COLOR_8 = {"red": "31", "orange": "33", "yellow": "33", "none": "32"}
_RESET = "\033[0m"


# ── small shared helpers ────────────────────────────────────────────────────

def _parse_iso(raw):
    """None on anything that isn't a real timestamp. Never raises."""
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _write_json_atomic(path, data):
    """Same tmp+rename idiom as quota.py's mirror writer. Never raises —
    returns False (silently) on an unwritable dir, a read-only filesystem,
    etc. — a self-heal or artifact write is always best-effort."""
    tmp_path = None
    try:
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        tmp_path = f"{path}.tmp.{os.getpid()}"
        with open(tmp_path, "w") as f:
            json.dump(data, f)
        os.replace(tmp_path, path)
        return True
    except Exception:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        return False


def _extract_frontmatter_scalars(text, keys):
    """Minimal, dependency-free reader for a handful of scalar frontmatter
    keys (status/slug/last_active_at) — mission.py's own writer already
    quotes any value containing YAML-special characters, so a plain
    `key: value` / `key: 'value'` / `key: "value"` line covers every case
    this feature reads. Malformed or missing frontmatter -> {} (D3-style
    fail-open, never a crash)."""
    result = {}
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return result
    body = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        body.append(line)
    for key in keys:
        prefix = f"{key}:"
        for line in body:
            if line.startswith(prefix):
                val = line[len(prefix):].strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                    val = val[1:-1]
                result[key] = val
                break
    return result


def _format_age(seconds):
    """Ns/Nm/NhMm bucketing, same grammar as turn-timestamps' format_gap()
    (implemented locally rather than imported — the hostile-conditions
    sandbox never carries execution/hooks/lib/turn_timestamp.py, only this
    module and quota.py). Never suppressed: a blocker's age is always
    shown, even at 0s (unlike a turn-to-turn gap)."""
    try:
        seconds = int(seconds)
    except (TypeError, ValueError):
        seconds = 0
    if seconds < 0:
        seconds = 0
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours}h" if minutes == 0 else f"{hours}h{minutes}m"


def _colorize(text, severity, color):
    """D10 — colour is never the only carrier; color=never (or an
    unrecognised mode) always returns plain text."""
    if color == "always":
        pass
    elif color == "auto":
        if os.environ.get("NO_COLOR") or not sys.stdout.isatty():
            return text
    else:
        return text
    table = _COLOR_256 if "256color" in os.environ.get("TERM", "") else _COLOR_8
    code = table.get(severity)
    if not code:
        return text
    return f"\033[{code}m{text}{_RESET}"


# ── aggregate() — D1/D8/D9: single source of truth for ordering ───────────

def aggregate(blockers):
    """blockers: list of {"code","severity","message","since","age_seconds"}
    dicts (already-derived, e.g. from compute_live_state()/collect_all_
    blockers() or hand-built by a caller/golden). Returns the full
    athanor.blocker/v1 artifact shape: worst-severity-first, oldest-first
    within a severity (blocker_status_spec.md)."""
    safe = [b for b in (blockers or []) if isinstance(b, dict) and b.get("severity") in SEVERITY_ORDER]
    ordered = sorted(
        safe,
        key=lambda b: (-SEVERITY_ORDER.index(b.get("severity", "none")), -(b.get("age_seconds") or 0)),
    )
    if ordered:
        worst_idx = max(SEVERITY_ORDER.index(b["severity"]) for b in ordered)
        severity = SEVERITY_ORDER[worst_idx]
    else:
        severity = "none"
    return {
        "schema": SCHEMA,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "severity": severity,
        "count": len(ordered),
        "blockers": ordered,
    }


# ── D3 derivations: compute_live_state() (quota/context/gate/mission) ──────

def _gate_blocked_timestamp(scratch_dir, from_agent, to_agent, now):
    """Newest gate-blocked-*.md mtime naming this exact gate id, else "now"
    with age_seconds=0 rather than inventing a wrong number (blocker_
    status_spec.md's since/age_seconds note)."""
    target = f"Gate: {from_agent} -> {to_agent}"
    best_mtime = None
    try:
        for fname in os.listdir(scratch_dir):
            if not (fname.startswith("gate-blocked-") and fname.endswith(".md")):
                continue
            fpath = os.path.join(scratch_dir, fname)
            try:
                with open(fpath) as f:
                    content = f.read()
            except Exception:
                continue
            if target in content:
                try:
                    mtime = os.path.getmtime(fpath)
                except Exception:
                    continue
                if best_mtime is None or mtime > best_mtime:
                    best_mtime = mtime
    except Exception:
        pass
    if best_mtime is None:
        return now.isoformat(), 0
    since_dt = datetime.fromtimestamp(best_mtime, tz=timezone.utc)
    return since_dt.isoformat(), max(0, int((now - since_dt).total_seconds()))


def _gate_blocked_entries(scratch_dir, now):
    """handoff_state.json: attempts>=3 per key -> one GATE_BLOCKED entry
    each (never collapsed — each gate is a distinct block). Missing,
    unreadable, malformed (not a dict), or a key whose attempts is
    non-integer/negative -> skipped, never a crash."""
    entries = []
    path = os.path.join(scratch_dir, "handoff_state.json")
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        return entries
    if not isinstance(data, dict):
        return entries
    for key, val in data.items():
        if not isinstance(val, dict):
            continue
        attempts = val.get("attempts")
        if not isinstance(attempts, int) or isinstance(attempts, bool) or attempts < 3:
            continue
        gate_part = key.split("@", 1)[0]
        if "->" not in gate_part:
            continue
        from_agent, to_agent = gate_part.split("->", 1)
        since, age_seconds = _gate_blocked_timestamp(scratch_dir, from_agent, to_agent, now)
        message = f"gate {from_agent}->{to_agent} blocked {attempts}x, human required"
        entries.append({
            "code": "GATE_BLOCKED",
            "severity": CODE_SEVERITY["GATE_BLOCKED"],
            "message": message,
            "since": since,
            "age_seconds": age_seconds,
        })
    return entries


def _quota_entries(scratch_dir, now):
    """band comes from quota.read_status() verbatim — pause/critical/tight
    map to their codes, healthy/unknown emit nothing (fail-open, matches
    quota.py's own contract)."""
    try:
        import quota
    except Exception:
        return []
    mirror_path = os.path.join(scratch_dir, ".quota_status.json")
    try:
        status = quota.read_status(mirror_path)
    except Exception:
        return []
    band = status.get("band")
    code = {"pause": "QUOTA_PAUSE", "critical": "QUOTA_CRITICAL", "tight": "QUOTA_TIGHT"}.get(band)
    if not code:
        return []
    since_dt = _parse_iso(status.get("captured_at")) or now
    age_seconds = max(0, int((now - since_dt).total_seconds()))
    pct = status.get("used_pct")
    pct_str = f"{pct}%" if status.get("state") in ("ok", "partial") and pct is not None else None
    if code == "QUOTA_PAUSE":
        message = f"quota pause band — {pct_str} used, stop now" if pct_str else "quota pause band, stop now"
    elif code == "QUOTA_CRITICAL":
        message = f"quota critical — {pct_str} used" if pct_str else "quota critical"
    else:
        message = f"quota tight — {pct_str} used" if pct_str else "quota tight"
    return [{
        "code": code, "severity": CODE_SEVERITY[code], "message": message,
        "since": since_dt.isoformat(), "age_seconds": age_seconds,
    }]


def _context_entries(scratch_dir, now):
    """.context_status.json: present, not stale (<=900s), tokens>=threshold
    -> one CONTEXT_HIGH entry. Missing/stale/corrupt/below threshold ->
    nothing."""
    path = os.path.join(scratch_dir, ".context_status.json")
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        return []
    if not isinstance(data, dict):
        return []
    tokens = data.get("tokens")
    if not isinstance(tokens, int) or isinstance(tokens, bool) or tokens < 0:
        return []
    since_dt = _parse_iso(data.get("captured_at"))
    if since_dt is None:
        return []
    age_seconds = (now - since_dt).total_seconds()
    if age_seconds < 0 or age_seconds > CONTEXT_STALE_SECONDS:
        return []
    if tokens < CONTEXT_HIGH_THRESHOLD_TOKENS:
        return []
    message = f"context high — {tokens // 1000}k tokens, compact now"
    return [{
        "code": "CONTEXT_HIGH", "severity": CODE_SEVERITY["CONTEXT_HIGH"], "message": message,
        "since": since_dt.isoformat(), "age_seconds": int(age_seconds),
    }]


def _active_mission_info(missions_dir):
    """Read active.json + the mission file's own frontmatter. Returns
    {"slug","feature","status"} or None. Missing/corrupt -> None, never a
    crash — used both for MISSION_PAUSED derivation and the all-clear
    render's mission fact."""
    active_path = os.path.join(missions_dir, "active.json")
    try:
        with open(active_path) as f:
            active = json.load(f)
    except Exception:
        return None
    if not isinstance(active, dict):
        return None
    mission_path = active.get("mission")
    if not mission_path or not isinstance(mission_path, str):
        return None
    slug = None
    status = None
    if os.path.isfile(mission_path):
        try:
            with open(mission_path) as f:
                text = f.read()
            fm = _extract_frontmatter_scalars(text, ("slug", "status", "last_active_at"))
            slug = fm.get("slug")
            status = fm.get("status")
        except Exception:
            fm = {}
    else:
        fm = {}
    if not slug:
        slug = os.path.splitext(os.path.basename(mission_path))[0]
    checkpoint = active.get("checkpoint")
    feature = checkpoint.get("feature") if isinstance(checkpoint, dict) else None
    return {"slug": slug, "feature": feature or "", "status": status, "last_active_at": fm.get("last_active_at")}


def _mission_paused_entries(missions_dir, now):
    info = _active_mission_info(missions_dir)
    if not info or info.get("status") != "paused":
        return []
    since_dt = _parse_iso(info.get("last_active_at")) or now
    age_seconds = max(0, int((now - since_dt).total_seconds()))
    return [{
        "code": "MISSION_PAUSED", "severity": CODE_SEVERITY["MISSION_PAUSED"],
        "message": f"mission '{info['slug']}' paused",
        "since": since_dt.isoformat(), "age_seconds": age_seconds,
    }]


def compute_live_state(scratch_dir=DEFAULT_SCRATCH_DIR, missions_dir=DEFAULT_MISSIONS_DIR):
    """Pure function of on-disk files (quota/context/gate/mission) — no
    transcript access, safe to call from anywhere, anytime (D3)."""
    now = datetime.now(timezone.utc)
    entries = []
    entries.extend(_gate_blocked_entries(scratch_dir, now))
    entries.extend(_quota_entries(scratch_dir, now))
    entries.extend(_context_entries(scratch_dir, now))
    entries.extend(_mission_paused_entries(missions_dir, now))
    return entries


# ── D3/D6: transcript signal (AWAITING_ANSWER / AWAITING_PLAN_APPROVAL) ────

def _transcript_signal_path(scratch_dir):
    return os.path.join(scratch_dir, ".blocker_transcript_signal.json")


_AWAITING_CODE = {"answer": "AWAITING_ANSWER", "plan": "AWAITING_PLAN_APPROVAL"}
_AWAITING_MESSAGE = {
    "answer": "waiting on your answer to a question",
    "plan": "plan awaiting your approval",
}


def _transcript_entries(scratch_dir, now):
    """Missing, corrupt, awaiting not one of the two valid values, or past
    the 4h TTL -> no entry, and the stale/invalid file is rewritten to {}
    so it is never re-evaluated as "maybe still stale" on the next read
    (D6). A missing file is left alone — nothing to self-heal."""
    path = _transcript_signal_path(scratch_dir)
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        return []
    if not isinstance(data, dict) or not data:
        return []
    code = _AWAITING_CODE.get(data.get("awaiting"))
    since_dt = _parse_iso(data.get("since"))
    if code is not None and since_dt is not None:
        age_seconds = (now - since_dt).total_seconds()
        if 0 <= age_seconds <= TRANSCRIPT_SIGNAL_TTL_SECONDS:
            return [{
                "code": code, "severity": CODE_SEVERITY[code],
                "message": _AWAITING_MESSAGE[data["awaiting"]],
                "since": since_dt.isoformat(), "age_seconds": int(age_seconds),
            }]
    _write_json_atomic(path, {})
    return []


def record_transcript_signal(awaiting, session_id, scratch_dir=DEFAULT_SCRATCH_DIR):
    """The only writer of the transcript signal — called exclusively by
    execution/hooks/blocker_scan.sh (the Stop hook, the only site with
    transcript access). Not itself a transcript reader (D3)."""
    if awaiting not in _AWAITING_CODE:
        return False
    now = datetime.now(timezone.utc)
    data = {"session_id": session_id, "awaiting": awaiting, "since": now.isoformat()}
    return _write_json_atomic(_transcript_signal_path(scratch_dir), data)


def clear_transcript_signal(session_id, scratch_dir=DEFAULT_SCRATCH_DIR):
    """Called from inject_pressure.sh on every UserPromptSubmit (D3/D6): a
    new user prompt landing is proof the awaiting-answer/plan state just
    ended. A signal belonging to a DIFFERENT concurrent session in the
    same workspace is left untouched — never cleared by the wrong
    session."""
    path = _transcript_signal_path(scratch_dir)
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        return True  # nothing to clear
    if not isinstance(data, dict) or not data:
        return True
    if session_id and data.get("session_id") not in (None, session_id):
        return False
    return _write_json_atomic(path, {})


def collect_all_blockers(scratch_dir=DEFAULT_SCRATCH_DIR, missions_dir=DEFAULT_MISSIONS_DIR):
    """compute_live_state() merged with the transcript signal — the ONE
    aggregation path both render() modes and `status` consume (D9b)."""
    now = datetime.now(timezone.utc)
    entries = compute_live_state(scratch_dir, missions_dir)
    entries.extend(_transcript_entries(scratch_dir, now))
    return entries


# ── D8/D9/D9b/D10: reference renderer ───────────────────────────────────────

def _all_clear_text(active_mission, width):
    """severity == "none" branch: MISSION: <slug> <feature> when a mission
    is active, else STATUS: clear — never blank, never a fixed alarm
    string (D9). The slug truncates under width pressure; the feature id
    never does (it is the freshest/most specific fact)."""
    if not active_mission or not active_mission.get("slug"):
        text = "STATUS: clear"
        return text[:width] if width > 0 and len(text) > width else text
    slug = str(active_mission.get("slug", ""))
    feature = str(active_mission.get("feature", ""))
    prefix = "MISSION: "
    suffix = f" {feature}" if feature else ""
    budget = max(width - len(prefix) - len(suffix), 0)
    if len(slug) > budget:
        slug = slug[:budget]
    line = f"{prefix}{slug}{suffix}"
    if len(line) > width and width > 0:
        line = line[:width]
    return line


def _format_one(entry, width):
    """D8 truncation rule: detail (the phrase) drops first; LABEL: and the
    age suffix are the two fixed points that survive to the last
    character of budget. Hard truncation, no ellipsis, if it still
    overflows at an extreme width."""
    label = LABEL_FOR_CODE.get(entry.get("code"), str(entry.get("code") or "?"))
    age = _format_age(entry.get("age_seconds"))
    prefix = f"{label}: "
    suffix = f" {age}"
    budget = max(width - len(prefix) - len(suffix), 0)
    phrase = str(entry.get("message") or "")
    if len(phrase) > budget:
        phrase = phrase[:budget]
    line = f"{prefix}{phrase}{suffix}"
    if len(line) > width and width > 0:
        line = line[:width]
    return line


def format_compact(agg, width=DEFAULT_WIDTH, color="auto", active_mission=None):
    """The single-fragment header-slot renderer (D8) — shows blockers[0]
    (already worst-severity/oldest-first ordered by aggregate()) only,
    never a joined list."""
    blockers = agg.get("blockers") or []
    if not blockers:
        return _colorize(_all_clear_text(active_mission, width), "none", color)
    entry = blockers[0]
    return _colorize(_format_one(entry, width), entry.get("severity", "red"), color)


def format_block(agg, width=DEFAULT_WIDTH, max_rows=DEFAULT_MAX_ROWS, color="auto", active_mission=None):
    """Multi-line renderer (D9b) — one row per blocker, worst-first
    (same ordering, never re-derived), capped at max_rows with a
    '+N more' summary row when truncated. All-clear renders as the exact
    single line format_compact() would have produced."""
    blockers = agg.get("blockers") or []
    if not blockers:
        return _colorize(_all_clear_text(active_mission, width), "none", color)
    n = len(blockers)
    rows = []
    if n <= max_rows:
        for b in blockers:
            rows.append(_colorize(_format_one(b, width), b.get("severity", "red"), color))
    else:
        show = max(max_rows - 1, 0)
        for b in blockers[:show]:
            rows.append(_colorize(_format_one(b, width), b.get("severity", "red"), color))
        rows.append(f"+{n - show} more")
    return "\n".join(rows)


# ── CLI ──────────────────────────────────────────────────────────────────

def cmd_status(args):
    blockers = collect_all_blockers(args.scratch_dir, args.missions_dir)
    agg = aggregate(blockers)
    _write_json_atomic(os.path.join(args.scratch_dir, ".blocker_status.json"), agg)
    if args.json:
        print(json.dumps(agg))
    else:
        mission = _active_mission_info(args.missions_dir)
        print(format_compact(agg, active_mission=mission))
    return 0


def cmd_render(args):
    blockers = collect_all_blockers(args.scratch_dir, args.missions_dir)
    agg = aggregate(blockers)
    _write_json_atomic(os.path.join(args.scratch_dir, ".blocker_status.json"), agg)
    if args.json:
        print(json.dumps(agg))
        return 0
    mission = _active_mission_info(args.missions_dir)
    if args.block:
        print(format_block(agg, width=args.width, max_rows=args.max_rows, color=args.color, active_mission=mission))
    else:
        print(format_compact(agg, width=args.width, color=args.color, active_mission=mission))
    return 0


def cmd_record_transcript_signal(args):
    record_transcript_signal(args.awaiting, args.session_id, scratch_dir=args.scratch_dir)
    return 0


def cmd_clear_transcript_signal(args):
    clear_transcript_signal(args.session_id, scratch_dir=args.scratch_dir)
    return 0


def cmd_write_context_mirror(args):
    try:
        tokens = int(args.tokens)
    except (TypeError, ValueError):
        tokens = None
    data = {
        "tokens": tokens,
        "pct": args.pct,
        "window": args.window,
        "captured_at": datetime.now(timezone.utc).isoformat(),
    }
    _write_json_atomic(args.mirror_path, data)
    return 0


def build_arg_parser():
    parser = argparse.ArgumentParser(
        prog="blocker_status.py",
        description="Per-workspace blocker-status oracle + reference renderer.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    status_p = sub.add_parser("status", help="Emit the aggregate blocker state")
    status_p.add_argument("--json", action="store_true", help="Emit the full athanor.blocker/v1 JSON")
    status_p.add_argument("--scratch-dir", default=DEFAULT_SCRATCH_DIR)
    status_p.add_argument("--missions-dir", default=DEFAULT_MISSIONS_DIR)
    status_p.set_defaults(func=cmd_status)

    render_p = sub.add_parser("render", help="Render the reference one-line/block view")
    render_p.add_argument("--block", action="store_true", help="Multi-line view instead of the single-line compact view")
    render_p.add_argument("--width", type=int, default=DEFAULT_WIDTH, help=f"Compact/row width (default {DEFAULT_WIDTH})")
    render_p.add_argument("--max-rows", type=int, default=DEFAULT_MAX_ROWS, help=f"--block row cap (default {DEFAULT_MAX_ROWS})")
    render_p.add_argument("--color", choices=("auto", "always", "never"), default="auto")
    render_p.add_argument("--json", action="store_true", help="Emit the full athanor.blocker/v1 JSON instead of a rendered line")
    render_p.add_argument("--scratch-dir", default=DEFAULT_SCRATCH_DIR)
    render_p.add_argument("--missions-dir", default=DEFAULT_MISSIONS_DIR)
    render_p.set_defaults(func=cmd_render)

    rec_p = sub.add_parser("record-transcript-signal", help="(internal, called by blocker_scan.sh)")
    rec_p.add_argument("--awaiting", required=True, choices=("answer", "plan"))
    rec_p.add_argument("--session-id", required=True)
    rec_p.add_argument("--scratch-dir", default=DEFAULT_SCRATCH_DIR)
    rec_p.set_defaults(func=cmd_record_transcript_signal)

    clear_p = sub.add_parser("clear-transcript-signal", help="(internal, called by inject_pressure.sh)")
    clear_p.add_argument("--session-id", required=True)
    clear_p.add_argument("--scratch-dir", default=DEFAULT_SCRATCH_DIR)
    clear_p.set_defaults(func=cmd_clear_transcript_signal)

    ctx_p = sub.add_parser("write-context-mirror", help="(internal, called by inject_pressure.sh)")
    ctx_p.add_argument("--tokens", required=True)
    ctx_p.add_argument("--pct", default="?")
    ctx_p.add_argument("--window", default="?")
    ctx_p.add_argument("--mirror-path", default=os.path.join(DEFAULT_SCRATCH_DIR, ".context_status.json"))
    ctx_p.set_defaults(func=cmd_write_context_mirror)

    return parser


def main():
    parser = build_arg_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except Exception:
        # Absolute fail-safe (same hard rule as quota.py / inject_pressure.sh):
        # an unforeseen error degrades to the all-clear line, never a
        # traceback, never a non-zero exit for a caller that just wanted a
        # status line.
        try:
            if getattr(args, "json", False):
                print(json.dumps(aggregate([])))
            else:
                print(format_compact(aggregate([]), color="never"))
        except Exception:
            print("STATUS: clear")
        return 0


if __name__ == "__main__":
    sys.exit(main())

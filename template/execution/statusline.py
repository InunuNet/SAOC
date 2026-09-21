#!/usr/bin/env python3
"""Athanor statusline — one script, every project, no field it cannot support.

Layout follows the PAI reference: a titled header rule, then labelled sections
separated by horizontal rules, labels dim and values coloured.

Three sources, in priority order:

  1. **The running session.** Claude Code pipes a JSON payload on stdin every
     render — model, CLI version, context window, session cost, output style,
     workspace. That is the freshest and cheapest source there is, so it wins
     wherever it carries the field.
  2. **Machine-global shared state** (``~/.claude/MEMORY/STATE``) for data that
     is identical for every agent on this machine: quota windows, location,
     weather, model. Read-only, always — no key is added, moved or rewritten,
     so PAI and LifeOS are untouched by this script running.
  3. **The project tree**, for everything that differs per workspace: name,
     skills, workflows, hooks, branch, backlog, mission, brain sessions.

Rules that do not bend:

  * **Unknown is omitted, never guessed.** A field with no data is dropped from
     the line; a line whose fields are all dropped is dropped with its rule. A
     panel of ``?`` marks teaches the operator to stop reading it, and a stale
     number is worse than an absent one. The field reappears by itself the
     moment its source exists — no configuration, no edit.
  * **Nothing outside the project is written.** The script this replaced dumped
     debug output into a hardcoded SIBLING project's directory.
  * **No network.** A statusline renders on every turn; an HTTP round trip in
     that path is a hang waiting to happen, and all fetching here goes through
     Alembic by rule anyway.
  * **Never raise.** Every field is guarded and main() is wrapped: a statusline
     that throws leaves the operator with no panel at all.
"""
from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

WIDTH = 66
BAR_WIDTH = 46
GIT_TIMEOUT_SECONDS = 1.5
BRAIN_TIMEOUT_SECONDS = 0.5
QUOTA_STALE_AFTER_SECONDS = 30 * 60
HOURS_PER_DAY = 24

BACKLOG_ITEM_RE = re.compile(
    r"^\s*-\s*\[[ xX]\]\s*(?:\*\*|__|\*|_)?\s*(P[01])\b:?\s*(.*)$"
)

R = "\033[0m"
DIM = "\033[38;5;245m"
RULE = "\033[38;5;238m"
BLUE = "\033[38;5;111m"
CYAN = "\033[38;5;80m"
GREEN = "\033[38;5;114m"
YELLOW = "\033[38;5;179m"
RED = "\033[38;5;204m"
MAGENTA = "\033[38;5;176m"

# Global shared state. Common to every agent on this machine, maintained
# outside Athanor, and read here without ever being written.
GLOBAL_STATE = Path.home() / ".claude" / "MEMORY" / "STATE"


# ── Rendering primitives — omission is enforced here, once ────────────────────

def seg(label: str, value: str, colour: str = CYAN) -> str:
    """A labelled segment, or the empty string when there is nothing to show.

    Every field routes through here, so "unknown is omitted" is a property of
    the renderer rather than a discipline each call site has to remember.
    """
    if value is None or str(value).strip() == "":
        return ""
    return f"{DIM}{label}:{R}{colour}{value}{R}"


def join(*parts: str) -> str:
    return f" {RULE}|{R} ".join(p for p in parts if p)


def rule() -> str:
    return f"{RULE}{'─' * WIDTH}{R}"


def bar(pct: int) -> str:
    filled = max(0, min(BAR_WIDTH, round(pct * BAR_WIDTH / 100)))
    colour = RED if pct >= 80 else YELLOW if pct >= 60 else GREEN
    return f"{colour}{'◍' * filled}{R}{RULE}{'◌' * (BAR_WIDTH - filled)}{R}"


def pressure(pct: float) -> str:
    return RED if pct >= 85 else YELLOW if pct >= 60 else GREEN


# ── Source 1: the running Claude Code session ─────────────────────────────────

def read_payload() -> dict:
    """The session payload on stdin. Absent when run by hand — that is fine."""
    try:
        raw = sys.stdin.read() if not sys.stdin.isatty() else ""
        data = json.loads(raw or "{}")
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def dig(payload: dict, *path: str):
    node = payload
    for key in path:
        if not isinstance(node, dict):
            return None
        node = node.get(key)
    return node


def session_model(payload: dict) -> str:
    """Model the session is actually running, falling back to shared state."""
    name = dig(payload, "model", "display_name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return global_text("model-cache.txt")


def session_context(payload: dict) -> int | None:
    raw = dig(payload, "context_window", "used_percentage")
    return int(raw) if isinstance(raw, (int, float)) else None


def session_cost(payload: dict) -> str:
    total = dig(payload, "cost", "total_cost_usd")
    return f"${total:.3f}" if isinstance(total, (int, float)) else ""


def session_diff(payload: dict) -> str:
    """Lines this session has added and removed, when the session tracks it."""
    added = dig(payload, "cost", "total_lines_added")
    removed = dig(payload, "cost", "total_lines_removed")
    if not isinstance(added, int) or not isinstance(removed, int):
        return ""
    if added == 0 and removed == 0:
        return ""
    return f"{GREEN}+{added}{R}{DIM}/{R}{RED}-{removed}{R}"


# ── Source 2: machine-global shared state ─────────────────────────────────────

def global_json(name: str):
    try:
        return json.loads((GLOBAL_STATE / name).read_text())
    except Exception:
        return None


def global_text(name: str) -> str:
    try:
        return (GLOBAL_STATE / name).read_text().strip()
    except Exception:
        return ""


def location() -> str:
    data = global_json("location-cache.json")
    if not isinstance(data, dict):
        return ""
    city, region = data.get("city"), data.get("regionName")
    if city and region:
        return f"{city}, {region}"
    return str(city or region or "")


def weather() -> str:
    return global_text("weather-cache.json")


def quota_window(block, label: str) -> str:
    """One quota window: utilisation, plus how long until it resets."""
    if not isinstance(block, dict):
        return ""
    used = block.get("utilization")
    if not isinstance(used, (int, float)):
        return ""
    out = f"{DIM}{label}:{R}{pressure(used)}{int(used)}%{R}"
    resets = block.get("resets_at")
    if isinstance(resets, str):
        try:
            when = datetime.fromisoformat(resets.replace("Z", "+00:00")).astimezone()
            left = (when - datetime.now(when.tzinfo)).total_seconds()
            stamp = (f"{int(left // 3600):02d}:{int(left % 3600 // 60):02d}"
                     if left < HOURS_PER_DAY * 3600 else when.strftime("%a %H:%M"))
            out += f" {DIM}↻{stamp}{R}"
        except Exception:
            pass
    return out


def quota(root: Path) -> str:
    """Quota from shared state, with the project mirror as a guarded fallback.

    The mirror's writer was retired upstream, so in most workspaces it holds a
    reading days old. A stale mirror renders nothing at all rather than a
    confident percentage that happens to be wrong.
    """
    cache = global_json("usage-cache.json")
    if isinstance(cache, dict):
        live = join(quota_window(cache.get("five_hour"), "5H"),
                    quota_window(cache.get("seven_day"), "WK"))
        if live:
            return live

    data = read_json(root / ".agent" / "memory" / "scratch" / ".quota_status.json")
    if not isinstance(data, dict):
        return ""
    used = data.get("used_pct")
    if not isinstance(used, (int, float)):
        return ""
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(
            str(data.get("captured_at")).replace("Z", "+00:00"))).total_seconds()
    except Exception:
        return ""
    if age > QUOTA_STALE_AFTER_SECONDS:
        return ""
    return f"{DIM}WK:{R}{pressure(used)}{int(used)}%{R}"


# ── Source 3: the project tree ────────────────────────────────────────────────

def read_json(path: Path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def git(root: Path, *args: str) -> str:
    try:
        done = subprocess.run(["git", "-C", str(root), *args],
                              capture_output=True, text=True,
                              timeout=GIT_TIMEOUT_SECONDS)
        return done.stdout.strip() if done.returncode == 0 else ""
    except Exception:
        return ""


def project_root(payload: dict) -> Path:
    """The workspace root: the session's own idea of it, else the tree walk.

    Deploying into every project means the script cannot assume it was started
    from the root, so it walks up for the .agent marker the harness plants.
    """
    for key in ("project_dir", "current_dir"):
        told = dig(payload, "workspace", key)
        if isinstance(told, str) and told.strip():
            candidate = Path(told).expanduser()
            if candidate.is_dir():
                start = candidate.resolve()
                break
    else:
        start = Path.cwd().resolve()
    for candidate in (start, *start.parents):
        if (candidate / ".agent").is_dir():
            return candidate
    return start


def project_name(root: Path) -> str:
    profile = read_json(root / ".agent" / "profile.json") or {}
    for key in ("project_name", "harness_name"):
        value = profile.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return root.name


def count_dir(path: Path, pattern: str) -> str:
    """A count, or nothing. An absent directory is not a zero."""
    if not path.is_dir():
        return ""
    try:
        return str(len(list(path.glob(pattern))))
    except Exception:
        return ""


def hook_count(root: Path) -> str:
    settings = read_json(root / ".claude" / "settings.json")
    if not isinstance(settings, dict) or "hooks" not in settings:
        return ""
    try:
        return str(sum(len(entry.get("hooks", []))
                       for group in (settings.get("hooks") or {}).values()
                       for entry in group))
    except Exception:
        return ""


def repo(root: Path) -> tuple[str, str, str]:
    """branch, HEAD age, ahead-count — two git calls, all three optional."""
    if not (root / ".git").exists():
        return "", "", ""
    head = git(root, "log", "-1", "--format=%cr")
    status = git(root, "status", "-sb", "--porcelain=v1")
    branch, ahead = "", ""
    if status:
        first = status.splitlines()[0]
        found = re.match(r"## ([^.\s]+)", first)
        if found:
            branch = found.group(1)
        counted = re.search(r"ahead (\d+)", first)
        if counted:
            ahead = counted.group(1)
    age = ""
    if head:
        age = head.replace(" ago", "")
        for long, short in ((" minutes", "m"), (" minute", "m"),
                            (" hours", "h"), (" hour", "h"),
                            (" days", "d"), (" day", "d"),
                            (" weeks", "w"), (" week", "w"),
                            (" months", "mo"), (" month", "mo")):
            age = age.replace(long, short)
    return branch, age, ahead


def p0_count(root: Path) -> str:
    try:
        text = (root / ".agent" / "memory" / "project" / "backlog.md").read_text()
    except Exception:
        return ""
    return str(sum(1 for line in text.splitlines() if BACKLOG_ITEM_RE.match(line)))


def brain_sessions(root: Path) -> str:
    db = root / ".agent" / "memory" / "brain" / "chroma.sqlite3"
    if not db.is_file():
        return ""
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro&immutable=1", uri=True,
                              timeout=BRAIN_TIMEOUT_SECONDS)
        try:
            row = con.execute("SELECT COUNT(*) FROM embeddings").fetchone()
            return str(row[0]) if row else ""
        finally:
            con.close()
    except Exception:
        return ""


def mission(root: Path) -> tuple[str, bool]:
    active = read_json(
        root / ".agent" / "memory" / "project" / "missions" / "active.json")
    if not isinstance(active, dict) or not active.get("mission"):
        return "", False
    slug = Path(str(active["mission"])).stem
    undecided = not active.get("autonomy")
    try:
        text = (root / str(active["mission"])).read_text()
    except Exception:
        return slug, undecided
    block = re.search(r"^features:\s*$(.*?)(?=^[A-Za-z_][\w-]*:|\Z)",
                      text, re.M | re.S)
    scope = block.group(1) if block else ""
    total = len(re.findall(r"^\s*-\s+id:\s*F\d+", scope, re.M))
    done = len(re.findall(r"^\s*status:\s*done\s*$", scope, re.M))
    return (f"{slug} {done}/{total}" if total else slug), undecided


# ── Panel ─────────────────────────────────────────────────────────────────────

def header(title: str) -> str:
    dashes = max(WIDTH - len(title) - 6, 0)
    return f'{RULE}— |{R} {BLUE}{title}{R} {RULE}| {"─" * dashes}{R}'


def build(payload: dict, root: Path) -> list[str]:
    """Assemble the panel, dropping every line that has nothing to say."""
    name = project_name(root)
    branch, age, ahead = repo(root)
    mission_name, undecided = mission(root)
    pct = session_context(payload)

    lines: list[str] = []

    env = join(
        seg("CC", str(payload.get("version") or "")),
        seg("Model", session_model(payload)),
        seg("Style", str(dig(payload, "output_style", "name") or "")),
        seg("SK", count_dir(root / ".claude" / "skills", "*")),
        seg("WF", count_dir(root / ".agent" / "workflows", "*.md")),
        seg("Hooks", hook_count(root)),
    )
    if env:
        lines.append(f'{DIM}ENV:{R} {env}')

    if pct is not None:
        lines.append(f'{BLUE}◉{R} {DIM}CONTEXT:{R} {bar(pct)} '
                     f'{pressure(pct)}{pct}%{R}')

    used = join(quota(root), seg("S", session_cost(payload)))
    if used:
        lines.append(f'{YELLOW}▰{R} {DIM}USED:{R} {used}')

    where = join(
        f"{CYAN}{name}{R}" if name else "",
        seg("Branch", branch, MAGENTA),
        seg("Age", age),
        seg("Sync", f"↑{ahead}" if ahead else ""),
        session_diff(payload),
    )
    if where:
        lines.append(f'{MAGENTA}◈{R} {DIM}PWD:{R} {where}')

    p0 = p0_count(root)
    memory = join(
        seg("Sessions", brain_sessions(root)),
        seg("P0", p0, RED if p0 not in ("", "0") else GREEN),
        seg("Mission", mission_name),
    )
    if memory:
        warn = f' {RED}⚠ autonomy undecided{R}' if undecided else ""
        lines.append(f'{GREEN}◎{R} {DIM}MEMORY:{R} {memory}{warn}')

    local = join(
        f"{CYAN}{location()}{R}" if location() else "",
        f"{YELLOW}{weather()}{R}" if weather() else "",
        f"{CYAN}{datetime.now().strftime('%H:%M')}{R}",
    )
    if local:
        lines.append(f'{CYAN}◐{R} {DIM}LOCAL:{R} {local}')

    if not lines:
        return []
    panel = [header(f"{name.upper()} STATUSLINE" if name else "STATUSLINE")]
    for index, line in enumerate(lines):
        if index:
            panel.append(rule())
        panel.append(line)
    return panel


def main() -> int:
    payload = read_payload()
    panel = build(payload, project_root(payload))
    if panel:
        print("\n".join(panel))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 — never take the session down
        print(f"statusline unavailable ({type(exc).__name__})", file=sys.stderr)
        sys.exit(0)

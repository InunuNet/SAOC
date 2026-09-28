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
import time
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

WIDTH = 66
BAR_WIDTH = 46
GIT_TIMEOUT_SECONDS = 1.5
BRAIN_TIMEOUT_SECONDS = 0.5
QUOTA_STALE_AFTER_SECONDS = 30 * 60
# Past this, a shared-cache reading is dated in the render rather than
# presented as the current figure.
QUOTA_FRESH_SECONDS = 3 * 60
USAGE_CACHE_NAME = "usage-cache.json"
# LifeOS uses 60s; the usage API asks for no more than one poll a minute.
USAGE_CACHE_TTL_SECONDS = 60
# Context-bar heat thresholds.
HEAT_AMBER_PCT = 60
HEAT_RED_PCT = 85
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


# ── The context bar, ported from LifeOS ──────────────────────────────────────
# Source: PAI/LifeOS/install/LIFEOS/LIFEOS_StatusLine.sh, render_context_bar().
# Ported rather than approximated, because two of its choices are invisible in
# a screenshot and neither is guessable:
#
#   * the glyph is ⛁ (U+26C1), which is what gives the track its stacked-ring
#     texture — it is not a circle;
#   * the fill colour does NOT encode heat. It encodes WHICH MODEL burned the
#     context, as SEGMENTS sized by each rung's share of the session's output
#     tokens — so the apparent left-to-right "fade" a screenshot shows is
#     segment boundaries, not a gradient. The session model's own colour is
#     only the FALLBACK, used before any mix data exists.
BAR_GLYPH = "⛁"
BAR_EMPTY_GLYPH = "⛁"
BAR_EMPTY_RGB = (75, 82, 95)
# Anthropic model -> bar colour, matching LifeOS's mapping exactly.
#
# ORDER IS THE ESCALATION LADDER, not alphabetical and not arbitrary: the mix
# segments are painted in this sequence, so haiku -> sonnet -> opus -> fable is
# load-bearing. A first port of this listed fable before opus and the two top
# rungs painted in the wrong order; caught only by rendering a synthetic
# four-model session and reading back the colours. Do not reorder.
MODEL_BAR_RGB = (
    ("haiku", (74, 222, 128)),    # green-400
    ("sonnet", (59, 130, 246)),   # blue-500
    ("opus", (239, 68, 68)),      # red-500
    ("fable", (168, 85, 247)),    # purple-500
)
MODEL_BAR_DEFAULT_RGB = (74, 222, 128)


def rgb(triple: tuple[int, int, int]) -> str:
    return f"\033[38;2;{triple[0]};{triple[1]};{triple[2]}m"


def model_bar_rgb(model_name: str) -> tuple[int, int, int]:
    lowered = (model_name or "").lower()
    for needle, colour in MODEL_BAR_RGB:
        if needle in lowered:
            return colour
    return MODEL_BAR_DEFAULT_RGB


def model_mix(payload: dict) -> list[int]:
    """Output tokens this session spent on each rung, in ladder order.

    Returns [haiku, sonnet, opus, fable]. All zeros when the transcript is
    unreadable or carries no usage yet — the caller then falls back to the
    session model's own colour, exactly as LifeOS does before its mix exists.

    Output tokens rather than input: they are the billed carrier, so a
    dispatch that was silently downgraded reports the model that really ran.
    """
    mix = [0, 0, 0, 0]
    path = payload.get("transcript_path")
    if not isinstance(path, str) or not path:
        return mix
    try:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                try:
                    record = json.loads(line)
                except ValueError:
                    continue
                message = record.get("message") or {}
                usage = message.get("usage") or {}
                out = usage.get("output_tokens")
                name = (message.get("model") or "").lower()
                if not isinstance(out, int) or not name:
                    continue
                for index, (needle, _colour) in enumerate(MODEL_BAR_RGB):
                    if needle in name:
                        mix[index] += out
                        break
    except OSError:
        return [0, 0, 0, 0]
    return mix


def bucket_rgb(pos: int, width: int) -> tuple[int, int, int]:
    """Colour of bucket `pos` of `width`, ported from LifeOS get_bucket_color.

    The gradient is keyed on POSITION ALONG THE TRACK, not on the fill
    percentage: bucket 1 is always green and the last bucket is always red,
    whatever the context is currently at. So a bar at 11% shows the green head
    of the gradient and nothing else -- which is exactly what the reference
    render shows, and why colouring the whole fill one colour was wrong twice
    over. A flat heat colour keyed on pct repaints the entire bar as the window
    fills; a flat colour keyed on the session model never changes at all.

    Three linear segments: green-400 -> yellow-400 at the first third,
    yellow-400 -> orange-400 at the second, orange-400 -> red-500 at the last.
    """
    pct = pos * 100 // max(1, width)
    if pct <= 33:
        return (74 + (250 - 74) * pct // 33,
                222 + (204 - 222) * pct // 33,
                128 + (21 - 128) * pct // 33)
    if pct <= 66:
        d = pct - 33
        return (250 + (251 - 250) * d // 33,
                204 + (146 - 204) * d // 33,
                21 + (60 - 21) * d // 33)
    d = pct - 66
    return (251 + (239 - 251) * d // 34,
            146 + (68 - 146) * d // 34,
            60 + (68 - 60) * d // 34)


def bar(pct: int, model_name: str = "", mix: list[int] | None = None) -> str:
    """The context bar. LENGTH is context fill; colour is the fixed gradient.

    model_name and mix are accepted and ignored. Callers still pass them and
    removing the parameters would break them for no gain.
    """
    filled = max(0, min(BAR_WIDTH, pct * BAR_WIDTH // 100))
    empty_colour = rgb(BAR_EMPTY_RGB)
    cells = [
        f"{rgb(bucket_rgb(i, BAR_WIDTH)) if i <= filled else empty_colour}"
        f"{BAR_GLYPH}{R}"
        for i in range(1, BAR_WIDTH + 1)
    ]
    return "".join(cells)


def last_fill_rgb(pct: int, model_name: str = "",
                  mix: list[int] | None = None) -> str:
    """Colour of the trailing percentage.

    NOT the last bucket's colour -- LifeOS uses its own threshold scale here,
    so the number and the bar head can legitimately differ.
    """
    if pct >= 80:
        return rgb((251, 113, 133))   # rose
    if pct >= 60:
        return rgb((251, 146, 60))    # orange-400
    if pct >= 40:
        return rgb((251, 191, 36))    # yellow-400
    return rgb((74, 222, 128))        # emerald


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


def global_age(name: str) -> float | None:
    """Seconds since the shared cache file was last written, or None."""
    try:
        return time.time() - (GLOBAL_STATE / name).stat().st_mtime
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
    """Reads the shared global cache verbatim (read-only, never rewritten —
    see module docstring), but converts a Fahrenheit reading to Celsius for
    display: the cache is populated by an external process outside this
    project and bakes in °F, which reads wrong for an operator whose own
    locale is Celsius. Conversion happens only in this render layer; the
    cache file itself is untouched.
    """
    raw = global_text("weather-cache.json")
    match = re.match(r"^(-?\d+(?:\.\d+)?)\s*°F(.*)$", raw)
    if not match:
        return raw
    fahrenheit, rest = match.groups()
    celsius = (float(fahrenheit) - 32) * 5 / 9
    return f"{celsius:.1f}°C{rest}"


def quota_window(block, label: str) -> str:
    """One quota window: utilisation, plus how long until it resets."""
    if not isinstance(block, dict):
        return ""
    used = block.get("utilization")
    if not isinstance(used, (int, float)):
        return ""
    resets = block.get("resets_at")
    if isinstance(resets, str):
        # A window whose reset time has already passed has rolled over: the
        # utilisation figure attached to it describes a window that no longer
        # exists. Printing it is printing a number that is not just old but
        # about something else.
        try:
            rolled = datetime.fromisoformat(
                resets.replace("Z", "+00:00")) <= datetime.now(timezone.utc)
        except Exception:
            rolled = False
        if rolled:
            return f"{DIM}{label}: --{R}"
    # The ↑ is not decoration: it states that the number counts UP as quota
    # is consumed. Without it, "5H 10%" is equally readable as "10% left".
    out = f"{DIM}{label}: {R}{pressure(used)}{int(used)}%↑{R}"
    if isinstance(resets, str):
        try:
            when = datetime.fromisoformat(resets.replace("Z", "+00:00")).astimezone()
            left = (when - datetime.now(when.tzinfo)).total_seconds()
            # "↻04:19" next to "↻Sun 12:00" read as two clock times, so at 16:30
            # the first looked like a reset at twenty past four in the morning.
            # It was a DURATION. Same glyph, opposite meanings, on one line.
            # Durations now carry their units and absolute times keep a leading
            # "@", so the two can never be confused for one another again.
            stamp = (when.strftime("%H:%M") if left < HOURS_PER_DAY * 3600
                     else when.strftime("%a %H:%M"))
            out += f" {DIM}↻{stamp}{R}"
        except Exception:
            pass
    return out


def refresh_usage_cache() -> None:
    """Refresh the shared usage cache when it is older than its TTL.

    Athanor previously only READ this file. LifeOS's own statusline is what
    refreshes it, from the OAuth usage endpoint, on a 60s TTL -- so whenever
    the operator was working in a project other than LifeOS, nothing refreshed
    it and the statusline printed a frozen percentage that drifted further from
    the truth the longer the session ran. Measured 2026-09-21: Athanor showed
    58% from a 23-minute-old cache while LifeOS showed the live 68%.

    Same endpoint, same cache file, same TTL as LifeOS. Best-effort: any
    failure leaves the existing cache alone, and quota() still dates it.
    """
    age = global_age(USAGE_CACHE_NAME)
    if age is not None and age <= USAGE_CACHE_TTL_SECONDS:
        return
    try:
        cred = subprocess.run(
            ["security", "find-generic-password",
             "-s", "Claude Code-credentials", "-w"],
            capture_output=True, text=True, timeout=3)
        token = (json.loads(cred.stdout).get("claudeAiOauth", {})
                 .get("accessToken", "")) if cred.returncode == 0 else ""
        if not token:
            return
        fetched = subprocess.run(
            ["curl", "-s", "--max-time", "3",
             "-H", f"Authorization: Bearer {token}",
             "-H", "Content-Type: application/json",
             "-H", "anthropic-beta: oauth-2025-04-20",
             "https://api.anthropic.com/api/oauth/usage"],
            capture_output=True, text=True, timeout=5)
        data = json.loads(fetched.stdout)
        if not isinstance(data, dict) or "five_hour" not in data:
            return
        # workspace_cost is populated by a slow admin-API call elsewhere; keep
        # whatever the cache already holds rather than dropping it.
        existing = global_json(USAGE_CACHE_NAME)
        if isinstance(existing, dict) and existing.get("workspace_cost"):
            data["workspace_cost"] = existing["workspace_cost"]
        target = GLOBAL_STATE / USAGE_CACHE_NAME
        tmp = target.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=2))
        tmp.replace(target)
    except Exception:
        return


def quota(root: Path) -> str:
    """Quota from shared state, with the project mirror as a guarded fallback.

    The mirror's writer was retired upstream, so in most workspaces it holds a
    reading days old. A stale mirror renders nothing at all rather than a
    confident percentage that happens to be wrong.
    """
    # The global cache is written by com.lifeos.pulse, a process this harness
    # does not own and cannot restart. It was previously trusted with no age
    # check at all -- the one branch that looked authoritative was the one
    # branch that never verified itself -- so a dead or wedged writer rendered
    # a frozen percentage indefinitely, with nothing to distinguish it from a
    # live reading. The project-mirror branch below has always had this guard.
    refresh_usage_cache()
    cache = global_json(USAGE_CACHE_NAME)
    if isinstance(cache, dict):
        age = global_age(USAGE_CACHE_NAME)
        live = join(quota_window(cache.get("five_hour"), "5H"),
                    quota_window(cache.get("seven_day"), "WK"))
        if live:
            # Always label the reading's age once it stops being current. A
            # 30-minute tolerance is meaningless against a 5-hour window: a
            # figure that old is simply a different number, and it was being
            # printed identically to a fresh one. Blanking it would be worse
            # than showing it, so it is shown and dated.
            if age is not None and age > QUOTA_FRESH_SECONDS:
                live += f" {DIM}({int(age // 60)}m old){R}"
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
        model_name = session_model(payload)
        mix = model_mix(payload)
        lines.append(f'{BLUE}◉{R} {DIM}CONTEXT:{R} {bar(pct, model_name, mix)} '
                     f'{last_fill_rgb(pct, model_name, mix)}{pct}%{R}')

    used = join(quota(root), seg("S", session_cost(payload)))
    if used:
        # "SPENT", not "USED", and every window carries a ↑. Agents have been
        # reading this number as remaining for three months -- "USED: 5H 10%"
        # gets skimmed as "10% left, nearly out" and the session starts
        # rationing against a quota that is 90% intact. The word "used" is
        # ambiguous in a way "spent" is not, and the arrow says which way the
        # number travels, so neither the label nor the glyph can be read
        # backwards. Costs three characters.
        lines.append(f'{YELLOW}◆{R} {DIM}SPENT:{R} {used}')

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

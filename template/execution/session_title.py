#!/usr/bin/env python3
"""SessionStart hook: title each session "<Project> · <mission>".

Claude Code names a session after its first prompt, so every session booted by
this harness read "Boot workspace and report status" in the session list. The
hook prints hookSpecificOutput.sessionTitle for startup/resume/fork sources so
the list says which project and mission a session belongs to.

Never breaks boot: exits 0 and stays silent on any failure.
"""
import json
import os
import re
import sys
from pathlib import Path

TITLE_SOURCES = frozenset({"startup", "resume", "fork"})
MAX_TITLE_LEN = 40
ELLIPSIS = "…"
SEPARATOR = " · "
IDLE_TAG = "idle"
PROFILE_REL = ".agent/profile.json"
ACTIVE_REL = ".agent/memory/project/missions/active.json"
DATE_PREFIX = re.compile(r"^\d{4}-\d{2}-\d{2}-")


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def project_name(root):
    try:
        name = read_json(root / PROFILE_REL).get("project_name")
    except (OSError, ValueError, AttributeError):
        name = None
    return name if isinstance(name, str) and name.strip() else root.name


def mission_tag(root):
    try:
        mission = read_json(root / ACTIVE_REL).get("mission")
    except (OSError, ValueError, AttributeError):
        return IDLE_TAG
    if not isinstance(mission, str) or not mission.strip():
        return IDLE_TAG
    base = mission.replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
    if base.endswith(".md"):
        base = base[: -len(".md")]
    return DATE_PREFIX.sub("", base) or IDLE_TAG


def clean(text):
    one_line = "".join(c if c.isprintable() else " " for c in text)
    return " ".join(one_line.split())


def build_title(root):
    title = clean(project_name(root) + SEPARATOR + clean(mission_tag(root)))
    if len(title) > MAX_TITLE_LEN:
        title = title[: MAX_TITLE_LEN - len(ELLIPSIS)].rstrip() + ELLIPSIS
    return title


def main():
    event = json.loads(sys.stdin.read())
    if not isinstance(event, dict) or event.get("source") not in TITLE_SOURCES:
        return
    cwd = event.get("cwd")
    root = Path(cwd) if isinstance(cwd, str) and cwd else Path.cwd()
    out = {"hookSpecificOutput": {"hookEventName": "SessionStart",
                                  "sessionTitle": build_title(root)}}
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.flush()


def silence_stdout():
    """Point fd 1 at /dev/null so the interpreter's shutdown flush cannot fail."""
    devnull = os.open(os.devnull, os.O_WRONLY)
    os.dup2(devnull, sys.stdout.fileno())
    os.close(devnull)


if __name__ == "__main__":
    try:
        main()
    except (BrokenPipeError, OSError):
        try:
            silence_stdout()
        except Exception:  # noqa: BLE001
            pass
    except Exception:  # noqa: BLE001 - a title hook must never break boot
        pass
    sys.exit(0)

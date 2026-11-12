#!/usr/bin/env python3
"""Measure the context that loads every turn and force a triage on every 7th mission close-out.

Usage:
    context_audit.py report [--json] [--strict] [--root DIR]
    context_audit.py tick [--root DIR]
    context_audit.py done [--root DIR]
    context_audit.py archive FILE (--done | --section HEADING) [--root DIR]

report measures each session-start source (CLAUDE.md, rules without `paths:` frontmatter,
the boot hook's stdout; 3000 tokens in all) and the other per-turn sources against their
budgets (tokens = (bytes + 3) // 4); a missing source is skipped. tick counts one close-out in .agent/memory/project/context_triage.json and, on
every 7th, writes .agent/memory/scratch/CONTEXT_TRIAGE_DUE and prints the over-budget sources.
done clears the marker and records today as the last triage. archive moves finished items or one
heading section out of a file under .agent/memory/ into .agent/memory/archive/<stem>-<date>.md;
nothing is ever deleted. tick and done return 0 on every path, so a close-out never fails on them.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
_EXEC_DIR = os.path.dirname(os.path.abspath(__file__))
if _EXEC_DIR not in sys.path:
    sys.path.insert(0, _EXEC_DIR)
from bash_exe import bash_exe  # noqa: E402  Windows: Git Bash, never System32 WSL

TRIAGE_EVERY = 7
CHARS_PER_TOKEN = 4
LEARNED_ARCHIVE_BYTES = 400 * 1024
BOOT_HOOK_REL = Path("execution") / "hooks" / "full_boot.sh"
BOOT_TIMEOUT_SECONDS = 120
TOTAL_BUDGET = 3000
SOURCES = (
    ("CLAUDE.md", ("CLAUDE.md",), 2000),
    ("rules", (".claude/rules/**/*.md",), None),
    ("boot panel", (), 300),
    ("identity", (".agent/identity/*.md",), 500),
    ("skills", (".agent/skills/*.md",), 2500),
    ("agents", (".agent/agents/*.md",), 1500),
)
SESSION_START = frozenset(("CLAUDE.md", "rules", "boot panel"))
DESCRIPTION_SOURCES = frozenset(("skills", "agents"))
FOLDED_MARKERS = frozenset((">", "|", ">-", "|-", ">+", "|+", ""))
MEMORY_REL = Path(".agent") / "memory"
COUNTER_REL = MEMORY_REL / "project" / "context_triage.json"
MARKER_REL = MEMORY_REL / "scratch" / "CONTEXT_TRIAGE_DUE"
DONE_PREFIX = "- [x]"
HEADING = re.compile(r"^(#+)\s")
FENCE = "```"
TRIAGE_INSTRUCTIONS = (
    "Maintainer triage: bring each over-budget source under its budget by archiving, never "
    "deleting:\n"
    "  python3 execution/context_audit.py archive FILE --done        (finished '- [x]' items)\n"
    "  python3 execution/context_audit.py archive FILE --section '## Heading'\n"
    "Trim CLAUDE.md, rules and skills by moving detail into docs/ and linking it. learned.md is "
    "not per-turn: archive it only when over %d KB. Then run:\n"
    "  python3 execution/context_audit.py done\n" % (LEARNED_ARCHIVE_BYTES // 1024)
)


def tokens_for(size: int) -> int:
    return (size + CHARS_PER_TOKEN - 1) // CHARS_PER_TOKEN


def frontmatter_description(text: str) -> str:
    """The `description:` value of a markdown file's frontmatter, folded lines included."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return ""
    value, collecting = [], False
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if collecting:
            if line[:1] in (" ", "\t"):
                value.append(line.strip())
                continue
            break
        if line.startswith("description:"):
            first = line[len("description:"):].strip()
            collecting = True
            if first not in FOLDED_MARKERS:
                value.append(first)
    return " ".join(value)


def has_paths_frontmatter(text: str) -> bool:
    """True when the frontmatter carries a `paths:` key, so the file loads only on a match."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return False
    for line in lines[1:]:
        if line.strip() == "---":
            return False
        if re.match(r"paths\s*:", line):
            return True
    return False


def boot_panel_bytes(root: Path) -> int | None:
    """Bytes the SessionStart boot hook prints, or None when the project has no such hook."""
    hook = root / BOOT_HOOK_REL
    if not hook.is_file():
        return None
    try:
        out = subprocess.run([bash_exe(), str(BOOT_HOOK_REL)], cwd=root, capture_output=True,
                             timeout=BOOT_TIMEOUT_SECONDS)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print("context_audit: boot hook failed: %s" % exc, file=sys.stderr)
        return None
    return len(out.stdout)


def source_bytes(root: Path, name: str, patterns) -> int | None:
    """Bytes a source contributes per turn, or None when it has no file at all."""
    if name == "boot panel":
        return boot_panel_bytes(root)
    files = sorted(p for pat in patterns for p in root.glob(pat) if p.is_file())
    if name == "rules":
        files = [p for p in files
                 if not has_paths_frontmatter(p.read_text(encoding="utf-8", errors="replace"))]
    if not files:
        return None
    total = 0
    for path in files:
        if name in DESCRIPTION_SOURCES:
            text = path.read_text(encoding="utf-8", errors="replace")
            total += len(frontmatter_description(text).encode("utf-8"))
        else:
            total += path.stat().st_size
    return total


def measure(root: Path) -> dict:
    rows = []
    for name, patterns, budget in SOURCES:
        size = source_bytes(root, name, patterns)
        if size is None:
            continue
        tokens = tokens_for(size)
        rows.append({"name": name, "bytes": size, "tokens": tokens, "budget": budget,
                     "over": budget is not None and tokens > budget})
    start = sum(r["tokens"] for r in rows if r["name"] in SESSION_START)
    over = [r["name"] for r in rows if r["over"]]
    if start > TOTAL_BUDGET:
        over.append("session start")
    return {"sources": rows, "session_start_tokens": start, "session_start_budget": TOTAL_BUDGET,
            "total_tokens": sum(r["tokens"] for r in rows), "over": over}


def over_lines(data: dict) -> list[str]:
    lines = ["%s: %d tokens (budget %d)" % (r["name"], r["tokens"], r["budget"])
             for r in data["sources"] if r["over"]]
    if data["session_start_tokens"] > data["session_start_budget"]:
        lines.append("session start: %d tokens (budget %d)"
                     % (data["session_start_tokens"], data["session_start_budget"]))
    return lines


def cmd_report(args) -> int:
    data = measure(args.root)
    if args.json:
        print(json.dumps(data))
    else:
        for r in data["sources"]:
            flag = "OVER" if r["over"] else "ok"
            budget = "-" if r["budget"] is None else r["budget"]
            print("%-12s %8d bytes %7d / %-5s tokens  %s"
                  % (r["name"], r["bytes"], r["tokens"], budget, flag))
        flag = "OVER" if "session start" in data["over"] else "ok"
        print("%-12s %8s       %7d / %-5d tokens  %s" % (
            "session start", "", data["session_start_tokens"], data["session_start_budget"], flag))
    return 1 if args.strict and data["over"] else 0


def write_no_follow(path: Path, text: str) -> bool:
    """Write text unless path is a symlink; False when refused."""
    if path.is_symlink():
        print("context_audit: refusing to write through symlink %s" % path, file=sys.stderr)
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0), 0o644)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(text)
    return True


def load_counter(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("closeouts"), int):
            return {"closeouts": data["closeouts"], "last_triage": data.get("last_triage")}
    except (OSError, ValueError):
        pass
    return {"closeouts": 0, "last_triage": None}


def cmd_tick(args) -> int:
    counter_path = args.root / COUNTER_REL
    state = load_counter(counter_path)
    state["closeouts"] += 1
    try:
        write_no_follow(counter_path, json.dumps(state) + "\n")
        if state["closeouts"] % TRIAGE_EVERY:
            return 0
        over = over_lines(measure(args.root))
        body = "CONTEXT TRIAGE DUE after %d close-outs\n\nOver budget:\n%s\n\n%s" % (
            state["closeouts"], "\n".join("- " + line for line in over) or "- none", TRIAGE_INSTRUCTIONS)
        write_no_follow(args.root / MARKER_REL, body)
        print("CONTEXT TRIAGE DUE: %d close-outs; over budget: %s"
              % (state["closeouts"], "; ".join(over) or "none"))
        print("See %s" % MARKER_REL)
    except OSError as exc:
        print("context_audit: tick failed: %s" % exc, file=sys.stderr)
    return 0


def cmd_done(args) -> int:
    counter_path = args.root / COUNTER_REL
    state = load_counter(counter_path)
    state["last_triage"] = date.today().isoformat()
    try:
        (args.root / MARKER_REL).unlink(missing_ok=True)
        write_no_follow(counter_path, json.dumps(state) + "\n")
    except OSError as exc:
        print("context_audit: done failed: %s" % exc, file=sys.stderr)
    return 0


def split_done(lines: list[str]) -> tuple[list[str], list[str]]:
    kept = [ln for ln in lines if not ln.startswith(DONE_PREFIX)]
    moved = [ln for ln in lines if ln.startswith(DONE_PREFIX)]
    return kept, moved


def split_section(lines: list[str], heading: str) -> tuple[list[str], list[str]]:
    """Separate the first line equal to heading and its body up to the next heading of the same
    or a higher level; headings inside code fences do not count."""
    wanted = heading.strip()
    match = HEADING.match(wanted + " ")
    if not match:
        raise ValueError("not a markdown heading: %r" % heading)
    level = len(match.group(1))
    start, end, in_fence = None, len(lines), False
    for i, line in enumerate(lines):
        if line.lstrip().startswith(FENCE):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if start is None:
            if line.strip() == wanted:
                start = i
            continue
        found = HEADING.match(line)
        if found and len(found.group(1)) <= level:
            end = i
            break
    if start is None:
        return lines, []
    return lines[:start] + lines[end:], lines[start:end]


def cmd_archive(args) -> int:
    root = args.root.resolve()
    memory = (root / MEMORY_REL).resolve()
    target = Path(args.file)
    if not target.is_absolute():
        target = root / target
    if target.is_symlink() or not target.is_file():
        print("context_audit: not a regular file: %s" % args.file, file=sys.stderr)
        return 2
    target = target.resolve()
    if memory not in target.parents:
        print("context_audit: %s is outside %s" % (args.file, MEMORY_REL), file=sys.stderr)
        return 2
    lines = target.read_text(encoding="utf-8").splitlines(keepends=True)
    try:
        kept, moved = split_done(lines) if args.done else split_section(lines, args.section)
    except ValueError as exc:
        print("context_audit: %s" % exc, file=sys.stderr)
        return 2
    if not moved:
        print("context_audit: nothing to archive in %s" % target.name)
        return 0
    archive = memory / "archive" / ("%s-%s.md" % (target.stem, date.today().strftime("%Y%m%d")))
    archive.parent.mkdir(parents=True, exist_ok=True)
    header = "" if archive.exists() else "# Archived from %s\n\n" % target.relative_to(root)
    tail = "" if not moved[-1] or moved[-1].endswith("\n") else "\n"
    with archive.open("a", encoding="utf-8") as handle:
        handle.write(header + "".join(moved) + tail)
    target.write_text("".join(kept), encoding="utf-8")
    print("archived %d line(s) from %s to %s" % (len(moved), target.name, archive.relative_to(root)))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    def add(name, handler, **kwargs):
        cmd = sub.add_parser(name, **kwargs)
        cmd.add_argument("--root", type=Path, default=Path.cwd())
        cmd.set_defaults(handler=handler)
        return cmd

    report = add("report", cmd_report, help="measure per-turn sources against budgets")
    report.add_argument("--json", action="store_true")
    report.add_argument("--strict", action="store_true", help="exit 1 when any source is over")
    add("tick", cmd_tick, help="count one mission close-out")
    add("done", cmd_done, help="clear the triage marker")
    archive = add("archive", cmd_archive, help="move finished items or a section to the archive")
    archive.add_argument("file")
    mode = archive.add_mutually_exclusive_group(required=True)
    mode.add_argument("--done", action="store_true", help="move every '- [x]' line")
    mode.add_argument("--section", metavar="HEADING", help="move a heading and its body")
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    args.root = args.root.resolve()
    return args.handler(args)


if __name__ == "__main__":
    sys.exit(main())

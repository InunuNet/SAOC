#!/usr/bin/env python3
"""Archive closed [x] backlog items to brain, remove them, and cap open items at 20."""

import os
import re
import sys
import subprocess
from datetime import date
from pathlib import Path

MAX_OPEN = 20
MAX_ITEM_LEN = 280
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKLOG_PATH = Path(os.environ.get("BACKLOG_TRIM_PATH", str(REPO_ROOT / ".agent" / "memory" / "project" / "backlog.md")))
DATA_DIR = REPO_ROOT / ".agent" / "memory" / "project" / "data"
if os.environ.get("BACKLOG_TRIM_DATA_DIR"):
    DATA_DIR = Path(os.environ["BACKLOG_TRIM_DATA_DIR"])
BRAIN_PY = SCRIPT_DIR / "brain.py"


def archive_to_brain(line_text: str) -> None:
    summary = line_text.lstrip("- ").rstrip()
    subprocess.run(
        [
            sys.executable,
            str(BRAIN_PY),
            "remember",
            "--summary", f"BACKLOG ARCHIVE: {summary}",
            "--tags", "backlog,archive",
            "--source", "backlog-autotrim",
        ],
        check=True,
    )


def update_last_compacted(lines: list[str], today: str) -> list[str]:
    new_header = f"_Last compacted: {today} by backlog_trim.py. Full history: git log on this file._"
    pattern = re.compile(r"^_Last compacted:")
    for i, line in enumerate(lines):
        if pattern.match(line):
            lines[i] = new_header + "\n"
            return lines
    # Insert as the third non-blank line if no header found
    insert_after = -1
    non_blank_count = 0
    for i, line in enumerate(lines):
        if line.strip():
            non_blank_count += 1
            if non_blank_count == 3:
                insert_after = i
                break
    lines.insert(insert_after + 1, new_header + "\n")
    return lines


def needs_extraction(line: str) -> bool:
    """True if this open item exceeds MAX_ITEM_LEN and doesn't already have a sidecar pointer."""
    if not re.match(r"^- \[ \]", line):
        return False
    if len(line.rstrip("\n")) <= MAX_ITEM_LEN:
        return False
    if "](data/" in line and ".md)" in line:
        return False  # already trimmed
    return True


def extract_sidecar(line: str) -> str:
    """Replace an over-length open item with a pointer; write sidecar. Return the replacement line."""
    body = re.sub(r"^- \[ \] ", "", line.rstrip("\n"))
    slug = re.sub(r"[^a-z0-9]+", "-", body.lower()).strip("-")[:40].rstrip("-")
    sidecar_path = DATA_DIR / f"{slug}.md"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    sidecar_path.write_text(f"# {slug}\n\n{body}\n", encoding="utf-8")
    # Pointer title: up to first '. ' sentence boundary, then truncate to 80 chars
    title = body.split(". ")[0]
    if len(title) > 80:
        title = title[:80] + "…"
    return f"- [ ] {title} → [details](data/{slug}.md)\n"


def main() -> None:
    if not BACKLOG_PATH.exists():
        print(f"ERROR: {BACKLOG_PATH} not found", file=sys.stderr)
        sys.exit(1)

    content = BACKLOG_PATH.read_text(encoding="utf-8")
    lines = content.splitlines(keepends=True)

    closed_pattern = re.compile(r"^- \[x\]")
    open_pattern = re.compile(r"^- \[ \]")

    # Collect closed items and archive each to brain (abort on failure)
    closed_lines = [l for l in lines if closed_pattern.match(l)]
    for line in closed_lines:
        try:
            archive_to_brain(line.rstrip("\n"))
        except subprocess.CalledProcessError as exc:
            print(
                f"ERROR: brain.py remember failed for line: {line.rstrip()}\n{exc}",
                file=sys.stderr,
            )
            sys.exit(1)

    # Remove closed lines
    filtered = [l for l in lines if not closed_pattern.match(l)]

    # Extract over-length open items to sidecar files
    filtered = [extract_sidecar(l) if needs_extraction(l) else l for l in filtered]

    # Collapse double (or more) blank lines into a single blank line
    collapsed: list[str] = []
    prev_blank = False
    for line in filtered:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        collapsed.append(line)
        prev_blank = is_blank

    # Cap open items at MAX_OPEN
    open_indices = [i for i, l in enumerate(collapsed) if open_pattern.match(l)]
    truncated_count = 0
    if len(open_indices) > MAX_OPEN:
        truncated_count = len(open_indices) - MAX_OPEN
        cutoff_index = open_indices[MAX_OPEN]
        # Remove lines from cutoff_index onward that are open items
        indices_to_remove = set(open_indices[MAX_OPEN:])
        collapsed = [l for i, l in enumerate(collapsed) if i not in indices_to_remove]
        today_str = date.today().isoformat()
        truncation_marker = f"> Truncated {truncated_count} items at trim time ({today_str}). Restore from git history if needed.\n"
        # Strip trailing blank lines, append marker, then single newline
        while collapsed and collapsed[-1].strip() == "":
            collapsed.pop()
        collapsed.append(truncation_marker)

    # Update _Last compacted: header
    today_str = date.today().isoformat()
    collapsed = update_last_compacted(collapsed, today_str)

    # Atomic write
    tmp_path = BACKLOG_PATH.with_suffix(".md.tmp")
    tmp_path.write_text("".join(collapsed), encoding="utf-8")
    os.replace(tmp_path, BACKLOG_PATH)

    # Final counts
    new_content = BACKLOG_PATH.read_text(encoding="utf-8")
    open_count = sum(1 for l in new_content.splitlines() if open_pattern.match(l))
    archived_count = len(closed_lines)

    print(f"Trimmed {archived_count} closed items → brain. Open: {open_count} items remain.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Archive closed [x] backlog items to brain and remove them. Open items are never removed: above MAX_OPEN (default 50, env override via BACKLOG_TRIM_MAX_OPEN) it only warns.

Backlog items may span multiple lines: a `- [ ]`/`- [x]` header followed by
indented continuation lines. Every operation here works on whole ITEMS (a
header plus its continuation lines), never on bare lines — a per-line pass
half-processes multi-line items and orphans their continuation lines under the
preceding open item, silently corrupting the file (GH #1370)."""

import os
import re
import sys
import subprocess
from datetime import date
from pathlib import Path

MAX_OPEN = int(os.environ.get("BACKLOG_TRIM_MAX_OPEN", "50"))
MAX_ITEM_LEN = 280
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BACKLOG_PATH = Path(os.environ.get("BACKLOG_TRIM_PATH", str(REPO_ROOT / ".agent" / "memory" / "project" / "backlog.md")))
DATA_DIR = REPO_ROOT / ".agent" / "memory" / "project" / "data"
if os.environ.get("BACKLOG_TRIM_DATA_DIR"):
    DATA_DIR = Path(os.environ["BACKLOG_TRIM_DATA_DIR"])
BRAIN_PY = SCRIPT_DIR / "brain.py"


def _brain_py_path() -> Path:
    """Path to brain.py, overridable for tests -- same pattern as
    mission.py's ATHANOR_BRAIN_PY_PATH override. Lets a golden point archival
    at a stand-in script (capturing or failing) instead of the real
    chromadb-backed brain."""
    override = os.environ.get("ATHANOR_BRAIN_PY_PATH")
    return Path(override) if override else BRAIN_PY

CLOSED_PATTERN = re.compile(r"^- \[x\]")
OPEN_PATTERN = re.compile(r"^- \[ \]")
BULLET_PATTERN = re.compile(r"^- \[[ x]\]")


def group_blocks(lines: list[str]) -> list[tuple[str, list[str]]]:
    """Group raw lines into blocks. Each block is (kind, block_lines):

      - "closed": a `- [x]` item header plus its continuation lines
      - "open":   a `- [ ]` item header plus its continuation lines
      - "other":  a single non-item line (heading, prose, blank, marker)

    A continuation line is an indented, non-blank line immediately following an
    item header. A blank line or a new bullet ends the item. This keeps every
    line of a multi-line item attached to its own header instead of leaking to
    the previous one."""
    blocks: list[tuple[str, list[str]]] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if BULLET_PATTERN.match(line):
            kind = "closed" if CLOSED_PATTERN.match(line) else "open"
            block = [line]
            i += 1
            while i < n:
                nxt = lines[i]
                # Continuation = indented and non-blank, and not a new bullet.
                if nxt.strip() and nxt[:1] in (" ", "\t") and not BULLET_PATTERN.match(nxt):
                    block.append(nxt)
                    i += 1
                else:
                    break
            blocks.append((kind, block))
        else:
            blocks.append(("other", [line]))
            i += 1
    return blocks


def block_text(block: list[str]) -> str:
    """Join a block's lines into a single trimmed string for archiving/length."""
    return "".join(block).strip()


def archive_to_brain(text: str) -> None:
    summary = re.sub(r"^- \[[ x]\]\s*", "", text).strip()
    # Collapse internal whitespace/newlines so the brain summary is one line.
    summary = re.sub(r"\s+", " ", summary)
    subprocess.run(
        [
            sys.executable,
            str(_brain_py_path()),
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


def needs_extraction(block: list[str]) -> bool:
    """True if this open item (whole block) exceeds MAX_ITEM_LEN and doesn't
    already carry a sidecar pointer."""
    if not OPEN_PATTERN.match(block[0]):
        return False
    text = block_text(block)
    if len(text) <= MAX_ITEM_LEN:
        return False
    if "](data/" in text and ".md)" in text:
        return False  # already trimmed
    return True


def extract_sidecar(block: list[str]) -> list[str]:
    """Replace an over-length open item with a single pointer line; write the
    full item body to a sidecar. Returns the replacement block (one line)."""
    body = re.sub(r"^- \[ \] ", "", block_text(block))
    slug = re.sub(r"[^a-z0-9]+", "-", body.lower()).strip("-")[:40].rstrip("-")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    text = f"# {slug}\n\n{body}\n"
    # Two long items can share a 40-char slug: never overwrite another item's
    # sidecar, or that item's full text is lost.
    base, n = slug, 2
    while (DATA_DIR / f"{slug}.md").exists() and \
            (DATA_DIR / f"{slug}.md").read_text(encoding="utf-8") != text:
        slug = f"{base}-{n}"
        n += 1
        text = f"# {slug}\n\n{body}\n"
    sidecar_path = DATA_DIR / f"{slug}.md"
    sidecar_path.write_text(text, encoding="utf-8")
    # Pointer title: up to first '. ' sentence boundary, then truncate to 80 chars
    title = body.split(". ")[0]
    if len(title) > 80:
        title = title[:80] + "…"
    return [f"- [ ] {title} → [details](data/{slug}.md)\n"]


def main() -> None:
    if not BACKLOG_PATH.exists():
        print(f"ERROR: {BACKLOG_PATH} not found", file=sys.stderr)
        sys.exit(1)

    # newline="": keep the file's own line endings (CRLF stays CRLF).
    with open(BACKLOG_PATH, encoding="utf-8", newline="") as fh:
        content = fh.read()
    lines = content.splitlines(keepends=True)

    blocks = group_blocks(lines)

    # Archive each closed item (whole block) to brain (abort on failure).
    closed_blocks = [b for kind, b in blocks if kind == "closed"]
    for block in closed_blocks:
        try:
            archive_to_brain(block_text(block))
        except subprocess.CalledProcessError as exc:
            print(
                f"ERROR: brain.py remember failed for item: {block_text(block)[:120]}\n{exc}",
                file=sys.stderr,
            )
            sys.exit(1)

    # Drop closed items (whole block); extract over-length open items to sidecars.
    kept: list[tuple[str, list[str]]] = []
    for kind, block in blocks:
        if kind == "closed":
            continue
        if kind == "open" and needs_extraction(block):
            kept.append(("open", extract_sidecar(block)))
        else:
            kept.append((kind, block))

    # Flatten to lines, collapsing runs of blank lines into a single blank line.
    filtered: list[str] = []
    for _, block in kept:
        filtered.extend(block)
    collapsed: list[str] = []
    prev_blank = False
    for line in filtered:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        collapsed.append(line)
        prev_blank = is_blank

    # MAX_OPEN is a warning, never a deletion. An open item is unfinished work:
    # removing it from the backlog -- even archived to brain -- drops it from the
    # mission queue. Until v3.8.19 every trim after the first truncated to
    # MAX_OPEN, and because wrap_mission.sh runs this on every close-out, SAOC
    # lost 12 open items (2026-10-07). Curating the backlog is the operator's call.
    open_count_now = sum(1 for kind, _ in group_blocks(collapsed) if kind == "open")
    if open_count_now > MAX_OPEN:
        print(f"WARN: {open_count_now} open backlog items exceed MAX_OPEN={MAX_OPEN}. "
              "Nothing removed -- curate the backlog by hand (close, merge or drop items).")

    # Update _Last compacted: header
    today_str = date.today().isoformat()
    collapsed = update_last_compacted(collapsed, today_str)

    # Atomic write
    tmp_path = BACKLOG_PATH.with_suffix(".md.tmp")
    with open(tmp_path, "w", encoding="utf-8", newline="") as fh:
        fh.write("".join(collapsed))
    os.replace(tmp_path, BACKLOG_PATH)

    # Final counts (count open ITEMS, not lines)
    new_content = BACKLOG_PATH.read_text(encoding="utf-8")
    open_count = sum(1 for kind, _ in group_blocks(new_content.splitlines(keepends=True)) if kind == "open")
    archived_count = len(closed_blocks)

    print(f"Trimmed {archived_count} closed items → brain. Open: {open_count} items remain.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Archive closed [x] backlog items to brain, remove them, and cap open items at MAX_OPEN (default 50, env override via BACKLOG_TRIM_MAX_OPEN).

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
    sidecar_path = DATA_DIR / f"{slug}.md"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    sidecar_path.write_text(f"# {slug}\n\n{body}\n", encoding="utf-8")
    # Pointer title: up to first '. ' sentence boundary, then truncate to 80 chars
    title = body.split(". ")[0]
    if len(title) > 80:
        title = title[:80] + "…"
    return [f"- [ ] {title} → [details](data/{slug}.md)\n"]


def main() -> None:
    if not BACKLOG_PATH.exists():
        print(f"ERROR: {BACKLOG_PATH} not found", file=sys.stderr)
        sys.exit(1)

    content = BACKLOG_PATH.read_text(encoding="utf-8")
    had_header = bool(re.search(r"^_Last compacted:", content, re.MULTILINE))
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

    # Cap open items at MAX_OPEN — but never on a project's first-ever trim run
    # (no pre-existing header): that would silently delete real, never-reviewed
    # backlog items the instant enforcement first turns on. First run: archive +
    # sidecar-extract + stamp header as normal, skip truncation, just warn.
    # Re-group after flattening so the cap removes whole items, not bare lines.
    capped_blocks = group_blocks(collapsed)
    open_positions = [i for i, (kind, _) in enumerate(capped_blocks) if kind == "open"]
    truncated_count = 0
    if len(open_positions) > MAX_OPEN:
        if not had_header:
            print(f"NOTE: first trim run — {len(open_positions)} open items exceed "
                  f"MAX_OPEN={MAX_OPEN}, not auto-truncating. Raise BACKLOG_TRIM_MAX_OPEN "
                  "or curate manually before next run.")
        else:
            truncated_count = len(open_positions) - MAX_OPEN
            remove_positions = set(open_positions[MAX_OPEN:])
            capped_blocks = [b for i, b in enumerate(capped_blocks) if i not in remove_positions]
            today_str = date.today().isoformat()
            truncation_marker = f"> Truncated {truncated_count} items at trim time ({today_str}). Restore from git history if needed.\n"
            # Rebuild lines, strip trailing blanks, append marker.
            collapsed = []
            for _, block in capped_blocks:
                collapsed.extend(block)
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

    # Final counts (count open ITEMS, not lines)
    new_content = BACKLOG_PATH.read_text(encoding="utf-8")
    open_count = sum(1 for kind, _ in group_blocks(new_content.splitlines(keepends=True)) if kind == "open")
    archived_count = len(closed_blocks)

    print(f"Trimmed {archived_count} closed items → brain. Open: {open_count} items remain.")


if __name__ == "__main__":
    main()

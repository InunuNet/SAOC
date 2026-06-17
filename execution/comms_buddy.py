#!/usr/bin/env python3
"""Provider-neutral helper for the root comms.md collaboration file."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMMS = ROOT / "comms.md"
STATE = ROOT / ".agent" / "memory" / "scratch" / "comms_buddy_state.json"
ARCHIVE_DIR = ROOT / ".agent" / "memory" / "project" / "comms-archive"
DEFAULT_MAX_BYTES = 12000
DEFAULT_KEEP_HEAD = 9000
DEFAULT_KEEP_TAIL = 6000
WATCH_PREFIX = "[comms-watch]"  # log prefix; watch CHANGED output: <path>: hash <old> -> <new>


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_state() -> dict:
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_name(f".{STATE.name}.{os.getpid()}.{time.time_ns()}.tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(STATE)


def snapshot() -> dict:
    data = COMMS.read_bytes()
    text = data.decode("utf-8")
    return {
        "path": str(COMMS),
        "size": len(data),
        "lines": text.count("\n"),
        "sha256": hashlib.sha256(data).hexdigest(),
        "checked_at": now(),
    }


def status(update: bool, exit_code: bool) -> int:
    snap = snapshot()
    prev = read_state()
    changed = prev.get("sha256") not in (None, snap["sha256"])
    print(f"comms.md size={snap['size']} bytes lines={snap['lines']} sha256={snap['sha256'][:12]}")
    if prev:
        print(f"previous size={prev.get('size')} sha256={str(prev.get('sha256', ''))[:12]}")
    print(f"changed={'yes' if changed else 'no'}")
    if update:
        write_state(snap)
    return 1 if changed and exit_code else 0


def split_live_and_history(text: str) -> tuple[str, str]:
    marker = "\n## Historical Fleet Notes\n"
    if marker in text:
        live, history = text.split(marker, 1)
        return live.rstrip() + "\n", "## Historical Fleet Notes\n" + history.lstrip()
    return text, ""


def trim(max_bytes: int, keep_head: int, keep_tail: int) -> int:
    data = COMMS.read_bytes()
    if len(data) <= max_bytes:
        print(f"comms.md within limit: {len(data)} <= {max_bytes}")
        write_state(snapshot())
        return 0

    text = data.decode("utf-8")
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = ARCHIVE_DIR / f"comms-{stamp}.md"
    archive.write_text(text, encoding="utf-8")

    live, history = split_live_and_history(text)
    if len(live.encode("utf-8")) > max_bytes:
        raw = live.encode("utf-8")
        notice = (
            "\n\n## Trim Notice\n\n"
            f"Older middle content archived to `{archive.relative_to(ROOT)}` by `execution/comms_buddy.py`.\n\n"
        )
        notice_bytes = len(notice.encode("utf-8"))
        available = max(1000, max_bytes - notice_bytes - 200)
        if keep_head + keep_tail > available:
            keep_head = max(500, int(available * 0.65))
            keep_tail = max(300, available - keep_head)
        head = raw[:keep_head].decode("utf-8", errors="ignore").rstrip()
        tail = raw[-keep_tail:].decode("utf-8", errors="ignore").lstrip()
        live = f"{head}{notice}{tail}\n"
    else:
        live = live.rstrip() + "\n\n"

    if history:
        live += (
            "## Historical Fleet Notes\n\n"
            f"Archived to `{archive.relative_to(ROOT)}` to keep root comms bounded.\n"
        )

    COMMS.write_text(live, encoding="utf-8")
    while len(COMMS.read_bytes()) > max_bytes:
        raw = COMMS.read_bytes()
        head_len = max(500, int(max_bytes * 0.55))
        tail_len = max(300, int(max_bytes * 0.25))
        notice = (
            "\n\n## Trim Notice\n\n"
            f"Further trimmed to enforce `{max_bytes}` byte live cap. Full content archived to `{archive.relative_to(ROOT)}`.\n\n"
        )
        live = (
            raw[:head_len].decode("utf-8", errors="ignore").rstrip()
            + notice
            + raw[-tail_len:].decode("utf-8", errors="ignore").lstrip()
        )
        COMMS.write_text(live, encoding="utf-8")
    snap = snapshot()
    write_state(snap)
    print(f"trimmed comms.md {len(data)} -> {snap['size']} bytes; archive={archive.relative_to(ROOT)}")
    return 0


def watch(interval: float, once: bool = False, extra_files: list | None = None) -> int:
    """Watch comms.md and extra_files for hash/size changes. Pure observation — no trim.

    Output format: [comms-watch] CHANGED <path>: hash <old> -> <new>, size=<N>B
    """
    import hashlib

    watch_paths = [COMMS] + [Path(f) for f in (extra_files or [])]

    def file_hash(path: Path) -> tuple[str, int]:
        try:
            data = path.read_bytes()
            return hashlib.sha256(data).hexdigest(), len(data)
        except (FileNotFoundError, OSError):
            return "missing", 0

    state = {p: file_hash(p) for p in watch_paths}

    if once:
        time.sleep(interval)
        changed = False
        for path in watch_paths:
            new_hash, new_size = file_hash(path)
            old_hash, _ = state[path]
            if new_hash != old_hash:
                print(f"[comms-watch] CHANGED {path}: hash {old_hash[:12]} -> {new_hash[:12]}, size={new_size}B")
                changed = True
        return 0 if changed else 1

    print(f"[comms-watch] watching {', '.join(str(p) for p in watch_paths)} every {interval:g}s")
    while True:
        time.sleep(interval)
        for path in watch_paths:
            new_hash, new_size = file_hash(path)
            old_hash, _ = state[path]
            if new_hash != old_hash:
                print(f"[comms-watch] CHANGED {path}: hash {old_hash[:12]} -> {new_hash[:12]}, size={new_size}B")
                state[path] = (new_hash, new_size)
    return 0  # defensive; loop normally exits via KeyboardInterrupt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_status = sub.add_parser("status")
    p_status.add_argument("--update", action="store_true")
    p_status.add_argument("--exit-code", action="store_true")

    p_trim = sub.add_parser("trim")
    p_trim.add_argument("--max-bytes", type=int, default=DEFAULT_MAX_BYTES)
    p_trim.add_argument("--keep-head", type=int, default=DEFAULT_KEEP_HEAD)
    p_trim.add_argument("--keep-tail", type=int, default=DEFAULT_KEEP_TAIL)

    p_watch = sub.add_parser("watch")
    p_watch.add_argument("--interval", type=float, default=30.0)
    p_watch.add_argument("--once", action="store_true",
                         help="poll once and exit (0=changed, 1=no change)")
    p_watch.add_argument("--file", dest="files", action="append", default=[],
                         metavar="PATH", help="additional file to watch (repeatable)")

    args = parser.parse_args()
    if args.cmd == "status":
        return status(update=args.update, exit_code=args.exit_code)
    if args.cmd == "trim":
        return trim(max_bytes=args.max_bytes, keep_head=args.keep_head, keep_tail=args.keep_tail)
    if args.cmd == "watch":
        return watch(interval=args.interval, once=args.once, extra_files=args.files)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

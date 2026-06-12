#!/usr/bin/env python3
"""
argus.py — directory snapshot + diff tool

Subcommands:
    snapshot <dir> --output <snapshot.json> [--ignore <pattern>]... [--follow-symlinks]
    diff <dir> <snapshot.json> [--ignore <pattern>]... [--follow-symlinks]

Snapshot exit codes:  0=success, 1=dir not found, 3=I/O error
Diff exit codes:      0=NO changes, 1=changes found, 2=invalid snapshot, 3=I/O error

stdlib only.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import fnmatch
import hashlib
import json
import os
import sys
from typing import Dict, Iterable, List, Optional, Tuple

CHUNK_SIZE = 4096


# ---------------------------------------------------------------------------
# Filesystem walk
# ---------------------------------------------------------------------------
def _matches_any(name: str, rel_path: str, patterns: Iterable[str]) -> bool:
    """Return True if either the basename or the relative path matches any glob."""
    for pat in patterns:
        if fnmatch.fnmatch(name, pat) or fnmatch.fnmatch(rel_path, pat):
            return True
    return False


def _hash_file(path: str) -> Tuple[str, int]:
    """Stream-read a file in CHUNK_SIZE blocks and return (sha256_hex, size_bytes)."""
    h = hashlib.sha256()
    size = 0
    with open(path, "rb") as f:
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break
            h.update(chunk)
            size += len(chunk)
    return h.hexdigest(), size


def _mode_str(path: str) -> str:
    """Return the lowest 6 octal digits of the file mode (e.g. '100644')."""
    st = os.stat(path)
    return oct(st.st_mode)[-6:]


def _walk_files(
    root: str,
    ignore_patterns: List[str],
    follow_symlinks: bool,
) -> Dict[str, Dict[str, object]]:
    """
    Walk root, returning a mapping rel_path -> {mode, sha256, size_bytes}.

    - Sorted dirnames and filenames for determinism.
    - Symlinks skipped unless follow_symlinks=True.
    - When follow_symlinks=True, an inode set is used to prevent cycles.
    - --ignore globs match against the basename OR the relative path.
    """
    files: Dict[str, Dict[str, object]] = {}
    visited_inodes: set = set()

    abs_root = os.path.abspath(root)

    for dirpath, dirnames, filenames in os.walk(abs_root, followlinks=follow_symlinks):
        dirnames.sort()
        filenames.sort()

        kept_dirs = []
        for d in dirnames:
            full = os.path.join(dirpath, d)
            rel = os.path.relpath(full, abs_root)

            if _matches_any(d, rel, ignore_patterns):
                continue

            if os.path.islink(full):
                if not follow_symlinks:
                    continue
                try:
                    st = os.stat(full)
                except OSError:
                    continue
                key = (st.st_dev, st.st_ino)
                if key in visited_inodes:
                    continue
                visited_inodes.add(key)

            kept_dirs.append(d)

        dirnames[:] = kept_dirs

        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, abs_root)

            if _matches_any(name, rel, ignore_patterns):
                continue

            if os.path.islink(full):
                if not follow_symlinks:
                    continue
                try:
                    st = os.stat(full)
                except OSError:
                    continue
                key = (st.st_dev, st.st_ino)
                if key in visited_inodes:
                    continue
                visited_inodes.add(key)

            if not os.path.isfile(full):
                continue

            try:
                sha, size = _hash_file(full)
                mode = _mode_str(full)
            except OSError as exc:
                raise IOError(f"failed reading {full}: {exc}") from exc

            files[rel] = {
                "mode": mode,
                "sha256": sha,
                "size_bytes": size,
            }

    return files


# ---------------------------------------------------------------------------
# Subcommand: snapshot
# ---------------------------------------------------------------------------
def cmd_snapshot(args: argparse.Namespace) -> int:
    target = args.dir
    if not os.path.isdir(target):
        print(f"error: directory not found: {target}", file=sys.stderr)
        return 1

    if not args.output:
        print("error: --output is required", file=sys.stderr)
        return 3

    try:
        files = _walk_files(target, args.ignore or [], args.follow_symlinks)
    except IOError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3

    snapshot = {
        "created_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "files": files,
        "root": os.path.abspath(target),
    }

    try:
        out_path = args.output
        parent = os.path.dirname(os.path.abspath(out_path))
        if parent and not os.path.isdir(parent):
            os.makedirs(parent, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, sort_keys=True, indent=2)
            f.write("\n")
    except OSError as exc:
        print(f"error: cannot write snapshot: {exc}", file=sys.stderr)
        return 3

    return 0


# ---------------------------------------------------------------------------
# Subcommand: diff
# ---------------------------------------------------------------------------
def cmd_diff(args: argparse.Namespace) -> int:
    target = args.dir
    if not os.path.isdir(target):
        print(f"error: directory not found: {target}", file=sys.stderr)
        return 3

    try:
        with open(args.snapshot, "r", encoding="utf-8") as f:
            snap = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: invalid snapshot: {exc}", file=sys.stderr)
        return 2

    if not isinstance(snap, dict) or "files" not in snap or not isinstance(snap["files"], dict):
        print("error: invalid snapshot: missing 'files' map", file=sys.stderr)
        return 2

    old_files: Dict[str, Dict[str, object]] = snap["files"]

    try:
        new_files = _walk_files(target, args.ignore or [], args.follow_symlinks)
    except IOError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3

    all_paths = sorted(set(old_files.keys()) | set(new_files.keys()))

    changed = False
    for path in all_paths:
        old = old_files.get(path)
        new = new_files.get(path)

        if old is None and new is not None:
            event = "added"
            old_hash: Optional[str] = None
            new_hash: Optional[str] = new.get("sha256")  # type: ignore[assignment]
            changed = True
        elif old is not None and new is None:
            event = "removed"
            old_hash = old.get("sha256")  # type: ignore[assignment]
            new_hash = None
            changed = True
        else:
            assert old is not None and new is not None
            old_hash = old.get("sha256")  # type: ignore[assignment]
            new_hash = new.get("sha256")  # type: ignore[assignment]
            if old_hash == new_hash:
                event = "unchanged"
            else:
                event = "modified"
                changed = True

        record = {
            "event": event,
            "path": path,
            "old_hash": old_hash,
            "new_hash": new_hash,
        }
        sys.stdout.write(json.dumps(record, sort_keys=True) + "\n")

    return 1 if changed else 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="argus.py",
        description="Directory snapshot + diff tool (sha256, JSONL diff output).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    snap_p = sub.add_parser("snapshot", help="Create a snapshot of a directory.")
    snap_p.add_argument("dir", help="Directory to snapshot.")
    # NOTE: --output declared optional so "snapshot <nonexistent_dir>" can return
    # exit 1 (dir not found) instead of argparse's exit 2 (usage error).
    snap_p.add_argument("--output", "-o", default=None, help="Path to write snapshot JSON.")
    snap_p.add_argument("--ignore", action="append", default=[],
                        help="Glob pattern to skip (repeatable).")
    snap_p.add_argument("--follow-symlinks", action="store_true",
                        help="Follow symlinks (inode-based cycle protection).")
    snap_p.set_defaults(func=cmd_snapshot)

    diff_p = sub.add_parser("diff", help="Diff a directory against a snapshot.")
    diff_p.add_argument("dir", help="Directory to compare.")
    diff_p.add_argument("snapshot", help="Snapshot JSON path.")
    diff_p.add_argument("--ignore", action="append", default=[],
                        help="Glob pattern to skip (repeatable).")
    diff_p.add_argument("--follow-symlinks", action="store_true",
                        help="Follow symlinks (inode-based cycle protection).")
    diff_p.set_defaults(func=cmd_diff)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

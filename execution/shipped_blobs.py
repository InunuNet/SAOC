#!/usr/bin/env python3
"""Generate the shipped-blob ledger: every (blob id, path) pair Athanor ever shipped.

A downstream project has no Athanor git history, so the updater cannot prove
that its Makefile or init.sh is an unedited copy of an OLDER release. The
ledger is that proof, carried with the harness: one "<40-hex blob id> <path>"
line per pair, sorted and unique, the path as git reports it, covering every version of every HARNESS path (plus
template/) reachable from HEAD.

Usage: python3 execution/shipped_blobs.py [--output PATH]
Default output: execution/shipped_blobs.txt, written atomically. Exits non-zero,
writing nothing, when git or the manifest cannot be read.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

import yaml

MANIFEST_PATH = Path(".agent/update-manifest.yaml")
DEFAULT_OUTPUT = Path("execution/shipped_blobs.txt")
GIT_ZERO_ID = "0" * 40
EMPTY_BLOB_ID = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
HARNESS_CATEGORY = "HARNESS"
EXTRA_PATHS = ["template/"]
MIN_RAW_FIELDS = 4
RAW_META_PATH_SEP = "\t"


def harness_paths(manifest_path: Path) -> list[str]:
    """HARNESS paths declared in the manifest, plus template/."""
    data = yaml.safe_load(manifest_path.read_text())
    entries = data.get("paths") if isinstance(data, dict) else None
    if not isinstance(entries, list):
        raise ValueError("manifest has no 'paths' list")
    paths = [e["path"] for e in entries
             if isinstance(e, dict) and e.get("category") == HARNESS_CATEGORY and e.get("path")]
    if not paths:
        raise ValueError("manifest declares no HARNESS paths")
    return paths + [p for p in EXTRA_PATHS if p not in paths]


def blob_ids(paths: list[str]) -> list[str]:
    """Sorted unique "<blob id> <path>" lines git history holds for `paths`."""
    proc = subprocess.run(
        ["git", "log", "HEAD", "--no-abbrev", "--raw", "--no-renames", "--format=", "--"] + paths,
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError("git log failed: %s" % proc.stderr.strip())
    pairs: set[str] = set()
    for line in proc.stdout.splitlines():
        meta, sep, path = line.partition(RAW_META_PATH_SEP)
        fields = meta.split()
        if line.startswith(":") and sep and len(fields) >= MIN_RAW_FIELDS:
            pairs.update("%s %s" % (f, path) for f in fields[2:4]
                         if f not in (GIT_ZERO_ID, EMPTY_BLOB_ID))
    return sorted(pairs)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    try:
        ids = blob_ids(harness_paths(MANIFEST_PATH))
    except (OSError, ValueError, RuntimeError, yaml.YAMLError) as exc:
        print("shipped_blobs.py: %s" % exc, file=sys.stderr)
        return 1
    if not ids:
        print("shipped_blobs.py: git history yielded no blob entries; ledger not written",
              file=sys.stderr)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.output.with_name(args.output.name + ".tmp.%d" % os.getpid())
    try:
        tmp.write_text("\n".join(ids) + "\n")
        os.replace(tmp, args.output)
    except OSError as exc:
        tmp.unlink(missing_ok=True)
        print("shipped_blobs.py: write failed: %s" % exc, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""verify_f2_baseline_hash_consistency.py -- proves the triad-baseline
grandfather list carries a real, checkable content pin per entry (mission
verification-triad-gate M2/F2, decision: editing a baselined contract
re-arms enforcement, it does not stay grandfathered forever).

Design (see contract-f2.yaml goal): execution/triad-baseline-exempt.txt
stays exactly the plain-path-per-line shape already staged for F2 (reused
as-is per the F2 research recommendation, not a second format) --
grandfathering means "this path was exempt AS OF the content whose sha256
is pinned in the companion hash file", execution/triad-baseline-exempt.sha256
(default; overridable via TRIAD_BASELINE_HASH_FILE), one `<sha256>  <path>`
line per baselined path. contract.py's real gate preflight re-derives each
baselined contract's live sha256 at gate time and only honours the
grandfather if it still matches; a mismatch re-arms enforcement for that
path (proven at runtime by verify_f2_gate_enforcement.sh's scenario 3 --
this check only proves the static pairing is consistent right now).

Two things checked:
  1. every path in the baseline file has exactly one corresponding line in
     the hash file (no baseline path missing a pin; no orphan hash-file
     line for a path absent from the baseline).
  2. every recorded hash matches sha256(current file content) for that path
     -- i.e. today's committed baseline is not already silently stale.
"""
from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BASELINE = REPO_ROOT / "execution" / "triad-baseline-exempt.txt"
DEFAULT_HASH_FILE = REPO_ROOT / "execution" / "triad-baseline-exempt.sha256"


def load_baseline_paths(path: Path) -> set:
    if not path.exists():
        return set()
    return {
        line.strip()
        for line in path.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def load_hash_entries(path: Path) -> dict:
    entries: dict = {}
    if not path.exists():
        return entries
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) != 2:
            continue
        digest, rel_path = parts
        entries[rel_path.strip()] = digest.strip()
    return entries


def main() -> int:
    baseline_path = Path(os.environ.get("TRIAD_BASELINE_FILE", str(DEFAULT_BASELINE)))
    hash_path = Path(os.environ.get("TRIAD_BASELINE_HASH_FILE", str(DEFAULT_HASH_FILE)))

    if not baseline_path.exists():
        print(f"FAIL: baseline file not found at {baseline_path}", file=sys.stderr)
        return 1
    if not hash_path.exists():
        print(
            f"FAIL: baseline hash-pin file not found at {hash_path} -- every "
            "baselined contract must carry a content hash so an edit re-arms "
            "enforcement instead of grandfathering forever.",
            file=sys.stderr,
        )
        return 1

    baseline_paths = load_baseline_paths(baseline_path)
    hash_entries = load_hash_entries(hash_path)

    missing_pins = sorted(baseline_paths - hash_entries.keys())
    orphan_pins = sorted(hash_entries.keys() - baseline_paths)
    if missing_pins:
        print(
            "FAIL: baselined path(s) with no entry in the hash-pin file "
            f"({hash_path}):\n  " + "\n  ".join(missing_pins),
            file=sys.stderr,
        )
        return 1
    if orphan_pins:
        print(
            "FAIL: hash-pin file has entries for path(s) not present in the "
            f"baseline ({baseline_path}) -- stale pin, remove it:\n  "
            + "\n  ".join(orphan_pins),
            file=sys.stderr,
        )
        return 1

    stale = []
    for rel_path, recorded_hash in sorted(hash_entries.items()):
        full = REPO_ROOT / rel_path
        if not full.exists():
            stale.append(f"{rel_path} (file no longer exists)")
            continue
        live_hash = hashlib.sha256(full.read_bytes()).hexdigest()
        if live_hash != recorded_hash:
            stale.append(
                f"{rel_path} (recorded {recorded_hash[:12]}..., live {live_hash[:12]}...)"
            )

    if stale:
        print(
            "FAIL: the following baselined contracts have been edited since "
            "their hash was pinned -- re-generate the pin (or drop the "
            "baseline entry and let enforcement re-arm) before shipping:\n  "
            + "\n  ".join(stale),
            file=sys.stderr,
        )
        return 1

    print(
        f"PASS: {len(baseline_paths)} baselined contract(s) each have exactly "
        "one matching, up-to-date hash pin -- no silently-stale grandfathers."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

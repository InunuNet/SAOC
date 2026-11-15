#!/usr/bin/env python3
"""Burn-rate brake: stop spending when the 5h quota figure jumps too fast.

Usage:
    burn_brake.py check   [--root R] [--no-voice]   exit 3 while the brake is on, else 0
    burn_brake.py release [--root R]                remove the flag, exit 0 even if absent

History: <root>/.agent/memory/scratch/.quota_history.jsonl, one {"t", "used_pct"} per line.
A rise of RISE_TRIP_PCT points or more inside WINDOW_SECONDS writes BURN_BRAKE (JSON with
rise_pct, from_pct, to_pct, window_s, tripped_at, resets_at). The floor and claude-loop.sh
refuse to dispatch while it exists. check removes it once resets_at has passed.
"""
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

RISE_TRIP_PCT = 25
WINDOW_SECONDS = 15 * 60
TRIPPED_EXIT = 3
FALLBACK_WINDOW_SECONDS = 5 * 3600
SCRATCH_REL = Path(".agent") / "memory" / "scratch"
ISO_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).strftime(ISO_FORMAT)


def parse_iso(value) -> float | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value, ISO_FORMAT).replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return None


def read_json(path: Path) -> dict | None:
    try:
        data = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def load_history(path: Path) -> list[tuple[float, float, float | None]]:
    """Rows as (t, used_pct, window). window is the quota resets_at epoch, None when unknown."""
    samples = []
    try:
        lines = path.read_text().splitlines()
    except OSError:
        return samples
    for line in lines:
        try:
            row = json.loads(line)
            window = row.get("w")
            samples.append((float(row["t"]), float(row["used_pct"]),
                            float(window) if window is not None else None))
        except (ValueError, KeyError, TypeError):
            continue
    return sorted(samples, key=lambda sample: sample[0])


def detect_rise(samples: list[tuple[float, float, float | None]]
                ) -> tuple[float, float, float] | None:
    """Return (from_pct, to_pct, rise) when the latest sample trips the threshold.

    Samples recorded in a different quota window are ignored (a sample with no window counts): a figure from before a reset
    says nothing about the burn rate after it.
    """
    if len(samples) < 2:
        return None
    latest_t, latest_pct, latest_window = samples[-1]
    earlier = [pct for t, pct, window in samples[:-1]
               if latest_t - t <= WINDOW_SECONDS
               and (window is None or latest_window is None or window == latest_window)]
    if not earlier:
        return None
    low = min(earlier)
    rise = latest_pct - low
    return (low, latest_pct, rise) if rise >= RISE_TRIP_PCT else None


def resets_at_of(scratch: Path, now: float) -> float:
    status = read_json(scratch / ".quota_status.json") or {}
    return parse_iso(status.get("resets_at")) or now + FALLBACK_WINDOW_SECONDS


def announce(root: Path) -> None:
    voice = Path(__file__).resolve().parent / "voice_say.py"
    try:
        subprocess.Popen([sys.executable, str(voice), "--event", "input-needed",
                          "--project-dir", str(root)], stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
    except OSError as exc:
        print(f"burn_brake: voice failed: {type(exc).__name__}", file=sys.stderr)


def release_if_reset(root: Path) -> bool:
    """Remove the flag once its recorded resets_at has passed. True when it was removed."""
    flag = root / SCRATCH_REL / "BURN_BRAKE"
    if not flag.exists():
        return False
    resets = parse_iso((read_json(flag) or {}).get("resets_at"))
    if resets is None or resets > time.time():
        return False
    flag.unlink(missing_ok=True)
    print("burn_brake: quota window reset, BURN_BRAKE removed")
    return True


def check(root: Path, voice: bool) -> int:
    scratch = root / SCRATCH_REL
    flag = scratch / "BURN_BRAKE"
    now = time.time()
    if release_if_reset(root):
        return 0
    if flag.exists():
        print(f"burn_brake: BURN_BRAKE is on ({flag}); release with burn_brake.py release")
        return TRIPPED_EXIT
    hit = detect_rise(load_history(scratch / ".quota_history.jsonl"))
    if hit is None:
        return 0
    low, high, rise = hit
    scratch.mkdir(parents=True, exist_ok=True)
    flag.write_text(json.dumps({
        "rise_pct": round(rise, 1), "from_pct": low, "to_pct": high,
        "window_s": WINDOW_SECONDS, "tripped_at": iso(now),
        "resets_at": iso(resets_at_of(scratch, now))}))
    print(f"burn_brake: BURN_BRAKE tripped, quota rose {low:g} -> {high:g} in "
          f"{WINDOW_SECONDS // 60} min; Agent dispatch is denied until release or window reset")
    if voice:
        announce(root)
    return TRIPPED_EXIT


def release(root: Path) -> int:
    (root / SCRATCH_REL / "BURN_BRAKE").unlink(missing_ok=True)
    print("burn_brake: BURN_BRAKE released")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("action", choices=("check", "release"))
    parser.add_argument("--root", default=".")
    parser.add_argument("--no-voice", action="store_true")
    args = parser.parse_args(argv)
    root = Path(args.root)
    if args.action == "release":
        return release(root)
    return check(root, voice=not args.no_voice)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

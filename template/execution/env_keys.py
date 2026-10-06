#!/usr/bin/env python3
"""env_keys.py — manage this project's own dotenv without printing its values.

The floor allows an agent to read `<project>/.env` as of 2026-09-22 (operator
ruling: "what's the point if you can't manage your own project files"). That
removed a mechanical guarantee: `cat .env` now succeeds, and a live key that
reaches an agent's context reaches the transcript, the scrollback, the
compaction summary, and any error message that echoes the variable. Nobody
controls it after that point.

Almost none of the questions an agent actually asks about a dotenv need the
value. "Is TYPESAFE_API_KEY set?" "Which keys does this project define?" "Did
my append land?" "Is line 12 malformed?" — all of those are answerable from
names, lengths and syntax alone. This answers them that way, so reading the
raw file stays available for the rare case that genuinely needs it rather than
being the first move by habit.

    python3 execution/env_keys.py                  # names, set/unset, lengths
    python3 execution/env_keys.py --has KEY        # exit 0 if set and non-empty
    python3 execution/env_keys.py --set KEY        # value from stdin, never argv

`--set` takes the value on stdin deliberately: an argv value is visible in the
process table and is echoed back in the tool-call record, which is the exact
exposure this script exists to avoid.
"""
import argparse
import os
import sys
from pathlib import Path

ENV = Path(".") / (".e" + "nv")


def parse(path: Path) -> list[tuple[int, str, str]]:
    """[(line number, key, value)] for every assignment line. Blanks and
    comments are skipped; a malformed line is reported with an empty key so
    the caller can name its number without showing what is on it."""
    out = []
    if not path.is_file():
        return out
    for n, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            out.append((n, "", ""))
            continue
        key, _, value = line.partition("=")
        out.append((n, key.strip(), value.strip().strip("'\"")))
    return out


def listing() -> int:
    entries = parse(ENV)
    if not entries:
        print(f"{ENV}: absent or defines nothing")
        return 1
    width = max((len(k) for _, k, _ in entries if k), default=1)
    for n, key, value in entries:
        if not key:
            print(f"  line {n}: MALFORMED — no '=' on this line")
            continue
        state = f"set, {len(value)} chars" if value else "EMPTY"
        print(f"  {key.ljust(width)}  {state}")
    return 0


def has(key: str) -> int:
    for _, k, v in parse(ENV):
        if k == key:
            return 0 if v else 1
    return 1


def set_key(key: str) -> int:
    value = sys.stdin.read().strip()
    if not value:
        print("refusing to write an empty value; pipe the value on stdin",
              file=sys.stderr)
        return 2
    entries = parse(ENV)
    lines = ENV.read_text().splitlines() if ENV.is_file() else []
    for n, k, _ in entries:
        if k == key:
            lines[n - 1] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    ENV.write_text("\n".join(lines).rstrip("\n") + "\n")
    print(f"{key}: written, {len(value)} chars")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--has", metavar="KEY",
                    help="exit 0 if KEY is set and non-empty")
    ap.add_argument("--set", metavar="KEY", dest="set_key",
                    help="write KEY, taking the value from stdin")
    args = ap.parse_args()

    if os.environ.get("ENV_KEYS_ROOT"):
        os.chdir(os.environ["ENV_KEYS_ROOT"])

    if args.has and args.set_key:
        ap.error("--has and --set are separate operations")
    if args.has:
        sys.exit(has(args.has))
    if args.set_key:
        sys.exit(set_key(args.set_key))
    sys.exit(listing())


if __name__ == "__main__":
    main()

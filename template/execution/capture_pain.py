#!/usr/bin/env python3
"""
capture_pain.py — Structured pain-point logger.

Call this during a @dev retry or @qa failure to immediately capture
what went wrong into learned.md with a structured entry.

Usage:
  python3 execution/capture_pain.py \
    --what "what went wrong (short)" \
    --fix "what the correct approach is" \
    [--mission MISSION_SLUG] \
    [--agent dev|qa|architect] \
    [--section "heading for learned.md"]

The entry is appended to .agent/memory/project/learned.md under a
"## Pain Points (auto-captured)" section (created if absent).
"""
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

LEARNED_PATH = Path(".agent/memory/project/learned.md")
PAIN_SECTION = "## Pain Points (auto-captured)"


def main():
    parser = argparse.ArgumentParser(description="Capture a pain point into learned.md")
    parser.add_argument("--what", required=True, help="What went wrong")
    parser.add_argument("--fix", required=True, help="Correct approach / fix")
    parser.add_argument("--mission", default="", help="Mission slug (optional)")
    parser.add_argument("--agent", default="", help="Which agent hit this (dev/qa/etc.)")
    parser.add_argument("--section", default="", help="Section heading (optional)")
    args = parser.parse_args()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    mission_tag = f" [{args.mission}]" if args.mission else ""
    agent_tag = f" @{args.agent}" if args.agent else ""

    entry = (
        f"\n### {now}{mission_tag}{agent_tag}\n"
        f"- **What:** {args.what}\n"
        f"- **Fix:** {args.fix}\n"
    )
    if args.section:
        entry = f"\n#### {args.section}\n" + entry

    if not LEARNED_PATH.exists():
        print(f"ERROR: {LEARNED_PATH} not found — are you in the project root?", file=sys.stderr)
        sys.exit(1)

    content = LEARNED_PATH.read_text()

    if PAIN_SECTION not in content:
        content = content.rstrip() + f"\n\n{PAIN_SECTION}\n"

    content = content.rstrip() + entry + "\n"
    LEARNED_PATH.write_text(content)

    print(f"✅ Pain point captured in {LEARNED_PATH}")
    print(f"   What: {args.what}")
    print(f"   Fix:  {args.fix}")


if __name__ == "__main__":
    main()

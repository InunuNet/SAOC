#!/usr/bin/env python3
"""
retro.py — Session-start memory scan.

Reads learned.md and recent brain entries to surface recurring pain points
and improvement candidates. Designed to be run by @maintainer at session
start/end, with findings handed to @lead/@analyst for triage.

Usage:
  python3 execution/retro.py                    # default: last 60 days, top 5 patterns
  python3 execution/retro.py --days 30          # restrict to last 30 days
  python3 execution/retro.py --top 10           # surface top 10 recurring themes
  python3 execution/retro.py --json             # machine-readable output
  python3 execution/retro.py --brain            # also scan brain via brain.py recall

Output:
  - List of recurring themes (keyword + occurrence count)
  - Flagged pain points (entries under "## Pain Points (auto-captured)")
  - Improvement candidates (high-frequency topics)
  - Suggested backlog items
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path

LEARNED_PATH = Path(".agent/memory/project/learned.md")
PAIN_SECTION = "Pain Points (auto-captured)"

# Keywords that signal a pain point or recurring issue
PAIN_KEYWORDS = [
    "trap", "bug", "wrong", "broken", "fails", "failed", "error", "incorrect",
    "regression", "stale", "missing", "never", "silently", "poisoned", "caveat",
    "always capture", "must be explicit", "forbidden", "ban", "fix:", "fixed:",
    "pattern:", "heuristic:", "anti-pattern", "footgun", "pitfall",
]

IMPROVEMENT_KEYWORDS = [
    "should", "would", "could", "automate", "backlog", "improvement",
    "consider", "better approach", "next time", "todo",
]


def parse_learned(path: Path, since: datetime) -> list[dict]:
    """Parse learned.md into dated entries."""
    if not path.exists():
        return []

    content = path.read_text()
    entries = []
    current_date = None
    current_section = ""
    current_lines = []

    for line in content.splitlines():
        date_match = re.match(r"^## (\d{4}-\d{2}-\d{2})", line)
        if date_match:
            if current_lines and current_date:
                entries.append({
                    "date": current_date,
                    "section": current_section,
                    "text": "\n".join(current_lines),
                })
            try:
                current_date = datetime.strptime(date_match.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                current_date = None
            current_section = line.strip("# ").strip()
            current_lines = []
        elif current_date:
            current_lines.append(line)

    if current_lines and current_date:
        entries.append({
            "date": current_date,
            "section": current_section,
            "text": "\n".join(current_lines),
        })

    return [e for e in entries if e["date"] and e["date"] >= since]


def extract_pain_section(path: Path) -> list[str]:
    """Extract the auto-captured pain points section."""
    if not path.exists():
        return []
    content = path.read_text()
    if PAIN_SECTION not in content:
        return []
    idx = content.index(PAIN_SECTION)
    pain_text = content[idx:]
    # Stop at next ## section
    next_section = re.search(r"\n## ", pain_text[1:])
    if next_section:
        pain_text = pain_text[: next_section.start() + 1]
    return [line for line in pain_text.splitlines() if line.startswith("- **What:**")]


def score_themes(entries: list[dict], top: int) -> list[tuple[str, int]]:
    """Find recurring keywords across all learned entries."""
    word_counter: Counter = Counter()
    for entry in entries:
        text_lower = entry["text"].lower()
        for kw in PAIN_KEYWORDS + IMPROVEMENT_KEYWORDS:
            if kw.lower() in text_lower:
                # Extract context around keyword (up to 60 chars)
                word_counter[kw] += text_lower.count(kw.lower())

    return word_counter.most_common(top)


def scan_brain(query: str = "pain point retry error") -> str:
    """Query brain.py for relevant memories."""
    try:
        result = subprocess.run(
            ["python3", "execution/brain.py", "recall", query, "--n", "5"],
            capture_output=True, text=True, timeout=15
        )
        return result.stdout.strip()
    except Exception as e:
        return f"(brain scan failed: {e})"


def main():
    parser = argparse.ArgumentParser(description="Session-start retro scan — surface pain points and improvements")
    parser.add_argument("--days", type=int, default=60, help="Look back this many days (default: 60)")
    parser.add_argument("--top", type=int, default=8, help="Top N recurring themes (default: 8)")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of human-readable")
    parser.add_argument("--brain", action="store_true", help="Also scan brain memories")
    args = parser.parse_args()

    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    entries = parse_learned(LEARNED_PATH, since)
    pain_entries = extract_pain_section(LEARNED_PATH)
    themes = score_themes(entries, args.top)

    # Improvement candidates: entries with multiple pain keywords
    improvement_candidates = []
    for entry in entries:
        score = sum(entry["text"].lower().count(kw) for kw in PAIN_KEYWORDS)
        if score >= 3:
            improvement_candidates.append({
                "section": entry["section"],
                "score": score,
                "snippet": entry["text"][:200].strip(),
            })
    improvement_candidates.sort(key=lambda x: -x["score"])

    brain_output = scan_brain() if args.brain else None

    if args.json:
        output = {
            "scanned_entries": len(entries),
            "since": since.isoformat(),
            "recurring_themes": [{"keyword": k, "count": v} for k, v in themes],
            "auto_captured_pain_points": pain_entries,
            "improvement_candidates": improvement_candidates[:5],
        }
        if brain_output:
            output["brain_scan"] = brain_output
        print(json.dumps(output, indent=2))
        return

    print("=" * 60)
    print(f"RETRO SCAN — last {args.days} days, {len(entries)} learned entries")
    print("=" * 60)

    if themes:
        print(f"\n📊 RECURRING THEMES (top {args.top}):")
        for kw, count in themes:
            bar = "█" * min(count, 20)
            print(f"  {kw:<28} {bar} ({count})")

    if pain_entries:
        print(f"\n🔴 AUTO-CAPTURED PAIN POINTS ({len(pain_entries)}):")
        for p in pain_entries:
            print(f"  {p}")

    if improvement_candidates:
        print(f"\n💡 IMPROVEMENT CANDIDATES (high pain-score sections):")
        for c in improvement_candidates[:5]:
            print(f"  [{c['score']}] {c['section']}")
            print(f"       → {c['snippet'][:120]}...")

    if brain_output:
        print(f"\n🧠 BRAIN SCAN (retry/error patterns):")
        print(brain_output[:800])

    print("\n─" * 60)
    print("Handoff: share improvement_candidates with @lead/@analyst for backlog triage.")
    print("=" * 60)


if __name__ == "__main__":
    main()

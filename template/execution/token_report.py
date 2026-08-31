#!/usr/bin/env python3
"""Burn-per-session trend reporter — reads the durable JSONL log written by
execution/hooks/session_token_log.sh and prints a by-day / by-model breakdown.

Usage: python3 execution/token_report.py [path-to-jsonl]
"""
import json
import sys
from collections import defaultdict

DEFAULT_LOG_PATH = ".agent/memory/project/telemetry/session_usage.jsonl"


def load_records(path):
    records = []
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except Exception:
                    continue
    except (FileNotFoundError, OSError):
        return []
    return records


def render_report(records):
    lines = []

    by_day = defaultdict(lambda: {"count": 0, "total": 0})
    by_model = defaultdict(int)
    grand_total_tokens = 0
    grand_total_sessions = 0

    for rec in records:
        ts = rec.get("ts", "")
        date = ts[:10]
        total_tokens = int(rec.get("total_tokens", 0) or 0)
        model = rec.get("model", "unknown")

        by_day[date]["count"] += 1
        by_day[date]["total"] += total_tokens
        by_model[model] += total_tokens
        grand_total_tokens += total_tokens
        grand_total_sessions += 1

    lines.append("By day:")
    for date in sorted(by_day):
        count = by_day[date]["count"]
        total = by_day[date]["total"]
        avg = round(total / count) if count else 0
        lines.append(f"  {date}  {count} sessions  {total:,} tokens  avg {avg:,}/session")

    lines.append("")
    lines.append("By model:")
    for model in sorted(by_model, key=lambda m: (-by_model[m], m)):
        total = by_model[model]
        share = round(total / grand_total_tokens * 100, 1) if grand_total_tokens else 0.0
        lines.append(f"  {model}  {total:,} tokens  {share}%")

    lines.append("")
    lines.append(f"Grand total: {grand_total_sessions} sessions, {grand_total_tokens:,} tokens")

    return "\n".join(lines)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_LOG_PATH
    records = load_records(path)
    if not records:
        print("No token usage data yet.")
        return 0
    print(render_report(records))
    return 0


if __name__ == "__main__":
    sys.exit(main())

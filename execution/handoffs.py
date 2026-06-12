#!/usr/bin/env python3
"""
handoffs.py — Parse and store structured agent handoffs.
Called by subagent_stop.sh with subagent payload on stdin.
"""
import json
import os
import re
import sys
import subprocess
from datetime import datetime, UTC
from pathlib import Path

SCRATCH_DIR = Path(".agent/memory/scratch/handoffs")
BACKLOG = Path(".agent/memory/project/backlog.md")
BRAIN = Path("execution/brain.py")

def extract_handoff_block(message: str) -> dict | None:
    """Extract and parse the ```handoff fenced block from agent message."""
    pattern = r"```handoff\s*\n(.*?)\n```"
    match = re.search(pattern, message, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1).strip())
    except json.JSONDecodeError:
        return None

def validate_handoff(data: dict) -> list[str]:
    """Return list of validation errors (empty = valid)."""
    errors = []
    schema = data.get("schema", "")

    # Common required fields for all variants
    base_required = ["schema", "agent", "task", "completed"]
    # Full v1 requires additional fields
    v1_required = ["left_undone", "procedures_followed"]

    for field in base_required:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # Only require v1-specific fields for full schema
    if schema == "athanor.handoff/v1":
        for field in v1_required:
            if field not in data:
                errors.append(f"Missing required field: {field}")

    if schema not in ("athanor.handoff/v1", "athanor.handoff/v1-lite"):
        errors.append(f"Unknown schema: {schema!r}")

    return errors

def write_handoff_file(data: dict, agent: str) -> Path:
    """Write handoff JSON to scratch/handoffs/."""
    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%S")
    path = SCRATCH_DIR / f"{ts}-{agent}.json"
    path.write_text(json.dumps(data, indent=2))
    return path

def append_deferred_to_backlog(left_undone: list, agent: str, handoff_file: str):
    """Append left_undone items to backlog.md under ## Deferred (auto-tracked)."""
    if not left_undone or not BACKLOG.exists():
        return
    content = BACKLOG.read_text()
    section_header = "## Deferred (auto-tracked)"
    new_entries = []
    for item in left_undone:
        date = datetime.now(UTC).strftime("%Y-%m-%d")
        priority = item.get("priority", "low")
        reason = item.get("reason", "")
        text = item.get("item", "")
        entry = f"- [ ] [{agent} {date}] {text} — {reason} _(priority: {priority}, handoff: {Path(handoff_file).name})_"
        # Avoid duplicates
        if text not in content:
            new_entries.append(entry)
    if not new_entries:
        return
    if section_header in content:
        content = content.replace(section_header, section_header + "\n" + "\n".join(new_entries))
    else:
        content = content.rstrip() + f"\n\n{section_header}\n" + "\n".join(new_entries) + "\n"
    BACKLOG.write_text(content)

def store_in_brain(data: dict, agent: str):
    """Store semantic summary in brain.py."""
    n_completed = len(data.get("completed", []))
    n_undone = len(data.get("left_undone", []))
    n_issues = len(data.get("issues_discovered", []))
    task = data.get("task", "unknown task")
    summary = f"@{agent} handoff: {task}. Completed: {n_completed}. Deferred: {n_undone}. Issues: {n_issues}."
    tags = ["handoff", agent, "subagent"]
    if n_undone > 0:
        tags.append("deferred")
    if n_issues > 0:
        tags.append("issue-discovered")
    if BRAIN.exists():
        subprocess.run(
            [sys.executable, str(BRAIN), "remember",
             "--summary", summary,
             "--tags", ",".join(tags)],
            capture_output=True
        )

def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        print("handoffs.py: invalid JSON payload, skipping structured handoff")
        return

    agent = payload.get("agent_type", "unknown")
    last_msg = payload.get("last_assistant_message", "")

    handoff = extract_handoff_block(last_msg)
    if not handoff:
        # No handoff block — fall back gracefully
        print(f"@{agent}: no structured handoff found (free-text mode)")
        return

    errors = validate_handoff(handoff)
    if errors:
        # Write malformed file for debugging
        SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%S")
        malformed = SCRATCH_DIR / f"{ts}-{agent}.malformed.txt"
        malformed.write_text(last_msg)
        print(f"@{agent} handoff validation failed: {', '.join(errors)}")
        print(f"   Raw saved to {malformed}")
        return

    handoff_file = write_handoff_file(handoff, agent)
    append_deferred_to_backlog(handoff.get("left_undone", []), agent, str(handoff_file))
    store_in_brain(handoff, agent)

    n_c = len(handoff.get("completed", []))
    n_u = len(handoff.get("left_undone", []))
    n_i = len(handoff.get("issues_discovered", []))
    print(f"@{agent} handoff stored — {n_c} completed, {n_u} deferred, {n_i} issues")
    if n_u > 0:
        print(f"   Deferred items added to backlog.md under ## Deferred (auto-tracked)")
    if n_i > 0:
        for issue in handoff.get("issues_discovered", []):
            print(f"   Issue: {issue}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
handoff_check.py — Gate check for Athanor handoff chain.

Usage:
  python3 execution/handoff_check.py --from <agent> --to <agent> [--json] \
      [--state-file <path>] [--mission-id <id>]

Exit codes:
  0  — gate passes
  2  — gate blocked

Stdout: JSON only (gate result).
Stderr: diagnostic logs.
"""

import argparse
import fnmatch
import glob
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Path resolution helpers
# ---------------------------------------------------------------------------

def _script_dir() -> Path:
    return Path(__file__).resolve().parent


def _project_root() -> Path:
    return _script_dir().parent


def _scratch_dir() -> Path:
    p = Path(os.environ.get("ATHANOR_SCRATCH", str(_project_root() / ".agent" / "memory" / "scratch")))
    if p.exists() and not p.is_dir():
        print(json.dumps({"pass": False, "attempts": 0, "trend": "static", "escalate_to": None, "reason": f"ATHANOR_SCRATCH is not a directory: {p}"}))
        sys.exit(2)
    return p


def _specs_dir() -> Path:
    env = os.environ.get("ATHANOR_SPECS")
    if env:
        return Path(env)
    return _project_root() / ".agent" / "memory" / "project" / "specs"


def _docs_dir() -> Path:
    env = os.environ.get("ATHANOR_DOCS")
    if env:
        return Path(env)
    return _project_root() / "docs"


def _project_mem_dir() -> Path:
    env = os.environ.get("ATHANOR_PROJECT_MEM")
    if env:
        return Path(env)
    return _project_root() / ".agent" / "memory" / "project"


def _handoffs_yaml() -> Path:
    env = os.environ.get("ATHANOR_HANDOFFS")
    if env:
        return Path(env)
    return _project_root() / ".agent" / "handoffs.yaml"


# ---------------------------------------------------------------------------
# Handoff config loader
# ---------------------------------------------------------------------------

def load_handoffs() -> list:
    hf = _handoffs_yaml()
    try:
        import yaml
        with open(hf) as f:
            data = yaml.safe_load(f)
    except ImportError:
        print("ERROR: PyYAML not available", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(f"ERROR: handoffs.yaml not found: {hf}", file=sys.stderr)
        sys.exit(1)
    except yaml.YAMLError as e:
        print(json.dumps({"pass": False, "attempts": 0, "trend": "static", "escalate_to": None, "reason": f"handoffs.yaml parse error: {e}"}))
        sys.exit(2)
    return data.get("handoffs", [])


def find_handoff(handoffs: list, from_agent: str, to_agent: str) -> dict | None:
    for h in handoffs:
        if h.get("from") == from_agent and h.get("to") == to_agent:
            return h
    return None


# ---------------------------------------------------------------------------
# Pattern resolution — expand env-specific base dirs
# ---------------------------------------------------------------------------

def resolve_pattern(raw_pattern: str) -> str:
    """
    Replace base path prefixes with env-override directories.
    The patterns in handoffs.yaml are project-relative. We resolve them to
    absolute paths, honouring ATHANOR_* overrides.
    """
    root = _project_root()

    # Map pattern prefixes to resolved base dirs
    prefix_map = [
        (".agent/memory/scratch/",   _scratch_dir()),
        (".agent/memory/project/specs/", _specs_dir()),
        ("docs/",                    _docs_dir()),
        (".agent/memory/project/",   _project_mem_dir()),
    ]

    for prefix, resolved_base in prefix_map:
        if raw_pattern.startswith(prefix):
            tail = raw_pattern[len(prefix):]
            return str(resolved_base / tail)

    # Fallback: project-relative
    return str(root / raw_pattern)


# ---------------------------------------------------------------------------
# Artefact checking
# ---------------------------------------------------------------------------

def find_artefact(pattern: str):
    """
    Glob pattern and return the newest file by mtime, or None if no matches.
    """
    matches = glob.glob(pattern)
    if not matches:
        return None
    # Return newest by mtime
    return max(matches, key=lambda p: os.path.getmtime(p))


def check_artefact(handoff: dict) -> dict:
    """
    Validate one handoff's artefact. Returns dict with keys:
      ok: bool
      reason: str
      category: "missing" | "size" | "stale" | "section"
      missing_sections: list[str]
      file_count: int
    """
    raw_pattern = handoff["artefact_pattern"]
    pattern = resolve_pattern(raw_pattern)
    min_size = handoff.get("min_size_bytes", 0)
    max_age = handoff.get("max_age_seconds", None)
    min_sections = handoff.get("min_sections", [])

    # Count matching files for failure signature
    all_matches = glob.glob(pattern)
    file_count = len(all_matches)

    if file_count == 0:
        return {
            "ok": False,
            "reason": f"artefact missing: no files match pattern {raw_pattern}",
            "category": "missing",
            "missing_sections": [],
            "file_count": 0,
        }

    # Use newest
    artefact = max(all_matches, key=lambda p: os.path.getmtime(p))

    # Size check
    size = os.path.getsize(artefact)
    if size < min_size:
        return {
            "ok": False,
            "reason": (
                f"artefact too small: {artefact} is {size} bytes "
                f"(min_size_bytes={min_size}); empty or near-empty file"
            ),
            "category": "size",
            "missing_sections": [],
            "file_count": file_count,
        }

    # Age (staleness) check
    if max_age is not None:
        mtime = os.path.getmtime(artefact)
        age = time.time() - mtime
        if age > max_age:
            return {
                "ok": False,
                "reason": (
                    f"artefact stale: {artefact} mtime age {age:.0f}s "
                    f"exceeds max_age_seconds={max_age}"
                ),
                "category": "stale",
                "missing_sections": [],
                "file_count": file_count,
            }

    # Required sections check
    if min_sections:
        try:
            content = Path(artefact).read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            return {
                "ok": False,
                "reason": f"artefact unreadable: {e}",
                "category": "section",
                "missing_sections": list(min_sections),
                "file_count": file_count,
            }

        missing = []
        for section in min_sections:
            if section not in content:
                missing.append(section)

        if missing:
            return {
                "ok": False,
                "reason": (
                    f"artefact missing required section(s): "
                    f"{missing}; marker/findings not found in {artefact}"
                ),
                "category": "section",
                "missing_sections": missing,
                "file_count": file_count,
            }

    return {
        "ok": True,
        "reason": f"artefact ok: {artefact}",
        "category": None,
        "missing_sections": [],
        "file_count": file_count,
    }


# ---------------------------------------------------------------------------
# Failure signature
# ---------------------------------------------------------------------------

def failure_signature(check_result: dict) -> str:
    category = check_result.get("category", "unknown")
    missing = sorted(check_result.get("missing_sections", []))
    file_count = check_result.get("file_count", 0)
    raw = f"{category}|{','.join(missing)}|{file_count}"
    return hashlib.md5(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# State file (three-tier recovery)
# ---------------------------------------------------------------------------

def load_state(state_file: Path) -> dict:
    if state_file.exists():
        try:
            return json.loads(state_file.read_text())
        except Exception:
            pass
    return {}


def save_state(state_file: Path, state: dict):
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, indent=2))


def gate_key(from_agent: str, to_agent: str, mission_id: str) -> str:
    return f"{from_agent}->{to_agent}@{mission_id}"


# ---------------------------------------------------------------------------
# Blocked gate file
# ---------------------------------------------------------------------------

def write_gate_blocked(from_agent: str, to_agent: str):
    scratch = _scratch_dir()
    scratch.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    fname = scratch / f"gate-blocked-{ts}.md"
    gate_id = f"{from_agent} -> {to_agent}"
    content = f"""# GATE BLOCKED

Gate: {gate_id}
Timestamp: {ts}

human required — this gate has failed 3 or more consecutive times.
The handoff chain is frozen. Manual intervention needed.

## Gate ID

{gate_id}

## Action Required

Review upstream agent output for {from_agent} and resolve the artefact issue before re-running.
"""
    fname.write_text(content)
    print(f"Gate blocked file written: {fname}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Main gate logic
# ---------------------------------------------------------------------------

def run_gate(from_agent: str, to_agent: str, state_file: Path, mission_id: str) -> tuple[dict, int]:
    handoffs = load_handoffs()
    handoff = find_handoff(handoffs, from_agent, to_agent)

    if handoff is None:
        result = {
            "pass": False,
            "attempts": 1,
            "trend": "static",
            "escalate_to": None,
            "reason": f"no handoff config found for {from_agent}->{to_agent}",
        }
        return result, 2

    # Check the artefact
    check_result = check_artefact(handoff)

    # Load state
    state = load_state(state_file)
    key = gate_key(from_agent, to_agent, mission_id)
    gate_state = state.get(key, {"attempts": 0, "last_sig": None})

    if check_result["ok"]:
        # Pass — reset counter
        gate_state["attempts"] = 1
        gate_state["last_sig"] = None
        state[key] = gate_state
        save_state(state_file, state)

        result = {
            "pass": True,
            "attempts": 1,
            "trend": "static",
            "escalate_to": None,
            "reason": check_result["reason"],
        }
        return result, 0

    # Failure path — increment attempts
    current_sig = failure_signature(check_result)
    prev_attempts = gate_state.get("attempts", 0)
    prev_sig = gate_state.get("last_sig")

    new_attempts = prev_attempts + 1
    gate_state["attempts"] = new_attempts
    gate_state["last_sig"] = current_sig
    state[key] = gate_state
    save_state(state_file, state)

    # Determine trend and escalation
    if new_attempts == 1:
        trend = "static"
        escalate_to = None
    elif new_attempts == 2:
        if prev_sig is not None and prev_sig != current_sig:
            trend = "diverging"
        else:
            trend = "static"
        escalate_to = from_agent
    else:
        # Attempt 3+: hard stop
        if prev_sig is not None and prev_sig != current_sig:
            trend = "diverging"
        else:
            trend = "static"
        escalate_to = from_agent
        write_gate_blocked(from_agent, to_agent)

        result = {
            "pass": False,
            "attempts": new_attempts,
            "trend": trend,
            "escalate_to": escalate_to,
            "reason": check_result["reason"],
        }
        return result, 2

    result = {
        "pass": False,
        "attempts": new_attempts,
        "trend": trend,
        "escalate_to": escalate_to,
        "reason": check_result["reason"],
    }
    return result, 2


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def append_bypass_entry(from_agent: str, to_agent: str, gate_id: str, mission_id: str, reason: str):
    """Append one bypass line to learned.md under ## Gate Bypasses section."""
    learned_path = _project_mem_dir() / "learned.md"
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    pair = f"{from_agent}->{to_agent}"
    mission_field = f"{gate_id}/{mission_id}" if gate_id and gate_id not in mission_id else mission_id
    entry = f'- `{ts}` | `{pair}` | `{mission_field}` | reason: "{reason}"\n'

    import fcntl
    learned_path.parent.mkdir(parents=True, exist_ok=True)
    with open(learned_path, "a+", encoding="utf-8") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        fh.seek(0)
        content = fh.read()
        if "## Gate Bypasses" not in content:
            if content and not content.endswith("\n"):
                fh.write("\n")
            fh.write("\n## Gate Bypasses\n\n")
        fh.write(entry)


def main():
    parser = argparse.ArgumentParser(
        description="Athanor handoff gate checker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--from", dest="from_agent", required=True,
                        help="upstream agent name (e.g. analyst)")
    parser.add_argument("--to", dest="to_agent", required=True,
                        help="downstream agent name (e.g. architect)")
    parser.add_argument("--state-file", dest="state_file", default=None,
                        help="path to JSON state file for three-tier recovery tracking")
    parser.add_argument("--mission-id", dest="mission_id", default="default",
                        help="mission identifier for gate state namespacing")
    parser.add_argument("--json", dest="json_output", action="store_true", default=True,
                        help="emit JSON on stdout (default: on)")
    parser.add_argument("--force-gate", dest="force_gate", default=None,
                        help="bypass gate check for this gate id (requires --reason)")
    parser.add_argument("--reason", dest="reason", default=None,
                        help="mandatory reason text when using --force-gate")

    args = parser.parse_args()

    # Resolve state file
    if args.state_file:
        state_file = Path(args.state_file)
    else:
        state_file = _scratch_dir() / "handoff_state.json"

    # Force-bypass path
    if args.force_gate is not None:
        if not args.reason:
            print("ERROR: --force-gate requires --reason", file=sys.stderr)
            sys.exit(1)

        # Reset gate state counter to prevent poisoning the attempt counter
        state = load_state(state_file)
        key = gate_key(args.from_agent, args.to_agent, args.mission_id)
        state[key] = {"attempts": 0, "last_sig": None}
        save_state(state_file, state)

        # Append bypass entry to learned.md
        append_bypass_entry(
            from_agent=args.from_agent,
            to_agent=args.to_agent,
            gate_id=args.force_gate,
            mission_id=args.mission_id,
            reason=args.reason,
        )

        result = {
            "pass": True,
            "bypassed": True,
            "attempts": 1,
            "trend": "static",
            "escalate_to": None,
            "reason": "bypassed",
        }
        print(json.dumps(result))
        sys.exit(0)

    result, exit_code = run_gate(
        from_agent=args.from_agent,
        to_agent=args.to_agent,
        state_file=state_file,
        mission_id=args.mission_id,
    )

    # Stdout: JSON only
    print(json.dumps(result))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

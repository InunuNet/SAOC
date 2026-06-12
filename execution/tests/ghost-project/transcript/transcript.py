#!/usr/bin/env python3
"""
Transcript — Tool-Call/Observation Pairing Validator
Spec: SPEC.md
"""

import json
import sys


# ── loading ──────────────────────────────────────────────────────────────────

def load_events(path: str) -> list[tuple[int, dict]]:
    """
    Read JSONL file. Returns list of (1-indexed line number, event dict).
    Exits 2 if any line is malformed JSON or missing required fields.
    """
    events = []
    try:
        with open(path) as f:
            lines = f.readlines()
    except OSError as exc:
        print(f"ERROR: cannot read file {path}: {exc}", file=sys.stderr)
        sys.exit(2)

    for lineno, raw in enumerate(lines, 1):
        raw = raw.strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError as exc:
            print(f"ERROR: malformed JSON on line {lineno}: {exc}", file=sys.stderr)
            sys.exit(2)

        # Validate required fields per event type
        event_type = obj.get("event")
        if event_type is None:
            print(
                f"ERROR: line {lineno}: missing required field 'event'",
                file=sys.stderr,
            )
            sys.exit(2)

        if event_type == "action":
            for field in ("id", "tool", "group"):
                if field not in obj:
                    print(
                        f"ERROR: line {lineno}: action event missing required field '{field}'",
                        file=sys.stderr,
                    )
                    sys.exit(2)
        elif event_type == "observation":
            if "tool_call_id" not in obj:
                print(
                    f"ERROR: line {lineno}: observation event missing required field 'tool_call_id'",
                    file=sys.stderr,
                )
                sys.exit(2)
            if "status" not in obj:
                print(
                    f"ERROR: line {lineno}: observation event missing required field 'status'",
                    file=sys.stderr,
                )
                sys.exit(2)
        elif event_type == "message":
            for field in ("role", "text"):
                if field not in obj:
                    print(
                        f"ERROR: line {lineno}: message event missing required field '{field}'",
                        file=sys.stderr,
                    )
                    sys.exit(2)

        events.append((lineno, obj))

    return events


# ── validation ────────────────────────────────────────────────────────────────

def validate_events(events: list[tuple[int, dict]]) -> list[tuple[int, str, str]]:
    """
    Scan events and return list of (event_index, violation_type, message).
    event_index is the 1-based line number of the triggering event.

    Scanning algorithm:
    - Track current group and actions within it.
    - On new group: close previous group, emit MISSING_OBSERVATION for any
      unobserved actions from the closed group.
    - On observation: check against all known actions (current + past groups).
      Emit: ID_MISMATCH, ORPHAN_OBSERVATION, DUPLICATE_OBSERVATION, ORDER_VIOLATION.
    - At EOF: close final group.
    """
    violations: list[tuple[int, str, str]] = []

    # Global registry: action_id -> {lineno, group, position_in_group, observed: bool}
    all_actions: dict[str, dict] = {}

    # Per-group state
    # current_group_id -> list of action_ids in declaration order
    current_group: str | None = None
    current_group_actions: list[str] = []  # action ids in order

    # Track which action_ids have been observed (for DUPLICATE detection)
    observed_ids: set[str] = set()

    # Track observation order within the current group
    # position counter for observations arriving in current group
    current_group_obs_position: int = 0

    def close_group(group_id: str, group_action_ids: list[str]) -> None:
        """Emit MISSING_OBSERVATION for any unobserved action in closed group."""
        for aid in group_action_ids:
            if aid not in observed_ids:
                action_info = all_actions[aid]
                violations.append((
                    action_info["lineno"],
                    "MISSING_OBSERVATION",
                    f"action {aid} in group {group_id} has no matching observation",
                ))

    for lineno, event in events:
        etype = event["event"]

        if etype == "action":
            aid = event["id"]
            group = event["group"]

            # Group transition?
            if group != current_group:
                # Close previous group
                if current_group is not None:
                    close_group(current_group, current_group_actions)
                current_group = group
                current_group_actions = []
                current_group_obs_position = 0

            pos = len(current_group_actions)
            current_group_actions.append(aid)
            all_actions[aid] = {
                "lineno": lineno,
                "group": group,
                "position": pos,
                "observed": False,
            }

        elif etype == "observation":
            tcid = event["tool_call_id"]

            # Check: does this tool_call_id match any known action?
            if tcid not in all_actions:
                violations.append((
                    lineno,
                    "ID_MISMATCH",
                    f"observation tool_call_id {tcid} matches no prior action",
                ))
                continue

            action_info = all_actions[tcid]

            # Check: is the action's group already closed (ORPHAN)?
            if action_info["group"] != current_group:
                violations.append((
                    lineno,
                    "ORPHAN_OBSERVATION",
                    f"observation for {tcid} arrived after group {action_info['group']} was closed",
                ))
                continue

            # Check: DUPLICATE?
            if tcid in observed_ids:
                violations.append((
                    lineno,
                    "DUPLICATE_OBSERVATION",
                    f"tool_call_id {tcid} already observed",
                ))
                continue

            # Check ORDER_VIOLATION
            # The observation's arrival position within this group must match
            # the action's declaration position.
            action_pos = action_info["position"]
            obs_arrival_pos = current_group_obs_position

            if obs_arrival_pos != action_pos:
                violations.append((
                    lineno,
                    "ORDER_VIOLATION",
                    f"observation for {tcid} arrived at group {current_group} position {obs_arrival_pos} "
                    f"but action {tcid} has position {action_pos}",
                ))
                # Still mark as observed to avoid cascading MISSING_OBSERVATION
            else:
                pass  # valid observation

            observed_ids.add(tcid)
            current_group_obs_position += 1

        # message events: no pairing validation needed

    # Close final group at EOF
    if current_group is not None:
        close_group(current_group, current_group_actions)

    # Sort violations by event_index ascending
    violations.sort(key=lambda v: v[0])
    return violations


# ── output ────────────────────────────────────────────────────────────────────

def main(argv=None) -> int:
    args = sys.argv[1:] if argv is None else argv

    if len(args) != 1:
        print(f"Usage: python3 transcript.py events.jsonl", file=sys.stderr)
        sys.exit(2)

    path = args[0]
    events = load_events(path)
    violations = validate_events(events)

    for lineno, vtype, msg in violations:
        print(f"VIOLATION {lineno} {vtype}: {msg}")

    if violations:
        print(f"INVALID: {len(violations)} violations")
    else:
        print("VALID")

    return 0


if __name__ == "__main__":
    sys.exit(main())

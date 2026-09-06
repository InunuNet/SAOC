#!/usr/bin/env python3
"""resolve_feature_contract.py — resolve the active mission's CURRENT
feature's contract path, for require_contract_for_write.sh.

This does not reimplement mission.py's contract-resolution rule. It calls
mission.py's own `parse_mission_file()` to read the mission, and its own
`_existing_contract_for_feature()` (the exact function `mission.py gate`
uses to auto-discover a feature's contract) to resolve it -- so the hook
and `mission.py gate` read mission files and resolve contracts identically
and can never drift into two different answers for "does this feature have
a contract".

Resolution order, mirroring mission.py's cmd_gate body exactly:
  1. The feature's own `contract:` field (set via attach-spec) -- used as-is,
     only checked for existence on disk. A field pointing at a missing file
     is a real spec/contract mismatch, not a "no contract" case: it blocks.
  2. specs/<mission-slug>/contract-f<N>.yaml, if present and it validates.
  3. specs/<mission-slug>/contract.yaml (shared/cumulative form), if present
     and it validates.

The CURRENT feature is read from active.json's checkpoint.feature -- the
mission-slug directory the old hook globbed for is not a convention any
mission actually creates (attach-spec records contracts per-feature).

Prints exactly one line to stdout. Exit code matters too: 0 for a
conclusive answer (including a conclusive "no contract"), 1 for "the input
could not be understood" -- the caller must treat a nonzero exit, or any
line this script does not document, as BLOCK. An unreadable guard does not
get to mean "allow": it means "I don't know", and "I don't know" blocks.

Exit 0 lines:
  allow             -- no active mission recorded, or the mission has
                       reached a terminal status -- nothing to gate.
  contract:<path>   -- resolved, existing contract for the current feature.
  noncontract       -- active mission, current feature has no contract
                       resolvable by any of the three steps above (this
                       includes: no checkpoint.feature recorded, the
                       checkpointed feature id is not in features:, or the
                       mission file itself fails to parse -- all of these
                       are "can't clear this write", not "allow it").
  invalid:<path>    -- a per-feature contract-f<N>.yaml exists but fails
                       `contract.py validate`.
  missing:<path>    -- feature's own `contract:` field names a file that
                       does not exist on disk (spec/contract mismatch).

Exit 1: active.json exists but is not readable/parseable JSON -- state is
unknown, so the caller must block rather than guess.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ACTIVE_JSON_REL = Path(".agent/memory/project/missions/active.json")
TERMINAL_MISSION_STATUSES = {"complete", "done", "abandoned"}

sys.path.insert(0, str(REPO_ROOT / "execution"))
import mission  # noqa: E402  (path must be set up first)


def emit(word: str, code: int = 0) -> None:
    print(word)
    sys.exit(code)


def main() -> None:
    active_json = Path.cwd() / ACTIVE_JSON_REL
    if not active_json.is_file():
        # No active.json at all -- the ordinary case, definitively no
        # active mission to gate against.
        emit("allow")

    try:
        active = json.loads(active_json.read_text())
        if not isinstance(active, dict):
            raise ValueError("active.json is not a JSON object")
    except Exception as exc:
        # active.json exists but can't be read/parsed -- unknown state,
        # not "no mission". Block rather than guess.
        print(f"unreadable active.json ({active_json}): {exc}", file=sys.stderr)
        emit("error", code=1)

    mission_path = active.get("mission") or ""
    if not mission_path:
        # active.json exists and parses, and explicitly records no mission
        # -- genuinely no active mission.
        emit("allow")

    mission_file = Path(mission_path)
    if not mission_file.is_absolute():
        mission_file = Path.cwd() / mission_file
    if not mission_file.is_file():
        # active.json points at a mission file that isn't there -- can't
        # verify the mission's real state (e.g. a terminal status that
        # would lift the gate). Blocks rather than assuming closed-out.
        emit("noncontract")

    fid = (active.get("checkpoint") or {}).get("feature") or ""
    if not fid:
        # Active mission but no way to tell which feature is current --
        # the gate cannot clear a write it cannot attribute. Stays blocked.
        emit("noncontract")

    try:
        fm, _body = mission.parse_mission_file(str(mission_file))
    except SystemExit:
        # parse_mission_file prints its own diagnostic and sys.exit(1)s on
        # a malformed mission file -- an unparseable mission is unknown
        # state, not "no mission". Blocks.
        emit("noncontract")

    if fm.get("status") in TERMINAL_MISSION_STATUSES:
        emit("allow")

    feature = next((f for f in fm.get("features", []) if f.get("id") == fid), None)
    if feature is None:
        # checkpoint.feature names an id absent from features: -- unresolvable.
        emit("noncontract")

    # Step 1: the feature's own attach-spec `contract:` field.
    contract = feature.get("contract")
    if not contract:
        # Steps 2-3: mission.py's own auto-discovery, verbatim.
        lookup = mission._existing_contract_for_feature(fm, fid)
        if lookup.invalid_path:
            emit(f"invalid:{lookup.invalid_path}")
        contract = lookup.path

    if not contract:
        emit("noncontract")

    contract_path = Path(contract)
    if not contract_path.is_absolute():
        contract_path = Path.cwd() / contract_path
    if not contract_path.is_file():
        emit(f"missing:{contract_path}")

    emit(f"contract:{contract_path}")


if __name__ == "__main__":
    main()

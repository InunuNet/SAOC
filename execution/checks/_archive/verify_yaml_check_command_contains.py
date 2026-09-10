#!/usr/bin/env python3
"""verify_yaml_check_command_contains.py -- assertion-shape-sweep F1 Defect 1
repair, generic wiring-check helper.

Usage:
  verify_yaml_check_command_contains.py <contract.yaml> <check_id> <required_substring>

Parses <contract.yaml> as YAML, looks up assertions.checks[id=<check_id>].command,
and asserts <required_substring> appears IN THAT FIELD ONLY. Prose --
`description:`, `goal:`, `anti_patterns:`, or any other key -- is
structurally unreachable: the parser never looks at it, so it can never
match by accident.

Why this exists (DECISION.md Defect 1): the original wiring check for
mission-py-gate-fix/contract-f1.yaml A1/A2 was a raw `grep -q substring
whole-file.yaml` -- and A4 misfired on a legitimate, unrelated
`anti_patterns` bullet ("... and no assertions.phase key") that happened to
contain a banned OR-fragment. Narrowing the regex would have been the same
defect with a smaller blast radius. Only parsing the YAML and inspecting
the one structured field the claim is actually about eliminates the whole
class: it is not merely unlikely to match prose, it is impossible to.

Edge cases (each must FAIL with a distinct, legible message -- never crash
with a bare traceback, never silently PASS just because it couldn't find
what it was asked to inspect):
  - contract file does not exist
  - contract file is not valid YAML
  - contract has no assertions.checks list at all (or assertions isn't the
    architect dict-with-checks shape)
  - no check in assertions.checks has the given id
  - the matched check has no command: field (or it's empty)
  - the command field exists but does not contain the required substring
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FAIL: pyyaml not importable — cannot run this check", file=sys.stderr)
    sys.exit(1)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 4:
        fail(
            "usage: verify_yaml_check_command_contains.py <contract.yaml> "
            "<check_id> <required_substring>"
        )

    contract_path_arg, check_id, required_substring = sys.argv[1], sys.argv[2], sys.argv[3]
    contract_path = Path(contract_path_arg)

    if not contract_path.exists():
        fail(f"contract file not found: {contract_path}")

    try:
        raw_text = contract_path.read_text()
    except OSError as e:
        fail(f"{contract_path}: could not read file: {type(e).__name__}: {e}")

    try:
        contract = yaml.safe_load(raw_text)
    except yaml.YAMLError as e:
        fail(f"{contract_path}: does not parse as YAML: {e}")

    if not isinstance(contract, dict):
        fail(f"{contract_path}: top-level YAML content is not a mapping (got {type(contract).__name__})")

    assertions = contract.get("assertions")
    if not isinstance(assertions, dict) or "checks" not in assertions:
        fail(
            f"{contract_path}: no assertions.checks list found (expected the "
            f"architect dict shape `assertions: {{phase: N, checks: [...]}}`, "
            f"got assertions={assertions!r})"
        )

    checks = assertions.get("checks")
    if not isinstance(checks, list):
        fail(f"{contract_path}: assertions.checks is not a list (got {type(checks).__name__})")

    matched = [c for c in checks if isinstance(c, dict) and c.get("id") == check_id]
    if not matched:
        known_ids = [c.get("id") for c in checks if isinstance(c, dict)]
        fail(
            f"{contract_path}: no check with id={check_id!r} found in "
            f"assertions.checks (known ids: {known_ids})"
        )

    check = matched[0]
    command = check.get("command")
    if not command:
        fail(f"{contract_path}: check id={check_id!r} has no (or an empty) command: field")

    if not isinstance(command, str):
        fail(f"{contract_path}: check id={check_id!r}'s command: field is not a string (got {type(command).__name__})")

    if required_substring not in command:
        fail(
            f"{contract_path}: check id={check_id!r}'s command: field does not "
            f"contain {required_substring!r} -- actual command: {command!r}"
        )

    print(
        f"PASS: {contract_path}: check id={check_id!r}'s command: field "
        f"contains {required_substring!r}"
    )
    sys.exit(0)


if __name__ == "__main__":
    main()

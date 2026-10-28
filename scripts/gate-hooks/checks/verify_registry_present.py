#!/usr/bin/env python3
"""Tripwire: the stock gate treats a missing or unreadable .agent/contract_kinds.json as "no
hooks" and proceeds, silently disabling the residue guard and the triad preflight. This check
fails loudly instead.

Usage: verify_registry_present.py [registry-path]  (default: REPO_ROOT/.agent/contract_kinds.json)

Exit 0 iff the file exists, parses as a JSON object, and its `schema`, `kinds` and `gate_hooks`
each equal (plain ==, same order and count, every field including timeout_seconds) those of
registry.expected.json. Other top-level keys are ignored, as the stock gate ignores them. Exit 1 on any violation (each is printed), exit 2 on a usage error.
Stdlib only.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REGISTRY = REPO_ROOT / ".agent" / "contract_kinds.json"
EXPECTED_PATH = (REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "harness-gate-hooks"
                 / "goldens" / "registry.expected.json")
COMPARED_KEYS = ("schema", "kinds", "gate_hooks")
EXIT_OK = 0
EXIT_VIOLATION = 1
EXIT_USAGE = 2


def load_json_object(path: Path, what: str, problems: list):
    try:
        data = json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        problems.append(f"{what} {path} is missing, unreadable or not JSON ({type(exc).__name__})")
        return None
    if not isinstance(data, dict):
        problems.append(f"{what} {path} is not a JSON object")
        return None
    return data


def first_difference(actual, expected, path: str) -> str:
    """Name the first place two parsed JSON values differ (paths and field names only)."""
    if isinstance(actual, dict) and isinstance(expected, dict):
        for key in expected:
            if key not in actual:
                return f"{path}.{key} is missing"
        for key in actual:
            if key not in expected:
                return f"{path}.{key} is unexpected"
        for key in expected:
            if actual[key] != expected[key]:
                return first_difference(actual[key], expected[key], f"{path}.{key}")
    if isinstance(actual, list) and isinstance(expected, list):
        if len(actual) != len(expected):
            return f"{path} has {len(actual)} entries, expected {len(expected)}"
        for index, (got, want) in enumerate(zip(actual, expected)):
            if got != want:
                return first_difference(got, want, f"{path}[{index}]")
    return f"{path} differs from the expected value"


def compare(actual: dict, expected: dict) -> list:
    """Plain == on the three keys the stock gate reads; other top-level keys are ignored."""
    problems = []
    for key in COMPARED_KEYS:
        got, want = actual.get(key), expected.get(key)
        if got != want:
            problems.append(first_difference(got, want, key))
    return problems


def main(argv: list) -> int:
    if len(argv) > 2:
        print("usage: verify_registry_present.py [registry-path]", file=sys.stderr)
        return EXIT_USAGE
    path = Path(argv[1]) if len(argv) == 2 else DEFAULT_REGISTRY
    problems: list = []
    expected = load_json_object(EXPECTED_PATH, "expected registry", problems)
    actual = load_json_object(path, "registry", problems)
    if expected is not None and actual is not None:
        problems += compare(actual, expected)
    if problems:
        print(f"FAIL: gate-hooks registry check failed for {path}:")
        for problem in problems:
            print(f"  - {problem}")
        return EXIT_VIOLATION
    print(f"PASS: {path} matches the expected registry")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main(sys.argv))

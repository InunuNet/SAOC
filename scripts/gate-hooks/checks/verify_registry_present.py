#!/usr/bin/env python3
"""Tripwire: the stock gate treats a missing or unreadable .agent/contract_kinds.json as "no
hooks" and proceeds, silently disabling the residue guard and the triad preflight. This check
fails loudly instead.

Usage: verify_registry_present.py [registry-path]  (default: REPO_ROOT/.agent/contract_kinds.json)

Exit 0 iff the file exists, parses as a JSON object, declares exactly the gate hooks of
registry.expected.json by name with the expected stage, on_error and command, and declares the
expected project kinds. Exit 1 on any violation (each is printed), exit 2 on a usage error.
Stdlib only.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REGISTRY = REPO_ROOT / ".agent" / "contract_kinds.json"
EXPECTED_PATH = (REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "harness-gate-hooks"
                 / "goldens" / "registry.expected.json")
HOOK_FIELDS = ("stage", "on_error", "command")
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


def hooks_by_name(data: dict) -> dict:
    hooks = data.get("gate_hooks")
    if not isinstance(hooks, list):
        return {}
    return {h["name"]: h for h in hooks if isinstance(h, dict) and isinstance(h.get("name"), str)}


def compare(actual: dict, expected: dict) -> list:
    problems = []
    got, want = hooks_by_name(actual), hooks_by_name(expected)
    for name in want:
        if name not in got:
            problems.append(f"gate hook {name!r} is not registered")
            continue
        for field in HOOK_FIELDS:
            if got[name].get(field) != want[name][field]:
                problems.append(f"gate hook {name!r} {field} is {got[name].get(field)!r}, "
                                f"expected {want[name][field]!r}")
    problems += [f"unexpected gate hook {n!r}" for n in got if n not in want]
    kinds = actual.get("kinds") if isinstance(actual.get("kinds"), dict) else {}
    for name, spec in expected.get("kinds", {}).items():
        if kinds.get(name) != spec:
            problems.append(f"project kind {name!r} is {kinds.get(name)!r}, expected {spec!r}")
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
    print(f"PASS: {path} declares the expected gate hooks and project kinds")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main(sys.argv))

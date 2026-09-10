#!/usr/bin/env python3
"""verify_contract_naming.py — flags contract YAML files under
.agent/memory/project/specs/ that don't follow the contract-f<N>.yaml
naming convention mandated in .agent/agents/architect.md.

Prose-only enforcement (the architect.md instruction) has no mechanical
backstop: nothing previously caught an architect run that wrote
contract.yaml, f1-contract.yaml, or contract-feature1.yaml instead of
contract-f<N>.yaml. This script is that backstop.

A file is treated as a "contract" if it declares
`schema: athanor.contract/v1` in one of its first few lines — this avoids
false positives on other YAML files that legitimately live under specs/
(e.g. non-contract config or data fixtures) without requiring a full YAML
parse.

Standalone advisory script — NOT wired into quick_gate.sh's critical path.
Run manually, by @maintainer during periodic hygiene sweeps, or wire it
into a gate later if drift proves recurring in practice.

Usage:
  python3 execution/checks/verify_contract_naming.py [specs_dir]

Exit code 0: no mis-named contracts found.
Exit code 1: one or more mis-named contracts found (listed on stdout).
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SPECS_DIR = REPO_ROOT / ".agent" / "memory" / "project" / "specs"

SCHEMA_MARKER = "schema: athanor.contract/v1"
NAME_PATTERN = re.compile(r"^contract-f\d+\.yaml$")
HEADER_LINES_TO_SCAN = 5


def is_contract_file(path: Path) -> bool:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            for _ in range(HEADER_LINES_TO_SCAN):
                line = f.readline()
                if not line:
                    break
                if line.strip() == SCHEMA_MARKER:
                    return True
    except OSError:
        return False
    return False


def find_misnamed_contracts(specs_dir: Path) -> list[Path]:
    misnamed = []
    for path in sorted(specs_dir.rglob("*.yaml")):
        # Fixture/reference contracts under any goldens/ dir are not live
        # contracts an architect wrote for real — e.g. this checker's own
        # test fixtures under
        # specs/architect-contract-naming-guardrail/goldens/fixtures/.
        # Skip them so running this over the whole specs/ tree doesn't
        # perpetually flag its own test data.
        if "goldens" in path.relative_to(specs_dir).parts:
            continue
        if not is_contract_file(path):
            continue
        if not NAME_PATTERN.match(path.name):
            misnamed.append(path)
    return misnamed


def main() -> int:
    specs_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SPECS_DIR
    if not specs_dir.is_dir():
        print(f"specs dir not found: {specs_dir}", file=sys.stderr)
        return 1

    misnamed = find_misnamed_contracts(specs_dir)
    if not misnamed:
        print("OK: all contract files follow contract-f<N>.yaml naming")
        return 0

    print("Mis-named contract files found (expected contract-f<N>.yaml):")
    for path in misnamed:
        try:
            rel = path.relative_to(REPO_ROOT)
        except ValueError:
            rel = path
        print(f"  {rel}")
    return 1


if __name__ == "__main__":
    sys.exit(main())

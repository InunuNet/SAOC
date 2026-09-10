#!/usr/bin/env python3
"""Every verification-triad check must carry a non-empty `target:`.

Covers all three triad kinds -- codex_qa, browser_deployed_check, gws_inbox_check -- because
all three read `target:` and ignore `command:`, so all three fail the same silent way.

contract.py:162-167 reads `target:` for a codex_qa check and ignores `command:`. An
assertion carrying only `command:` passes an empty prompt to execution/codex_qa.sh, which
exits 2 on a usage error -- so no review runs, while the contract reads as fully populated.
That happened to A39 on 2026-09-09 and was found only by reading the handler.

Exit 0 = every codex_qa check has a target. 1 = one or more do not. 2 = harness failure.
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("harness: pyyaml not available", file=sys.stderr)
    sys.exit(2)

DEFAULT_CONTRACT = (Path(__file__).resolve().parent.parent.parent
                    / ".agent/memory/project/specs/national-show-ia-alignment/contract-m1.yaml")


def main() -> int:
    # An optional path argument exists so this check can be driven against a
    # deliberately-broken fixture. A guard nobody has watched fail is not a guard.
    contract = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CONTRACT
    if not contract.is_file():
        print(f"harness: contract not found at {contract}", file=sys.stderr)
        return 2
    try:
        checks = yaml.safe_load(contract.read_text())["assertions"]["checks"]
    except Exception as exc:                                    # noqa: BLE001
        print(f"harness: could not parse contract -- {exc}", file=sys.stderr)
        return 2

    triad_kinds = {"codex_qa", "browser_deployed_check", "gws_inbox_check"}
    triad_checks = [c for c in checks if c.get("type") in triad_kinds]
    bad = [(c.get("id", "<no id>"), c.get("type")) for c in triad_checks
           if not str(c.get("target", "")).strip()]

    for cid, kind in bad:
        print(f"FAIL {cid}: {kind} check has no non-empty `target:` -- it would receive an "
              f"empty target and verify nothing. `command:` is ignored for this kind.",
              file=sys.stderr)

    print(f"triad checks: {len(triad_checks)}, missing target: {len(bad)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

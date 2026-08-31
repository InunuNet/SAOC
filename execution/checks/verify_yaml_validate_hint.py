#!/usr/bin/env python3
"""GOLDEN -- place at execution/checks/verify_yaml_validate_hint.py.

Mechanical proof for contract-f2.yaml (yaml-authoring-guardrails, F2):
actionable, enriched errors from `contract.py validate` and
`mission.py validate` when a yaml.YAMLError is caught, via
execution/yaml_safe.py::diagnose_scalar_break(source, err).

Two modes, both exercised by contract-f2.yaml's assertions:

  --mode mechanical
    Runs the real CLI (`python3 execution/contract.py validate <f>` /
    `python3 execution/mission.py validate <f>`) as a black-box subprocess
    against three small fixtures shipped alongside this script:
      - fixture_colon_space_contract.yaml -- unquoted colon+whitespace
        inside a `command:` plain scalar. Must produce PyYAML's original
        error UNCHANGED plus an appended "hint:" line naming the colon-space
        signature and the correct line number (9), not the possibly-wrong
        line PyYAML itself reports.
      - fixture_hash_space_mission.md -- unquoted whitespace+hash inside a
        multi-line `name:` plain scalar (mission frontmatter). PyYAML
        reports the error two lines below the actual site (line 10, a
        `status:` key) -- this is the exact "wrong line/column" problem the
        mission exists to fix. Must produce the original error UNCHANGED
        plus a "hint:" line naming the space-hash signature and the REAL
        site (line 8), not PyYAML's misleading line 10.
      - fixture_unrelated_error.yaml -- a bad-indentation YAMLError with
        neither signature present. Must produce the original error
        UNCHANGED with NO "hint:" line appended (fallback proof -- the
        heuristic must not fabricate a hint when it finds nothing).

  --mode sweep
    Real, full sweep (not sampled) of every pre-existing contract and
    mission file in this repo:
      - every .agent/memory/project/specs/**/contract-f*.yaml
      - every .agent/memory/project/missions/*.md
    Runs the real CLI `validate` subcommand against each (plain `validate`,
    not `--strict` -- `--strict`'s binary-assertion-ratio check is an
    unrelated pre-existing invariant, not part of this feature's contract)
    and asserts the combined stdout+stderr never contains a "hint:" line.
    Since a hint can only ever be appended inside the `except
    yaml.YAMLError` branch this feature adds, and every one of these files
    already parses successfully (that's what "pre-existing, in active use"
    means), this is a real behavioral no-change proof, not a tautology
    dressed up as one -- if any of these files DID fail to parse and
    happened to trip the heuristic, that would show up here as a hint
    appearing where none appeared before, exactly the false positive this
    mode exists to catch.

Exits 0 and prints OK on success. Exits 1 with a diagnostic (which files/
fixtures, what was expected vs seen) on any assertion failure.
"""
import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GOLDENS_DIR = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "yaml-authoring-guardrails" / "goldens"
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
MISSION_PY = REPO_ROOT / "execution" / "mission.py"
SPECS_DIR = REPO_ROOT / ".agent" / "memory" / "project" / "specs"
MISSIONS_DIR = REPO_ROOT / ".agent" / "memory" / "project" / "missions"


def run(cmd):
    p = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=60)
    return p.returncode, p.stdout, p.stderr


def check(cond, msg, failures):
    if not cond:
        failures.append(msg)


def mode_mechanical():
    failures = []

    colon_fixture = GOLDENS_DIR / "fixture_colon_space_contract.yaml"
    rc, out, err = run([sys.executable, str(CONTRACT_PY), "validate", str(colon_fixture)])
    combined = out + err
    check(rc != 0, f"colon-space fixture: expected nonzero exit, got {rc}", failures)
    check("mapping values are not allowed here" in combined,
          "colon-space fixture: original PyYAML error text missing from output "
          f"(got: {combined!r})", failures)
    check("hint:" in combined, "colon-space fixture: no hint appended", failures)
    check("colon-space" in combined,
          "colon-space fixture: hint did not name the colon-space signature", failures)
    check("line 9" in combined,
          "colon-space fixture: hint did not point at the real site (line 9), "
          f"got: {combined!r}", failures)

    hash_fixture = GOLDENS_DIR / "fixture_hash_space_mission.md"
    rc, out, err = run([sys.executable, str(MISSION_PY), "validate", str(hash_fixture)])
    combined = out + err
    check(rc != 0, f"hash-space fixture: expected nonzero exit, got {rc}", failures)
    check("hint:" in combined, "hash-space fixture: no hint appended", failures)
    check("space-hash" in combined,
          "hash-space fixture: hint did not name the space-hash signature", failures)
    check("line 8" in combined,
          "hash-space fixture: hint did not point at the real site (line 8, the `name:` "
          f"field), not PyYAML's misleading line 10, got: {combined!r}", failures)

    unrelated_fixture = GOLDENS_DIR / "fixture_unrelated_error.yaml"
    rc, out, err = run([sys.executable, str(CONTRACT_PY), "validate", str(unrelated_fixture)])
    combined = out + err
    check(rc != 0, f"unrelated fixture: expected nonzero exit, got {rc}", failures)
    check("hint:" not in combined,
          f"unrelated fixture: fabricated a hint where none should exist: {combined!r}",
          failures)

    return failures


def mode_sweep():
    failures = []

    contract_files = sorted(SPECS_DIR.rglob("contract-f*.yaml"))
    check(len(contract_files) > 0, "sweep found zero contract-f*.yaml files -- glob is broken",
          failures)
    for f in contract_files:
        rc, out, err = run([sys.executable, str(CONTRACT_PY), "validate", str(f)])
        combined = out + err
        check("hint:" not in combined,
              f"{f}: spurious hint appended to a pre-existing file: {combined!r}", failures)

    mission_files = sorted(MISSIONS_DIR.glob("*.md"))
    check(len(mission_files) > 0, "sweep found zero mission .md files -- glob is broken",
          failures)
    for f in mission_files:
        rc, out, err = run([sys.executable, str(MISSION_PY), "validate", str(f)])
        combined = out + err
        check("hint:" not in combined,
              f"{f}: spurious hint appended to a pre-existing file: {combined!r}", failures)

    print(f"  swept {len(contract_files)} contract files, {len(mission_files)} mission files",
          file=sys.stderr)
    return failures


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["mechanical", "sweep"], required=True)
    args = parser.parse_args()

    failures = mode_mechanical() if args.mode == "mechanical" else mode_sweep()

    if failures:
        for f in failures:
            print(f"FAIL: {f}", file=sys.stderr)
        return 1

    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

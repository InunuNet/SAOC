#!/usr/bin/env python3
"""A14: invocation-form parity between the firestore-residue-guard CI job and
this contract's own assertions.

Adapted from contracts/checks/dataset-residue-guard/check_invocation_parity.py
(the sibling guard's proven A15) after the 2026-08-15/16 incident where that
guard's CI job ran `node --import tsx/esm ...` while every local assertion ran
a different invocation and stayed green throughout, so the job's ERR_REQUIRE_
CYCLE_MODULE failure on GitHub's Node 22 was invisible locally. Same fix here:
parse both files structurally (YAML), never grep for a hardcoded literal.

What this proves: the exact command string used by the `firestore-residue-guard`
job's scanner step in .github/workflows/ci.yml is the SAME invocation form
(interpreter + loader/runner flags + script path) as at least one assertion in
contract-firestore-residue-guard.yaml.

What this does NOT and CANNOT prove: that the matched invocation actually runs
successfully on the CI runner's Node version, or that the CI job's credential-
presence branch (`steps.creds.outputs.present == 'true'`) is itself correct —
those require running in CI (or under a locally provisioned matching Node
version), not a static/YAML-structural comparison.
"""
import re
import sys

import yaml

CONTRACT_PATH = "contracts/contract-firestore-residue-guard.yaml"
WORKFLOW_PATH = ".github/workflows/ci.yml"
SCANNER_JOB = "firestore-residue-guard"
SCANNER_SCRIPT = "scripts/scan-firestore-residue.ts"

# Assertions wrap the real invocation in shell plumbing that is not part of "how
# the scanner is launched": a leading `out=$(` / `var=$(` command substitution
# opener, and inside that, a leading `env -u VAR [-u VAR...]` prefix that unsets
# credentials to prove fixture mode is network-free. CI's own step carries
# neither wrapper.
_SUBSHELL_ASSIGN_PREFIX = re.compile(r"^\S+=\$\(\s*")
_ENV_UNSET_PREFIX = re.compile(r"^env(?:\s+-u\s+\S+)+\s+")
_INVOCATION = re.compile(r"\S.*?" + re.escape(SCANNER_SCRIPT))


def extract_invocation(segment: str):
    segment = segment.strip()
    segment = _SUBSHELL_ASSIGN_PREFIX.sub("", segment)
    segment = _ENV_UNSET_PREFIX.sub("", segment)
    if SCANNER_SCRIPT not in segment:
        return None
    # Segments referencing the script as a grep TARGET (source-level checks
    # such as A3/A5/A8), not as an invocation of it — exclude those.
    bare = segment.lstrip("!").strip()
    if bare.startswith("grep") or bare.startswith("! grep"):
        return None
    m = _INVOCATION.search(segment)
    return m.group(0).strip() if m else None


def invocations_in_command(command: str):
    found = []
    for segment in re.split(r"(?:;|&&|\|\|)\s*", command):
        inv = extract_invocation(segment)
        if inv:
            found.append(inv)
    return found


def get_ci_invocation(workflow_path: str):
    with open(workflow_path, "r", encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    job = doc.get("jobs", {}).get(SCANNER_JOB)
    if not job:
        return None, f"no job named '{SCANNER_JOB}' in {workflow_path}"
    for step in job.get("steps", []):
        run = step.get("run", "")
        if SCANNER_SCRIPT in run:
            inv = extract_invocation(run)
            if inv:
                return inv, None
    return None, f"no step in job '{SCANNER_JOB}' runs {SCANNER_SCRIPT}"


def get_assertion_invocations(contract_path: str):
    with open(contract_path, "r", encoding="utf-8") as f:
        doc = yaml.safe_load(f)
    checks = doc.get("assertions", {}).get("checks", [])
    invocations = set()
    for check in checks:
        if check.get("id") == "A14":
            continue  # this assertion doesn't invoke the scanner itself
        command = check.get("command", "")
        for inv in invocations_in_command(command):
            invocations.add(inv)
    return invocations


def main():
    ci_invocation, ci_err = get_ci_invocation(WORKFLOW_PATH)
    if ci_err:
        print(f"FAIL: {ci_err}")
        return 1

    assertion_invocations = get_assertion_invocations(CONTRACT_PATH)
    if not assertion_invocations:
        print(f"FAIL: no assertion in {CONTRACT_PATH} invokes {SCANNER_SCRIPT}")
        return 1

    print(f"CI job '{SCANNER_JOB}' invokes:  {ci_invocation!r}")
    print(f"Contract assertions invoke:      {sorted(assertion_invocations)!r}")

    if ci_invocation in assertion_invocations:
        print("PASS: invocation forms match.")
        return 0

    print(
        "FAIL: the firestore-residue-guard CI job launches the scanner "
        "differently than every contract assertion does. This does not prove "
        "either form is broken — see this script's module docstring for what it "
        "can and cannot prove — but a diverged invocation means the contract has "
        "never once exercised the exact command CI runs."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())

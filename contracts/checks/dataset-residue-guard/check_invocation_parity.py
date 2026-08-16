#!/usr/bin/env python3
"""A15: invocation-form parity between the dataset-residue-guard CI job and the
contract's own assertions.

What this proves: the exact command string used by the `dataset-residue-guard`
job's scanner step in .github/workflows/ci.yml is the SAME invocation form
(interpreter + loader/runner flags + script path) as at least one assertion in
contract-dataset-residue-guard.yaml. Both files are parsed structurally (YAML),
never grepped for a hardcoded literal, so a future edit to either side that
silently drifts from the other is caught automatically — no one has to remember
to update this script when the invocation changes.

What this does NOT and CANNOT prove: that the matched invocation actually runs
successfully on the CI runner. The 2026-08-15 red-CI incident this assertion was
added for (`node --import tsx/esm ...` raising ERR_REQUIRE_CYCLE_MODULE on
GitHub's Node 22 while working locally on Node 26.4.0) is a runtime/module-loader
behaviour difference between two Node versions, invisible to any static text or
YAML-structural comparison run on the local machine. No cheap local check can
reproduce it without actually provisioning and running under Node 22 locally
(e.g. via nvm/volta) or in CI itself — which is the very thing that just failed.
This script closes the "the two invocations silently diverged" blind spot only;
it does not and cannot close the "this invocation works on the CI runner's Node
version" blind spot. Treat that as a standing, documented gap, not as something
this assertion implicitly covers.
"""
import re
import sys

import yaml

REPO_ROOT_MARKERS = ("contracts", ".github")
CONTRACT_PATH = "contracts/contract-dataset-residue-guard.yaml"
WORKFLOW_PATH = ".github/workflows/ci.yml"
SCANNER_JOB = "dataset-residue-guard"
SCANNER_SCRIPT = "scripts/scan-dataset-residue.ts"

# Assertion commands wrap the scanner invocation in test-isolation plumbing that
# is not part of "how the scanner is launched" (env-var unsetting to prove
# fixture mode is network-free, output capture, exit-code checks). Strip a
# leading `env -u VAR [-u VAR...]` prefix before extracting the invocation —
# CI's own step never carries this prefix, so leaving it in would make parity
# permanently unsatisfiable even when the real interpreter/script portion
# matches.
# Assertions wrap the real invocation in shell plumbing that is not part of
# "how the scanner is launched": a leading `out=$(` / `var=$(` command
# substitution opener, and inside that, a leading `env -u VAR [-u VAR...]`
# prefix that unsets credentials to prove fixture mode is network-free. CI's
# own step carries neither wrapper, so both must be stripped before comparing
# — otherwise parity would be permanently unsatisfiable even when the real
# interpreter/script portion is identical.
_SUBSHELL_ASSIGN_PREFIX = re.compile(r"^\S+=\$\(\s*")
_ENV_UNSET_PREFIX = re.compile(r"^env(?:\s+-u\s+\S+)+\s+")
_INVOCATION = re.compile(r"\S.*?" + re.escape(SCANNER_SCRIPT))


def extract_invocation(segment: str):
    """Given one shell command segment, return the interpreter+flags+script
    prefix that launches the scanner, or None if this segment doesn't."""
    segment = segment.strip()
    segment = _SUBSHELL_ASSIGN_PREFIX.sub("", segment)
    segment = _ENV_UNSET_PREFIX.sub("", segment)
    if SCANNER_SCRIPT not in segment:
        return None
    # Segments like `grep -E ... scripts/scan-dataset-residue.ts` or
    # `! grep ...` reference the script as a grep TARGET (source-level checks
    # such as A3/A5), not as an invocation of it — exclude those so they don't
    # pollute the comparison set.
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
        if check.get("id") == "A15":
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
        "FAIL: the dataset-residue-guard CI job launches the scanner differently "
        "than every contract assertion does. This does not prove either form is "
        "broken — see this script's module docstring for what it can and cannot "
        "prove — but a diverged invocation means the contract has never once "
        "exercised the exact command CI runs."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())

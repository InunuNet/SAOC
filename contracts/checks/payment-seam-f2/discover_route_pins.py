#!/usr/bin/env python3
"""Discover EVERY assertion across EVERY contract that pins a given file.

Written because F2's A3 originally enumerated the four `.sha256` goldens it happened to know
about, @dev updated all four correctly, A3 went green — and `contract-ticketing-hardening.yaml`'s
A33, which pins the SAME file by `diff` against an `.expected.ts.txt`, stayed red. A3 asserted its
own completeness while being incomplete: a check satisfied by a proxy (the four files I listed)
rather than by the property (every pin for this file is current). Enumeration cannot be the fix for
a defect caused by enumeration, so discovery is derived from the contracts themselves.

Commands are read via a YAML parser, never by grepping the file: a `command:` string quoted inside
a `description:` or a `#` comment must not register as an assertion. That is the same
prose-satisfies-the-check trap that defeated A8's registry ban.

Emits one `KIND|contract|assertion_id|golden|target` line per discovered pin:

  SHA256   golden holds a hex digest compared with `shasum -a 256 -c -`
  DIFF     golden is a full expected copy compared with `diff`
  WORKTREE `git diff`-style "this file has no uncommitted changes" guard. Not a pin and not a
           content claim: it is red for the whole of any feature that touches the file and goes
           green on commit. Must be re-verified after committing, never waved through.
  GITHASH  the file is compared against its own git history rather than a golden — nothing to re-pin
  CONTENT  a grep/test claim about what the file CONTAINS. These are the ones a rewire silently
           breaks: they assert the presence of code the rewire deliberately moves elsewhere.
  UNKNOWN  pin-shaped but unparseable. Reported so a novel idiom becomes a finding rather than a
           silent skip; this is what stops discovery decaying the way the pins did.

Run as: python3 contracts/checks/payment-seam-f2/discover_route_pins.py <target-path>
"""

import glob
import os
import re
import sys

import yaml

GOLDEN_ROOT = "contracts/golden/"


def commands(contract_path):
    """Yield (assertion_id, command) from a contract's assertions, via the YAML parser only."""
    try:
        with open(contract_path) as handle:
            doc = yaml.safe_load(handle)
    except Exception as error:  # a malformed contract must be loud, never skipped
        print(f"UNKNOWN|{contract_path}|<unparseable>|-|-  ({error})")
        return
    if not isinstance(doc, dict):
        return
    # `assertions:` is a mapping with a `checks:` list in most contracts, but a bare list in a
    # few older ones. Handle both rather than crashing — a contract this cannot read is a contract
    # whose pins go undiscovered, which is the failure this script exists to prevent.
    assertions = doc.get("assertions")
    if isinstance(assertions, dict):
        checks = assertions.get("checks") or []
    elif isinstance(assertions, list):
        checks = assertions
    else:
        checks = []
    for check in checks:
        if not isinstance(check, dict):
            continue
        command = check.get("command")
        if isinstance(command, str):
            yield str(check.get("id", "?")), command


def classify(command, target):
    """Return (kind, golden) for a command that mentions `target`."""
    if re.search(r"\bgit diff\b", command):
        return "WORKTREE", "-"

    if "git show" in command or "git cat-file" in command or "git rev-parse" in command:
        return "GITHASH", "-"

    if "shasum" in command and "-c" in command:
        match = re.search(r"cat\s+(\S*\.sha256)", command)
        if match:
            return "SHA256", match.group(1)
        return "UNKNOWN", "-"

    if re.search(r"\bdiff\b", command):
        tokens = [t for t in re.split(r"\s+", command) if t and not t.startswith("-")]
        goldens = [t for t in tokens if t.startswith(GOLDEN_ROOT)]
        # Exactly one side under contracts/golden/ — otherwise refuse to guess which is which.
        if len(goldens) == 1:
            return "DIFF", goldens[0]
        return "UNKNOWN", "-"

    if re.search(r"\b(grep|test -f|test -e)\b", command):
        return "CONTENT", "-"

    return "UNKNOWN", "-"


def main():
    if len(sys.argv) != 2:
        print("usage: discover_route_pins.py <target-path>", file=sys.stderr)
        return 2
    target = sys.argv[1]

    found = False
    for contract in sorted(glob.glob("contracts/*.yaml")):
        for assertion_id, command in commands(contract):
            if target not in command:
                continue
            kind, golden = classify(command, target)
            print(f"{kind}|{os.path.basename(contract)}|{assertion_id}|{golden}|{target}")
            found = True

    if not found:
        # Zero pins for a file the caller believes is pinned is itself a finding: either the
        # target moved, or discovery has stopped working. Never report it as "all clear".
        print(f"UNKNOWN|-|-|-|{target}  (no assertion in any contract mentions this path)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

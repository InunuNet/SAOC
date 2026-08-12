#!/usr/bin/env python3
"""Parse an apphosting.yaml and emit `VAR=value` tokens for every env entry whose
`availability` includes BUILD.

Used by build_isolated.sh to construct the exact environment the App Hosting
builder actually has — no more, no less — so the hermetic build assertion tests
reality, not a hand-maintained guess at what apphosting.yaml says.

Refuses (non-zero exit, nothing printed) if any BUILD-available entry is
`secret:`-sourced rather than a literal `value:` — a secret should never be
BUILD-available (that is precisely the forbidden shortcut this contract exists
to block: see check_apphosting_guard.py for the standing structural assertion,
this is a second, independent line of defense inside the tool that would
otherwise happily leak one into the build env).

Usage: python3 extract_build_vars.py path/to/apphosting.yaml
Exit 0 and print `VAR=value` lines (one per BUILD var) on success.
Exit 1 and print an error to stderr if a BUILD entry is secret-sourced or the
file cannot be parsed.
"""
import sys

import yaml


def extract(path: str) -> list[tuple[str, str]]:
    with open(path) as f:
        doc = yaml.safe_load(f)

    build_vars: list[tuple[str, str]] = []
    for entry in doc.get("env", []):
        availability = entry.get("availability", [])
        if "BUILD" not in availability:
            continue
        name = entry["variable"]
        if "secret" in entry:
            raise ValueError(
                f"REFUSING: {name} is BUILD-available AND secret-sourced "
                f"({entry['secret']}) — a secret must never be baked into the "
                "build. This is the forbidden shortcut; fix apphosting.yaml, "
                "not this script."
            )
        if "value" not in entry:
            raise ValueError(f"{name} is BUILD-available but has neither value: nor secret:")
        build_vars.append((name, str(entry["value"])))
    return build_vars


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: extract_build_vars.py path/to/apphosting.yaml", file=sys.stderr)
        return 1
    try:
        build_vars = extract(sys.argv[1])
    except (OSError, ValueError, yaml.YAMLError) as exc:
        print(f"extract_build_vars: {exc}", file=sys.stderr)
        return 1
    for name, value in build_vars:
        print(f"{name}={value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

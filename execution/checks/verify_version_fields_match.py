#!/usr/bin/env python3
"""Guard: .agent/version must match .agent/profile.json's template_version (#1295/#1312).

Root cause: this repo's own .agent/version (source of truth) and
.agent/profile.json's template_version drifted apart — the template lying about its
own currency to every downstream full_boot.sh update check. This script fails loud on
any future divergence and is wired into `make audit`.

Paths are read relative to CWD so this works both at the repo root and inside test
sandboxes/fixtures.

Exit 0, silent: .agent/version == profile.json.template_version.
Exit non-zero, printing both values: fields diverge.
Exit non-zero, "cannot verify" message: either file missing/unparseable (safe default
is to block, never silently pass).
"""

import json
import sys
from pathlib import Path

VERSION_FILE = Path(".agent/version")
PROFILE_FILE = Path(".agent/profile.json")


def main() -> int:
    if not VERSION_FILE.is_file():
        print(f"cannot verify: {VERSION_FILE} is missing", file=sys.stderr)
        return 1
    if not PROFILE_FILE.is_file():
        print(f"cannot verify: {PROFILE_FILE} is missing", file=sys.stderr)
        return 1

    try:
        version = VERSION_FILE.read_text().strip()
    except OSError as exc:
        print(f"cannot verify: failed to read {VERSION_FILE}: {exc}", file=sys.stderr)
        return 1

    try:
        profile = json.loads(PROFILE_FILE.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"cannot verify: failed to parse {PROFILE_FILE}: {exc}", file=sys.stderr)
        return 1

    if "template_version" not in profile:
        print(f"cannot verify: {PROFILE_FILE} has no template_version field", file=sys.stderr)
        return 1

    template_version = str(profile["template_version"]).strip()

    if version != template_version:
        print(
            f"version fields diverged: {VERSION_FILE}={version} "
            f"vs {PROFILE_FILE}.template_version={template_version}",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

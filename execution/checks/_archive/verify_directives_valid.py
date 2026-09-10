#!/usr/bin/env python3
"""A8 (spec directive-channel F1) -- publish-side lint for .agent/directives/.

Every file in Athanor's own .agent/directives/ must parse, validate, carry
symmetric supersede links, pass the deny-list, and address only the closed
target vocabulary.

The vocabulary check lives HERE and deliberately NOT in
``directives.validate_directive``: a reader must stay forward-compatible when a
fifth downstream is added, or every checkout would call directives for the new
project invalid until it updated. On the publishing side the list is by
definition current -- and a typo'd token addresses NOBODY, silently, which is
exactly the failure class this converts into a gate failure.

Usable standalone as a pre-publish lint:

    python3 execution/checks/verify_directives_valid.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "execution"))

import directives  # noqa: E402

ALLOWED_TARGETS = set(directives.KNOWN_TARGETS) | {"all"}


def main() -> int:
    directory = ROOT / directives.DIRECTIVES_DIR
    if not directory.is_dir():
        print(f"FAIL: {directives.DIRECTIVES_DIR}/ does not exist -- "
              "the publish directory is part of the feature, create it")
        return 1

    errors: list = []
    metas: dict = {}
    paths = sorted(directory.glob("*.md"))

    for path in paths:
        text = path.read_text(encoding="utf-8")
        try:
            meta, body = directives.parse_directive(text, path.name)
        except directives.DirectiveError as exc:
            errors.append(str(exc))
            continue

        errors.extend(directives.validate_directive(meta, body, path.name))

        for token in meta.get("targets") or []:
            if isinstance(token, str) and token.strip().lower() not in ALLOWED_TARGETS:
                errors.append(
                    f"{path.name}: target {token!r} is not in the closed vocabulary "
                    f"{sorted(ALLOWED_TARGETS)} -- it would address NOBODY, silently. "
                    "Athanor is the publisher and is never a target."
                )

        for finding in directives.lint_body(body):
            errors.append(f"{path.name}: deny-list: {finding}")

        did = meta.get("id")
        if isinstance(did, str) and did:
            if did in metas:
                errors.append(f"{path.name}: duplicate id {did!r}")
            metas[did] = meta

    errors.extend(f"link: {e}" for e in directives.validate_links(metas))

    for path in sorted(directory.iterdir()):
        if path.is_file() and path.suffix != ".md":
            errors.append(
                f"{path.name}: only <id>.md directives belong in "
                f"{directives.DIRECTIVES_DIR}/ -- the directory listing IS the index, "
                "and applied-state must live in the receiving project"
            )

    print(f"checked {len(paths)} directive(s) in {directives.DIRECTIVES_DIR}/")
    if errors:
        for err in errors:
            print(f"  FAIL {err}")
        print(f"\nFAIL: {len(errors)} problem(s)")
        return 1
    for did in sorted(metas):
        meta = metas[did]
        print(f"  ok   {did}  [{meta['status']}/{meta['priority']}] "
              f"-> {', '.join(meta['targets'])}")
    print("\nPASS: every published directive is valid, addressed and clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())

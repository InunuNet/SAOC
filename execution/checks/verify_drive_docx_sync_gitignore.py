#!/usr/bin/env python3
"""F1 (mission drive-docx-version-export) -- repo-hygiene check for the
architect's commit/ignore decision (see goldens/README.md): raw .docx export
bytes under content/drive-source/ are gitignored (regenerable from Drive on
demand, bulky, binary diffs are useless in review); the parsed content.md,
per-version manifest.json, and the top-level index.json are NOT gitignored
(small, diffable, and are the actual provenance/parse artefacts this mission
exists to produce).

RED today (no .gitignore entry exists yet) -- expected; goes GREEN once
@dev adds the pattern. Uses `git check-ignore` (the real mechanism, not a
grep guess) against representative sample paths, so a pattern that looks
right in the .gitignore file but doesn't actually match real paths (wrong
glob anchoring, wrong directory depth) is caught, not just "text is present
somewhere".
"""
import subprocess
import sys

STORE_ROOT = "content/drive-source"

MUST_BE_IGNORED = [
    f"{STORE_ROOT}/National Show/4. South African Exhibitors/Vendor Pricing/v1.0/source.docx",
    f"{STORE_ROOT}/SAOC/Some Doc/v2.0/source.docx",
]
MUST_NOT_BE_IGNORED = [
    f"{STORE_ROOT}/National Show/4. South African Exhibitors/Vendor Pricing/v1.0/content.md",
    f"{STORE_ROOT}/National Show/4. South African Exhibitors/Vendor Pricing/v1.0/manifest.json",
    f"{STORE_ROOT}/index.json",
]


def is_ignored(path):
    result = subprocess.run(["git", "check-ignore", "-q", path], capture_output=True)
    return result.returncode == 0


def main():
    failures = []
    for path in MUST_BE_IGNORED:
        if not is_ignored(path):
            failures.append(f"expected gitignored (raw .docx export, regenerable/bulky): {path}")
    for path in MUST_NOT_BE_IGNORED:
        if is_ignored(path):
            failures.append(f"expected NOT gitignored (parsed/provenance artefact this mission exists to produce): {path}")

    if failures:
        print("FAIL")
        for f in failures:
            print(f"FAIL: {f}")
        print(
            "FAIL: A wrong .gitignore pattern that's too broad (ignores content.md/manifest.json/"
            "index.json too) would silently hide the tool's actual output from review; too narrow "
            "(doesn't match nested version dirs) would let binary .docx blobs bloat the repo."
        )
        sys.exit(1)
    print("PASS: .gitignore excludes raw source.docx exports and keeps parsed/provenance artefacts tracked")
    sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
verify_no_baseline_pycache_filter.py — F9: _enumerate_no_baseline_harness_paths()
must never return compiled Python bytecode artefacts.

CONTEXT (template-update-actually-updates F9, downstream defect report from
Alembic's live 3.7.110 first-hardened-run): _enumerate_no_baseline_harness_paths()
in execution/update_template.py walks every HARNESS directory entry in
.agent/update-manifest.yaml (e.g. "execution/") with dst_dir.rglob("*") and
returns every on-disk file with no recorded baseline. On Alembic's real repo
this returned 780 paths, 28 of them execution/__pycache__/*.pyc bytecode.

Why bytecode specifically, and not other file types, is the right and ONLY
generalization here: a .pyc file is not authored content -- it is the
interpreter's own cached compile of a sibling .py file, deleted and
regenerated automatically (different mtime, sometimes a different filename
tag, on every interpreter version change) with zero human involvement.
Recording a baseline for it is not merely noise, it is actively wrong: F6's
--adopt-baseline all would stamp sha256(bytecode-as-it-happens-to-be-right-now),
which goes stale the moment the interpreter recompiles it, defeating the
entire point of a baseline (detecting real drift). No other artefact class
under the current HARNESS manifest entries (execution/, .agent/agents/,
.agent/rules/, .agent/skills/, .agent/workflows/, template/) shares this
exact property today -- they are all human-authored or version-controlled
source. Generalizing further (e.g. .DS_Store, node_modules, build/) would be
speculative filtering for artefact classes that do not currently appear
under any HARNESS path; this check scopes ONLY to what is proven to occur:
__pycache__/ directories and *.pyc / *.pyo compiled bytecode files, at any
depth under any HARNESS directory entry -- not hardcoded to "execution/".

Also inflates the number an operator reads at exactly the moment they
should be scrutinising it (780 vs 752) -- see the F9 contract for the full
defect writeup.

THIS CHECK CALLS THE REAL FUNCTION AGAINST A REAL ON-DISK FIXTURE TREE. It
does not grep update_template.py's source text -- a source-text grep is
exactly the defect class that let this bug ship silently (see the F9
contract's "why the assertion must invoke the function" rationale).
"""
import shutil
import sys
import tempfile
from pathlib import Path

def _find_repo_root(start: Path) -> Path:
    """Walk upward from this file to find the repo root, identified by
    execution/update_template.py existing under it. Deliberately NOT a
    fixed parents[N] index -- this script is invoked from two different
    locations (execution/checks/ directly, and its .golden copy nested
    under .agent/memory/project/specs/.../goldens/), at different depths
    from the repo root.
    """
    for candidate in [start, *start.parents]:
        if (candidate / "execution" / "update_template.py").is_file():
            return candidate
    raise RuntimeError("could not locate repo root from " + str(start))


REPO_ROOT = _find_repo_root(Path(__file__).resolve().parent)
sys.path.insert(0, str(REPO_ROOT / "execution"))

import update_template  # noqa: E402


def build_fixture(root: Path) -> None:
    """Lay out a HARNESS directory tree with real source files, a
    __pycache__ directory nested at two different depths, a stray top-level
    .pyc (not inside __pycache__, e.g. a manually placed compiled file), and
    a .pyo for good measure -- all under an "execution/"-named HARNESS dir,
    matching the manifest.yaml written alongside it.
    """
    execution = root / "execution"
    execution.mkdir(parents=True)

    # Legitimate, real, human-authored source -- MUST survive the filter.
    (execution / "foo.py").write_text("# real source\n")

    # Top-level __pycache__ (the exact shape Alembic hit).
    pycache = execution / "__pycache__"
    pycache.mkdir()
    (pycache / "foo.cpython-311.pyc").write_bytes(b"\x00fake-bytecode")
    (pycache / "foo.cpython-311.pyo").write_bytes(b"\x00fake-bytecode-pyo")

    # Nested subdirectory with its OWN __pycache__ -- defeats a filter
    # hardcoded to "execution/__pycache__" rather than "any __pycache__ dir
    # at any depth".
    sub = execution / "sub"
    sub.mkdir()
    (sub / "legit.py").write_text("# real nested source\n")
    sub_pycache = sub / "__pycache__"
    sub_pycache.mkdir()
    (sub_pycache / "legit.cpython-311.pyc").write_bytes(b"\x00fake-bytecode-2")

    # A stray .pyc that is NOT inside a __pycache__ directory at all --
    # confirms the filter matches on file extension too, not only on the
    # "__pycache__" directory-name component.
    (execution / "stray.pyc").write_bytes(b"\x00fake-stray-bytecode")

    # A legitimately-named file that merely CONTAINS "pyc" as a substring --
    # must NOT be filtered (defeats an overbroad substring filter).
    (execution / "mypycfile.py").write_text("# not bytecode, just a name\n")

    manifest = root / "manifest.yaml"
    manifest.write_text(
        "paths:\n"
        "  - category: HARNESS\n"
        "    path: execution/\n"
    )


def main() -> int:
    tmpdir = Path(tempfile.mkdtemp(prefix="pycache_filter_fixture_"))
    failures = []
    try:
        build_fixture(tmpdir)

        import os

        cwd = os.getcwd()
        os.chdir(tmpdir)
        try:
            result = update_template._enumerate_no_baseline_harness_paths(
                Path("manifest.yaml")
            )
        finally:
            os.chdir(cwd)

        # Row A1: no __pycache__-directory-component paths at any depth.
        pycache_hits = [p for p in result if "__pycache__" in Path(p).parts]
        if pycache_hits:
            failures.append(
                "A1 FAIL: __pycache__ paths present in enumeration result: "
                f"{pycache_hits}"
            )

        # Row A2: no compiled-bytecode-extension paths, including ones NOT
        # inside a __pycache__ dir (the stray top-level .pyc / .pyo).
        bytecode_hits = [p for p in result if p.endswith((".pyc", ".pyo"))]
        if bytecode_hits:
            failures.append(
                "A2 FAIL: compiled bytecode paths present in enumeration "
                f"result: {bytecode_hits}"
            )

        # Row A3: legitimate real source files at multiple depths must
        # still be present -- a filter broad enough to kill A1+A2 must not
        # also kill real content (defeats "just return [] always" and
        # defeats an overbroad substring/name filter).
        expected_legit = {
            "execution/foo.py",
            "execution/sub/legit.py",
            "execution/mypycfile.py",
        }
        missing_legit = expected_legit - set(result)
        if missing_legit:
            failures.append(
                "A3 FAIL: legitimate source paths were wrongly filtered "
                f"out: {sorted(missing_legit)}"
            )

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if failures:
        print("FAIL: _enumerate_no_baseline_harness_paths() pycache filter")
        for f in failures:
            print(f"  {f}")
        return 1

    print("PASS: _enumerate_no_baseline_harness_paths() excludes all "
          "__pycache__ / .pyc / .pyo paths at every depth while preserving "
          "legitimate source paths")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Detect a symlink-stubbed checkout (platform-scoped-delivery F2).

Git for Windows ships core.symlinks=false at SYSTEM scope, so a default clone
materialises every tracked mode-120000 path as a small REGULAR FILE containing
its target path. Measured on macOS 25.5.0 via `git clone -c
core.symlinks=false`: CLAUDE.md becomes a 9-byte text file, the index still
records 120000, and `git status --porcelain` is EMPTY. Nothing reports a
problem while the agent boots with no instructions.

THE DETECTION RULE is index-based and content-based, and introspects no git
config: for every path the INDEX records at mode 120000, compare it against its
ON-DISK form.

    symlink       -> LINK-OK
    regular file  -> STUB-DAMAGE   (the Windows default-clone state)
    absent        -> STUB-MISSING

Config-based detection (`git config core.symlinks`) was rejected: it describes
the machine, not the worktree, and needs a per-platform reading of three config
scopes. Delegating to `git status` was rejected because status is EMPTY in a
damaged clone.

    python3 execution/checks/verify_no_symlink_stubs.py [--root R]
                                                        [--forbid-tracked-symlinks]

Exit codes: 0 healthy; 2 damage found (or, in --forbid-tracked-symlinks mode,
any tracked symlink at all); 1 the detector's own error.

--forbid-tracked-symlinks is the enforcement mode: a mode-120000 entry is a
violation even when its worktree form is a valid symlink, because that is
precisely the state that looks healthy on macOS and destroys the Windows clone.
This check stays useful after the harness de-symlinks its own root pointers:
every workspace an older init.sh already scaffolded carries symlinks, and the
26 downstream projects are exactly that population.
"""

import argparse
import os
import subprocess
import sys

SYMLINK_MODE = "120000"
STUB_PREVIEW_CHARS = 120
GIT_TIMEOUT_SECONDS = 60

EXIT_OK = 0
EXIT_TOOL_ERROR = 1
EXIT_VIOLATION = 2

REMEDY = "python3 execution/paired_copies.py --sync"


def tracked_symlinks(root):
    """Paths the git INDEX records at mode 120000.

    Index-based on purpose: the on-disk form is exactly what is untrustworthy
    on a damaged checkout.
    """
    try:
        proc = subprocess.run(["git", "ls-files", "-s"], cwd=root,
                              capture_output=True, text=True,
                              timeout=GIT_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError("git ls-files failed in %s (%s)" % (root, exc))
    if proc.returncode != 0:
        raise RuntimeError("git ls-files failed in %s: %s"
                           % (root, proc.stderr.strip()))
    paths = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        meta, _, path = line.partition("\t")
        fields = meta.split()
        if fields and fields[0] == SYMLINK_MODE:
            paths.append(path)
    return paths


def describe(root, relpath):
    """Return (line, ok) for one tracked symlink's on-disk form."""
    path = os.path.join(root, relpath)
    if os.path.islink(path):
        try:
            target = os.readlink(path)
        except OSError:
            target = "?"
        return ("LINK-OK %s -> %s" % (relpath, target), True)
    if not os.path.exists(path):
        return ("STUB-MISSING %s (tracked mode 120000, absent from worktree)"
                % relpath, False)
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as fh:
            body = fh.read(STUB_PREVIEW_CHARS).decode("utf-8", "replace")
    except OSError as exc:
        return ("STUB-DAMAGE %s (tracked mode 120000, unreadable: %s)"
                % (relpath, exc), False)
    return ("STUB-DAMAGE %s (%d B regular file containing %r) - this checkout "
            "was made with core.symlinks=false; run: %s"
            % (relpath, size, body.strip(), REMEDY), False)


def build_parser():
    parser = argparse.ArgumentParser(
        description="Detect symlink-stubbed checkouts from the git index.")
    parser.add_argument("--root", default=".",
                        help="workspace root to scan (default: cwd)")
    parser.add_argument("--forbid-tracked-symlinks", action="store_true",
                        help="treat any tracked mode-120000 entry as a "
                             "violation, even a healthy one")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print("SYMLINK-SCAN-ERROR --root %s is not a directory" % args.root)
        return EXIT_TOOL_ERROR
    try:
        links = tracked_symlinks(root)
    except RuntimeError as exc:
        print("SYMLINK-SCAN-ERROR %s" % exc)
        return EXIT_TOOL_ERROR

    print("SYMLINK-SCAN %d tracked symlink(s) in %s" % (len(links), root))
    bad = 0
    for relpath in sorted(links):
        line, ok = describe(root, relpath)
        print(line)
        if not ok:
            bad += 1
        if args.forbid_tracked_symlinks:
            print("TRACKED-SYMLINK %s -- a tracked symlink is a text stub on "
                  "any default Windows clone, however healthy it looks here"
                  % relpath)

    if args.forbid_tracked_symlinks and links:
        return EXIT_VIOLATION
    return EXIT_VIOLATION if bad else EXIT_OK


if __name__ == "__main__":
    sys.exit(main())

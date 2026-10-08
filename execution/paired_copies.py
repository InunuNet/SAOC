#!/usr/bin/env python3
"""Paired-copy generator and drift gate (platform-scoped-delivery F2).

BINDING RULING (Brad, 2026-09-01): "AGENTS.md should be the default and all
others cloned from it." CLAUDE.md, GEMINI.md and the root rules.md pointer are
REAL FILES cloned from their source -- not symlinks, not repaired symlinks, not
conditionally-materialised symlinks.

WHY. Git for Windows ships core.symlinks=false at SYSTEM scope, so a default
clone materialises every tracked mode-120000 path as a small TEXT FILE
containing its target path, with `git status --porcelain` EMPTY. Claude Code
and Gemini CLI then boot with a 9-byte CLAUDE.md instead of the whole workflow
contract, and nothing reports a problem. A real file cannot be damaged that
way: core.symlinks, Developer Mode, elevated shells and MSYS
winsymlinks:nativestrict are all irrelevant to it.

WHERE THE FAILURE MODE MOVES, WHICH IS NOW THE WHOLE JOB: copies drift. So this
tool is a DRIFT GATE. Drift fails loudly here, at gate time. Nothing is ever
repaired at read time -- `--check` is strictly read-only, because silent repair
is how the original defect stayed invisible.

    python3 execution/paired_copies.py [--root R] [--check | --sync] [--force]

Exit codes: 0 all pairs identical; 2 any pair wrong or any registry row
invalid; 1 tool error.

Pairs are DATA (.agent/paired-copies.yaml): adding a row requires no code
change. Two modes: `clone` (one file, byte-identical) and `mirror` (two
directories; every file present in both is byte-identical -- see
expand_rows()). An unknown mode FAILS CLOSED -- a pair that appears covered
and is not is worse than an uncovered one.
"""

import argparse
import os
import subprocess
import sys

REGISTRY_REL = ".agent/paired-copies.yaml"
# expand_rows() asks update_template.is_harness_checkout(), which lives beside
# this file; make the import work however this script is invoked.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SUPPORTED_MODES = ("clone", "mirror")
DEFAULT_MODE = "clone"

EXIT_OK = 0
EXIT_TOOL_ERROR = 1
EXIT_VIOLATION = 2

GIT_TIMEOUT_SECONDS = 60


def norm(data):
    """LF-normalise.

    Required for comparison, not for writing: on a Windows checkout
    core.autocrlf=true rewrites every text file to CRLF, so a byte-exact
    worktree comparison would go RED on every Windows clone for a reason that
    is not drift. Byte-identity in the repository is asserted at the git blob
    level by the gate, which is the only platform-independent form of it.
    """
    if isinstance(data, bytes):
        data = data.decode("utf-8", "replace")
    return data.replace("\r\n", "\n").replace("\r", "\n")


def read_norm(path):
    with open(path, "rb") as fh:
        return norm(fh.read())


def load_registry(path):
    """Parse the paired-copy registry.

    Deliberately a tiny reader rather than PyYAML: this file is on the path
    that repairs a broken checkout and runs from the gate on three platforms,
    so the harness must not acquire a hard third-party dependency here.
    """
    rows, cur = [], None
    with open(path) as fh:
        for raw in fh:
            line = raw.split("#", 1)[0].rstrip()
            if not line.strip():
                continue
            stripped = line.strip()
            if stripped.startswith("- "):
                cur = {}
                rows.append(cur)
                stripped = stripped[2:].strip()
            if ":" in stripped and cur is not None:
                key, _, value = stripped.partition(":")
                cur[key.strip()] = value.strip().strip("'\"")
    return [r for r in rows if r.get("copy") and r.get("source")]


def head_blob_text(root, relpath):
    """Content of `relpath` at git HEAD, LF-normalised, or None.

    git HEAD is the ledger that tells a merely-STALE clone (the source moved)
    apart from a LOCALLY EDITED one (the clone moved). A `.lock` file recording
    the source hash would work too, and would be one more paired copy that can
    itself drift -- which is the defect this tool exists to remove. Git already
    knows.
    """
    try:
        proc = subprocess.run(["git", "show", "HEAD:%s" % relpath],
                              cwd=root, capture_output=True,
                              timeout=GIT_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0:
        return None
    return norm(proc.stdout)


# Never compared by a mirror: build and OS residue, not source.
MIRROR_IGNORED_NAMES = ("__pycache__", ".DS_Store")


def expand_rows(root, rows):
    """Turn every `enforce: mirror` row into per-file `clone` rows.

    A mirror pairs two DIRECTORIES: every file present under both must be
    byte-identical to its source. A file on only one side is allowed --
    template/ carries a subset of execution/ by design. Expanding into clone
    rows means the mirror inherits the clone rules unchanged, including the
    refusal to overwrite a locally edited copy.

    A mirror binds only the harness checkout. Downstream, both trees arrive
    from the same release, and a project's own execution/ edits are its own
    business, not drift (returns a skip note instead).
    """
    out, notes = [], []
    for row in rows:
        if row.get("enforce", DEFAULT_MODE) != "mirror":
            out.append(row)
            continue
        from update_template import is_harness_checkout
        if not is_harness_checkout(root):
            notes.append("MIRROR-SKIPPED %s (not the harness checkout)" % row["copy"])
            continue
        copy_dir = os.path.join(root, row["copy"])
        source_dir = os.path.join(root, row["source"])
        if not os.path.isdir(source_dir) or not os.path.isdir(copy_dir):
            notes.append("MIRROR-MISSING %s or %s" % (row["copy"], row["source"]))
            out.append({"copy": row["copy"], "source": row["source"],
                        "enforce": "mirror-missing"})
            continue
        for dirpath, dirnames, filenames in os.walk(copy_dir):
            # os.walk never descends a symlinked directory, so the files
            # behind one would silently drop out of the comparison. Fail it
            # closed instead: a pair that looks covered and is not is worse
            # than an uncovered one (Codex QA, 2026-09-29).
            for d in dirnames:
                if os.path.islink(os.path.join(dirpath, d)):
                    rel = os.path.relpath(os.path.join(dirpath, d), copy_dir)
                    out.append({"copy": os.path.join(row["copy"], rel),
                                "source": os.path.join(row["source"], rel),
                                "enforce": "mirror-symlinked-dir"})
            dirnames[:] = sorted(d for d in dirnames if d not in MIRROR_IGNORED_NAMES
                                 and not os.path.islink(os.path.join(dirpath, d)))
            for name in sorted(filenames):
                if name in MIRROR_IGNORED_NAMES:
                    continue
                rel = os.path.relpath(os.path.join(dirpath, name), copy_dir)
                if os.path.isfile(os.path.join(source_dir, rel)):
                    out.append({"copy": os.path.join(row["copy"], rel),
                                "source": os.path.join(row["source"], rel),
                                "enforce": "clone"})
    return out, notes


class PairProblem(Exception):
    """A registry row that cannot be enforced as written."""


def classify(root, row):
    """Return (line, ok) describing the pair's current state. Read-only."""
    copy, source = row["copy"], row["source"]
    mode = row.get("enforce", DEFAULT_MODE)
    if mode not in SUPPORTED_MODES:
        return ("CLONE-ENFORCE-UNKNOWN %s (mode %s)" % (copy, mode), False)

    copy_path = os.path.join(root, copy)
    source_path = os.path.join(root, source)

    if not os.path.isfile(source_path) or os.path.islink(source_path):
        return ("CLONE-SOURCE-MISSING %s (for %s)" % (source, copy), False)
    if os.path.islink(copy_path):
        try:
            target = os.readlink(copy_path)
        except OSError:
            target = "?"
        return ("CLONE-SYMLINK %s -> %s" % (copy, target), False)
    if not os.path.exists(copy_path):
        return ("CLONE-MISSING %s" % copy, False)
    if not os.path.isfile(copy_path):
        return ("CLONE-MISSING %s (not a regular file)" % copy, False)

    want, got = read_norm(source_path), read_norm(copy_path)
    if want != got:
        return ("CLONE-DRIFT %s (%d chars, source %s has %d)"
                % (copy, len(got), source, len(want)), False)
    return ("CLONE-OK %s" % copy, True)


def cmd_check(root, rows):
    bad = 0
    for row in rows:
        line, ok = classify(root, row)
        print(line)
        if not ok:
            bad += 1
    if bad:
        print("CLONE-CHECK %d pair(s) wrong. Edit the SOURCE, then run "
              "`make sync-clones`." % bad)
        return EXIT_VIOLATION
    print("CLONE-CHECK %d pair(s) identical to their source" % len(rows))
    return EXIT_OK


def sync_one(root, row, force):
    """Regenerate one clone. Returns a report line; raises PairProblem if the
    row cannot be honoured."""
    copy, source = row["copy"], row["source"]
    mode = row.get("enforce", DEFAULT_MODE)
    if mode not in SUPPORTED_MODES:
        raise PairProblem("CLONE-ENFORCE-UNKNOWN %s (mode %s)" % (copy, mode))

    copy_path = os.path.join(root, copy)
    source_path = os.path.join(root, source)
    if not os.path.isfile(source_path) or os.path.islink(source_path):
        raise PairProblem("CLONE-SOURCE-MISSING %s (for %s)" % (source, copy))

    with open(source_path, "rb") as fh:
        payload = fh.read()

    if os.path.isfile(copy_path) and not os.path.islink(copy_path):
        current = read_norm(copy_path)
        if current == norm(payload):
            return "CLONE-OK %s" % copy
        head = head_blob_text(root, copy)
        # STALE (the source moved, the clone is untouched) regenerates freely.
        # LOCALLY EDITED (the clone moved) must never be silently discarded:
        # `make sync` runs this generator, and an unconditional overwrite turns
        # "your edit is in the wrong file" into "your edit is gone".
        #
        # git HEAD is the ledger that separates those two cases. When it
        # cannot be read -- no commits yet, not a git repo, git missing -- the
        # ledger is ABSENT, not empty: nothing proves this clone is merely
        # stale, so overwriting it may destroy bytes that exist nowhere else.
        # Treating an unreadable HEAD as permission to overwrite switched the
        # protection off in exactly the state init.sh leaves every freshly
        # scaffolded workspace in (a git repo with no commits).
        #
        # This whole branch is reached only when the clone ALREADY EXISTS as a
        # regular file and its bytes differ from the source. First-run
        # generation of a clone that does not exist yet never lands here, so a
        # brand-new workspace can still mint its clones.
        if not force:
            if head is None:
                raise PairProblem(
                    "CLONE-UNVERIFIABLE %s -- it differs from %s, and HEAD:%s "
                    "could not be read (no commits yet, not a git repo, or git "
                    "unavailable), so there is no ledger proving these bytes "
                    "are a stale copy rather than someone's edit. Not an "
                    "accusation: commit the workspace so HEAD can answer, or "
                    "re-run with --force to regenerate from %s anyway."
                    % (copy, source, copy, source))
            if current != head:
                raise PairProblem(
                    "CLONE-EDITED-BLOCKED %s -- it differs from HEAD:%s, so "
                    "these bytes exist nowhere else. Move the edit into %s and "
                    "re-run, or discard it with --force." % (copy, copy, source))

    parent = os.path.dirname(copy_path)
    if parent and not os.path.isdir(parent):
        os.makedirs(parent)
    if os.path.islink(copy_path):
        os.unlink(copy_path)
    # A REGULAR FILE, always. Never os.symlink: symlink creation on Windows
    # needs Developer Mode or elevation, and MSYS `ln -s` silently yields a
    # copy while exiting 0 -- privilege-dependent and unverifiable at once.
    with open(copy_path, "wb") as fh:
        fh.write(payload)
    return "CLONE-SYNCED %s <- %s" % (copy, source)


def cmd_sync(root, rows, force):
    bad = 0
    for row in rows:
        try:
            print(sync_one(root, row, force))
        except PairProblem as exc:
            print(str(exc))
            bad += 1
        except OSError as exc:
            print("CLONE-WRITE-FAILED %s (%s)" % (row["copy"], exc))
            bad += 1
    if bad:
        print("CLONE-SYNC %d pair(s) not regenerated" % bad)
        return EXIT_VIOLATION
    return EXIT_OK


def build_parser():
    parser = argparse.ArgumentParser(
        description="Generate and verify paired copies (clones) of source files.")
    parser.add_argument("--root", default=".",
                        help="workspace root to operate on (default: cwd)")
    parser.add_argument("--check", action="store_true",
                        help="verify only; strictly read-only (default)")
    parser.add_argument("--sync", action="store_true",
                        help="regenerate every clone from its source")
    parser.add_argument("--force", action="store_true",
                        help="with --sync, overwrite a locally edited clone")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print("CLONE-TOOL-ERROR --root %s is not a directory" % args.root)
        return EXIT_TOOL_ERROR

    registry = os.path.join(root, REGISTRY_REL)
    if not os.path.isfile(registry):
        print("CLONE-REGISTRY-ABSENT %s (no pairs declared in %s)"
              % (REGISTRY_REL, root))
        return EXIT_OK
    try:
        rows = load_registry(registry)
    except OSError as exc:
        print("CLONE-TOOL-ERROR cannot read %s (%s)" % (REGISTRY_REL, exc))
        return EXIT_TOOL_ERROR

    rows, notes = expand_rows(root, rows)
    for note in notes:
        print(note)
    if args.sync:
        return cmd_sync(root, rows, args.force)
    return cmd_check(root, rows)


if __name__ == "__main__":
    sys.exit(main())

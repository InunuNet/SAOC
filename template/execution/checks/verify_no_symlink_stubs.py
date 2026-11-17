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

    python3 execution/checks/verify_no_symlink_stubs.py --materialise

--materialise is THE REMEDY boot prints, and it covers EVERY tracked symlink,
not only the paired-copies registry: Alembic's specs/*/contract-f*.yaml stubs
were never touched by `paired_copies.py --sync`. For each path the INDEX
records at 120000 it reads the link text from the index (`git cat-file blob`,
because on a stubbed clone the worktree file merely contains that text),
resolves it against the link's parent, and, only when the target is a regular
file inside --root (realpath containment) that is not itself a tracked
symlink, writes the target's bytes over the path atomically (temp file in the
same directory + os.replace, which replaces a symlink without following it).
It re-stages with `git rm --cached` + `git add`, in that order AROUND the write
(unstage, write, stage): under core.symlinks=false a plain `git add` of the
materialised file would store its whole content as a symlink target, and
content must never sit on disk while the index still says 120000. If the
final `git add` fails the path prints `PARTIAL` (a safe untracked regular
file) and the run exits 2. Anything else prints `SKIPPED <path> (<reason>)`, is left
untouched, and the run exits 2. Nothing is committed; the operator commits.
Pure python + git, no os.symlink, so it behaves identically on Windows, macOS
and Linux. A second run finds no 120000 entries and is a no-op.
"""

import argparse
import os
import subprocess
import sys
import tempfile

SYMLINK_MODE = "120000"
STUB_PREVIEW_CHARS = 120
GIT_TIMEOUT_SECONDS = 60

EXIT_OK = 0
EXIT_TOOL_ERROR = 1
EXIT_VIOLATION = 2

REGULAR_FILE_MODE = 0o644

# A tracked name such as `:(top,glob)**` is read by git as a PATHSPEC even
# after `--`, so rm/add would hit unrelated paths. Every git call runs literal.
GIT_ENV = dict(os.environ, GIT_LITERAL_PATHSPECS="1")

REMEDY = "python3 execution/checks/verify_no_symlink_stubs.py --materialise"


def tracked_symlinks(root):
    """Paths the git INDEX records at mode 120000.

    Index-based on purpose: the on-disk form is exactly what is untrustworthy
    on a damaged checkout.
    """
    try:
        proc = subprocess.run(["git", "ls-files", "-s", "-z"], cwd=root,
                              capture_output=True, env=GIT_ENV,
                              timeout=GIT_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError("git ls-files failed in %s (%s)" % (root, exc))
    if proc.returncode != 0:
        raise RuntimeError("git ls-files failed in %s: %s"
                           % (root, proc.stderr.decode("utf-8", "replace").strip()))
    # -z: NUL-separated, never C-quoted, so newline and non-ASCII names survive.
    paths = []
    for entry in proc.stdout.split(b"\0"):
        line = os.fsdecode(entry)
        if not line:
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


def _git(root, *args):
    """Run git in root; return the CompletedProcess (bytes output)."""
    try:
        return subprocess.run(["git"] + list(args), cwd=root,
                              capture_output=True, env=GIT_ENV,
                              timeout=GIT_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as exc:
        raise RuntimeError("git %s failed in %s (%s)" % (args[0], root, exc))


def _inside(root, real):
    """True when the realpath `real` is root itself or lies beneath it."""
    base = os.path.normcase(os.path.realpath(root))
    try:
        # commonpath raises ValueError across Windows drives: that is "outside".
        return os.path.commonpath([base, os.path.normcase(real)]) == base
    except ValueError:
        return False


def _is_tracked_link(root, target, link_set):
    """True when `target` IS one of the tracked links, by file identity.

    A spelling comparison misses `agents.md` vs `AGENTS.md` on a
    case-insensitive filesystem; lstat identity does not. lstat, not stat:
    following links would make two links to one file look like each other.
    """
    try:
        target_stat = os.lstat(target)
    except OSError:
        return False
    for link in link_set:
        try:
            if os.path.samestat(target_stat, os.lstat(os.path.join(root, link))):
                return True
        except OSError:
            continue
    return False


def resolve_target(root, relpath, link_text, link_set):
    """Return (target_realpath, None) or (None, reason it must be skipped)."""
    if not link_text:
        return None, "empty link text"
    parent = os.path.dirname(os.path.join(root, relpath))
    target = os.path.join(parent, link_text)
    # The lexical form is used ONLY to spot a tracked-symlink target (a false
    # hit merely skips). Existence is judged on the raw path, so the OS
    # resolves `missing/../x` physically and a dangling link stays dangling.
    try:
        rel = os.path.relpath(os.path.normpath(target), root).replace(os.sep, "/")
    except ValueError:
        # relpath raises across Windows drives (C:\\repo vs D:\\x): outside.
        return None, "target %s is outside --root" % link_text
    if rel in link_set or _is_tracked_link(root, target, link_set):
        return None, "target %s is itself a tracked symlink" % rel
    # realpath alone is not an existence test: it normalises `missing/..`
    # lexically. The OS call on the raw path is.
    if not os.path.exists(target):
        return None, "target %s is missing" % link_text
    real = os.path.realpath(target)
    if not _inside(root, real):
        return None, "target %s is outside --root" % link_text
    if not os.path.isfile(real):
        return None, "target %s is not a regular file" % link_text
    return real, None


def parent_is_plain(root, relpath):
    """True when relpath's parent directory is inside root with no symlink.

    A worktree directory that is a symlink out of root (`sub -> /opt/x`) would
    make write_atomic create and replace a file outside the workspace, and the
    link text resolves through the same directory. The realpath of the parent
    must therefore equal realpath(root)/<dirname(relpath)> exactly.
    """
    base = os.path.realpath(root)
    expected = os.path.join(base, os.path.dirname(relpath))
    actual = os.path.realpath(os.path.join(root, os.path.dirname(relpath)))
    same = os.path.normcase(os.path.normpath(expected)) == os.path.normcase(actual)
    return same and _inside(root, actual)


def write_atomic(path, data):
    """Replace `path` (a symlink is replaced, never followed) with `data`."""
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path) or ".",
                               prefix=".materialise-")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.chmod(tmp, REGULAR_FILE_MODE)
        os.replace(tmp, path)
    except OSError:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def _err(proc):
    return proc.stderr.decode("utf-8", "replace").strip()


def materialise_one(root, relpath, link_set):
    """Materialise one tracked symlink; return True when it is fully done.

    ORDER IS THE SAFETY: unstage first, write second, stage third. Content is
    never on disk while the index still says 120000, because under
    core.symlinks=false a later `git add -A` would store the whole file as a
    link target. A failure at step 1 touches nothing; a failure at step 2
    restores the index entry; a failure at step 3 leaves an untracked regular
    file, which `git add` stores as 100644.
    """
    proc = _git(root, "cat-file", "blob", ":" + relpath)
    if proc.returncode != 0:
        print("SKIPPED %s (cannot read link text from the index: %s)"
              % (relpath, _err(proc)))
        return False
    # Exact bytes, no strip: `AGENTS.md\n` and ` AGENTS.md` are different names.
    link_text = os.fsdecode(proc.stdout)
    if not parent_is_plain(root, relpath):
        print("SKIPPED %s (parent directory resolves outside the workspace "
              "or through a symlink)" % relpath)
        return False
    target, reason = resolve_target(root, relpath, link_text, link_set)
    if reason:
        print("SKIPPED %s (%s)" % (relpath, reason))
        return False
    blob = _git(root, "rev-parse", ":" + relpath)
    try:
        with open(target, "rb") as fh:
            data = fh.read()
    except OSError as exc:
        print("SKIPPED %s (cannot read target: %s)" % (relpath, exc))
        return False
    unstaged = _git(root, "rm", "--cached", "-q", "--", relpath)
    if unstaged.returncode != 0:
        print("SKIPPED %s (git rm --cached failed: %s)" % (relpath, _err(unstaged)))
        return False
    try:
        write_atomic(os.path.join(root, relpath), data)
    except OSError as exc:
        sha = blob.stdout.decode().strip()
        restore = _git(root, "update-index", "--add", "--cacheinfo",
                       "%s,%s,%s" % (SYMLINK_MODE, sha, relpath))
        if restore.returncode != 0:
            print("PARTIAL %s (write failed and the index restore failed: %s; "
                  "run: git update-index --add --cacheinfo %s,%s,%s)"
                  % (relpath, _err(restore), SYMLINK_MODE, sha, relpath))
            return False
        print("SKIPPED %s (write failed: %s)" % (relpath, exc))
        return False
    staged = _git(root, "add", "--", relpath)
    if staged.returncode != 0:
        print("PARTIAL %s (written; index entry removed, re-run git add -- %s)"
              % (relpath, relpath))
        return False
    print("MATERIALISED %s <- %s" % (relpath, link_text))
    return True


def materialise(root, links):
    """Materialise every link; return EXIT_VIOLATION unless all succeeded."""
    link_set = set(links)
    failed = 0
    for relpath in sorted(links):
        if not materialise_one(root, relpath, link_set):
            failed += 1
    return EXIT_VIOLATION if failed else EXIT_OK


def build_parser():
    parser = argparse.ArgumentParser(
        description="Detect symlink-stubbed checkouts from the git index.")
    parser.add_argument("--root", default=".",
                        help="workspace root to scan (default: cwd)")
    parser.add_argument("--forbid-tracked-symlinks", action="store_true",
                        help="treat any tracked mode-120000 entry as a "
                             "violation, even a healthy one")
    parser.add_argument("--materialise", action="store_true",
                        help="replace every tracked symlink or stub with a "
                             "regular-file copy of its target and re-stage it")
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
    if args.materialise:
        return materialise(root, links)
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

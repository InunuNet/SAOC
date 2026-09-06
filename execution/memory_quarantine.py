#!/usr/bin/env python3
"""Inherited workspace memory: QUARANTINE, never purge.

A project is normally started by COPYING a harness checkout or a sibling
project, so the folder arrives carrying somebody else's goals, backlog,
missions, brain, telemetry, persona and profile. Measured 2026-09-03: that
state rode straight through onboarding, and the new workspace booted into
another project's mission at another project's autonomy level.

The disposal is a MOVE into one loud, named directory, never a delete:
classification is heuristic, and brain/, telemetry/ and scratch/ are
recoverable from no repository on earth. A wrong answer must cost the operator
an inspection, not their data.

    .agent/memory/<entry>      ->  .agent/memory-quarantine-<UTC>/<entry>
    .agent/identity/<name>.md  ->  .agent/memory-quarantine-<UTC>/identity/<name>.md
    .agent/profile.json        ->  .agent/memory-quarantine-<UTC>/profile.json  (COPY)

The layout is pinned by
`.agent/memory/project/specs/first-boot-law/goldens/first_boot_law.md` section 6
and is deliberately identical to `init.sh`'s. That is two implementations of
one rule, declared rather than hidden (first-boot-law DECISIONS D4): `init.sh`
is the live subject of another spec, so the convergence onto this module is
recorded as a follow-up and the shared golden is what keeps the two honest in
the meantime.

    memory_quarantine.py --root <dir>

Exit codes: 0 disposed or nothing to dispose, 1 the disposal could not
complete — in which case nothing was deleted and the caller must NOT go on to
flip the boot gate.
"""

import argparse
import copy
import datetime
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# D-G4's ruling, reused: one implementation of the dangerous write. That one
# carries symlink resolution, permission-bit preservation, temp-file-plus-
# os.replace, corrupt-profile quarantine, BOM tolerance and a read-only refusal.
from onboard_headless import _load_profile, _write_profile  # noqa: E402

QUARANTINE_PREFIX = "memory-quarantine-"
QUARANTINE_STAMP = "%Y%m%dT%H%M%SZ"

# `mkdir` is POSIX's atomic test-and-create, so exactly one racer wins a name
# and the loser retries with the next suffix. A check-then-act loop lets two
# runs in the same second settle on one path and have the second move land on
# top of the first — quarantine that overwrites quarantine is a purge with
# extra steps. The ceiling exists so a directory nobody can create fails loudly
# instead of spinning.
MAX_QUARANTINE_SUFFIX = 1000

# The files the harness itself lays down under .agent/memory/. Disposal
# triggers on content BEYOND this set, never on the mere existence of
# .agent/memory — otherwise a second run would quarantine the seeds the first
# one wrote. A path missing from this list causes a FALSE-POSITIVE quarantine:
# noisy and fully recoverable, which is the safe direction to fail in.
SEED_CLASS = frozenset((
    "project/goals.md",
    "project/learned.md",
    "project/backlog.md",
    "project/session_log.md",
    "project/rules.md",
))

# An identity document still carrying this marker is the shipped placeholder —
# a file with no identity in it yet, not another project's persona. Anything
# else under .agent/identity/ names somebody, and whoever it names is not this
# project until the interview says so.
IDENTITY_PLACEHOLDER = "[Set during /onboard]"

# Golden section 6.1. The writer MERGES into whatever profile it finds, so an
# inherited tech_stack, git block or autonomy level rides through onboarding
# and comes out looking sourced — an invented value with a provenance, which is
# worse than a guessed one. harness_name, primary_platform and template_version
# are harness facts, not project facts, and survive.
REMOVE_FIELD = object()
PROJECT_OWNED_FIELDS = (
    ("identity", {}),          # the writer fills it from the interview
    ("tech_stack", []),        # unset until the operator supplies one
    ("git", REMOVE_FIELD),     # git_provision writes the new one
    ("autonomy", REMOVE_FIELD),  # REQUIREMENTS section 6: decided, never inherited
)

# Structure, never content: what each of these files SAYS is another spec's
# (clean-scaffold F3 owns the seeded lessons), so the disposal restores the
# heading and stops. Written only when the file is absent.
SEED_STUBS = (
    ("project/goals.md", "# Project Goals\n"),
    ("project/backlog.md", "# Backlog\n"),
    ("project/learned.md", "# Learned\n"),
)
SEED_DIRS = ("project", "project/missions", "scratch")


class QuarantineError(RuntimeError):
    """The disposal could not complete. Nothing was deleted."""


class Quarantine(object):
    """What one disposal did: where it put things, and what it moved."""

    def __init__(self, directory, moved):
        self.directory = directory
        self.moved = moved

    @property
    def name(self):
        return os.path.basename(self.directory)


def _memory_dir(root):
    return os.path.join(root, ".agent", "memory")


def _identity_dir(root):
    return os.path.join(root, ".agent", "identity")


def _profile_path(root):
    return os.path.join(root, ".agent", "profile.json")


def _memory_files(mem):
    """Every non-directory entry under .agent/memory, relative to it."""
    found = []
    for dirpath, _dirs, names in os.walk(mem):
        for name in names:
            full = os.path.join(dirpath, name)
            found.append(os.path.relpath(full, mem))
    return found


def _is_harness_seed(root, rel, full):
    """True when a seed-class file holds bytes the HARNESS itself laid down.

    Emptiness alone cannot decide this. TWO disposers seed these paths from the
    same harness — init.sh copies `template/.agent/memory/<rel>` and `_reseed()`
    below writes SEED_STUBS — and every one of those seeds is non-empty, so the
    old `size > 0 => foreign` rule contradicted this module's own docstring:
    the stub `_reseed()` had just written came back as foreign content on the
    very next call, and a scaffold whose memory init.sh had already disposed got
    a SECOND quarantine directory holding nothing but the harness's fresh seeds
    (first-boot-e2e A4, measured 2026-09-03).

    Strictness is unchanged where it matters: a seed-class file carrying
    ANYTHING else is still another project's content and is still quarantined.
    """
    try:
        if os.path.getsize(full) == 0:
            return True
        with open(full, "rb") as fh:
            body = fh.read()
    except OSError:
        return False
    stub = dict(SEED_STUBS).get(rel)
    if stub is not None and body == stub.encode("utf-8"):
        return True
    template_seed = os.path.join(root, "template", ".agent", "memory",
                                 *rel.split("/"))
    try:
        if os.path.isfile(template_seed):
            with open(template_seed, "rb") as fh:
                return fh.read() == body
    except OSError:
        return False
    return False


def memory_has_foreign_content(root):
    """True when .agent/memory carries anything beyond the seed class."""
    mem = _memory_dir(root)
    if not os.path.isdir(mem):
        return False
    for rel in _memory_files(mem):
        if os.path.basename(rel) == ".keep":
            continue
        if rel not in SEED_CLASS:
            return True
        if not _is_harness_seed(root, rel, os.path.join(mem, rel)):
            return True
    return False


def identity_has_foreign_content(root):
    """True when an identity document names somebody other than nobody.

    The shipped placeholders carry IDENTITY_PLACEHOLDER and are not an
    identity; a soul.md that has been filled in belongs to whatever project
    filled it in, and leaving it in place boots the new workspace wearing that
    project's persona.
    """
    ident = _identity_dir(root)
    if not os.path.isdir(ident):
        return False
    for name in sorted(os.listdir(ident)):
        if not name.endswith(".md"):
            continue
        path = os.path.join(ident, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8-sig", errors="replace") as fh:
                text = fh.read()
        except OSError as exc:
            raise QuarantineError(
                "cannot read the identity document %s (%s), so whether it "
                "carries another project's persona is unknown" % (path, exc))
        if text.strip() and IDENTITY_PLACEHOLDER not in text:
            return True
    return False


def has_foreign_content(root):
    """The trigger, golden section 6: inherited memory, or an inherited persona."""
    return memory_has_foreign_content(root) or identity_has_foreign_content(root)


def reserve(root):
    """Atomically reserve exactly one quarantine directory and return its path."""
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime(QUARANTINE_STAMP)
    base = os.path.join(root, ".agent", QUARANTINE_PREFIX + stamp)
    candidate = base
    suffix = 0
    while True:
        try:
            os.makedirs(candidate)
            return candidate
        except FileExistsError:
            suffix += 1
            if suffix > MAX_QUARANTINE_SUFFIX:
                raise QuarantineError(
                    "could not reserve a quarantine name: %d candidates under "
                    "%s are already taken. Move the old %s* directories aside "
                    "and re-run." % (MAX_QUARANTINE_SUFFIX, base,
                                     QUARANTINE_PREFIX))
            candidate = "%s.%d" % (base, suffix)
        except OSError as exc:
            raise QuarantineError(
                "could not create a quarantine directory at %s (%s). Nothing "
                "was moved and nothing was deleted." % (candidate, exc))


def _move(src, dst, what):
    try:
        shutil.move(src, dst)
    except (OSError, shutil.Error) as exc:
        raise QuarantineError(
            "could not quarantine %s: %s (%s). Nothing was deleted — fix the "
            "permissions and re-run." % (what, src, exc))


def _move_memory(root, qdir):
    """Move .agent/memory wholesale. Dotfiles included: they are state too."""
    mem = _memory_dir(root)
    moved = []
    if not os.path.isdir(mem):
        return moved
    for name in sorted(os.listdir(mem)):
        _move(os.path.join(mem, name), os.path.join(qdir, name),
              ".agent/memory/" + name)
        moved.append(".agent/memory/" + name)
    return moved


def _move_identity(root, qdir):
    """Identity docs travel with the memory, into the same quarantine."""
    ident = _identity_dir(root)
    moved = []
    if not os.path.isdir(ident):
        return moved
    for name in sorted(os.listdir(ident)):
        if not name.endswith(".md"):
            continue
        source = os.path.join(ident, name)
        if not os.path.isfile(source):
            continue
        target_dir = os.path.join(qdir, "identity")
        try:
            os.makedirs(target_dir, exist_ok=True)
        except OSError as exc:
            raise QuarantineError(
                "could not create %s (%s), so the inherited identity documents "
                "could not be preserved. Nothing was deleted." % (target_dir, exc))
        _move(source, os.path.join(target_dir, name),
              ".agent/identity/" + name)
        moved.append(".agent/identity/" + name)
    return moved


def reset_profile(root, qdir):
    """Copy profile.json into the quarantine, then clear its project fields.

    The file is COPIED rather than moved because the writer needs a profile at
    that path; what makes the copy load-bearing is that the operator can still
    read every value this reset clears. Golden section 6.1.

    `qdir` is None when this disposal quarantined nothing, and then there is no
    copy to take — and none is owed. The memory FOLLOWS the profile
    (scaffold-identity-integrity D-F4-2): a workspace whose memory and identity
    are the harness's own fresh seeds is one init.sh has just scaffolded, so
    every project-owned field beside them is a TEMPLATE DEFAULT, recoverable
    from `template/.agent/profile.json`, not a value anybody chose. The reset
    still has to happen — REQUIREMENTS section 6: autonomy is decided, never
    inherited and never defaulted — so it must not be gated on there having
    been inherited memory to move.
    """
    path = _profile_path(root)
    if not os.path.isfile(path):
        return False
    if qdir is not None:
        try:
            shutil.copy2(path, os.path.join(qdir, "profile.json"))
        except OSError as exc:
            raise QuarantineError(
                "could not preserve %s in the quarantine (%s), so its project "
                "fields were left alone rather than cleared without a copy."
                % (path, exc))
    profile = _load_profile(path)
    for field, reset in PROJECT_OWNED_FIELDS:
        if reset is REMOVE_FIELD:
            profile.pop(field, None)
        else:
            profile[field] = copy.copy(reset)
    # REQUIREMENTS section 0: the boot gate is never inherited, ever.
    profile["onboarding_complete"] = False
    _write_profile(path, profile)
    return True


def _reseed(root):
    """Put the memory skeleton back so the writer has somewhere to write."""
    mem = _memory_dir(root)
    try:
        for rel in SEED_DIRS:
            os.makedirs(os.path.join(mem, *rel.split("/")), exist_ok=True)
        for rel, stub in SEED_STUBS:
            path = os.path.join(mem, *rel.split("/"))
            if not os.path.exists(path):
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(stub)
    except OSError as exc:
        raise QuarantineError(
            "the inherited memory was quarantined but the fresh skeleton could "
            "not be laid down under %s (%s)." % (mem, exc))


def dispose(root):
    """Quarantine inherited workspace state. Returns a Quarantine, or None.

    Raises QuarantineError when the disposal cannot complete. A caller that is
    about to flip the boot gate MUST treat that as fatal: a half-disposed tree
    with an open gate is the state this whole module exists to prevent.
    """
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        raise QuarantineError("%s is not a directory" % root)
    # NO FOREIGN CONTENT IS NOT NOTHING TO DO. The profile reset is owed on
    # every onboarding, not only where there was inherited memory to move: the
    # scaffold seed itself ships `autonomy` (see reset_profile), and a workspace
    # init.sh has already disposed arrives here clean. Reserving a directory
    # anyway would put an empty quarantine in every clean scaffold, which
    # copied-project-halt A2/A4/A5 forbid — so the quarantine stays conditional
    # and the reset does not.
    qdir = reserve(root) if has_foreign_content(root) else None
    moved = []
    if qdir is not None:
        moved = _move_memory(root, qdir)
        moved += _move_identity(root, qdir)
    reset = reset_profile(root, qdir)
    if reset and qdir is not None:
        moved.append(".agent/profile.json (copied, then reset)")
    _reseed(root)
    if qdir is None:
        return None
    return Quarantine(qdir, moved)


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="memory_quarantine.py",
        description=__doc__.splitlines()[0])
    parser.add_argument("--root", default=".", help="Workspace root (default: cwd)")
    args = parser.parse_args(argv)
    try:
        result = dispose(args.root)
    except QuarantineError as exc:
        sys.stderr.write("Quarantine failed: %s\n" % exc)
        return 1
    if result is None:
        print("No inherited workspace state found.")
        return 0
    print("Inherited workspace state QUARANTINED, not deleted, in .agent/%s"
          % result.name)
    for entry in result.moved:
        print("  moved: %s" % entry)
    return 0


if __name__ == "__main__":
    sys.exit(main())

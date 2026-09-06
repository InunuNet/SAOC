#!/usr/bin/env python3
"""
workspace_state.py — the ONE reader of §0's absolute rule (clean-scaffold D-2).

    .agent/profile.json exists AND is readable AND parses as JSON AND the parsed
    value is a JSON object AND profile["onboarding_complete"] is the JSON literal
    true AND the profile is THIS WORKSPACE'S, not the harness's riding along
                                                            -> ESTABLISHED
    anything else                                           -> NEW

One test, no heuristics, fails toward NEW.

WHY THIS FILE EXISTS. The flag had THREE independent readers (full_boot.sh's
inline python, init.sh's write_profile probe, onboard_headless) and "one test,
no heuristics" is unenforceable while that is true: each dialect drifts on its
own. Every consumer calls this module — nobody re-implements the read.

TWO THINGS THE IMPLEMENTATION MUST GET RIGHT, both measured:

  * IDENTITY, not truthiness and not equality. In Python ``1 == True``, and
    ``"true"``, ``"yes"``, ``["true"]``, ``1.0`` and ``{"done": True}`` are all
    truthy. Only the JSON literal ``true`` counts, so the test is ``is True``.
  * ENCODING IS NOT A STATE. A UTF-8 BOM, CRLF line endings, or a symlink to the
    real profile are transport details. A BOM made the old inline reader raise,
    which turned a fully onboarded workspace into a permanent onboarding siren.
    Hence ``encoding="utf-8-sig"``.
  * AN INHERITED PROFILE IS NOT AN IDENTITY. See _is_inherited_harness_profile
    below: the single clause that stops a copy of the harness from booting as
    the harness. Without it the rule cannot catch the very defect §0 names.

Usage:
    python3 execution/workspace_state.py [DIR]            # prints NEW|ESTABLISHED
    python3 execution/workspace_state.py [DIR] --reason   # ...and the reason on stderr

DIR defaults to the current directory. The decision goes to stdout and the
reason to stderr so a caller can take the decision with a plain command
substitution and never has to parse. Always exits 0: this is consulted by a
SessionStart hook, and a boot hook that fails takes the session with it.
"""
import argparse
import json
import os
import sys

NEW = "NEW"
ESTABLISHED = "ESTABLISHED"

PROFILE_RELPATH = os.path.join(".agent", "profile.json")

# Reason vocabulary — one word per way the rule can be answered. Exhaustive by
# construction: inspect() returns exactly one of these.
REASON_MISSING = "missing"
REASON_UNREADABLE = "unreadable"
REASON_MALFORMED = "malformed"
REASON_NOT_OBJECT = "not-object"
REASON_KEY_ABSENT = "key-absent"
REASON_VALUE_NOT_TRUE = "value-not-true"
REASON_INHERITED_HARNESS = "inherited-harness-profile"
REASON_ONBOARDED = "onboarded"

ONBOARDING_KEY = "onboarding_complete"
PROJECT_NAME_KEY = "project_name"
HARNESS_NAME_KEY = "harness_name"


def profile_path(workspace="."):
    """Absolute-or-relative path to the profile this rule reads."""
    return os.path.join(workspace, PROFILE_RELPATH)


def _is_inherited_harness_profile(data, workspace):
    """True when this profile is the HARNESS'S OWN, riding along in a copy.

    THE DEFECT THIS EXISTS FOR (measured 2026-09-03, codex QA round 1, finding
    4): copy an Athanor checkout into ``NewProj/`` and its tracked
    ``.agent/profile.json`` still says ``project_name: Athanor``,
    ``onboarding_complete: true``. Under the bare rule that folder reads
    ESTABLISHED, so boot never scaffolds it and the session resumes ATHANOR'S
    missions inside NewProj. That is REQUIREMENTS.md §0's complaint verbatim —
    "new projects think they are Athanor" — and the bare rule cannot see it.
    DECISIONS.md C-1 reported the conflict; this is the clause that resolves it.

    THE TEST, and why it is exactly this shape:

      project_name == harness_name    a profile whose project IS the harness is
                                      the harness's own profile. Read from the
                                      profile itself, never hard-coded, so a
                                      fork or a renamed harness is covered too
                                      (the same rule as init.sh's harness_name).
      AND project_name != basename    ...but the harness's REAL checkout is
                                      allowed to be onboarded as itself. The
                                      folder name is what separates the harness
                                      from a copy of it: §1 makes the project
                                      name the folder name, so a profile naming
                                      a different folder is not this folder's.

    Both clauses are required. project_name != basename ALONE would be wrong —
    F2/A3 (rename-preserves) requires that renaming an established project's
    DIRECTORY does not rename the project, and the golden's own ESTABLISHED
    fixtures live in directories named for their state, not their project. So
    this narrows to the harness-identity case, which is the one §0 names.

    Undecidable case, deliberately left ESTABLISHED and reported rather than
    guessed: a copy of a DOWNSTREAM project (project_name "SAOC" in a folder
    "NewProj") is byte-for-byte indistinguishable from that same project after
    a legitimate directory rename. Nothing on disk separates them.

    Comparison is exact, never case-folded: §0 fails toward NEW, so on a
    case-insensitive filesystem a clone in ``athanor/`` reading NEW (and being
    sent to onboarding) is the safe direction, while the reverse is the defect.

    A profile with no harness_name (a workspace predating that key) leaves this
    clause INERT — there is nothing to compare against, and inventing a
    fingerprint here would be the heuristic §0 forbids.
    """
    project = str(data.get(PROJECT_NAME_KEY) or "").strip()
    harness = str(data.get(HARNESS_NAME_KEY) or "").strip()
    if not project or not harness or project != harness:
        return False
    try:
        folder = os.path.basename(os.path.realpath(os.path.abspath(workspace)))
    except OSError:
        # Never raise: an unresolvable path is not an answer, and the caller's
        # contract is that inspect() always returns.
        return False
    return folder != project


def inspect(workspace="."):
    """Return (state, reason) for a workspace directory.

    state is NEW or ESTABLISHED; reason is one of the REASON_* words above.
    Never raises: every failure to read is itself an answer, and the answer is
    always NEW.
    """
    path = profile_path(workspace)

    # A directory named profile.json, and a dangling symlink, are both "there is
    # no profile here" — but they are NOT the same as "nothing exists", because
    # the scaffold has to move them aside before it can write. Report them as
    # unreadable so the caller can tell the two apart.
    if os.path.isdir(path):
        return NEW, REASON_UNREADABLE
    if not os.path.exists(path):
        # os.path.exists() follows symlinks, so a dangling link lands here; a
        # link that exists but points at nothing readable is still no profile.
        return NEW, REASON_UNREADABLE if os.path.islink(path) else REASON_MISSING

    try:
        with open(path, encoding="utf-8-sig") as fh:
            raw = fh.read()
    except UnicodeDecodeError:
        # MUST precede OSError/ValueError: UnicodeDecodeError is a ValueError
        # subclass, so an except clause naming ValueError first would swallow it
        # and report undecodable bytes as a permissions problem.
        return NEW, REASON_MALFORMED
    except (OSError, ValueError):
        # PermissionError (mode 000) and IsADirectoryError both mean the same
        # thing here: the file is there and its contents are out of reach.
        return NEW, REASON_UNREADABLE

    try:
        data = json.loads(raw)
    except ValueError:
        return NEW, REASON_MALFORMED

    if not isinstance(data, dict):
        return NEW, REASON_NOT_OBJECT
    if ONBOARDING_KEY not in data:
        return NEW, REASON_KEY_ABSENT
    # `is True`, never `== True` and never truthiness: 1 == True in Python, and
    # the golden state family exists to kill both refactors.
    if data[ONBOARDING_KEY] is not True:
        return NEW, REASON_VALUE_NOT_TRUE
    # LAST, never earlier: every NEW row above keeps its own reason word, so
    # this clause can only ever turn a would-be ESTABLISHED into NEW.
    if _is_inherited_harness_profile(data, workspace):
        return NEW, REASON_INHERITED_HARNESS
    return ESTABLISHED, REASON_ONBOARDED


def classify(workspace="."):
    """Return NEW or ESTABLISHED for a workspace directory."""
    return inspect(workspace)[0]


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Classify a workspace as NEW or ESTABLISHED (REQUIREMENTS.md section 0).")
    parser.add_argument("workspace", nargs="?", default=".",
                        help="workspace directory (default: the current directory)")
    parser.add_argument("--reason", action="store_true",
                        help="also write the one-word reason to stderr")
    args = parser.parse_args(argv)

    state, reason = inspect(args.workspace)
    sys.stdout.write(state + "\n")
    if args.reason:
        sys.stderr.write(reason + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

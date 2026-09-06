#!/usr/bin/env python3
"""Boot-time integrity siren (platform-scoped-delivery F2).

THE CIRCULARITY this exists to break: the fix for a stubbed checkout would be
written in CLAUDE.md / AGENTS.md -- and CLAUDE.md is one of the files that
vanished. A fresh Windows onboarding cannot read its own fix. So the remedy has
to be EXECUTED MACHINERY, not a document. `.claude/settings.json` and
`.gemini/settings.json` are ordinary files that core.symlinks cannot damage,
and their SessionStart hook runs execution/hooks/full_boot.sh, which runs this.

    python3 execution/boot_integrity.py [--root R]      # ALWAYS exits 0

THE EXIT CODE IS LOAD-BEARING. A SessionStart hook that exits non-zero degrades
or kills the session, and an unprivileged Windows box may have no way to clear
the condition -- a permanent lockout for a defect the operator cannot fix.
Loudness belongs in the output, not the exit code.

IT NEVER REPAIRS, for either condition. Silent repair at boot would restore
exactly the invisibility this feature removes: the agent would be handed
corrected instructions and nobody would ever learn that a clone had been edited
or a `make sync-clones` skipped. Drift belongs to the gate; boot only tells the
truth about it.

Three states:
  clean        -- prints NOTHING (every boot pays for this output).
  drifted      -- one loud CLONE-DRIFT line naming the file and the remedy.
  stub damage  -- the ATHANOR-STUB-DAMAGE banner, every damaged path, the exact
                  remedy, AND the whole of AGENTS.md injected inline. The
                  injection is what makes this a mitigation rather than a
                  complaint: the session holds the workflow contract even
                  though its file is gone.
"""

import argparse
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Resolved relative to THIS FILE, never to --root: --root is the workspace
# under inspection and may be any checkout, including one that has no
# execution/checks/ at all. Resolving against --root would make the siren a
# silent no-op in precisely the damaged workspaces it exists for.
DETECTOR = os.path.join(HERE, "checks", "verify_no_symlink_stubs.py")
PAIRED_COPIES = os.path.join(HERE, "paired_copies.py")

REGISTRY_REL = ".agent/paired-copies.yaml"
SOURCE_OF_TRUTH = "AGENTS.md"
BANNER = "ATHANOR-STUB-DAMAGE"
RULE = "=" * 72
BEGIN_MARKER = "--- BEGIN AGENTS.md FALLBACK ---"
END_MARKER = "--- END AGENTS.md FALLBACK ---"
REMEDY = "python3 execution/paired_copies.py --sync"
DRIFT_REMEDY = "make sync-clones"
DETECTOR_TIMEOUT_SECONDS = 120

EXIT_ALWAYS = 0


def _run_detector(root):
    """Return the detector's (returncode, output), or (None, "") if it cannot
    be run. A siren that cannot introspect stays quiet rather than shouting
    about itself on every boot."""
    if not os.path.isfile(DETECTOR):
        return None, ""
    try:
        proc = subprocess.run([sys.executable, DETECTOR, "--root", root],
                              capture_output=True, text=True,
                              timeout=DETECTOR_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return None, ""
    return proc.returncode, proc.stdout + proc.stderr


def damaged_paths(output):
    """The STUB-DAMAGE / STUB-MISSING lines from the detector's report."""
    return [line for line in output.splitlines()
            if line.startswith(("STUB-DAMAGE ", "STUB-MISSING "))]


def report_stub_damage(root, lines):
    print(RULE)
    print("%s - this checkout is missing agent instruction files" % BANNER)
    print(RULE)
    for line in lines:
        print("  %s" % line)
    print("")
    print("CAUSE: these paths are tracked as symlinks. Git for Windows ships")
    print("core.symlinks=false at SYSTEM scope, so they check out as small text")
    print("files containing their target path. `git status` reports nothing.")
    print("REMEDY: %s" % REMEDY)
    print("")

    agents = os.path.join(root, SOURCE_OF_TRUTH)
    if not os.path.isfile(agents):
        print("%s is itself absent from this checkout, so no inline fallback "
              "can be injected." % SOURCE_OF_TRUTH)
        return
    print("The instruction file is injected below so this session is not")
    print("running without it.")
    print(BEGIN_MARKER)
    with open(agents, "rb") as fh:
        sys.stdout.write(fh.read().decode("utf-8", "replace"))
    print("")
    print(END_MARKER)


def report_drift(root):
    """One loud line per drifted clone. Reads only; writes nothing."""
    if not os.path.isfile(PAIRED_COPIES):
        return
    if not os.path.isfile(os.path.join(root, REGISTRY_REL)):
        return
    sys.path.insert(0, HERE)
    try:
        import paired_copies
    except ImportError:
        return
    finally:
        sys.path.pop(0)
    try:
        rows = paired_copies.load_registry(os.path.join(root, REGISTRY_REL))
    except OSError:
        return
    for row in rows:
        line, ok = paired_copies.classify(root, row)
        if ok:
            continue
        print("%s; run `%s`" % (line, DRIFT_REMEDY))


def build_parser():
    parser = argparse.ArgumentParser(
        description="Boot-time integrity siren. Always exits 0.")
    parser.add_argument("--root", default=".",
                        help="workspace root to inspect (default: cwd)")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        return EXIT_ALWAYS

    returncode, output = _run_detector(root)
    if returncode is not None and returncode != 0:
        lines = damaged_paths(output)
        if lines:
            report_stub_damage(root, lines)
            return EXIT_ALWAYS

    report_drift(root)
    return EXIT_ALWAYS


if __name__ == "__main__":
    sys.exit(main())

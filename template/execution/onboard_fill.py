#!/usr/bin/env python3
"""Write the onboarded agent identity into AGENTS.md and re-sync its clones.

Before scaffold-identity-integrity F1 this script PRINTED the filled document to
stdout and never wrote it, while its only caller piped that stdout to DEVNULL —
a double no-op that is why every scaffolded workspace shipped an unfilled
identity line.

The identity site is a marker-delimited block:

    <!-- IDENTITY:BEGIN ... -->
    ...pre-onboarding text...
    <!-- IDENTITY:END -->

Markers beat matching prose: they survive rewording, replacement is idempotent
under re-onboarding, and a hand-edit inside them is visibly out-of-band. A
LEGACY workspace whose AGENTS.md predates the markers is still handled, by
replacing the old "**You are X** — the Y and primary agent." sentence.

CLAUDE.md and GEMINI.md are byte-identical clones of AGENTS.md
(platform-scoped-delivery F2), so an identity write that touched only AGENTS.md
would turn the drift gate red and hand each platform different instructions.
Re-syncing the clones is therefore part of this write, not a follow-up step.

    python3 execution/onboard_fill.py [AGENTS.md path]

Exit codes: 0 written (or already correct); 1 nothing could be written.
"""

import json
import os
import re
import subprocess
import sys

PROFILE_PATH = ".agent/profile.json"
REGISTRY_REL = ".agent/paired-copies.yaml"
PAIRED_COPIES_REL = "execution/paired_copies.py"
DEFAULT_AGENTS_MD = "AGENTS.md"
SUBPROCESS_TIMEOUT_SECONDS = 60

MARKER_BLOCK_RE = re.compile(
    r"(<!--\s*IDENTITY:BEGIN.*?-->)(.*?)(<!--\s*IDENTITY:END\s*-->)",
    re.DOTALL,
)
LEGACY_IDENTITY_RE = re.compile(
    r"\*\*You are [^*\n]+\*\* — the [^\n]+? and primary agent[^\n]*\.")


def load_identity(profile_path):
    """Return (agent_name, role, project_name) from the profile, or Nones."""
    try:
        with open(profile_path) as fh:
            profile = json.load(fh)
    except (OSError, ValueError) as exc:
        print("onboard_fill: cannot read %s (%s)" % (profile_path, exc),
              file=sys.stderr)
        return None, None, None

    identity = profile.get("identity") or {}
    agent_name = identity.get("agent_name") or profile.get("agent_name")
    role = identity.get("project_role") or profile.get("project_role")
    project_name = profile.get("project_name") or ""
    return agent_name, role, project_name


FORBIDDEN_IDENTITY_SUBSTRINGS = ("<!--", "-->", "\n", "\r")


def identity_value_fault(label, value):
    """Return a complaint string if `value` cannot live inside the markers."""
    for bad in FORBIDDEN_IDENTITY_SUBSTRINGS:
        if bad in value:
            return ("%s is %r, which contains %r — the identity is written "
                    "between IDENTITY:BEGIN/END markers and this value would "
                    "break out of that block, stranding text outside it that "
                    "no later onboarding can reach."
                    % (label, value, bad))
    return None


def identity_sentence(agent_name, role, project_name):
    if project_name:
        return ("**You are %s** — the %s and primary agent of %s."
                % (agent_name, role, project_name))
    return "**You are %s** — the %s and primary agent." % (agent_name, role)


def fill_identity(text, sentence):
    """Return (new_text, how) with the identity block rewritten, or (text, None)."""
    if MARKER_BLOCK_RE.search(text):
        return MARKER_BLOCK_RE.sub(
            lambda m: "%s\n%s\n%s" % (m.group(1), sentence, m.group(3)),
            text, count=1), "marker block"
    if LEGACY_IDENTITY_RE.search(text):
        return LEGACY_IDENTITY_RE.sub(
            lambda _m: sentence, text, count=1), "legacy identity sentence"
    return text, None


def registry_pairs(root):
    """copy/source pairs from the paired-copy registry (tiny reader, no PyYAML)."""
    path = os.path.join(root, REGISTRY_REL)
    rows, cur = [], None
    try:
        with open(path) as fh:
            for raw in fh:
                line = raw.split("#", 1)[0].strip()
                if not line:
                    continue
                if line.startswith("- "):
                    cur = {}
                    rows.append(cur)
                    line = line[2:].strip()
                if ":" in line and cur is not None:
                    key, _, value = line.partition(":")
                    cur[key.strip()] = value.strip().strip("'\"")
    except OSError:
        return []
    return [r for r in rows if r.get("copy") and r.get("source")]


def sync_clones(root, agents_rel, stale_ledger):
    """Re-clone the paired copies of AGENTS.md. Returns True on success.

    `stale_ledger` maps clone relpath -> the bytes AGENTS.md held BEFORE this
    write. A clone still holding exactly those bytes is provably stale rather
    than hand-edited, which is the distinction paired_copies.py normally asks
    git HEAD to make — and cannot, in a freshly scaffolded workspace that has no
    commits yet. Anything else is someone's edit and is never overwritten here.
    """
    tool = os.path.join(root, PAIRED_COPIES_REL)
    tool_report = ""
    if os.path.isfile(tool) and os.path.isfile(os.path.join(root, REGISTRY_REL)):
        try:
            proc = subprocess.run(
                [sys.executable, tool, "--root", root, "--sync"],
                capture_output=True, text=True,
                timeout=SUBPROCESS_TIMEOUT_SECONDS)
        except (OSError, subprocess.SubprocessError) as exc:
            tool_report = "paired_copies.py could not run (%s)" % exc
        else:
            if proc.returncode == 0:
                return True
            # A fresh scaffold is a git repo with NO COMMITS, so paired_copies
            # cannot read HEAD and refuses to overwrite a clone it cannot prove
            # is merely stale. The ledger below proves exactly that, so the
            # fallback is the right answer here, not a workaround — its refusal
            # is only reported if the fallback ALSO declines.
            tool_report = ("paired_copies.py --sync exited %d:\n%s"
                           % (proc.returncode,
                              (proc.stdout or "") + (proc.stderr or "")))

    # Fallback: byte-copy the rows ourselves, using the in-memory ledger.
    pairs = [r for r in registry_pairs(root) if r["source"] == agents_rel]
    if not pairs:
        return True
    try:
        with open(os.path.join(root, agents_rel), "rb") as fh:
            payload = fh.read()
    except OSError as exc:
        print("onboard_fill: cannot re-read %s (%s)" % (agents_rel, exc),
              file=sys.stderr)
        return False

    ok = True
    for row in pairs:
        copy_path = os.path.join(root, row["copy"])
        if os.path.exists(copy_path):
            try:
                with open(copy_path, "rb") as fh:
                    current = fh.read()
            except OSError as exc:
                print("onboard_fill: cannot read clone %s (%s)"
                      % (row["copy"], exc), file=sys.stderr)
                ok = False
                continue
            if current not in (stale_ledger.get(row["copy"]), payload):
                if tool_report:
                    print("onboard_fill: %s" % tool_report, file=sys.stderr)
                print("onboard_fill: refusing to overwrite %s — it matches "
                      "neither the pre-onboarding AGENTS.md nor the new one, "
                      "so these bytes exist nowhere else. Move the edit into "
                      "%s and run `make sync-clones`."
                      % (row["copy"], agents_rel), file=sys.stderr)
                ok = False
                continue
        try:
            with open(copy_path, "wb") as fh:
                fh.write(payload)
        except OSError as exc:
            if tool_report:
                print("onboard_fill: %s" % tool_report, file=sys.stderr)
            print("onboard_fill: cannot write clone %s (%s)"
                  % (row["copy"], exc), file=sys.stderr)
            ok = False
    return ok


def main(argv):
    agents_path = argv[1] if len(argv) > 1 else DEFAULT_AGENTS_MD
    root = os.path.dirname(os.path.abspath(agents_path)) or "."
    agents_rel = os.path.basename(agents_path)

    agent_name, role, project_name = load_identity(
        os.path.join(root, PROFILE_PATH) if os.path.isdir(
            os.path.join(root, ".agent")) else PROFILE_PATH)
    if not agent_name or not role:
        print("onboard_fill: identity.agent_name / identity.project_role are "
              "not set in %s — run onboarding first." % PROFILE_PATH,
              file=sys.stderr)
        return 1

    # The profile is a file on disk and may have been hand-edited, so the
    # marker-escape check is repeated HERE, at the substitution site, rather
    # than trusted to have happened in the caller.
    # project_name is checked here too: identity_sentence() interpolates it
    # into the SAME line, between the SAME markers, so it can strand text
    # outside the block exactly as the other two can.
    for label, value in (("identity.agent_name", agent_name),
                         ("identity.project_role", role),
                         ("project_name", project_name)):
        fault = identity_value_fault(label, value)
        if fault:
            print("onboard_fill: refusing to write — %s" % fault,
                  file=sys.stderr)
            return 1

    if not os.path.isfile(agents_path):
        print("onboard_fill: %s not found" % agents_path, file=sys.stderr)
        return 1

    with open(agents_path, "rb") as fh:
        original = fh.read()
    text = original.decode("utf-8")

    new_text, how = fill_identity(text, identity_sentence(
        agent_name, role, project_name))
    if how is None:
        print("onboard_fill: no identity site found in %s — expected an "
              "%sIDENTITY:BEGIN%s marker block or a '**You are ...** — the ... "
              "and primary agent.' sentence."
              % (agents_path, "<!-- ", " -->"), file=sys.stderr)
        return 1

    if new_text != text:
        with open(agents_path, "w") as fh:
            fh.write(new_text)
        print("onboard_fill: identity written to %s (%s)" % (agents_path, how))
    else:
        print("onboard_fill: identity in %s already current" % agents_path)

    ledger = {}
    for row in registry_pairs(root):
        if row["source"] == agents_rel:
            ledger[row["copy"]] = original

    return 0 if sync_clones(root, agents_rel, ledger) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

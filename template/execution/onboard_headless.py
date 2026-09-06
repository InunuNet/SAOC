#!/usr/bin/env python3
"""Headless onboarding CLI — configures Athanor project without interactive prompts."""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


# REQUIREMENTS.md §4.1 — the communication contract, verbatim intent. It is a
# module constant rather than a template file for two reasons (DECISIONS D-O3):
# a template file adds a delivery path that can fail, and it tempts the
# assertion into comparing the generated soul.md against the very template it
# came from — an oracle derived from the artifact under test inherits its
# mutations. The independent transcription lives in
# specs/onboarding-rework/goldens/f3_identity_contract.md and is what F3A1
# compares against, so the expectation can disagree with this list.
COMMUNICATION_CONTRACT = (
    "Direct, no BS.",
    "Compact responses.",
    "Non-technical explanations \u2014 the user is human and will not read 100 lines "
    "of scrolling comments or code.",
    "Do NOT flatter the user.",
    'Do NOT use clich\u00e9d filler: "to be honest", "fair enough", and similar.',
    "You are not here to please me, you are here to prove you are better than the "
    "other agents.",
)

# An absent archetype is stated as absent. A plausible-sounding default here
# would be a fabricated fact of exactly the class scaffold-identity D2 removed
# when it stopped seeding `Athanor Agent` (DECISIONS D-O2).
ARCHETYPE_UNSET = "(not yet set \u2014 run /onboard to set it)"

# REQUIREMENTS.md §4.2 — Brad's profile is the DEFAULT, presented and confirmed
# at every scaffold because someone else may be running the harness.
# `--user-context` replaces it wholesale; it is a default, not a hardcode.
DEFAULT_USER_PROFILE = (
    "# User Profile\n"
    "\n"
    "**Name**: Brad\n"
    "\n"
    "Address him as **Boss** or **Sir**.\n"
    "\n"
    "**Role**: CEO. The ideas guy.\n"
    "\n"
    "Time is precious. He hates repeating himself.\n"
    "\n"
    "He is a hacker \u2014 he will ask for technical detail when he wants it. "
    "Otherwise keep it short and to the point, or it will not be read.\n"
    "\n"
    "This is the harness default, presented at every scaffold and CONFIRMED with\n"
    "whoever is actually running it. If that is not you, /onboard replaces this\n"
    "block wholesale with your own profile.\n"
)

# REQUIREMENTS.md §4.3 — scale CANNOT be inferred from the mission's wording,
# so the default states that it is not yet known and names the step that would
# find out. A default asserting a size would be a fabricated fact.
SCALE_DEFAULT = (
    "unknown until we look \u2014 a scoping step must run before this mission is sized."
)


def build_soul_content(agent_name: str, role: str, archetype: str,
                       soul_persona: str) -> str:
    """Render soul.md: who the agent is, plus §4.1's communication contract.

    `--soul-persona` still replaces the document wholesale, which is what
    docs/harness/ONBOARDING.md has always documented it to do. What it does not
    do is escape verification: verify_landed() re-reads whichever of the two
    documents this run actually wrote.
    """
    if soul_persona:
        return soul_persona
    contract = "".join("- %s\n" % line for line in COMMUNICATION_CONTRACT)
    return (
        f"# Soul: {agent_name}\n"
        f"\n"
        f"**Name**: {agent_name}\n"
        f"**Role**: {role}\n"
        f"**Archetype**: {archetype or ARCHETYPE_UNSET}\n"
        f"\n"
        f"You are {agent_name}, the {role} and primary agent for this project.\n"
        f"You follow the Athanor workflow chain strictly: architect -> dev -> qa\n"
        f"-> docs -> gate -> maintainer.\n"
        f"\n"
        f"## Communication contract\n"
        f"\n"
        f"{contract}"
    )


def build_user_content(user_context: str) -> str:
    """Render user.md. `--user-context` REPLACES the §4.2 default wholesale."""
    if user_context:
        return user_context
    return DEFAULT_USER_PROFILE


def parse_tech_stack(raw: str) -> list:
    """Split `--tech-stack` into profile.json's existing list-of-strings shape.

    Trimmed, empties dropped, duplicates dropped keeping first-seen order. A
    naive split(",") stores ' firebase ' and '' as stack entries, and every
    consumer that resolves a stack name to a probe then looks for a tool whose
    name has a space in it. The shape is profile.json's existing `tech_stack`
    field, preserved rather than redesigned: merge_profile.py and the template
    profile already read it.
    """
    stack = []
    for part in raw.split(","):
        item = part.strip()
        if item and item not in stack:
            stack.append(item)
    return stack


def resolve_project_name(workspace_path: str) -> str:
    """The project name is the FOLDER NAME and is never asked (REQUIREMENTS §1).

    WORKSPACE first when it holds something: init.sh has already written the
    sanitised folder name there, and reading it back is one name dialect rather
    than a second. The folder basename is the fallback for a directory that has
    no WORKSPACE file yet.
    """
    try:
        with open(workspace_path, "r", encoding="utf-8-sig") as fh:
            recorded = fh.readline().strip()
        if recorded:
            return recorded
    except OSError:
        pass
    name = os.path.basename(os.path.abspath(os.getcwd()))
    if not name:
        raise SystemExit(
            "Onboarding failed: no --project-name was given, "
            f"{workspace_path} holds nothing usable, and the working directory "
            "has no basename to fall back on. onboarding_complete stays false "
            "and the boot gate stays shut."
        )
    return name


DEFAULT_HARNESS_NAME = "Athanor"


_QUARANTINED: dict = {}


def _quarantine_corrupt_profile(profile_path: str) -> str:
    """Copy an unusable profile aside before it is rebuilt. Returns the copy's path.

    Rebuilding a corrupt profile is right; DESTROYING it is not. The rebuild
    keeps four keys (project_name, identity, harness_name, onboarding_complete)
    and _write_profile's os.replace() then overwrites the original — so a
    workspace whose profile carried agents, autonomy, tech_stack, features,
    memory, status, project_type, soul_type, primary_platform and created_at
    lost every one of them FROM DISK, unrecoverably, at rc=0, from a fault as
    trivial as a byte-order mark. Keep the bytes; they are the only copy.

    Returns "" when there is provably nothing to keep (a zero-byte file) — a
    directory of empty .corrupt files is noise that buries the one backup that
    matters. One run reads the profile more than once (the harness-name guard,
    then patch_profile), so the result is memoised: a single run must leave a
    single backup, not one per read.
    """
    if profile_path in _QUARANTINED:
        return _QUARANTINED[profile_path]
    try:
        if os.path.getsize(profile_path) == 0:
            _QUARANTINED[profile_path] = ""
            return ""
    except OSError:
        pass
    backup = profile_path + ".corrupt"
    suffix = 1
    while os.path.exists(backup):
        backup = f"{profile_path}.corrupt.{suffix}"
        suffix += 1
    try:
        shutil.copy2(profile_path, backup)
    except OSError as exc:
        raise SystemExit(
            f"Onboarding failed: {profile_path} is unreadable as JSON and could "
            f"not be copied aside to {backup} ({exc}). Refusing to rebuild it, "
            f"because doing so would destroy the only copy of whatever it holds. "
            f"onboarding_complete stays false and the boot gate stays shut."
        )
    _QUARANTINED[profile_path] = backup
    return backup


def _load_profile(profile_path: str) -> dict:
    """Return the existing profile, or {} when there is nothing usable to keep.

    A CORRUPT profile (zero-byte, truncated, hand-broken JSON) used to abort
    onboarding with a raw JSONDecodeError traceback — leaving the workspace
    stuck in exactly the state onboarding exists to clear, with no statement of
    what was wrong. Onboarding is the recovery path for that state, so say what
    happened on stderr and rebuild from scratch rather than crashing — but copy
    the original aside first, never overwrite it (see
    _quarantine_corrupt_profile).

    Read with utf-8-sig, not utf-8. A UTF-8 BOM is what many Windows editors and
    PowerShell redirections write by default; plain utf-8 rejects it as invalid
    JSON, which SHUT the boot gate on an already-onboarded workspace and sent the
    operator to re-run onboarding — the one action that then wiped the profile.
    utf-8-sig accepts a BOM and is identical to utf-8 when there is none, so this
    costs nothing and removes the whole failure chain.
    """
    if not os.path.exists(profile_path):
        return {}
    try:
        with open(profile_path, "r", encoding="utf-8-sig") as fh:
            data = json.load(fh)
    except (ValueError, UnicodeDecodeError) as exc:
        backup = _quarantine_corrupt_profile(profile_path)
        kept = (
            f"The original has been kept at {backup} — recover any keys you need "
            f"from there, because the rebuilt profile does not carry them."
            if backup
            else "The file was empty, so there was nothing to preserve."
        )
        print(
            f"warning: {profile_path} is not valid JSON ({exc}); rebuilding it "
            f"from scratch. {kept}",
            file=sys.stderr,
        )
        return {}
    except OSError as exc:
        raise SystemExit(
            f"Onboarding failed: cannot read {profile_path} ({exc}). "
            f"onboarding_complete stays false and the boot gate stays shut."
        )
    if not isinstance(data, dict):
        backup = _quarantine_corrupt_profile(profile_path)
        print(
            f"warning: {profile_path} does not contain a JSON object; "
            f"rebuilding it from scratch. The original has been kept at {backup}.",
            file=sys.stderr,
        )
        return {}
    return data


def _write_profile(profile_path: str, data: dict) -> None:
    """Replace profile.json atomically — never truncate it in place.

    `open(path, "w")` truncates first and writes second. A kill, a crash or an
    ENOSPC between those two moments leaves a ZERO-BYTE profile.json: the boot
    gate then cannot read its own onboarding state, and every consumer that
    parses this file fails. Writing a sibling temp file and os.replace()-ing it
    makes the swap atomic on POSIX, so the file on disk is always either the
    whole old profile or the whole new one.

    The temp file is created in the SAME directory as the target because
    os.replace is only atomic within one filesystem.

    A SYMLINK target is resolved to its real path first. os.replace() on the
    link itself drops a regular file over the link and leaves the operator's
    real profile untouched at its old content — two divergent profiles, rc=0,
    no warning. A symlink here is deliberate (shared config, a dotfiles repo),
    so write through it.

    The original file's permission bits are carried across the swap.
    tempfile.mkstemp() creates at 0600 and nothing restored the mode, so every
    atomic write silently narrowed a 0644 profile to 0600.
    """
    # os.replace() renames over the target, and rename permission is granted by
    # the DIRECTORY, not the file — so an atomic write would silently overwrite
    # a profile the operator had deliberately made read-only. Refuse first, and
    # say so in a sentence: the previous behaviour surfaced this as a raw
    # PermissionError traceback with no statement of what failed or why.
    if os.path.exists(profile_path) and not os.access(profile_path, os.W_OK):
        raise SystemExit(
            f"Onboarding failed: {profile_path} is not writable, so the "
            f"identity could not be recorded. onboarding_complete stays false "
            f"and the boot gate stays shut. Fix the permissions and re-run."
        )

    profile_path = os.path.realpath(profile_path)
    try:
        original_mode = os.stat(profile_path).st_mode & 0o7777
    except OSError:
        original_mode = None

    directory = os.path.dirname(os.path.abspath(profile_path))
    try:
        fd, tmp_path = tempfile.mkstemp(prefix=".profile.", suffix=".tmp", dir=directory)
    except OSError as exc:
        raise SystemExit(
            f"Onboarding failed: cannot create a temporary file next to "
            f"{profile_path} ({exc}), so the profile could not be written "
            f"atomically. onboarding_complete stays false."
        )
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        if original_mode is not None:
            os.chmod(tmp_path, original_mode)
        os.replace(tmp_path, profile_path)
    except OSError as exc:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise SystemExit(
            f"Onboarding failed: could not write {profile_path} ({exc}). "
            f"onboarding_complete stays false and the boot gate stays shut."
        )
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def patch_profile(profile_path: str, project_name: str, agent_name: str,
                  role: str, tech_stack=None) -> None:
    """Write the identity into profile.json and SHUT the onboarding gate.

    `onboarding_complete` is deliberately forced False here and opened only by
    open_onboarding_gate(), as the very last act of a fully successful run. It
    used to be set True at this step — step 2 of 6 — so any failure in the
    later steps exited 1 having already told every future boot that onboarding
    was done, which is exactly the unfilled-identity regression this feature
    exists to prevent. A partial onboarding must leave the gate shut so the
    next boot retries.
    """
    data = _load_profile(profile_path)

    data["project_name"] = project_name
    data["onboarding_complete"] = False
    if "harness_name" not in data:
        data["harness_name"] = DEFAULT_HARNESS_NAME

    if "identity" not in data or not isinstance(data["identity"], dict):
        data["identity"] = {}
    data["identity"]["agent_name"] = agent_name
    data["identity"]["project_role"] = role

    # REQUIREMENTS §4.4. Written only when the flag was SUPPLIED: an omitted
    # --tech-stack must not silently erase a stack an earlier run recorded,
    # and every new flag in this feature is optional (DECISIONS D-O2).
    if tech_stack is not None:
        data["tech_stack"] = list(tech_stack)

    _write_profile(profile_path, data)


def open_onboarding_gate(profile_path: str) -> None:
    """Open the boot gate. MUST be the last write of a successful onboarding."""
    data = _load_profile(profile_path)
    data["onboarding_complete"] = True
    _write_profile(profile_path, data)


def confirm_gate_open(profile_path: str) -> None:
    """Re-read the gate FROM DISK. It must be the JSON boolean true.

    This is a READ, so open_onboarding_gate() remains the last WRITE — the
    invariant its own docstring states and that scaffold-identity D6 asserts.

    The test is identity against True, never truthiness: full_boot.sh and
    workspace_state.py both test `p.get('onboarding_complete') is True`, so a
    string "true" here shuts the boot gate forever while onboarding reports
    success. `1`, `"yes"` and `["true"]` are all truthy and all equally fatal.
    """
    value = _load_profile(profile_path).get("onboarding_complete")
    if value is not True:
        raise SystemExit(
            f"Onboarding failed: onboarding_complete reads back from "
            f"{profile_path} as {value!r} ({type(value).__name__}), not the "
            f"JSON boolean true. The boot gate tests `is True`, so this "
            f"workspace would never boot as onboarded. Nothing else is wrong "
            f"with this run; fix the write and re-run."
        )


def patch_goals(goals_path: str, mission_text: str) -> None:
    if os.path.exists(goals_path):
        with open(goals_path, "r") as fh:
            content = fh.read()
    else:
        content = "# Goals\n\n## Mission\n\n"

    # Replace only the first ## Mission section body up to next ## heading or EOF.
    # The canonical form is exactly: "## Mission\n\n<mission_text>\n"
    # We match the heading line plus any content following it (until next ## section or EOF).
    pattern = re.compile(
        r"## Mission[^\n]*\n.*?(?=\n## |\Z)",
        re.DOTALL,
    )
    replacement = "## Mission\n\n" + mission_text
    new_content, count = pattern.subn(replacement, content, count=1)
    if count == 0:
        # No existing Mission section — append one.
        new_content = content.rstrip("\n") + "\n\n## Mission\n\n" + mission_text + "\n"
    else:
        # Ensure file ends with a single newline.
        if not new_content.endswith("\n"):
            new_content += "\n"

    with open(goals_path, "w") as fh:
        fh.write(new_content)


def patch_scale(goals_path: str, scale_text: str) -> None:
    """Write goals.md's `## Scale` section (REQUIREMENTS §4.3).

    Scale is a SEPARATE recorded field, not a phrase inside the mission,
    because §4.3 is explicit that scale cannot be inferred from the mission's
    wording: "fix this bug" may be a three-week root-cause hunt. Recording it
    apart from the mission text is what makes the honest answer — "unknown
    until we look" — a statable value rather than a hedge buried in prose.

    Written the same way `## Mission` already is: replace the first section
    body up to the next `## ` heading or EOF, and append the section when the
    file does not have one yet.
    """
    if os.path.exists(goals_path):
        with open(goals_path, "r") as fh:
            content = fh.read()
    else:
        content = "# Goals\n\n"

    pattern = re.compile(r"## Scale[^\n]*\n.*?(?=\n## |\Z)", re.DOTALL)
    replacement = "## Scale\n\n" + scale_text
    new_content, scount = pattern.subn(replacement, content, count=1)
    if scount == 0:
        new_content = content.rstrip("\n") + "\n\n## Scale\n\n" + scale_text + "\n"
    elif not new_content.endswith("\n"):
        new_content += "\n"

    with open(goals_path, "w") as fh:
        fh.write(new_content)


FORBIDDEN_IDENTITY_SUBSTRINGS = ("<!--", "-->")


def validate_identity_value(label: str, value: str) -> None:
    """Reject an identity value that could break out of the marker block.

    The identity is substituted verbatim between <!-- IDENTITY:BEGIN --> and
    <!-- IDENTITY:END -->. A value carrying a comment delimiter or a newline
    closes the block early, leaving stranded text OUTSIDE it that no later
    onboarding can reach (MARKER_BLOCK_RE is non-greedy, so it matches to the
    INJECTED end marker forever) and that the clones then replicate to every
    platform — silently, at rc=0.

    Rejecting is deliberate over sanitising: the name an operator chose is
    theirs, and quietly mangling it into something else is a worse answer than
    saying which character cannot be used.
    """
    for bad in FORBIDDEN_IDENTITY_SUBSTRINGS:
        if bad in value:
            raise SystemExit(
                f"Refusing to onboard: --{label} contains {bad!r}, an HTML "
                f"comment delimiter. The identity is written between "
                f"<!-- IDENTITY:BEGIN --> and <!-- IDENTITY:END --> markers, "
                f"and this value would break out of that block and corrupt "
                f"AGENTS.md and its clones. Choose a name without it."
            )
    if "\n" in value or "\r" in value:
        raise SystemExit(
            f"Refusing to onboard: --{label} contains a newline. The identity "
            f"is a single line inside the marker block; a multi-line value "
            f"would corrupt AGENTS.md and its clones."
        )


ONBOARD_FILL_REL = "execution/onboard_fill.py"
ONBOARD_FILL_TIMEOUT_SECONDS = 120


def identity_is_present(agents_path: str, agent_name: str) -> bool:
    """True if AGENTS.md now carries this agent's identity sentence."""
    try:
        with open(agents_path, "r") as fh:
            return ("**You are %s**" % agent_name) in fh.read()
    except OSError:
        return False


def run_onboard_fill(agents_path: str, agent_name: str) -> None:
    """Write the identity into AGENTS.md (and re-sync its clones).

    Failures are PROPAGATED, never swallowed. The previous version piped
    onboard_fill's output to DEVNULL and ignored its exit code, so an onboarding
    that never wrote the agent's identity still reported success — half of the
    double no-op that shipped unfilled instructions to every workspace. An
    ABSENT AGENTS.md is still tolerated (nothing to fill is not a failure); an
    AGENTS.md that could not be filled is not.
    """
    if not os.path.exists(agents_path):
        return
    if not os.path.exists(ONBOARD_FILL_REL):
        raise SystemExit(
            f"Onboarding incomplete: {ONBOARD_FILL_REL} is not present, so the "
            f"agent identity was never written into {agents_path}."
        )
    proc = subprocess.run(
        [sys.executable, ONBOARD_FILL_REL, agents_path],
        check=False,
        capture_output=True,
        text=True,
        timeout=ONBOARD_FILL_TIMEOUT_SECONDS,
    )
    if proc.stdout:
        sys.stdout.write(proc.stdout)
    if proc.stderr:
        sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        # Say what actually happened. onboard_fill exits 1 both when it could
        # not write the identity AND when it wrote it but could not re-sync the
        # CLAUDE.md / GEMINI.md clones; reporting the former for the latter
        # sends the operator looking in the wrong file.
        if identity_is_present(agents_path, agent_name):
            detail = (
                f"the agent identity WAS written into {agents_path}, but its "
                f"CLAUDE.md / GEMINI.md clones could not be re-synced, so the "
                f"platforms would disagree about who the agent is"
            )
        else:
            detail = f"the agent identity was NOT written into {agents_path}"
        raise SystemExit(
            f"Onboarding incomplete: {ONBOARD_FILL_REL} exited "
            f"{proc.returncode} — {detail}. onboarding_complete stays false; "
            f"fix the cause and re-run."
        )


def _read_back(path: str) -> str:
    """Read a file this run just wrote. A read that fails is a FAILED run."""
    try:
        with open(path, "r", encoding="utf-8-sig") as fh:
            return fh.read()
    except OSError as exc:
        raise SystemExit(
            f"Onboarding failed: {path} could not be read back after being "
            f"written ({exc}), so this run cannot confirm what landed on disk. "
            f"onboarding_complete stays false and the boot gate stays shut."
        )


def _landed(what: str, path: str, got, expected) -> None:
    if got != expected:
        raise SystemExit(
            f"Onboarding failed: {what} did not land in {path}. Expected "
            f"{expected!r}, read back {got!r}. The boot gate has NOT been "
            f"opened; fix the cause and re-run."
        )


def verify_landed(args, tech_stack, soul_content, user_content,
                  scale_text) -> None:
    """Re-read every artifact FROM DISK and confirm this run's values landed.

    REQUIREMENTS §4: the profile write and the gate flip are background, but
    CONCLUSIVE. "Conclusive" is not a comment — it is this function plus
    confirm_gate_open(). Everything above wrote; nothing above checked that a
    write survived contact with the filesystem, so a write that silently
    dropped a key, truncated a file or landed under a different name reported
    success and shut the boot gate on a workspace with no identity in it.

    This runs BEFORE open_onboarding_gate(), so a failure here leaves the gate
    shut and the next boot retries — the invariant scaffold-identity D6 and
    open_onboarding_gate's own docstring both state.
    """
    data = _load_profile(args.profile_path)
    identity = data.get("identity")
    if not isinstance(identity, dict):
        identity = {}
    _landed("project_name", args.profile_path,
            data.get("project_name"), args.project_name)
    _landed("identity.agent_name", args.profile_path,
            identity.get("agent_name"), args.agent_name)
    _landed("identity.project_role", args.profile_path,
            identity.get("project_role"), args.role)
    if tech_stack is not None:
        _landed("tech_stack", args.profile_path,
                data.get("tech_stack"), tech_stack)

    _landed("soul.md", args.soul_path, _read_back(args.soul_path), soul_content)
    _landed("user.md", args.user_path, _read_back(args.user_path), user_content)
    _landed("WORKSPACE", args.workspace_path,
            _read_back(args.workspace_path), args.project_name + "\n")

    goals = _read_back(args.goals_path)
    for what, expected in (("the mission text", args.mission),
                           ("the mission scale", scale_text)):
        if expected not in goals:
            raise SystemExit(
                f"Onboarding failed: {what} did not land in {args.goals_path}. "
                f"Expected to read back {expected!r} and did not. The boot gate "
                f"has NOT been opened; fix the cause and re-run."
            )

    # AGENTS.md is the single most-read surface in every later session. An
    # absent one is not a failure (run_onboard_fill tolerates it); one that
    # exists and does not name this agent is.
    if os.path.exists(args.agents_path) and not identity_is_present(
            args.agents_path, args.agent_name):
        raise SystemExit(
            f"Onboarding failed: {args.agents_path} exists but does not carry "
            f"the identity sentence for {args.agent_name!r}, so every session "
            f"would read the wrong agent off it. The boot gate has NOT been "
            f"opened; fix the cause and re-run."
        )


def build_parser() -> argparse.ArgumentParser:
    """Return the writer's CLI parser.

    Split out of main() so the flag surface can be INTROSPECTED without running
    the writer. `.agent/skills/onboard.md` documents one command, and F3A7
    checks every flag in it against this parser; the alternative — scraping
    add_argument() calls out of the AST — cannot see a flag added through a
    loop or inherited from a parent parser.
    """
    parser = argparse.ArgumentParser(
        description="Headless Athanor onboarding — no interactive prompts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # OPTIONAL. REQUIREMENTS §1: the project name is the FOLDER NAME and is
    # never asked — it is already in WORKSPACE, written by init.sh from the
    # sanitised folder name. The flag survives for two reasons: it is the
    # isolation seam three other specs' goldens pass, and a caller deliberately
    # renaming a workspace has to be able to say so. Resolved in main() by
    # resolve_project_name(), keyed on `is None` and never on falsiness.
    parser.add_argument(
        "--project-name",
        default=None,
        help="Project name. Optional — defaults to WORKSPACE's first line, or "
             "the folder name. Never asked during onboarding.",
    )
    # OPTIONAL, and the default is the project name (REQUIREMENTS.md §1,
    # clean-scaffold D-4): "agent name = the project name, SUGGESTED; user
    # approves or changes". Making it required meant there was no suggestion at
    # all — every caller had to invent a name, which is precisely the fabricated
    # identity scaffold-identity D2 exists to end. The default is applied in
    # main() below, keyed on `is None` and never on falsiness.
    parser.add_argument(
        "--agent-name",
        default=None,
        help="Agent name (identity). Optional — defaults to --project-name, "
             "the suggestion the user approves or changes.",
    )
    parser.add_argument("--role", required=True, help="Agent project role")
    parser.add_argument("--mission", required=True, help="Mission statement for goals.md")

    # ── The interview's own fields (REQUIREMENTS §4.1, §4.3, §4.4) ──────────
    # ALL OPTIONAL, deliberately (DECISIONS D-O2). Three shipped goldens invoke
    # this writer with exactly --project-name/--agent-name/--role/--mission;
    # making any of these required turns those gates red on the day it lands.
    # The requirement is that onboarding ASKS, not that the CLI refuses.
    parser.add_argument(
        "--archetype",
        default="",
        help="Domain archetype for soul.md (e.g. 'Master Hacker', 'Designer'). "
             "Omitted: soul.md says so rather than inventing one.",
    )
    parser.add_argument(
        "--mission-scale",
        default="",
        help="Recorded scale of the mission, WITH reasoning. Omitted: goals.md "
             "records that it is not yet known and that a scoping step is owed.",
    )
    parser.add_argument(
        "--tech-stack",
        default=None,
        help="Comma-separated stack (e.g. 'node, firebase, resend'). Trimmed, "
             "de-duplicated and stored as profile.json's tech_stack list.",
    )

    # Optional override flags
    parser.add_argument(
        "--soul-persona",
        default="",
        help="Full soul.md content (default: generated from agent-name + role)",
    )
    parser.add_argument(
        "--user-context",
        default="",
        help="Full user.md content (default: generic placeholder)",
    )
    parser.add_argument(
        "--profile-path",
        default=".agent/profile.json",
        help="Path to profile.json (default: .agent/profile.json)",
    )
    parser.add_argument(
        "--soul-path",
        default=".agent/identity/soul.md",
        help="Path to soul.md (default: .agent/identity/soul.md)",
    )
    parser.add_argument(
        "--user-path",
        default=".agent/identity/user.md",
        help="Path to user.md (default: .agent/identity/user.md)",
    )
    parser.add_argument(
        "--goals-path",
        default=".agent/memory/project/goals.md",
        help="Path to goals.md (default: .agent/memory/project/goals.md)",
    )
    parser.add_argument(
        "--workspace-path",
        default="WORKSPACE",
        help="Path to WORKSPACE file (default: WORKSPACE)",
    )
    parser.add_argument(
        "--agents-path",
        default="AGENTS.md",
        help="Path to AGENTS.md, the identity document (default: AGENTS.md)",
    )
    parser.add_argument(
        "--allow-harness-rewrite",
        action="store_true",
        default=False,
        help="Override the harness-identity guard and rewrite WORKSPACE even if it "
        "currently holds the harness name",
    )

    return parser


def main() -> None:
    args = build_parser().parse_args()

    # REQUIREMENTS §1, resolved before anything reads it.
    if args.project_name is None:
        args.project_name = resolve_project_name(args.workspace_path)

    # The suggestion, approved (REQUIREMENTS.md §1 / clean-scaffold D-4).
    # Omitting --agent-name IS the approval, so the project name becomes the
    # identity; supplying one overrides it. `is None` and never falsiness: an
    # explicit --agent-name="" is a value the operator typed, and it must reach
    # the validation and the profile as itself rather than be silently replaced
    # by a different name. Runs BEFORE validate_identity_value so the default is
    # held to exactly the same rules as a name typed by hand.
    if args.agent_name is None:
        args.agent_name = args.project_name

    # Guard: reject an identity that cannot survive the marker block. Must run
    # before any writes — see validate_identity_value.
    validate_identity_value("agent-name", args.agent_name)
    validate_identity_value("role", args.role)
    # --project-name reaches the SAME substitution site: identity_sentence()
    # interpolates it verbatim between the IDENTITY markers, so an unvalidated
    # value strands text outside the block exactly as an unvalidated agent name
    # would, and the clones then replicate that to every platform at rc=0.
    validate_identity_value("project-name", args.project_name)

    # Guard: refuse to rewrite WORKSPACE if it currently holds the harness
    # identity (i.e. this looks like a checkout of the harness repo itself,
    # not a downstream project) and the requested project name differs.
    # Must run before any writes. See GH #1369.
    if not args.allow_harness_rewrite and os.path.exists(args.workspace_path):
        with open(args.workspace_path, "r") as fh:
            current_workspace = fh.read().strip()

        effective_harness_name = (
            _load_profile(args.profile_path).get("harness_name")
            or DEFAULT_HARNESS_NAME
        )

        if current_workspace == effective_harness_name and args.project_name != effective_harness_name:
            print(
                f"Refusing to onboard: WORKSPACE currently holds the harness name "
                f"({effective_harness_name!r}), which means this looks like a checkout "
                f"of the harness repo itself, not a downstream project. Onboarding as "
                f"{args.project_name!r} would corrupt the harness's own WORKSPACE. "
                f"Pass --allow-harness-rewrite to override.",
                file=sys.stderr,
            )
            sys.exit(1)

    # Ensure parent directories exist for override paths.
    for path in (args.profile_path, args.soul_path, args.user_path, args.goals_path):
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)

    tech_stack = (None if args.tech_stack is None
                  else parse_tech_stack(args.tech_stack))
    scale_text = args.mission_scale or SCALE_DEFAULT

    # 1. Patch profile.json — preserve all existing keys.
    patch_profile(args.profile_path, args.project_name, args.agent_name,
                  args.role, tech_stack)

    # 2. Write soul.md.
    soul_content = build_soul_content(args.agent_name, args.role,
                                      args.archetype, args.soul_persona)
    with open(args.soul_path, "w") as fh:
        fh.write(soul_content)

    # 3. Write user.md.
    user_content = build_user_content(args.user_context)
    with open(args.user_path, "w") as fh:
        fh.write(user_content)

    # 4. Patch goals.md — the mission verbatim, then its scale as its own
    #    section. Mission first: patch_goals' section regex stops at the next
    #    `## ` heading, so writing Scale first would leave Mission's body
    #    bounded by it and the order of the two writes would matter.
    patch_goals(args.goals_path, args.mission)
    patch_scale(args.goals_path, scale_text)

    # 5. Write WORKSPACE file.
    with open(args.workspace_path, "w") as fh:
        fh.write(args.project_name + "\n")

    # 6. Write the identity into AGENTS.md and re-sync its clones.
    run_onboard_fill(args.agents_path, args.agent_name)

    # 6.5 CONCLUSIVE, part one. Re-read every value above FROM DISK before the
    #     gate is touched at all. A mismatch exits non-zero with the gate still
    #     shut, so the next boot retries.
    verify_landed(args, tech_stack, soul_content, user_content, scale_text)

    # 7. Open the boot gate. LAST WRITE, and only now: every step above
    #    succeeded AND was read back, so this is the one moment at which
    #    onboarding is genuinely complete.
    open_onboarding_gate(args.profile_path)

    # 7.5 CONCLUSIVE, part two. A READ, so step 7 remains the last WRITE.
    confirm_gate_open(args.profile_path)

    # 8. Confirm success.
    print(f"Onboarding complete: {args.project_name}")
    sys.exit(0)


if __name__ == "__main__":
    main()

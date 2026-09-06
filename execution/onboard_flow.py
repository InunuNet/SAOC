#!/usr/bin/env python3
"""First boot, as a program — specs/first-boot-law, golden `first_boot_law.md`.

One law governs every value this interview puts in front of an operator:

    DISPLAYED FROM DISK AND CONFIRMED, or ASKED. Nothing is inferred, and
    nothing is invented to fill a gap.

Prose could not hold that line. The interview used to live in
`.agent/skills/onboard.md`, describing a flow that git provisioning and the
boot panel were never wired into; every component passed a contract of its own
while the seams between them went unexecuted, and a real first boot came out
carrying a fabricated archetype, another project's mission and a stack nobody
named. So the interview is this program. It ORCHESTRATES the shipped
components and reimplements none of them:

    onboard_headless.py   the one writer, and the one definition of every
                          harness default this interview displays
    memory_quarantine.py  disposal of inherited workspace state
    git_provision.py      `propose`, then `apply --confirmed` and nothing else
    boot_panel.py         the closing panel, rendered by its own renderer

    onboard_flow.py steps                      -> the ten step ids, in order
    onboard_flow.py run                        -> the interview
    onboard_flow.py run --answers <file.json>  -> the same interview, scripted

The defaults are IMPORTED from the writer rather than copied (DECISIONS D1):
the interview and the writer read one object in one process tree, so "the
interview showed one thing and the writer wrote another" has nowhere left to
live. `template/.agent/identity/*.md` are placeholders and are never displayed.

Exit codes:
    0  onboarding completed; the panel reports whatever git ended up as
    1  a step failed — the boot gate is left exactly as the writer left it
    2  refused: an answer that is neither of the two moves a confirm step
       offers. Nothing is written and nothing is created.

Git provisioning being declined, or failing, does NOT fail the run: the
identity has already landed by then, the panel's git line reports it as
not-ready, and re-running the whole interview would be the wrong repair
(golden section 3).
"""

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from onboard_headless import (ARCHETYPE_UNSET, COMMUNICATION_CONTRACT,  # noqa: E402
                              DEFAULT_USER_PROFILE, SCALE_DEFAULT)
import memory_quarantine  # noqa: E402

# Golden section 3. The order is load-bearing three times over: every
# DISPLAY-CONFIRM step precedes the write, because a default shown afterwards
# is a report rather than a confirmation; `quarantine` precedes
# `write-identity`, because that is where the boot gate flips; and `panel` is
# last, because its only job is to report the finished state.
STEPS = (
    ("identity", "ASK"),
    ("user-profile", "DISPLAY-CONFIRM"),
    ("comms-contract", "DISPLAY-CONFIRM"),
    ("mission", "ASK"),
    ("scale", "ASK"),
    ("tech-stack", "PROPOSE-CONFIRM"),
    ("quarantine", "ACT"),
    ("write-identity", "ACT"),
    ("git", "PROPOSE-CONFIRM"),
    ("panel", "ACT"),
)
STEP_KIND = dict(STEPS)

RC_OK = 0
RC_FAILED = 1
RC_REFUSED = 2

# Golden section 5. Case-sensitive, because these are the values the answers
# schema pins; anything else at a confirm step is a refusal, not a synonym.
CONFIRM = "CONFIRM"
DECLINE = "DECLINE"
EDIT_PREFIX = "EDIT:"

# Where the run leaves the panel document it collected, so the panel it printed
# can be re-rendered from the same bytes rather than re-collected.
PANEL_DOC_REL = os.path.join(".agent", "memory", "scratch", "boot_panel_last.json")

# The end of a multi-line replacement typed at a terminal. A lone dot, because
# an operator pasting a Markdown document has no use for one on its own line.
EDIT_TERMINATOR = "."

COMPONENTS = ("onboard_headless.py", "git_provision.py", "boot_panel.py")


class Refusal(Exception):
    """An answer that is neither of the two moves a confirm step offers."""

    def __init__(self, step, value):
        super(Refusal, self).__init__(step)
        self.step = step
        self.value = value


class StepFailed(Exception):
    """A step could not complete. The transcript says which and why."""


def emit(text):
    """Write to the transcript verbatim. The transcript IS the operator's view."""
    sys.stdout.write(text)
    sys.stdout.flush()


def marker(step):
    emit("=== STEP %s %s ===\n" % (step, STEP_KIND[step]))


def project_name(root):
    """The project name is the FOLDER NAME and is never asked (REQUIREMENTS 1).

    WORKSPACE first when it holds something — init.sh has already written the
    sanitised folder name there — and the folder's own basename otherwise.
    """
    try:
        with open(os.path.join(root, "WORKSPACE"), "r", encoding="utf-8-sig") as fh:
            recorded = fh.readline().strip()
        if recorded:
            return recorded
    except OSError:
        pass
    return os.path.basename(os.path.abspath(root))


class Answers(object):
    """The answer source. One step machine; only where answers come from differs.

    A scripted run reads a JSON object written ahead of time and treats an
    unrecognised value at a confirm step as a refusal. An interactive run asks
    the operator and re-asks until the answer is one of the moves the step
    offers, because a human mistyping `y` has not refused anything. End of
    input is a refusal in both.
    """

    def __init__(self, scripted=None):
        self.scripted = scripted

    @property
    def interactive(self):
        return self.scripted is None

    def _scripted_value(self, key):
        value = self.scripted.get(key, "")
        if value is None:
            return ""
        if not isinstance(value, str):
            raise Refusal(key, value)
        return value

    def _read(self, prompt=""):
        """Read one line, and keep the transcript's column-0 invariant true.

        A newline typed at a terminal is echoed by the terminal. One arriving
        down a pipe is not, so without this the next step marker would be
        appended to the prompt instead of starting at column 0 (golden
        section 4). Raises EOFError, which each caller answers differently.
        """
        line = input(prompt)
        if not sys.stdin.isatty():
            emit("\n")
        return line

    def _prompt(self, text):
        try:
            return self._read(text).strip()
        except EOFError:
            raise Refusal("input", "end of input")

    def text(self, key, prompt, default="", required=False):
        """A free-text answer. Empty means the default, which may be empty."""
        if not self.interactive:
            return self._scripted_value(key).strip() or default
        while True:
            answer = self._prompt(prompt)
            if answer:
                return answer
            if not required:
                return default
            emit("An answer is required here.\n")

    def block(self, prompt):
        """A multi-line replacement, typed at a terminal."""
        emit(prompt)
        lines = []
        while True:
            try:
                line = self._read()
            except EOFError:
                break
            if line.strip() == EDIT_TERMINATOR:
                break
            lines.append(line)
        return "\n".join(lines) + "\n"

    def confirm_or_edit(self, key, prompt):
        """CONFIRM, or EDIT:<replacement>. There is no third move."""
        if not self.interactive:
            value = self._scripted_value(key)
            # The interactive branch below lowercases before matching, so a
            # human typing `confirm` is accepted while the SAME word in an
            # answers file was refused with rc=2 and nothing written — one
            # interview with two vocabularies, and the skill doc teaches the
            # lowercase one. Case is normalised here for the two fixed tokens
            # ONLY; anything that is not a move remains a refusal.
            upper = value.upper()
            if upper == CONFIRM:
                return CONFIRM
            if upper.startswith(EDIT_PREFIX):
                # The replacement text itself keeps its own case.
                return EDIT_PREFIX + value[len(EDIT_PREFIX):]
            raise Refusal(key, value)
        while True:
            answer = self._prompt(prompt).lower()
            if answer in ("confirm", "c", ""):
                return CONFIRM
            if answer in ("edit", "e"):
                return EDIT_PREFIX + self.block(
                    "Type the replacement, then a single '%s' on its own line:\n"
                    % EDIT_TERMINATOR)
            emit("Answer 'confirm' or 'edit'.\n")

    def choice(self, key, prompt, accepted):
        """One of a fixed set of answers, and nothing else."""
        if not self.interactive:
            value = self._scripted_value(key)
            # Same normalisation as confirm_or_edit, and for the same reason:
            # the interactive branch below uppercases before matching.
            if value.upper() in accepted:
                return value.upper()
            raise Refusal(key, value)
        while True:
            answer = self._prompt(prompt).upper()
            if answer in accepted:
                return answer
            emit("Answer %s.\n" % " or ".join("'%s'" % a for a in accepted))


def load_answers(path):
    """Read the answers file. A boundary: say what is wrong with it, precisely."""
    try:
        with open(path, "r", encoding="utf-8-sig") as fh:
            data = json.load(fh)
    except OSError as exc:
        raise StepFailed("cannot read the answers file %s (%s)" % (path, exc))
    except ValueError as exc:
        raise StepFailed("%s is not valid JSON (%s)" % (path, exc))
    if not isinstance(data, dict):
        raise StepFailed(
            "%s must hold a JSON object of answers, not %s"
            % (path, type(data).__name__))
    return data


def require_components(root):
    """Every shipped component this flow orchestrates must be here to orchestrate."""
    missing = [name for name in COMPONENTS
               if not os.path.isfile(os.path.join(root, "execution", name))]
    if missing:
        raise StepFailed(
            "this workspace is missing %s under %s/execution — onboarding "
            "orchestrates the shipped components and cannot stand in for them"
            % (", ".join(missing), root))


def run_component(root, name, argv):
    """Run one shipped component and hand back its result. Never its stderr."""
    script = os.path.join(root, "execution", name)
    try:
        return subprocess.run([sys.executable, script] + argv, cwd=root,
                              capture_output=True, text=True)
    except OSError as exc:
        raise StepFailed("could not run %s (%s)" % (script, exc))


def step_identity(answers, root):
    """ASK. The project name is not among the questions: it is the folder name."""
    marker("identity")
    name = project_name(root)
    emit("Project name: %s — the folder name, read from WORKSPACE, never asked.\n"
         % name)
    agent = answers.text("agent_name", "Agent name [%s]: " % name, default=name)
    role = answers.text("role", "Role: ", required=True)
    archetype = answers.text(
        "archetype",
        "Archetype (leave empty and it is recorded as unset, never guessed): ")
    emit("Agent name: %s\n" % agent)
    emit("Role: %s\n" % role)
    emit("Archetype: %s\n" % (archetype or ARCHETYPE_UNSET))
    return {"project": name, "agent": agent, "role": role, "archetype": archetype}


def step_user_profile(answers):
    """DISPLAY-CONFIRM. The harness default, as the writer holds it."""
    marker("user-profile")
    emit("This is the harness default operator profile, as written:\n\n")
    emit(DEFAULT_USER_PROFILE)
    emit("\nConfirm it, or replace it wholesale. Those are the only two moves.\n")
    answer = answers.confirm_or_edit(
        "user_profile", "Confirm this profile, or edit it? [confirm/edit]: ")
    if answer == CONFIRM:
        return ""
    replacement = answer[len(EDIT_PREFIX):]
    emit("\nReplaced. This is what will be written, read back:\n\n")
    emit(replacement if replacement.endswith("\n") else replacement + "\n")
    return replacement


def step_comms_contract(answers):
    """DISPLAY-CONFIRM. Fixed by the harness; confirmed, never negotiated."""
    marker("comms-contract")
    emit("This is the agent's communication contract, as written. The harness "
         "fixes it; confirming is the only move.\n\n")
    for line in COMMUNICATION_CONTRACT:
        emit("- %s\n" % line)
    answers.choice("comms_contract", "\nConfirm the contract? [CONFIRM]: ",
                   (CONFIRM,))
    return None


def step_mission(answers):
    """ASK. The operator's words, read back before anything is written."""
    marker("mission")
    emit("The mission, in your words. It is read back before anything is "
         "written, and it lands in goals.md verbatim.\n")
    mission = answers.text("mission", "Mission: ", required=True)
    emit("Mission: %s\n" % mission)
    return mission


def step_scale(answers):
    """ASK. Scale cannot be read off the mission's wording, so it is asked."""
    marker("scale")
    emit("The scale, with your reasoning. It cannot be inferred from the "
         "mission's wording.\n")
    emit("Default when it is not yet known: %s\n" % SCALE_DEFAULT)
    scale = answers.text("scale", "Scale [%s]: " % SCALE_DEFAULT)
    emit("Scale: %s\n" % (scale or SCALE_DEFAULT))
    return scale


def step_tech_stack(answers):
    """PROPOSE-CONFIRM. Empty is recorded as unset, never read off the mission."""
    marker("tech-stack")
    emit("The tech stack, comma-separated, with reasons for each piece.\n")
    emit("Empty is recorded as unset — it is never inferred from the mission "
         "text, the folder name or the platform.\n")
    stack = answers.text("tech_stack", "Tech stack: ")
    emit("Tech stack: %s\n"
         % (stack if stack else "(not set — recorded as [], not inferred)"))
    return stack


def step_quarantine(root):
    """ACT. Inherited state goes before the gate can ever flip."""
    marker("quarantine")
    try:
        result = memory_quarantine.dispose(root)
    except memory_quarantine.QuarantineError as exc:
        raise StepFailed(
            "inherited workspace state could not be quarantined: %s\n"
            "Nothing was deleted, and the boot gate stays shut." % exc)
    if result is None:
        emit("No inherited workspace state found — nothing to move.\n")
        return
    emit("Inherited workspace state QUARANTINED, not deleted, in .agent/%s\n"
         % result.name)
    for entry in result.moved:
        emit("  moved: %s\n" % entry)
    emit("Inspect it, copy back what you want, and delete it yourself.\n")


def step_write_identity(root, identity, mission, scale, stack, user_profile):
    """ACT. The one writer runs, and the boot gate flips inside it."""
    marker("write-identity")
    # Every field is passed explicitly, empty ones included: an omitted flag
    # leaves whatever the profile already held, and "whatever was already
    # there" is exactly the inherited value this flow exists to end.
    argv = [
        "--agent-name", identity["agent"],
        "--role", identity["role"],
        "--mission", mission,
        "--archetype", identity["archetype"],
        "--mission-scale", scale,
        "--tech-stack", stack,
        "--user-context", user_profile,
    ]
    proc = run_component(root, "onboard_headless.py", argv)
    emit(proc.stdout)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        raise StepFailed(
            "the writer exited %d — the boot gate stayed shut and the next "
            "boot retries" % proc.returncode)


def step_git(answers, root, name):
    """PROPOSE-CONFIRM. The shipped proposal, then confirmation or nothing."""
    marker("git")
    proposal = run_component(root, "git_provision.py",
                             ["propose", "--project-name", name])
    emit(proposal.stdout)
    if proposal.returncode != 0:
        sys.stderr.write(proposal.stderr)
        emit("No repository, no remote and no commit identity can be proposed "
             "for this project name, so none is created.\n")
        return
    emit("\nYour confirmation is the only authorisation. Nothing above exists "
         "until you give it.\n")
    answer = answers.choice("git", "Create it? [CONFIRM/DECLINE]: ",
                            (CONFIRM, DECLINE))
    if answer == DECLINE:
        emit("Declined — no repository, no remote and no commit identity was "
             "created.\n")
        return
    applied = run_component(root, "git_provision.py",
                            ["apply", "--project-name", name,
                             "--path", root, "--confirmed"])
    emit(applied.stdout)
    emit(applied.stderr)
    if applied.returncode != 0:
        # Not fatal: the identity has landed, and the panel's git line is what
        # makes an incomplete provisioning visible instead of silent.
        emit("git provisioning exited %d — the panel below reports what is "
             "actually configured.\n" % applied.returncode)


def step_panel(root):
    """ACT. The shipped panel's own bytes, and the last bytes of the run."""
    marker("panel")
    doc = os.path.join(root, PANEL_DOC_REL)
    try:
        os.makedirs(os.path.dirname(doc), exist_ok=True)
    except OSError as exc:
        raise StepFailed("cannot create %s (%s)" % (os.path.dirname(doc), exc))
    collected = run_component(root, "boot_panel.py",
                              ["--format", "json", "--root", root])
    if collected.returncode != 0 or not collected.stdout.strip():
        sys.stderr.write(collected.stderr)
        raise StepFailed("the boot panel collected nothing to report")
    try:
        with open(doc, "w", encoding="utf-8") as fh:
            fh.write(collected.stdout)
    except OSError as exc:
        raise StepFailed("cannot write %s (%s)" % (doc, exc))
    rendered = run_component(root, "boot_panel.py",
                             ["--no-collect", "--from-json", doc,
                              "--agreement", "--root", root])
    if rendered.returncode != 0:
        sys.stderr.write(rendered.stderr)
        raise StepFailed("the boot panel could not render the collected report")
    # LAST. Nothing may follow the panel — no farewell, no summary — or an
    # interrupted run reads as a finished one.
    emit(rendered.stdout)


def cmd_steps(_args):
    for step, _kind in STEPS:
        print(step)
    return RC_OK


def cmd_run(args):
    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        sys.stderr.write("Onboarding failed: %s is not a directory\n" % root)
        return RC_FAILED
    answers_path = args.answers or os.environ.get("ATHANOR_ONBOARD_ANSWERS", "")
    try:
        require_components(root)
        if answers_path:
            # Announced on the FIRST line: a human operator must never be
            # silently inside a run that is answering for them.
            emit("NON-INTERACTIVE RUN — answers read from %s\n" % answers_path)
            answers = Answers(load_answers(answers_path))
        else:
            answers = Answers()
        identity = step_identity(answers, root)
        user_profile = step_user_profile(answers)
        step_comms_contract(answers)
        mission = step_mission(answers)
        scale = step_scale(answers)
        stack = step_tech_stack(answers)
        step_quarantine(root)
        step_write_identity(root, identity, mission, scale, stack, user_profile)
        step_git(answers, root, identity["project"])
        step_panel(root)
    except Refusal as exc:
        sys.stderr.write(
            "REFUSED at step '%s': %r is not an answer that step accepts. "
            "Nothing was written and nothing was created.\n"
            % (exc.step, exc.value))
        return RC_REFUSED
    except StepFailed as exc:
        sys.stderr.write("Onboarding failed: %s\n" % exc)
        return RC_FAILED
    return RC_OK


def build_parser():
    parser = argparse.ArgumentParser(
        prog="onboard_flow.py", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    steps = sub.add_parser("steps", help="print the step ids, in order")
    steps.set_defaults(func=cmd_steps)

    run = sub.add_parser("run", help="run the interview")
    run.add_argument("--root", default=".",
                     help="Workspace root (default: the working directory)")
    run.add_argument("--answers", default="",
                     help="JSON answers file for a non-interactive run "
                          "(or ATHANOR_ONBOARD_ANSWERS)")
    run.set_defaults(func=cmd_run)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

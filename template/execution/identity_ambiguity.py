#!/usr/bin/env python3
"""
identity_ambiguity.py — the ONE reader of "has a human accepted THIS folder as
the home of THIS project?" (spec copied-project-halt, F14).

THE DEFECT. Copying a project folder is the obvious way to start a new one, and
a copied DOWNSTREAM project silently inherits the source's identity, memory,
missions and brain. A copied HARNESS is already caught — workspace_state.py's
``inherited-harness-profile`` clause — but ``SAOC/`` copied to ``NewProj/``
still reads ESTABLISHED, resumes SAOC's missions, and nothing says so.

WHAT THIS FILE DOES NOT DO. It does not ask "copy or rename". A copy and a
rename are BYTE-FOR-BYTE IDENTICAL on disk: in both, ``project_name`` and
``WORKSPACE`` agree with each other and disagree with the folder. Two fixes
were proved unshippable and must never be re-proposed (DECISIONS.md D-1):

  * ``project_name != basename`` => inherited. That turns clean-scaffold
    F1/A1's ESTABLISHED fixtures red and contradicts F2/A3 (a directory rename
    must not rename the project).
  * a path fingerprint. A rename moves the path too.

So the gate asks the one question the filesystem CAN answer:

    Has a human ever accepted THIS folder as the home of THIS project?

AMBIGUOUS = no. Boot halts, changes nothing, and asks. CLEAR = yes, or the
question does not arise.

THE RULE, pinned by goldens/f14_identity_cases.md (an INDEPENDENT oracle —
never regenerate it from this file):

    AMBIGUOUS iff
        workspace_state.py says ESTABLISHED                      (§0 owns NEW)
      AND the folder disagrees with project_name under names_agree()
        below — the lossy comparison key, spending ONE dimension of
        loss (case OR punctuation) and never both at once
      AND no intact affirmation binds this project to this exact realpath.

Usage:
    python3 execution/identity_ambiguity.py [DIR]           # CLEAR|AMBIGUOUS
    python3 execution/identity_ambiguity.py [DIR] --reason  # ...reason on stderr
    python3 execution/identity_ambiguity.py [DIR] --affirm rename --project NAME
    python3 execution/identity_ambiguity.py [DIR] --affirm copy   --project NAME

The classification always exits 0: it is consulted by a SessionStart hook, and
a boot hook that fails takes the session with it. The two answers DO exit
non-zero when they refuse — a refusal the caller cannot see is not a refusal.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import name_sanitize  # noqa: E402  (path fixed up above)
import workspace_state  # noqa: E402

CLEAR = "CLEAR"
AMBIGUOUS = "AMBIGUOUS"

BINDING_RELPATH = os.path.join(".agent", ".identity_binding.json")
BINDING_SCHEMA = "athanor.identity-binding/v1"

ANSWER_RENAME = "rename"
ANSWER_COPY = "copy"
ANSWERS = (ANSWER_RENAME, ANSWER_COPY)

# Reason vocabulary — one word per way the question can be answered.
REASON_NOT_ESTABLISHED = "not-established"
REASON_NAMES_AGREE = "names-agree"
REASON_NO_RECORD = "no-record"
REASON_RECORD_UNREADABLE = "record-unreadable"
REASON_RECORD_MALFORMED = "record-malformed"
REASON_RECORD_NOT_OBJECT = "record-not-object"
REASON_RECORD_SCHEMA = "record-wrong-schema"
REASON_RECORD_ANSWER = "record-bad-answer"
REASON_DIGEST_MISMATCH = "digest-mismatch"
REASON_PATH_MISMATCH = "path-mismatch"
REASON_PROJECT_MISMATCH = "project-mismatch"
REASON_AFFIRMED = "affirmed"

# The seed class init.sh itself lays down under .agent/memory/ (init.sh's
# MEMORY_SEED_CLASS, D-F4-3). Anything else under live memory after the COPY
# answer is the SOURCE project's memory still sitting in a folder that is not
# that project — which is the whole defect, so the answer refuses to claim
# success while it is true (DECISIONS.md D-5 step 5, REQUIREMENTS §4).
MEMORY_SEED_CLASS = (
    "project/goals.md",
    "project/learned.md",
    "project/backlog.md",
    "project/session_log.md",
    "project/rules.md",
)

RC_OK = 0
RC_REFUSED = 2
RC_INCONCLUSIVE = 3

INIT_TIMEOUT_SECONDS = 900

# A record standing in the way that is NOT a regular file is MOVED aside under
# this suffix, never deleted — the same ruling init.sh reached for an
# unreadable profile (quarantine, never purge, always loud).
BINDING_RESCUE_SUFFIX = ".unreadable-"


class SymlinkedPath(Exception):
    """Raised instead of writing THROUGH a symlink.

    Measured 2026-09-03 (codex QA round 1, finding 3): with
    ``.agent/.identity_binding.json`` a symlink to
    ``.agent/memory/project/goals.md``, ``--affirm rename`` followed the link
    and ``os.replace()`` wrote the binding JSON over goals.md — the project's
    goals, destroyed by the command whose whole promise is "changes nothing
    else". A symlink is INTENT: the operator pointed this name at bytes that
    live somewhere else. init.sh already refuses a symlinked profile rather
    than moving it aside; the same refusal applies here.
    """

    def __init__(self, path):
        super().__init__(path)
        self.path = path


# ------------------------------------------------------------------ helpers --
def comparison_key(name):
    """The LOSSY key two existing names are compared through.

    NOT a second dialect of init.sh's sanitiser. REQUIREMENTS §3 forbids a
    second thing that PRODUCES a name; this produces none — it only compares
    two that already exist, and it is lossy ON PURPOSE so that ``My Project/``
    (which scaffolds to project ``MyProject``) does not halt forever on its own
    scaffolded name. It cannot hide a real copy: a copy is named for the NEW
    project (``SAOC`` in ``NewProj/``), never for the old one modulo
    punctuation. Golden kill K1 — an exact string compare — is what keeps it.

    It is the OUTER SCREEN, not the whole answer: see ``names_agree``.
    """
    return "".join(ch for ch in str(name or "") if ch.isalnum()).casefold()


def alnum_only(name):
    """comparison_key WITHOUT the case fold — punctuation-blind only."""
    return "".join(ch for ch in str(name or "") if ch.isalnum())


def case_only(name):
    """The raw name case-folded — case-blind only."""
    return str(name or "").casefold()


def names_agree(profile_project, folder):
    """Do these two names agree WELL ENOUGH to skip the binding check?

    THE COLLISION (codex QA round 1, finding 1). ``comparison_key`` is lossy in
    two INDEPENDENT dimensions — case and punctuation — and equality of the key
    alone let both losses compose. Measured 2026-09-03: a project named
    ``ACME R&D`` copied into a folder named ``Acme-RD`` keys to ``acmerd`` on
    both sides, so ``inspect()`` returned CLEAR before any binding was
    consulted and the copy ran with the source's identity, memory and missions.
    That is precisely the failure this feature exists to prevent, reached
    through the guard's own front door.

    So the key stays the outer screen (K1's exact-compare mutation still dies
    on agree-case/agree-space/agree-punct) and ONE dimension of loss is spent,
    never both:

      * differ only in CASE       — ``OwnProj`` in ``ownproj/`` (golden
        agree-case)
      * differ only in NON-ALPHANUMERICS — ``MyProject`` in ``My Project/``,
        ``ScafTest`` in ``Scaf-Test/`` (golden agree-space, agree-punct): the
        scaffolder's own shape, where the folder carries separators the
        project name does not.

    A name that needs BOTH rewrites to line up is not this folder's own name
    modulo the scaffolder — it is a different name that happens to collide. It
    does not short-circuit; it falls through to the binding check, where a
    human who really did rename ``ACME R&D/`` to ``Acme-RD/`` answers once and
    is never asked again.

    COST, stated rather than hidden: a workspace whose folder differs from its
    project name in case AND punctuation at once (``My Project`` in
    ``my-project/``) halts once and takes one ``--affirm rename`` — the same
    accepted residual shape as golden row ``sanitiser-residual``, and it fails
    toward the halt, which is the safe direction (D-2, "absence never
    accuses").
    """
    if comparison_key(profile_project) != comparison_key(folder):
        return False
    if case_only(profile_project) == case_only(folder):
        return True
    return alnum_only(profile_project) == alnum_only(folder)


def binding_path(workspace="."):
    return os.path.join(workspace, BINDING_RELPATH)


def compute_digest(project_name, workspace_path, answer):
    """sha256 over the record's four load-bearing fields, NUL-separated.

    Not a secret-keyed signature and it does not pretend to be (D-2). It
    catches a partial hand-edit or a bad merge — a path swapped without the
    digest recomputed — not a determined forger. A forger who recomputes the
    digest has stated, in the same keystrokes, exactly what ``--affirm rename``
    states. That is not an attack; it is the answer.
    """
    payload = "\0".join([BINDING_SCHEMA, str(project_name),
                         str(workspace_path), str(answer)])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def workspace_realpath(workspace="."):
    return os.path.realpath(os.path.abspath(workspace))


def folder_name(workspace="."):
    return os.path.basename(workspace_realpath(workspace))


def scaffold_name(workspace="."):
    """The project name THIS folder scaffolds as.

    Where a name is PRODUCED rather than compared, init.sh's one sanitiser is
    reused verbatim (REQUIREMENTS §3) — never comparison_key(), which is a
    comparison and would produce a name nobody chose.
    """
    return name_sanitize.workspace(folder_name(workspace))


def read_profile(workspace="."):
    """Return the parsed profile dict, or None. Never raises."""
    try:
        with open(workspace_state.profile_path(workspace),
                  encoding="utf-8-sig") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def project_name(workspace="."):
    profile = read_profile(workspace)
    if not profile:
        return ""
    return str(profile.get(workspace_state.PROJECT_NAME_KEY) or "").strip()


def _atomic_write_json(path, data):
    """Write JSON by os.replace, never truncate-in-place.

    ``open(path, "w")`` truncates first and writes second; an interruption
    between the two leaves a zero-byte file that the next read cannot classify.

    NEVER THROUGH A SYMLINK. This used to ``os.path.realpath()`` the target,
    which is exactly what followed ``.identity_binding.json -> goals.md`` and
    overwrote the goals (codex QA round 1, finding 3). ``abspath`` resolves the
    directory components the same way while leaving the final name alone, and a
    link standing at that name is refused instead of dereferenced.
    """
    if os.path.islink(path):
        raise SymlinkedPath(path)
    path = os.path.abspath(path)
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    try:
        mode = os.stat(path).st_mode & 0o7777
    except OSError:
        mode = None
    fd, tmp = tempfile.mkstemp(prefix=".identity.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(data, fh, indent=2)
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        if mode is not None:
            os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# ------------------------------------------------------------- the decision --
def read_binding(workspace="."):
    """Return (record, reason). record is None whenever reason is not None."""
    path = binding_path(workspace)
    if os.path.isdir(path):
        return None, REASON_RECORD_UNREADABLE
    if not os.path.exists(path):
        return None, REASON_RECORD_UNREADABLE if os.path.islink(path) else REASON_NO_RECORD
    try:
        with open(path, encoding="utf-8-sig") as fh:
            raw = fh.read()
    except UnicodeDecodeError:
        # MUST precede OSError/ValueError: UnicodeDecodeError is a ValueError
        # subclass, so naming ValueError first would report bad bytes as a
        # permissions problem.
        return None, REASON_RECORD_MALFORMED
    except (OSError, ValueError):
        return None, REASON_RECORD_UNREADABLE
    try:
        record = json.loads(raw)
    except ValueError:
        return None, REASON_RECORD_MALFORMED
    if not isinstance(record, dict):
        return None, REASON_RECORD_NOT_OBJECT
    if record.get("schema") != BINDING_SCHEMA:
        return None, REASON_RECORD_SCHEMA
    return record, None


def binding_clears(workspace, profile_project):
    """Return (True, REASON_AFFIRMED) iff an intact record binds this project
    to this exact realpath.

    ALL THREE clauses are required, and each has its own kill-mutation:

      digest recomputes         K3 — the only clause that catches a field
                                rewritten with the digest left alone.
      workspace_path == NOW     K2 — THE tamper-evidence clause. Without it an
                                inherited affirmation launders the very copy
                                that carries it.
      project_name == NOW       a record naming another project is not this
                                project's answer.

    ABSENCE NEVER ACCUSES; it only fails to clear. This function can turn a
    halt into a pass, never a pass into a halt — so an rsync that dropped the
    record still leaves the copy caught.
    """
    record, reason = read_binding(workspace)
    if record is None:
        return False, reason

    answer = str(record.get("answer") or "")
    if answer not in ANSWERS:
        return False, REASON_RECORD_ANSWER

    recorded_project = str(record.get("project_name") or "")
    recorded_path = str(record.get("workspace_path") or "")

    expected = compute_digest(recorded_project, recorded_path, answer)
    if str(record.get("digest") or "") != expected:
        return False, REASON_DIGEST_MISMATCH
    if recorded_path != workspace_realpath(workspace):
        return False, REASON_PATH_MISMATCH
    if recorded_project != profile_project:
        return False, REASON_PROJECT_MISMATCH
    return True, REASON_AFFIRMED


def inspect(workspace="."):
    """Return (verdict, reason). Never raises."""
    # §0 OWNS NEW. Consulted only when workspace_state says ESTABLISHED —
    # otherwise this gate steals the rows the ONBOARDING gate already halts,
    # producing two halts for one defect (golden rows 11-13; kill K4).
    state, _ = workspace_state.inspect(workspace)
    if state != workspace_state.ESTABLISHED:
        return CLEAR, REASON_NOT_ESTABLISHED

    profile_project = project_name(workspace)
    if names_agree(profile_project, folder_name(workspace)):
        return CLEAR, REASON_NAMES_AGREE

    cleared, reason = binding_clears(workspace, profile_project)
    return (CLEAR if cleared else AMBIGUOUS), reason


def classify(workspace="."):
    return inspect(workspace)[0]


# --------------------------------------------------------------- the answers --
def _quoted(name):
    """Render a name for a copy-pasteable command line."""
    safe = name and all(ch.isalnum() or ch in "._-" for ch in name)
    return name if safe else '"%s"' % name.replace('"', '\\"')


def answer_lines(workspace="."):
    """The two commands the halt prints — this workspace's own names.

    A halt whose printed way out does not work is a lockout
    (platform-scoped-delivery D-F2-4), so A6 does not read this off the prose:
    it EXTRACTS the rename command from the boot log, RUNS it, and requires the
    halt to be gone afterwards.
    """
    return [
        "python3 execution/identity_ambiguity.py --affirm rename --project %s"
        % _quoted(project_name(workspace)),
        "python3 execution/identity_ambiguity.py --affirm copy --project %s"
        % _quoted(scaffold_name(workspace)),
    ]


def _refuse_symlink(path, what):
    """Say why a symlinked `path` is refused, and print the command that clears it.

    Every halt must be clearable by something the halt actually prints
    (platform-scoped-delivery D-F2-4). Removing a SYMLINK destroys nothing —
    the bytes live at the target, which `rm` on the link never touches — so
    this refusal ships its own one-command way out, unlike the write-through it
    replaces, which destroyed the target silently.
    """
    sys.stderr.write(
        "REFUSED: %s is a SYMLINK.\n"
        "         link   : %s\n"
        "         target : %s\n"
        "         Writing through it would overwrite the bytes at that target, which are\n"
        "         not this record's to overwrite — a symlinked record once destroyed a\n"
        "         project's goals.md exactly this way. Nothing was changed.\n"
        "         The link points somewhere on purpose. If it is stale, remove the LINK\n"
        "         (its target is untouched) and re-run this command:\n"
        "           rm %s\n"
        % (what, path,
           os.readlink(path) if os.path.islink(path) else "<unreadable>",
           path))


def _rescue_non_file(path, what):
    """MOVE a non-regular thing standing at `path` aside. Never delete it.

    A DIRECTORY named `.agent/.identity_binding.json` used to be a LOCKOUT
    (codex QA round 1, finding 4): it read as record-unreadable so boot halted,
    and the rename command the halt printed died with an IsADirectoryError out
    of `os.replace` — no documented command cleared it, and a delivered
    workspace has no init.sh to fall back on either. Moving it aside is
    non-destructive (every byte is preserved under a timestamped name) and
    makes the printed way out actually work, which is the whole bar a halt has
    to clear.
    """
    aside = "%s%s%s" % (path, BINDING_RESCUE_SUFFIX,
                        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    suffix = 1
    while os.path.lexists(aside):
        aside = "%s%s%s.%d" % (path, BINDING_RESCUE_SUFFIX,
                               datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
                               suffix)
        suffix += 1
    os.rename(path, aside)
    sys.stdout.write(
        "   ⚠ %s was not a file — it was MOVED aside, not deleted:\n"
        "       %s\n" % (what, os.path.basename(aside)))


def _clear_record_path(workspace):
    """Make the record path writable, or explain why it is not. Returns bool."""
    path = binding_path(workspace)
    what = BINDING_RELPATH
    if os.path.islink(path):
        _refuse_symlink(path, what)
        return False
    if os.path.lexists(path) and not os.path.isfile(path):
        try:
            _rescue_non_file(path, what)
        except OSError as exc:
            sys.stderr.write(
                "REFUSED: %s is not a file and could not be moved aside: %s\n"
                "         Nothing was deleted. Fix the permissions on %s and re-run.\n"
                % (what, exc, os.path.dirname(path) or "."))
            return False
    return True


def write_binding(workspace, answer):
    record = {
        "schema": BINDING_SCHEMA,
        "project_name": project_name(workspace),
        "workspace_path": workspace_realpath(workspace),
        "answer": answer,
        "affirmed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    record["digest"] = compute_digest(record["project_name"],
                                      record["workspace_path"], answer)
    _atomic_write_json(binding_path(workspace), record)
    return record


def affirm_rename(workspace, typed):
    """RENAME: record the answer and change NOTHING ELSE.

    REQUIREMENTS §1's "the project name IS the folder name" is a SCAFFOLD-TIME
    rule. clean-scaffold F2/A3 requires a directory rename NOT to rename an
    established project, and F2/A3 wins here (D-4): profile, WORKSPACE,
    AGENTS.md, memory, missions and identity are byte-identical afterwards.
    Renaming a project is a separate, deliberate act; this gate never performs
    it as a side effect. Kill K10 is the mutation that writes project_name.
    """
    current = project_name(workspace)
    if not current:
        sys.stderr.write(
            "REFUSED: this workspace has no readable project_name in %s, so there is\n"
            "         no identity to affirm. Repair the profile first.\n"
            % workspace_state.PROFILE_RELPATH)
        return RC_REFUSED
    if typed != current:
        sys.stderr.write(
            "REFUSED: --affirm rename --project '%s' does not name this workspace's\n"
            "         project. Its %s says '%s'.\n"
            "         The typed name IS the authorisation (REQUIREMENTS §3): affirming a\n"
            "         rename asserts that THIS project kept its identity across a folder\n"
            "         rename, so it has to be spelled out. Nothing was changed.\n"
            % (typed, workspace_state.PROFILE_RELPATH, current))
        return RC_REFUSED

    # The record path itself, BEFORE anything is written: a symlink is refused
    # outright and a directory is moved aside, so the one command this halt
    # prints cannot die on either (codex QA round 1, findings 3 and 4).
    if not _clear_record_path(workspace):
        return RC_REFUSED
    try:
        record = write_binding(workspace, ANSWER_RENAME)
    except SymlinkedPath as exc:
        _refuse_symlink(exc.path, BINDING_RELPATH)
        return RC_REFUSED
    sys.stdout.write(
        "RENAME affirmed: '%s' lives in '%s'.\n"
        "  recorded at : %s\n"
        "  bound to    : %s\n"
        "Nothing else was changed — the profile, WORKSPACE, memory and missions are\n"
        "untouched. The record is bound to that absolute path, so a COPY of this folder\n"
        "will be asked again rather than inheriting this answer.\n"
        % (current, folder_name(workspace), BINDING_RELPATH,
           record["workspace_path"]))
    return RC_OK


def _live_foreign_memory(workspace):
    """Relative paths under .agent/memory/ that are NOT init.sh's own seeds."""
    root = os.path.join(workspace, ".agent", "memory")
    foreign = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for filename in filenames:
            if filename in (".keep", ".gitkeep"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, filename), root)
            if rel.replace(os.sep, "/") in MEMORY_SEED_CLASS:
                continue
            foreign.append(rel.replace(os.sep, "/"))
    return sorted(foreign)


def affirm_copy(workspace, typed):
    """COPY: disown the inherited identity and hand the tree to init.sh.

    Disposal of the inherited memory is NOT implemented or re-specified here.
    init.sh owns it (scaffold-identity-integrity F4: quarantine, never purge),
    and an unonboarded profile is a FRESH disposition under its own rule — so
    flipping the flag below is what routes into it. Kill K12 (disposal changed
    from move to delete) is caught there, by F4's own assertion.
    """
    expected = scaffold_name(workspace)
    if not expected:
        sys.stderr.write(
            "REFUSED: this folder's name sanitizes to nothing, so there is no project\n"
            "         name to scaffold as. Rename the directory and re-run.\n")
        return RC_REFUSED
    if typed != expected:
        sys.stderr.write(
            "REFUSED: --affirm copy --project '%s' does not name THIS folder. This\n"
            "         directory scaffolds as '%s'.\n"
            "         Answering COPY disowns the identity in this folder and quarantines\n"
            "         the memory it inherited, so the name has to be typed exactly.\n"
            "         Nothing was changed.\n" % (typed, expected))
        return RC_REFUSED

    init_script = os.path.join(workspace, "init.sh")
    if not os.path.isfile(init_script):
        sys.stderr.write(
            "REFUSED: this workspace has no init.sh, and init.sh is what disposes of the\n"
            "         inherited memory (quarantine, never purge). Doing half of this — a\n"
            "         disowned profile beside another project's live missions — is worse\n"
            "         than doing none of it. Nothing was changed.\n"
            "         Scaffold it from a harness clone instead:\n"
            "           bash /path/to/Athanor/init.sh --path \"%s\"\n"
            % workspace_realpath(workspace))
        return RC_REFUSED

    inherited = project_name(workspace)

    # 0. The two files this answer REWRITES must not be symlinks. Same ruling,
    #    same reason, same measured defect class as the binding record (finding
    #    3): writing through `profile.json -> ../shared/profile.json` or
    #    `WORKSPACE -> ../shared/WORKSPACE` destroys bytes that belong to
    #    whatever the operator pointed at. init.sh refuses a symlinked profile
    #    for exactly this reason; refusing here too means the answer cannot
    #    half-do it and then hand init.sh a tree it will refuse anyway.
    for rel in (workspace_state.PROFILE_RELPATH, "WORKSPACE"):
        target = os.path.join(workspace, rel)
        if os.path.islink(target):
            _refuse_symlink(target, rel)
            return RC_REFUSED

    # 1. DISOWN. project_name becomes this folder's own; agent_name goes EMPTY
    #    rather than being invented (scaffold-identity D2: suggested and
    #    approved, never fabricated); onboarding_complete goes false, which is
    #    what routes init.sh into F4's disposal.
    profile = read_profile(workspace) or {}
    profile[workspace_state.PROJECT_NAME_KEY] = expected
    profile[workspace_state.ONBOARDING_KEY] = False
    identity = profile.get("identity")
    identity = dict(identity) if isinstance(identity, dict) else {}
    identity["agent_name"] = ""
    identity["project_role"] = ""
    profile["identity"] = identity
    _atomic_write_json(workspace_state.profile_path(workspace), profile)

    # 2. WORKSPACE too. init.sh resolves the project name FROM WORKSPACE when
    #    it exists, so leaving it would hand the scaffold back the very identity
    #    step 1 just disowned.
    with open(os.path.join(workspace, "WORKSPACE"), "w", encoding="utf-8") as fh:
        fh.write(expected + "\n")

    # 3. The affirmation belonged to the identity being disowned. `unlink`
    #    removes a symlink itself (never its target); a directory standing
    #    there is moved aside rather than left to make the next read halt.
    record_path = binding_path(workspace)
    try:
        if os.path.lexists(record_path) and not os.path.islink(record_path) \
                and not os.path.isfile(record_path):
            _rescue_non_file(record_path, BINDING_RELPATH)
        else:
            os.unlink(record_path)
    except OSError:
        pass

    sys.stdout.write("COPY answered: this folder is '%s', not '%s'.\n"
                     % (expected, inherited or "<unreadable>"))
    sys.stdout.write("Handing the tree to init.sh, which owns inherited-memory disposal.\n")
    sys.stdout.flush()

    # 4. init.sh owns the disposal. Its rc is deliberately NOT the verdict: on
    #    an in-place run the placeholder-residue gate legitimately exits 1 AFTER
    #    the tree is complete. The TREE is re-read below instead.
    try:
        proc = subprocess.run(
            ["bash", "init.sh", "--path", workspace_realpath(workspace), "--no-pulse"],
            cwd=workspace_realpath(workspace), timeout=INIT_TIMEOUT_SECONDS,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        init_output = proc.stdout or ""
        init_rc = proc.returncode
    except (OSError, subprocess.SubprocessError) as exc:
        init_output = "init.sh could not be run: %s" % exc
        init_rc = 127
    for line in init_output.splitlines():
        sys.stdout.write("   %s\n" % line)

    # 5. CONCLUSIVE, or it is not an answer (REQUIREMENTS §4). Saying the
    #    source project's missions were disposed of while they sit in the tree
    #    is the defect, not the fix — so the tree is re-read and the answer
    #    refuses to claim success it cannot see.
    problems = []
    state, reason = workspace_state.inspect(workspace)
    if state != workspace_state.NEW:
        problems.append("the workspace still reads %s (%s) — it would resume the "
                        "source project's missions" % (state, reason))
    now_project = project_name(workspace)
    if now_project != expected:
        problems.append("project_name is '%s', expected '%s'" % (now_project, expected))
    agent = str(((read_profile(workspace) or {}).get("identity") or {}).get("agent_name") or "")
    if agent:
        problems.append("identity.agent_name is '%s' — a name nobody chose" % agent)
    foreign = _live_foreign_memory(workspace)
    if foreign:
        problems.append("%d inherited memory file(s) are still LIVE under "
                        ".agent/memory/ (e.g. %s)" % (len(foreign), ", ".join(foreign[:3])))
    if problems:
        sys.stderr.write("\nINCONCLUSIVE — the copy answer did NOT finish (init.sh rc=%s):\n" % init_rc)
        for problem in problems:
            sys.stderr.write("  - %s\n" % problem)
        sys.stderr.write(
            "Nothing was deleted. Read init.sh's output above, fix what it reports, and\n"
            "re-run this command. This exits non-zero on purpose: reporting success while\n"
            "another project's memory is still live is the defect, not the fix.\n")
        return RC_INCONCLUSIVE

    quarantines = sorted(
        entry for entry in os.listdir(os.path.join(workspace, ".agent"))
        if entry.startswith("memory-quarantine-")
        and os.path.isdir(os.path.join(workspace, ".agent", entry)))
    sys.stdout.write(
        "\nDone. This folder is now the NEW, un-onboarded project '%s'.\n" % expected)
    if quarantines:
        sys.stdout.write("The inherited memory was MOVED, not deleted, to:\n")
        for entry in quarantines:
            sys.stdout.write("  .agent/%s/\n" % entry)
    sys.stdout.write("The next session halts at the onboarding gate. Onboard it:\n"
                     "  python3 execution/onboard_headless.py --project-name %s "
                     "--agent-name <name> --role <role> --mission \"<mission>\"\n"
                     % _quoted(expected))
    return RC_OK


# ------------------------------------------------------------------- the CLI --
def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Is this folder's identity confirmed? (spec copied-project-halt F14)")
    parser.add_argument("workspace", nargs="?", default=".",
                        help="workspace directory (default: the current directory)")
    parser.add_argument("--reason", action="store_true",
                        help="also write the one-word reason to stderr")
    parser.add_argument("--answers", action="store_true",
                        help="print the two answer commands for this workspace, one per line")
    parser.add_argument("--affirm", choices=ANSWERS,
                        help="answer the halt for this folder")
    parser.add_argument("--project",
                        help="the project name being affirmed — the authorisation")
    args = parser.parse_args(argv)

    if args.answers:
        # The boot gate prints these rather than composing them itself: a halt
        # whose printed way out does not work is a lockout, and one file
        # rendering them is one file to keep correct.
        for line in answer_lines(args.workspace):
            sys.stdout.write(line + "\n")
        return RC_OK

    if args.affirm:
        if args.project is None:
            sys.stderr.write("REFUSED: --affirm requires --project <name>. The typed name is\n"
                             "         the authorisation (REQUIREMENTS §3). Nothing was changed.\n")
            return RC_REFUSED
        if args.affirm == ANSWER_RENAME:
            return affirm_rename(args.workspace, args.project)
        return affirm_copy(args.workspace, args.project)

    verdict, reason = inspect(args.workspace)
    sys.stdout.write(verdict + "\n")
    if args.reason:
        sys.stderr.write(reason + "\n")
    # ALWAYS 0 for a classification: a SessionStart hook that fails takes the
    # session with it.
    return RC_OK


if __name__ == "__main__":
    sys.exit(main())

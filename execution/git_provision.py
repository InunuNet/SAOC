#!/usr/bin/env python3
"""Git provisioning at scaffold — REQUIREMENTS.md §3.

A new project folder is PROPOSED a remote, a repository name and a commit
identity in one line the human confirms; that confirmation is the only
authorisation, and nothing is created without it. The repository is then created
private or attached to non-destructively, THIS FOLDER IS THE REPOSITORY ROOT
(never a subfolder, never a fork), the per-project plus-address is written ONCE,
and the pre-push guard is armed.

    git_provision.py names   --project-name X            -> "<slug>\\t<local>"
    git_provision.py propose --project-name X            -> the three lines
    git_provision.py apply   --project-name X --path D --confirmed

Exit codes:
    0  done
    2  refused — no --confirmed, an unusable name, a nested repository, or a
       checkout that would overwrite files the scaffold already wrote
    3  unverified — `gh` is missing or unauthenticated, OR `gh repo view`
       failed for a reason that is not "no such repository" (an HTTP 500, a
       rate limit, a permissions error), so the repository's existence is
       unknown. The remote is configured and the identity written anyway;
       nothing is created. An auth or network problem must not cost the
       operator the whole setup, must not be reported as success, and must
       never take the CREATE path (DECISIONS.md D-G2).

init.sh never runs `apply`: it runs unattended and cannot obtain a
confirmation. It prints the proposal and the exact `--confirmed` command.
"""

import argparse
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from name_sanitize import MAX_EMAIL_LOCAL_PART, MAX_SLUG_CHARS  # noqa: E402
from name_sanitize import email as email_local_part  # noqa: E402
from name_sanitize import is_lossy as email_is_lossy  # noqa: E402
from name_sanitize import slug as repo_slug  # noqa: E402

# D-G4: reuse onboard_headless's atomic profile writer rather than acquiring a
# second implementation of the dangerous write. That one carries symlink
# resolution, permission-bit preservation, temp-file-plus-os.replace, corrupt
# profile quarantine, BOM tolerance and a read-only refusal.
from onboard_headless import _load_profile, _write_profile  # noqa: E402

DEFAULT_OWNER = "InunuNet"
DEFAULT_EMAIL_USER = "brad"
DEFAULT_EMAIL_DOMAIN = "inunu.net"
DEFAULT_DISPLAY_NAME = "Brad"
DEFAULT_BRANCH = "main"

# §3's branching rule ("main is protected, the agent never merges to main") is
# enforced locally by the pre-push guard. A guard nobody arms enforces nothing,
# and the confirmation moment is the one place arming is expected (D-G7).
HOOKS_PATH = ".agent/githooks"

RC_OK = 0
RC_REFUSED = 2
RC_UNVERIFIED = 3

# Git reads these from the ENVIRONMENT and they OVERRIDE `-C`. With
# `GIT_DIR=/repoA/.git GIT_WORK_TREE=/repoB`, the root check below passes for
# /repoB while every `git config` write lands in /repoA/.git/config: provisioning
# one project silently reconfigures another. They are removed for every git and
# gh invocation this tool makes. GIT_CEILING_DIRECTORIES is deliberately KEPT —
# it constrains where discovery may look, it does not redirect it, and the
# golden's sandbox relies on it for containment.
GIT_REDIRECT_VARS = (
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_NAMESPACE",
)

# One owner, or one repository name. Never a path, never a flag.
_SEGMENT_RE = re.compile(r"^[A-Za-z0-9._-]+$")

# `gh repo view` exits 1 for "no such repository" AND for an HTTP 500, a rate
# limit and a permissions error. Absence has to be POSITIVELY indicated; these
# are the phrasings gh uses when the answer really is "it does not exist".
_NOT_FOUND_RE = re.compile(
    r"404|could not resolve to a repository|not found|no such repo", re.IGNORECASE
)

REPO_PRESENT = "present"
REPO_ABSENT = "absent"
REPO_UNKNOWN = "unknown"


class Plan(object):
    """The three facts the human confirms, and the identifiers behind them."""

    def __init__(self, owner, repo, remote, user_name, user_email):
        self.owner = owner
        self.repo = repo
        self.remote = remote
        self.user_name = user_name
        self.user_email = user_email

    def lines(self):
        """The proposal, verbatim. Reworded here is a failed gate — the remote,
        the visibility and the commit identity must all be visible at the one
        moment the human says yes (§3 step 2)."""
        return [
            "remote:  %s (private if created)" % self.remote,
            "user.name:  %s" % self.user_name,
            "user.email: %s" % self.user_email,
        ]


def _clean_env():
    """The caller's environment minus every git redirection variable."""
    env = os.environ.copy()
    for var in GIT_REDIRECT_VARS:
        env.pop(var, None)
    return env


def _git(path, *args):
    return subprocess.run(
        ["git", "-C", path] + list(args),
        capture_output=True,
        text=True,
        env=_clean_env(),
    )


def _gh(args, cwd=None):
    return subprocess.run(
        ["gh"] + list(args),
        capture_output=True,
        text=True,
        cwd=cwd,
        env=_clean_env(),
    )


def _err(message):
    print(message, file=sys.stderr)


def valid_segment(value):
    """Exactly one owner or one repository name — no path, no traversal.

    `--repo` used to reach `origin` and `gh` VERBATIM: `--repo '../../prod'`
    configured `https://github.com/InunuNet/../../prod.git` and handed
    `InunuNet/../../prod` to gh, escaping the owner/name boundary the whole
    proposal is built on. An operator-supplied name now crosses exactly the
    boundary a derived one does.
    """
    if not value or len(value) > MAX_SLUG_CHARS:
        return False
    if not _SEGMENT_RE.match(value):
        # Catches `/`, `\`, whitespace, `:`, `@`, NUL and everything else that
        # could turn one segment into two.
        return False
    if value.startswith("-"):
        return False  # gh and git would read it as a flag
    if ".." in value or not value.strip("."):
        return False  # traversal, and `.`/`..` are not repositories
    return True


def email_budget(args):
    """How many characters the derived local part may occupy.

    The assembled local part is `<email-user>+<derived>`, and RFC 5321 caps the
    whole thing at 64 octets.
    """
    return MAX_EMAIL_LOCAL_PART - len(args.email_user) - 1


def build_plan(args, notify=True):
    """Derive the plan, or return None having said why it cannot be derived.

    `notify=False` silences the advisory collision note for `names`, which is
    machine-readable plumbing rather than a surface a human is reading.
    """
    name = args.project_name
    budget = email_budget(args)
    if budget <= 0:
        _err(
            "REFUSED: --email-user '%s' leaves no room for a per-project "
            "suffix inside RFC 5321's 64-octet local part." % args.email_user
        )
        return None
    if args.repo and not valid_segment(args.repo):
        _err(
            "REFUSED: --repo '%s' is not a repository NAME." % args.repo
        )
        _err(
            "         It must be a single segment matching [A-Za-z0-9._-], at "
            "most %d characters, with no '/', no '..' and no leading '-'. The "
            "owner is supplied separately by --owner, so the one slash in "
            "'<owner>/<repo>' is the tool's, not the argument's." % MAX_SLUG_CHARS
        )
        return None
    if not valid_segment(args.owner):
        _err("REFUSED: --owner '%s' is not a single owner name." % args.owner)
        return None
    slug = args.repo or repo_slug(name)
    local = email_local_part(name, budget)
    if not slug or not local:
        _err(
            "REFUSED: '%s' has no ASCII residue, so there is neither a usable "
            "repository name nor a deliverable plus-address." % name
        )
        _err(
            "         Emitting %s+@%s would silently mis-attribute every commit "
            "on a shared remote, and a repository called '-' is not a "
            "repository." % (args.email_user, args.email_domain)
        )
        _err(
            "         The scaffold still stands; git provisioning does not. "
            "Re-run with --repo and --email-user to choose them by hand."
        )
        return None
    if not valid_segment(slug):
        _err(
            "REFUSED: '%s' derives the repository name '%s', which is not a "
            "usable one — a name that is only dots, that carries '..', or that "
            "starts with '-' is a traversal or a flag, not a repository."
            % (name, slug)
        )
        _err("         Re-run with --repo to choose the name by hand.")
        return None
    owner = args.owner
    remote = args.remote_url or "https://github.com/%s/%s.git" % (owner, slug)
    user_name = "%s (%s)" % (args.display_name, name)
    user_email = "%s+%s@%s" % (args.email_user, local, args.email_domain)
    if notify and email_is_lossy(name, budget):
        # The derivation is many-to-one, so this address does NOT identify the
        # project on its own. Said at the one moment a human is authorising it,
        # on stderr so the machine-read proposal on stdout stays exactly the
        # three lines the golden pins.
        _err(
            "note: '%s' derives the plus-address '%s' by dropping characters, "
            "so it is SHARED by every project name that folds to '%s' — "
            "'SAOC Design' and 'SAOC/Design' are one such pair. Two workspaces "
            "on one remote would mis-attribute each other's commits."
            % (name, user_email, local)
        )
        _err(
            "      Pass --email-user or --repo to choose distinct values by "
            "hand. The derivation is recorded in profile.json as "
            "git.user_email_derived_from so a collision is detectable later."
        )
    return Plan(owner, slug, remote, user_name, user_email)


def cmd_names(args):
    plan = build_plan(args, notify=False)
    if plan is None:
        return RC_REFUSED
    sys.stdout.write(
        "%s\t%s\n"
        % (plan.repo, email_local_part(args.project_name, email_budget(args)))
    )
    return RC_OK


def cmd_propose(args):
    plan = build_plan(args)
    if plan is None:
        return RC_REFUSED
    for line in plan.lines():
        sys.stdout.write(line + "\n")
    return RC_OK


def ensure_root_repo(path, plan):
    """This folder must BE the repository root, or nothing happens.

    §3: never create a subfolder for the repo. A folder that already sits inside
    another work tree cannot become its own root without NESTING one repository
    inside another, which is silent data-model corruption rather than an error —
    so refuse and say where the outer tree is.
    """
    top = _git(path, "rev-parse", "--show-toplevel")
    if top.returncode == 0 and top.stdout.strip():
        outer = os.path.realpath(top.stdout.strip())
        if outer != os.path.realpath(path):
            _err(
                "REFUSED: %s is inside another git work tree at %s."
                % (path, outer)
            )
            _err(
                "         The project folder must BE the repository root (§3), "
                "so refusing to nest a repository inside one. Move the folder "
                "outside that work tree and re-run."
            )
            return RC_REFUSED
        return RC_OK
    init = _git(path, "init", "-q")
    if init.returncode != 0:
        _err("REFUSED: could not initialise a repository in %s." % path)
        _err(init.stderr.rstrip())
        return RC_REFUSED
    return RC_OK


def name_unborn_head(path):
    """Point an unborn HEAD at `main`.

    Only ever touches a repository with no commits, so it can neither move nor
    lose anything. Without it the default branch is whatever the operator's
    global `init.defaultBranch` happens to say, while §3's protection rule, the
    pre-push guard and the PR flow all name `main`.
    """
    if _git(path, "rev-parse", "--verify", "-q", "HEAD").returncode == 0:
        return
    _git(path, "symbolic-ref", "HEAD", "refs/heads/%s" % DEFAULT_BRANCH)


def origin_url(path):
    """The current `origin`, or None when there is no origin at all."""
    got = _git(path, "remote", "get-url", "origin")
    return got.stdout.strip() if got.returncode == 0 else None


def configure_remote(path, plan):
    if origin_url(path) is not None:
        _git(path, "remote", "set-url", "origin", plan.remote)
    else:
        _git(path, "remote", "add", "origin", plan.remote)


def restore_remote(path, before):
    """Put `origin` back exactly as it was, including 'there wasn't one'."""
    if before is None:
        _git(path, "remote", "remove", "origin")
    else:
        _git(path, "remote", "set-url", "origin", before)


def local_config(path, key):
    """The REPO-LOCAL value only, or "".

    `git config user.email` MERGES global and system config, so on any machine
    where the operator has a global identity it is never empty — which would
    make "is one already set here?" answer yes for every fresh scaffold.
    `--local` answers the question actually being asked: did a human set one in
    THIS repository?
    """
    got = _git(path, "config", "--local", key)
    return got.stdout.strip() if got.returncode == 0 else ""


def write_or_verify_identity(path, plan, recorded_email, recorded_name):
    """§3: written ONCE at scaffold, VERIFIED thereafter. Never repaired here.

    Returns the (email, name) pair to RECORD in profile.json — which is the
    identity a commit from this repository will actually carry, not the one the
    tool would have preferred. The recorded expectation is what every later boot
    verifies against, so recording anything else manufactures a permanent
    mismatch nobody can clear.
    """
    if not recorded_email:
        # FIRST provision. An identity a human already set in this repository is
        # not ours to replace: `git config user.email alice@example.com` used to
        # be silently overwritten by the derived plus-address on the first
        # confirmed apply.
        found_email = local_config(path, "user.email")
        found_name = local_config(path, "user.name")
        if found_email or found_name:
            _err(
                "⚠️  a git identity is already set in THIS repository and was "
                "NOT replaced."
            )
            if found_email:
                _err("    user.email kept: %s" % found_email)
                _err("    user.email proposed: %s" % plan.user_email)
            if found_name:
                _err("    user.name kept: %s" % found_name)
                _err("    user.name proposed: %s" % plan.user_name)
            _err(
                "    Recording what the repository actually holds, so later "
                "boots verify against what a commit will really carry. To "
                "adopt the proposal instead, run:"
            )
            if found_email:
                _err('    git config user.email "%s"' % plan.user_email)
            if found_name:
                _err('    git config user.name "%s"' % plan.user_name)
        if not found_email:
            _git(path, "config", "user.email", plan.user_email)
            found_email = plan.user_email
        if not found_name:
            _git(path, "config", "user.name", plan.user_name)
            found_name = plan.user_name
        return found_email, found_name
    found_email = _git(path, "config", "user.email").stdout.strip()
    found_name = _git(path, "config", "user.name").stdout.strip()
    expected_name = recorded_name or plan.user_name
    if found_email == recorded_email and found_name == expected_name:
        return recorded_email, expected_name
    _err(
        "⚠️  git identity differs from the one recorded at scaffold and was "
        "NOT repaired."
    )
    _err("    §3: the identity is written ONCE at scaffold and verified thereafter.")
    if found_email != recorded_email:
        _err("    user.email found:    %s" % (found_email or "(unset)"))
        _err("    user.email expected: %s" % recorded_email)
        _err('    fix: git config user.email "%s"' % recorded_email)
    if found_name != expected_name:
        _err("    user.name found:    %s" % (found_name or "(unset)"))
        _err("    user.name expected: %s" % expected_name)
        _err('    fix: git config user.name "%s"' % expected_name)
    return recorded_email, expected_name


def gh_usable():
    """`gh` present AND authenticated. Anything else is 'unknown', not 'absent'."""
    if shutil.which("gh") is None:
        return False
    return subprocess.run(
        ["gh", "auth", "status"], capture_output=True, text=True
    ).returncode == 0


def repo_existence(path, plan):
    """present / absent / unknown — never 'absent' because the CALL failed.

    `gh repo view` exits 1 for a repository that does not exist AND for an HTTP
    500, a rate limit, a revoked token and a permissions error. Treating every
    nonzero as "absent" takes the CREATE path on a transient API failure, and a
    repository created because a call failed is the one unrecoverable mistake
    available here (DECIDE table, golden §4).

    So absence must be POSITIVELY indicated. Only rc 1 can mean absent, and only
    when gh either names the not-found condition or says nothing at all — a real
    gh always writes a diagnostic when something went wrong, so silence is the
    "nothing to report" case. Every other outcome, including an rc 1 carrying an
    unrecognised complaint, is UNKNOWN and provisions exactly like a missing
    `gh`: configure, create nothing, exit 3. The honest limit: a future gh that
    reports not-found with wording matching none of _NOT_FOUND_RE would be read
    as UNKNOWN — which errs toward creating nothing.
    """
    view = _gh(["repo", "view", "%s/%s" % (plan.owner, plan.repo)], cwd=path)
    if view.returncode == 0:
        return REPO_PRESENT, ""
    detail = ((view.stderr or "") + (view.stdout or "")).strip()
    if view.returncode == 1 and (not detail or _NOT_FOUND_RE.search(detail)):
        return REPO_ABSENT, detail
    return REPO_UNKNOWN, detail


def remote_default_branch(path):
    _git(path, "remote", "set-head", "origin", "-a")
    ref = _git(path, "symbolic-ref", "--short", "refs/remotes/origin/HEAD")
    if ref.returncode == 0 and ref.stdout.strip():
        return ref.stdout.strip().split("/", 1)[-1]
    return DEFAULT_BRANCH


def attach(path, plan):
    """Attach and pull — performed in the only way that cannot destroy the
    scaffold (D-G5).

    `git checkout --track` REFUSES rather than overwriting untracked files, and
    that refusal is the mechanism, not a fallback: REQUIREMENTS §2 forbids setup
    destroying existing memory, and `pull`/`reset --hard` would do exactly that
    to a second folder attaching to a repo the first already pushed `.agent/`
    into.
    """
    fetch = _git(path, "fetch", "--quiet", "origin")
    if fetch.returncode != 0:
        _err("REFUSED: could not fetch from %s." % plan.remote)
        _err(fetch.stderr.rstrip())
        return RC_REFUSED, ""
    branch = remote_default_branch(path)
    if _git(path, "show-ref", "--verify", "--quiet", "refs/heads/%s" % branch).returncode == 0:
        checkout = _git(path, "checkout", branch)
    else:
        checkout = _git(
            path, "checkout", "-b", branch, "--track", "origin/%s" % branch
        )
    if checkout.returncode != 0:
        _err(
            "REFUSED: attaching to %s would OVERWRITE files this scaffold "
            "already wrote." % plan.remote
        )
        _err(
            "         Nothing was changed: `origin` is restored to its "
            "previous value and no git identity was written."
        )
        _err(
            "         The colliding paths are named below. §2: setup must never "
            "destroy existing memory — resolve them by hand and re-run."
        )
        _err(checkout.stderr.rstrip())
        return RC_REFUSED, branch
    return RC_OK, branch


def cmd_apply(args):
    if not args.confirmed:
        _err(
            "REFUSED: nothing is created without the operator's confirmation "
            "(§3 step 2)."
        )
        plan = build_plan(args)
        if plan is not None:
            for line in plan.lines():
                _err("    " + line)
            _err(
                "    Confirm by re-running this command with --confirmed. "
                "No repository, no remote and no git identity has been touched."
            )
        return RC_REFUSED

    plan = build_plan(args)
    if plan is None:
        return RC_REFUSED

    path = os.path.abspath(args.path)
    if not os.path.isdir(path):
        _err("REFUSED: %s is not a directory." % path)
        return RC_REFUSED

    rc = ensure_root_repo(path, plan)
    if rc != RC_OK:
        return rc
    name_unborn_head(path)

    profile_path = os.path.join(path, ".agent", "profile.json")
    profile = _load_profile(profile_path)
    block = profile.get("git")
    if not isinstance(block, dict):
        block = {}
    recorded_email = (block.get("user_email") or "").strip()
    recorded_name = (block.get("user_name") or "").strip()

    # ORDER IS THE ATOMICITY. `origin` has to exist before `attach` can fetch
    # through it, so it is snapshotted and RESTORED on refusal; the identity is
    # not written until create-or-attach has actually succeeded. The previous
    # order mutated both up front and then printed "nothing was changed" over a
    # changed origin and a changed user.email.
    origin_before = origin_url(path)
    configure_remote(path, plan)

    branch = ""
    unverified_reason = ""
    unverified_detail = ""
    if not gh_usable():
        state = "unverified"
        rc = RC_UNVERIFIED
        unverified_reason = "`gh` is missing or unauthenticated"
    else:
        presence, detail = repo_existence(path, plan)
        if presence == REPO_PRESENT:
            rc, branch = attach(path, plan)
            if rc != RC_OK:
                restore_remote(path, origin_before)
                return rc
            state = "attached"
        elif presence == REPO_ABSENT:
            # ONLY these arguments. --source and --clone can put the work tree
            # somewhere other than this folder, --fork is for contributors
            # without write access, --public is not the default §3 asks for.
            create = _gh(
                ["repo", "create", "%s/%s" % (plan.owner, plan.repo), "--private"],
                cwd=path,
            )
            if create.returncode != 0:
                _err("REFUSED: could not create %s/%s." % (plan.owner, plan.repo))
                _err(create.stderr.rstrip())
                _err("         `origin` has been restored and no identity written.")
                restore_remote(path, origin_before)
                return RC_REFUSED
            state = "created"
            rc = RC_OK
        else:
            state = "unverified"
            rc = RC_UNVERIFIED
            unverified_reason = (
                "`gh repo view` failed for a reason that is not "
                '"no such repository"'
            )
            unverified_detail = detail.splitlines()[0] if detail else ""

    if rc == RC_UNVERIFIED:
        _err(
            "⚠️  %s, so it is UNKNOWN whether %s/%s exists."
            % (unverified_reason, plan.owner, plan.repo)
        )
        if unverified_detail:
            _err("    gh said: %s" % unverified_detail)
        _err(
            "    The remote and the commit identity are configured; NOTHING was "
            "created. Re-run this command once `gh auth login` succeeds."
        )

    write_email, write_name = write_or_verify_identity(
        path, plan, recorded_email, recorded_name
    )
    _git(path, "config", "core.hooksPath", HOOKS_PATH)

    if not branch:
        head = _git(path, "symbolic-ref", "--short", "HEAD")
        branch = head.stdout.strip() if head.returncode == 0 else ""
    profile["git"] = {
        "remote": plan.remote,
        "owner": plan.owner,
        "repo": plan.repo,
        "user_name": write_name,
        "user_email": write_email,
        # The project name the plus-address was derived FROM. The derivation is
        # many-to-one, so two workspaces can hold the same user_email; carrying
        # its source is what makes that collision detectable after the fact
        # instead of only at the moment the note was printed.
        "user_email_derived_from": args.project_name,
        "remote_state": state,
        "default_branch": branch or DEFAULT_BRANCH,
    }
    _write_profile(profile_path, profile)
    return rc


def build_parser():
    parser = argparse.ArgumentParser(
        prog="git_provision.py", description=__doc__.splitlines()[0]
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def common(sp):
        sp.add_argument("--project-name", required=True)
        sp.add_argument("--owner", default=DEFAULT_OWNER)
        sp.add_argument(
            "--repo",
            default="",
            help="repository NAME only — one segment, no '/', no '..'",
        )
        sp.add_argument("--remote-url", default="")
        sp.add_argument("--email-user", default=DEFAULT_EMAIL_USER)
        sp.add_argument("--email-domain", default=DEFAULT_EMAIL_DOMAIN)
        sp.add_argument("--display-name", default=DEFAULT_DISPLAY_NAME)
        return sp

    common(sub.add_parser("names", help="print '<repo-slug>\\t<email-local-part>'"))
    common(sub.add_parser("propose", help="print the proposal the human confirms"))
    apply_sp = common(sub.add_parser("apply", help="provision, once confirmed"))
    apply_sp.add_argument("--path", default=".")
    apply_sp.add_argument("--confirmed", action="store_true")
    return parser


def main(argv):
    args = build_parser().parse_args(argv)
    return {"names": cmd_names, "propose": cmd_propose, "apply": cmd_apply}[
        args.command
    ](args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

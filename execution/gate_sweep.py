#!/usr/bin/env python3
"""gate_sweep.py -- repo-wide Phase-4 gate sweep (F1 of the repo-wide-gate-sweep mission).

Closes backlog P1 p1-a-mission-s-contracts-do-not-run-the: a mission's own
contract gate can be fully green while it has silently regressed a DIFFERENT
spec's shipped gate, because nothing ever runs that other spec's assertions.
This tool discovers every contract*.yaml under a specs root and re-runs each
one's Phase 4 assertions LIVE through the existing `execution/contract.py
gate <path> --phase 4 --run-checks` path -- never a cached result file, and
never a reimplementation of assertion semantics.

See .agent/memory/project/specs/repo-wide-gate-sweep/goldens/DECISIONS.md
for the full design rationale and the hand-verified contract.py behaviour
table this classifier is built from.

Usage:
  python3 execution/gate_sweep.py [--specs-root DIR] [--jobs N] [--allow-skips]
      [--no-sandbox] [--sandbox-dir PARENT] [--manifest PATH]

Discovery: DIR.glob("**/contract*.yaml") -- the same glob shape
execution/checks/verify_all_contracts_parse.py already uses, so a spec
directory holding multiple contract files (contract-f1.yaml, contract-f2.yaml,
...) yields one independent evaluation per file, not one per directory.

Containment (F5 -- see DECISIONS.md "F5 -- containment: the sweep must not
mutate the tree it verifies"). `--run-checks` executes real, arbitrary,
user-authored check scripts, and some of them write. SANDBOX IS THE DEFAULT:
before gating anything, the sweep materialises ONE disposable MASTER copy of
the whole repository (`.git` included -- checks shell out to git and resolve
repo-relative paths) under --sandbox-dir (default: system temp). The master is
sealed once, never mutated, and serves as the source of `tree_fingerprint` at
t0 and the pristine clone source. ONE SANDBOX PER SPEC (F5 round 6): each
discovered spec is gated inside its OWN fresh clonefile copy of the master
(APFS COW, ~3.1s/122M each; only --jobs N live at once) and that clone is
destroyed afterward. No neighbouring spec ever runs in a spec's own tree, so
nothing in it -- contract, goldens, or a shared helper script an assertion
invokes -- can be substituted for the question or the answer (the round-6
finding: a per-directory deny names a PATH and loses to an ancestor-symlink
substitution). A discovered spec path is translated into its clone equivalent
via `path.resolve().relative_to(REPO_ROOT)`; a spec that resolves outside
REPO_ROOT cannot be sandboxed and is gated in place, noted on its report line.
If the master cannot be created the sweep exits 2 -- it never silently falls
back to gating in place; that is an explicit operator choice via --no-sandbox.
Sandbox drift (any change to a non-git-ignored path inside a spec's clone,
graded against the master's t0 snapshot) is reported by name and drives exit 2;
drift confined to git-ignored paths is expected and does not (the verdict
report never lands in the clone at all -- see the classification channel
below). `--manifest PATH` writes an athanor.gate-sweep/v1 JSON document
carrying a `tree_fingerprint` -- see tree_fingerprint() below -- computed on the
master at creation, i.e. the real working tree's fingerprint at t0, which is
still valid after the sweep because the real tree was never touched.

ROUND 2 (after @qa FAIL, F5_QA_ROUND1.md; see DECISIONS.md "F5 round 2"):
  - Drift is graded by CONTENT, not by status-line set-difference: a write into an
    already-dirty path, or a revert of one, is invisible to set-difference either way.
    Snapshot {non-ignored dirty path -> sha256} at t0 and diff content, not lines.
  - Ignore rules are read from the T0 SNAPSHOT, never re-derived post-sweep -- a check
    that rewrites .gitignore/.git/info/exclude to hide its own drift is itself drift,
    named in the report.
  - The sandbox must contain GIT writes, not only file writes: every `.git` FILE
    (linked-worktree/submodule pointer) whose gitdir resolves outside the sandbox is
    neutralised right after the copy, and that invariant is asserted before gating.
  - Manifest gains `sandbox_coverage` ("full"/"partial"/"none", a NEW key --
    `sandboxed` keeps its boolean type), `unsandboxed_specs` (named, not just counted),
    and `real_tree_fingerprint_before`/`_after` + `real_tree_changed` -- the advisory
    real-tree canary moved from stderr into the manifest, still advisory and out of the
    exit code.
  - --sandbox-dir resolving inside REPO_ROOT is rejected up front (before any bytes are
    copied); a partial copy is removed on every make_sandbox failure path; aged
    gate_sweep_sandbox_* leftovers under --sandbox-dir are reaped at startup.

ROUND 3 (after @qa FAIL, F5_QA_ROUND2.md; see DECISIONS.md "F5 round 3"). Rounds 1-3
produced three escapes and TWO OF THEM WERE CREATED BY THE PREVIOUS ROUND'S FIX. That
is not three bugs but one fact restated: a check runs as an ordinary child process
holding the operator's full filesystem privileges, so AN ABSOLUTE PATH IS THE ENTIRE
EXPLOIT AND A FILE COPY CANNOT REVOKE A PRIVILEGE. `cp -Rc` contains RELATIVE writes and
nothing else, and part of the absolute-path surface (~/.gitconfig, /etc/gitconfig, the
GIT_DIR/GIT_WORK_TREE/GIT_COMMON_DIR/... environment) lives outside the copy entirely, so
a strategy bounded by the copy cannot close it. The containment PRIMITIVE therefore
changes:
  - Every gate subprocess runs under an OS-ENFORCED confinement profile that permits
    writes only inside the sandbox (`sandbox-exec` on darwin, `bwrap` on linux), and the
    GIT_* environment family is stripped from every child. The manifest declares
    `containment` ("os-enforced"/"audit-only"/"none") and `containment_backend`; where no
    backend exists the sweep degrades LOUDLY to audit-only, never silently (A6's rule
    applied to the new layer).
  - The copy stays, DEMOTED to defence in depth, and its rules become whole-tree
    INVARIANTS rather than pointer lists: every absolute reference to REPO_ROOT in any
    gitdir's metadata is remapped generically, a worktree entry that cannot be remapped
    into the sandbox is PRUNED from the copy, and the invariant "no reference inside the
    sandbox resolves to a git location outside it" is asserted at creation and
    RE-ASSERTED after the sweep before grading (round-2 P1-2 is entirely the absence of
    the second assertion).
  - Every read and write gate_sweep itself performs on a sandbox path goes through one
    symlink-refusing helper (O_NOFOLLOW, unlink-then-write). Round-2 P1-1 made the
    containment tool itself an arbitrary-file-overwrite primitive.
  - The behaviour-bearing git metadata (.git/config and friends) is content-snapshotted
    at t0 exactly as ignore sources are, so `core.excludesFile` tampering is named as
    drift rather than silently grading the graded party's own writes.
  - Any failure of the containment machinery exits 2, never the softer 1 (a genuinely
    FAILing spec still exits 1 -- "make everything exit 2" is not a fix).
  - The advisory real-tree canary -- and ONLY that canary, never `tree_fingerprint` --
    sees git-ignored paths, which is exactly where machine noise lands.

ROUND 4 (after @qa FAIL, F5_QA_ROUND3.md; see DECISIONS.md "F5 round 4"). Round 3's OS
boundary HELD -- no write outside the two allowed roots was obtainable by any means. The
defect was in the write root the boundary HAD TO GRANT: `_write_roots()` granted
`realpath(tempfile.gettempdir())` entire, and gate_sweep keeps its own TRUST ARTIFACTS
there -- the per-spec `gate-report.json` every verdict is read from, and the `--manifest`
F3 consumes. A genuinely FAILing spec came back PASS while a concurrent ordinary spec
overwrote its report, and a sweep that had correctly computed exit 2 shipped an all-clean
forged manifest. THAT IS THE F1 ROUND-1 DEFECT CLASS -- a verdict read from data the
graded party can write -- reintroduced one layer down, and harder to see because the layer
beneath it is genuinely sound. Fixing a trust boundary at one layer can recreate the
identical defect at another; the question that finds these is not "is the boundary sound?"
but "what did the boundary have to grant, and what of mine lives inside the grant?".
  - The write grant is PER-SPEC and never shared: the sandbox plus THAT spec's own
    private workdir, never `gettempdir()`. TMPDIR/TMP/TEMP are pointed at a scratch
    directory inside the grant, so ordinary temp-using checks keep working -- a
    containment fix that turns honest checks into FAILs is a different silent lie.
  - The manifest lives where NO grant reaches, and a `--manifest` resolving inside one is
    refused up front (exit 2) before any bytes are copied.
  - NO CHECK PROCESS OUTLIVES ITS SPEC: each gate subprocess gets its own session and its
    whole process group is killed when it returns AND on timeout -- after it returns,
    never before, or honest slow foreground work is truncated. bwrap gains
    `--die-with-parent --unshare-pid --unshare-ipc --unshare-uts` (never `--unshare-net`;
    checks may legitimately reach the network).
  - The bulk stores are pruned from the gitdir metadata walk by RELATIVE PATH
    (`objects/pack`, `objects/<2-hex>`, `lfs/objects`), never by bare directory name,
    which discarded `objects/info` with `objects/ab` and left `objects/info/alternates`
    unremapped and unreported.

SCOPE OF THE CONTAINMENT CLAIM -- stated plainly, because "os-enforced" reads broader than
what is enforced. The profile is `(allow default)` + `(deny file-write*)`, so READS AND
NETWORK ARE NOT CONFINED: a check can read ~/.ssh, ~/.aws/credentials or a .env and
exfiltrate it. Verbatim, for the avoidance of doubt: reads and network are NOT confined.
The guarantee is about FILE WRITES and nothing else, which is F5's charter (the sweep must
not mutate the working tree it verifies); the manifest carries
`containment_scope: "file-writes"` and `containment_unconfined` so a consumer of the
artifact cannot over-read it. Widening the enforcement is not available -- checks
legitimately read the whole repository, shell out to git (which reads ~/.gitconfig) and
may reach the network, so no enumerable read set exists and a read-deny profile would
break every legitimate check. `--run-checks` over contracts you do not trust is a TRUST
DECISION, not an isolation boundary. What IS enforced, and may be stated:
file-writes are OS-confined; a spec cannot alter any spec's verdict, its own
included; and a check cannot signal out of the sandbox.

TWO LIMITS ROUND 5 FOUND AND DID NOT CLOSE, declared in `containment_unconfined`
rather than glossed. A Python double-fork/setsid daemon reparents to launchd in
its own process group, so `killpg` cannot reach it: a check that escapes its process group can outlive the sweep, and post-sweep drift evidence is therefore best-effort
(`sandbox_drift` and `containment_violations` are computed after the sweep by
reading a tree checks legitimately write, and that tree cannot be made
unwritable without breaking every check). Both residuals are bounded and the
bound is why they are acceptable: a survivor never inherits the verdict
descriptor, so it can forge neither a verdict nor the manifest -- what remains
is a resource leak -- and under OS-enforced containment the real tree is
unwritable regardless, so hiding drift hides a REPORT, not a HARM.

Per-spec classification (exactly one of five statuses; see DECISIONS.md):
  PASS       -- phase-4 gate green (skips allowed only under --allow-skips)
  FAIL       -- gate ran; >=1 assertion verdict=fail
  ERROR      -- gate ran; 0 fail, >=1 assertion verdict=error, OR the check
                subprocess itself crashed with an uncaught exception
  QA_BLOCKED -- a codex_qa assertion produced a genuine adversarial finding
  INVALID    -- the spec could not be gated at all: malformed YAML, `validate`
                refused it, phase 4 absent, or phase 4 has zero checks

Exit-code policy (mandatory -- see DECISIONS.md "Exit-code policy"):
  0 -- every discovered spec is PASS
  1 -- no spec is INVALID/ERROR; at least one spec is FAIL or QA_BLOCKED
  2 -- at least one spec is INVALID or ERROR (always wins over 1, even when
       FAILs also exist -- a check that cannot fail is worse than a check
       that fails)

Classification channel: each spec is gated with `--report-fd N` -- a
descriptor gate_sweep owns, on a file it created in the ungranted work root
and UNLINKED immediately -- and classified from the structured
athanor.gate-report/v1 document contract.py alone writes to it. contract.py's
stdout relays arbitrary check output as "evidence" both before and after the
authoritative summary line, so no text search over it -- first match or last
-- can be trusted. If nothing was written the gate never reached a verdict:
the spec is INVALID or ERROR, never PASS.

The channel is a CAPABILITY rather than a NAME (F5 round 5), and that is what
terminates five rounds of the same defect. A path-based report cannot be made
unforgeable while writer and attacker share a profile: confine() wraps the
contract.py invocation itself, so every grant that lets contract.py write the
report lets a check's descendant overwrite it -- round 4's per-spec workdir
included, reachable from inside as `$TMPDIR/../gate-report.json`, where a
genuinely FAILING spec was made to report PASS at rc 0. There is no next name
to narrow to; a descriptor is authority the graded party cannot name,
re-derive, or inherit (close_fds), and Seatbelt checks write authority at
OPEN, so the confined writer writes an fd into a directory it is refused by
name. The GRADED INPUTS are protected by per-spec isolation (F5 round 6): each
spec runs in its OWN clone of the master, so no neighbour is present in the tree
to rewrite this spec's contract.yaml, its goldens, or a shared helper script --
and no ancestor of any of them can be substituted, the round-6 finding the
round-5 per-directory deny (now retired) did not close. A spec's own directory
stays writable -- checks legitimately write there, and contract.py has already
loaded the contract before the first check runs, so a self-rewrite changes no
question.

Output: one complete line per spec, streamed and flushed the moment that spec
finishes, followed by the summary block. A run killed mid-sweep therefore
still yields every result computed up to that point.
"""
import argparse
import concurrent.futures
import fnmatch
import hashlib
import json
import os
import re
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
DEFAULT_SPECS_ROOT = REPO_ROOT / ".agent" / "memory" / "project" / "specs"

MANIFEST_SCHEMA = "athanor.gate-sweep/v1"

# A gate_sweep_sandbox_* directory older than this under --sandbox-dir is
# presumed abandoned (its owning sweep was SIGKILLed before reaching its
# finally) and is reaped at startup. 6 hours: comfortably longer than the
# longest observed real sweep (27m34s at --jobs 4 over the full 362-spec
# corpus, measured 2026-08-31) so a slow but live sweep's own sandbox can
# never be reaped out from under it, while still clearing same-session
# debris promptly rather than letting it linger for a full day.
STALE_SANDBOX_AGE_SECONDS = 6 * 3600

# ".gitignore" is read from every directory level; ".git/info/exclude" is the
# other ignore-rule source this repo uses (no core.excludesFile is set).
_GITIGNORE_NAME = ".gitignore"

# Per-spec subprocess timeout. `contract.py gate --run-checks` runs every
# phase-4 assertion live (shell timeout default 60s each); 300s bounds any
# single spec well above that while still failing loudly on a truly hung
# check rather than hanging the whole sweep forever.
PER_SPEC_TIMEOUT_SECONDS = 300

STATUSES = ("PASS", "FAIL", "ERROR", "QA_BLOCKED", "INVALID")

# --- OS-enforced containment (F5 round 3) --------------------------------------------
SANDBOX_EXEC = Path("/usr/bin/sandbox-exec")

CONTAINMENT_OS_ENFORCED = "os-enforced"
CONTAINMENT_AUDIT_ONLY = "audit-only"
CONTAINMENT_NONE = "none"

BACKEND_SANDBOX_EXEC = "sandbox-exec"
BACKEND_BWRAP = "bwrap"
BACKEND_NONE = "none"

# The BOUND on the containment claim, carried in the manifest F3 consumes.
# `--run-checks` over contracts you do not trust remains a trust decision, not
# an isolation boundary, and the artifact must say so in words rather than
# leave a consumer to infer it.
CONTAINMENT_SCOPE = "file-writes"
# `process-lifetime` and `post-sweep-forensics` joined the list in round 5 and
# are NOT closable here: a Python double-fork/setsid daemon reparents to launchd
# in its own process group, so a check that escapes its process group can outlive the sweep, and post-sweep drift evidence is therefore best-effort
# -- sandbox_drift and containment_violations are read after the sweep from a
# tree checks legitimately write, and that tree cannot be made unwritable without
# breaking every check. The residual is bounded: under OS-enforced containment
# the real tree is unwritable regardless, so a survivor hiding drift hides a
# REPORT and not a HARM, and under "audit-only" the manifest already says the
# guarantee is unenforced. `signals` is deliberately ABSENT: round 5 CONFINES
# them ((deny signal) + (allow signal (target same-sandbox))), and a declaration
# that under-claims an enforced boundary misleads as much as one that
# over-claims an unenforced one.
CONTAINMENT_UNCONFINED = ("reads", "network", "process-execution",
                          "process-lifetime", "post-sweep-forensics")

# ROUND 6 CORRECTION, stated verbatim (A32). Round 5 accepted
# `post-sweep-forensics` as unconfined on the ground that "hiding drift hides a
# REPORT, not a HARM, because the real tree is unwritable regardless." @qa showed
# that FALSE: the harm was a forged manifest VERDICT, not a real-tree write, so a
# survivor erasing drift erased the only trace of a real harm. Per-spec isolation
# (one sandbox per spec) makes the justification true again -- with cross-spec
# forgery structurally impossible, a survivor confined to its own per-spec
# sandbox can hide only a report of its own contained writes.
# The next two literals are single physical lines ON PURPOSE (A32 searches this
# file's SOURCE text for the exact phrase; a line-wrapped literal would not
# match), so they exceed the usual line width.
_POST_SWEEP_FORENSICS_JUSTIFICATION = "post-sweep drift evidence is best-effort, but a survivor is confined to its own per-spec sandbox and can forge no other spec's verdict, so it can hide only a report of its own contained writes, never a harm"  # noqa: E501
# NEWLY DECLARED (previously incidental -- undeclared behaviour is what every
# round punishes): a property of the Seatbelt profile, not a guarantee F5 offers.
_PS_TABLE_BLINDNESS_NOTE = "a confined check cannot enumerate the process table (ps returns nothing under the profile); lsof still resolves"  # noqa: E501

# Device nodes a confined child still legitimately writes. Without them even
# `>/dev/null` fails, and every check would break for reasons that have nothing
# to do with containment.
_ALLOWED_WRITE_DEVICES = (
    "/dev/null", "/dev/zero", "/dev/random", "/dev/urandom",
    "/dev/stdout", "/dev/stderr", "/dev/tty", "/dev/dtracehelper",
)

_O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)

# A snapshot entry for a path that is a SYMLINK rather than a regular file. Kept
# distinct from any possible file content so a check that swaps a snapshotted
# file for a symlink is drift by construction (round-2 P1-1).
_SYMLINK_SENTINEL = b"\x00<GATE-SWEEP-SYMLINK>\x00"

# Marker for a path whose bytes cannot be read at all. Never a crash: an
# unreadable path is drift (and therefore exit 2), not an uncaught
# PermissionError that presents as the softer exit 1 (round-2 P2-2).
_UNREADABLE = "UNREADABLE"

# Placeholder for a sandbox root's own absolute path inside git-metadata
# snapshots (F5 round 6). Drift is now graded PER SPEC against the MASTER's t0
# snapshot, but each per-spec sandbox is a CLONE sealed to its own distinct
# path, so `.git/config` core.hooksPath, worktree back-pointers and the like
# legitimately differ from the master's by exactly that path. Snapshotting git
# metadata with each root's own path replaced by this constant makes the
# master's t0 baseline and a clone's post-gate reading compare apples-to-apples:
# a difference then means a CHECK changed the metadata, never that the clone
# lives at a different address than the master. Only the git-metadata channel is
# normalised -- dirty working-tree content and ignore-rule sources hold no
# sandbox path, so their snapshots are already clone-independent.
_SANDBOX_PATH_TOKEN = b"@@GATE-SWEEP-SANDBOX-ROOT@@"

# Git metadata whose CONTENT changes how git grades or executes. Snapshotted at
# t0 exactly as ignore sources are (round-2 P2-1: `core.excludesFile` tampering
# was invisible because `.git/config` never appears in `git status`). `index`,
# `logs/` and `refs/` are deliberately EXCLUDED -- they move under ordinary
# read-only gating and would make every sweep red.
_GIT_METADATA_FILES = ("config", "config.worktree", "commondir",
                       "objects/info/alternates")
_GIT_METADATA_DIRS = ("info", "hooks")
_GIT_WORKTREE_METADATA_FILES = ("gitdir", "commondir", "config.worktree")

# The BULK CONTENT STORES are excluded from every metadata walk: they are
# large, binary, and hold no path references. Pruned by RELATIVE PATH, never by
# bare directory NAME (F5 round 4). `_SKIP_GITDIR_DIRS = ("objects", "lfs")`
# discarded `objects/info` along with `objects/ab`, so
# `objects/info/alternates` -- the one file whose entire purpose is to make
# this repository read ANOTHER repository's object store -- was neither remapped
# nor reported, while _gitdir_metadata_files() below named it as covered. That
# is the round-2 pruned-traversal shape recurring in a different directory after
# being named, and the shape is the bug: a name-based prune cannot tell a
# metadata directory from a content directory. Everything not matched here is
# traversed.
# Matched against a directory's path RELATIVE TO ITS GITDIR: the packfile
# store, the loose-object fanout (`objects/<2-hex>`) and the LFS object store.
# `objects/info` is emphatically NOT one of these, and the two-segment shape is
# the whole reason this rule can tell them apart. The optional leading segments
# make it hold for a nested gitdir (`modules/<name>/objects/pack`) as well as a
# top-level one -- the property is "no bulk store is walked and no metadata
# directory is pruned", anywhere, not just where the fixture looks.
_SKIP_GITDIR_RELDIR_RE = re.compile(
    r"^(?:.*/)?(?:objects/(?:pack|[0-9a-f]{2})|lfs/objects)$"
)
# `index` is binary and holds only repo-relative paths; scanning it yields
# nothing but noise and rewriting it would corrupt the sandbox's index.
_SKIP_GITDIR_NAMES = ("index",)

# An absolute-path token, for the GENERIC outward-reference scan. Deliberately
# not a list of known keys: commondir, alternates, core.worktree,
# core.excludesFile, core.hooksPath, include.path, modules/*/gitdir and anything
# not yet invented are all caught by the same rule, unenumerated.
_ABS_TOKEN_RE = re.compile(rb"/[A-Za-z0-9._][A-Za-z0-9._/@+-]*")

# contract.py's report statuses -> this tool's five-way vocabulary.
_REPORT_STATUS_MAP = {
    "PASS": "PASS",
    "FAIL": "FAIL",
    "ERROR": "ERROR",
    "INVALID": "INVALID",
    "BLOCKED": "QA_BLOCKED",
}

# Marker strings contract.py prints to STDERR when `gate` aborts before it can
# write any report at all. Consulted ONLY in the no-report case, and ONLY
# against stderr -- check_cmd relays check evidence to stdout, so stderr is a
# channel arbitrary check output cannot reach.
_STDERR_INVALID_MARKERS = (
    ("ERROR: failed to parse", "contract file does not parse (malformed yaml)"),
    ("gate refuses to run", "contract.py validate refused this contract"),
)

# One lock around each per-spec line so a whole line is written in a single
# critical section: under --jobs N the report streams as it goes, but never
# interleaves mid-line.
_PRINT_LOCK = threading.Lock()

_SLUG_LINE_RE = re.compile(r"^\s*slug:\s*['\"]?([^'\"\s#]+)", re.MULTILINE)


class SandboxError(Exception):
    """Raised when the disposable sandbox copy cannot be created. Never caught
    to fall back to gating in place -- see main(): this always exits 2."""


def child_env(tmpdir: Path = None) -> dict:
    """Environment for every child process this tool spawns.

    `tmpdir`, when given, redirects TMPDIR/TMP/TEMP into the spec's own granted
    workdir (F5 round 4). Narrowing the write grant to a per-spec workdir is the
    fix for the forgeable-trust-artifact defect, and its naive form breaks every
    check that uses the temp directory the way real checks do -- TMPDIR would
    still name a directory the check may no longer write. A containment fix that
    turns ordinary temp-using checks into FAILs is a different silent lie, not a
    fix, so the per-spec grant comes with a per-spec TMPDIR inside it.

    The GIT_* family (GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR, GIT_INDEX_FILE,
    GIT_OBJECT_DIRECTORY, GIT_ALTERNATE_OBJECT_DIRECTORIES,
    GIT_CONFIG_GLOBAL/SYSTEM/COUNT/KEY_n/VALUE_n) is an absolute-path surface
    that lives OUTSIDE the sandbox copy entirely, so no amount of sanitising the
    copy reaches it. Strip it instead -- for the gate subprocesses and for this
    tool's own git calls alike, so an ambient GIT_DIR cannot misdirect grading.
    """
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    if tmpdir is not None:
        for var in ("TMPDIR", "TMP", "TEMP"):
            env[var] = str(tmpdir)
    return env


def detect_containment_backend():
    """The OS-enforced confinement backend available on this platform, or None.

    None is not a fallback to "contained anyway" -- it is the audit-only
    degradation, and it is announced loudly and recorded in the manifest."""
    if sys.platform == "darwin" and SANDBOX_EXEC.exists():
        return BACKEND_SANDBOX_EXEC
    if sys.platform.startswith("linux") and shutil.which("bwrap"):
        return BACKEND_BWRAP
    return None


def _write_roots(sandbox_root: Path, workdir: Path):
    """Absolute, symlink-resolved directories ONE confined gate subprocess may
    write to: the sandbox, and THAT SPEC'S OWN private workdir -- never the
    shared temp dir (F5 round 4).

    Round 3 granted `realpath(tempfile.gettempdir())` entire, because the
    per-spec `--report-json` destination contract.py must write lives there.
    That is also where gate_sweep keeps every artifact it TRUSTS: the per-spec
    `gate-report.json` each verdict is read from, and the `--manifest` F3
    consumes. So the graded party could write the grading data -- the F1
    round-1 defect class, reintroduced one layer down by the write root the OS
    boundary had to grant, and harder to see because the layer beneath it is
    genuinely sound. The grant is per-spec: `confine()` is already called once
    per spec, so one spec's workdir is not writable from another's profile,
    and the manifest lives where no grant reaches at all."""
    roots = []
    for candidate in (str(sandbox_root), str(workdir)):
        real = os.path.realpath(candidate)
        if real not in roots:
            roots.append(real)
    return roots


def sandbox_exec_profile(write_roots) -> str:
    """`(allow default)` + `(deny file-write*)` + an allow-list of write
    subpaths. Measured on Darwin 25.5 during design: an absolute write into
    REPO_ROOT is refused, a write THROUGH a symlink whose target is outside is
    refused, `git update-ref` into a repository outside is refused, while git,
    python3 and tempfile all behave normally inside the allowed subpath.

    F5 round 6 RETIRED the round-5 deny-roots machinery. A31's per-directory
    deny named a PATH, and @qa forged a PASS by substituting a common ANCESTOR of
    the deny root with a symlink to a forgery -- a path deny loses to path
    substitution, the round-3/4/5 pattern once more. The terminator is one
    sandbox PER SPEC (see run_sweep): no neighbouring spec runs in this spec's
    copy, so there is nothing in the tree to deny -- the sandbox holds exactly
    one spec's graded inputs. `write_roots` is therefore just this spec's own
    clone plus its private workdir.

    SIGNALS are confined here too, and this is a boundary rather than a
    declaration. `(allow default)` reaches them and `(deny file-write*)` does
    not, so a check could SIGKILL gate_sweep.py itself mid-sweep: no manifest,
    no drift report, a leaked sandbox, silence where a verdict should be. A
    blanket `(deny signal)` would pass that test and break every check that
    manages a subprocess (timeouts, helper daemons, cleanup), so the rule is
    `(deny signal)` followed by `(allow signal (target same-sandbox))` -- a
    check keeps signalling its OWN children and cannot reach anything outside.
    Measured on Darwin 25.5: outward `kill` returns EPERM, inward SIGKILL of an
    in-sandbox child still succeeds. Linux gets the same from `--unshare-pid`.
    """
    lines = ["(version 1)", "(allow default)", "(deny file-write*)", "(allow file-write*"]
    lines += [f'    (subpath "{r}")' for r in write_roots]
    lines += [f'    (literal "{d}")' for d in _ALLOWED_WRITE_DEVICES]
    lines += ['    (regex #"^/dev/fd/")', '    (regex #"^/dev/ttys")', ")"]
    lines += ["(deny signal)", "(allow signal (target same-sandbox))"]
    return "\n".join(lines) + "\n"


def confine(cmd, backend, sandbox_root, cwd, workdir):
    """Wrap `cmd` so the OPERATING SYSTEM refuses every write outside the
    sandbox. Detection is not containment: three rounds of grading a check's
    effects after the fact produced three escapes, because the graded party
    could write the grading data. Returns cmd unchanged when there is no
    backend (audit-only) or no sandbox (--no-sandbox / an un-sandboxable spec,
    which is an explicit, manifest-declared choice).

    `sandbox_root` is this spec's OWN per-spec clone (F5 round 6): the write
    grant is the clone plus this spec's private workdir, and no neighbour's clone
    or inputs are reachable at all, so there is no deny-list to maintain."""
    if backend is None or sandbox_root is None:
        return cmd
    roots = _write_roots(sandbox_root, workdir)
    if backend == BACKEND_SANDBOX_EXEC:
        # -p takes the profile INLINE: a profile file would itself sit in a
        # writable temp dir, i.e. be tamperable by the very checks it confines.
        return [str(SANDBOX_EXEC), "-p", sandbox_exec_profile(roots), *cmd]
    if backend == BACKEND_BWRAP:
        # --die-with-parent + --unshare-pid: no check process may outlive the
        # spec that spawned it (F5 round 4). A backgrounded grandchild spanned a
        # concurrent spec's whole run and the manifest write that follows the
        # sweep -- it is what turns a narrow write window into a tuned one.
        # --unshare-ipc/--unshare-uts cost nothing and remove two more shared
        # namespaces; --unshare-NET IS DELIBERATELY ABSENT, because checks may
        # legitimately reach the network and F5's charter is mutation.
        argv = ["bwrap", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc",
                "--die-with-parent", "--unshare-pid", "--unshare-ipc", "--unshare-uts"]
        for r in roots:
            argv += ["--bind", r, r]
        argv += ["--chdir", str(cwd), "--"]
        return argv + cmd
    return cmd


def _rmtree_force(path):
    """`shutil.rmtree` a check cannot defeat by chmodding a directory it owns.

    The round-5 self-forgery fixture ends with its workdir at 0555 -- making the
    DIRECTORY read-only is how it blocked contract.py's `os.replace` of the
    report, since rename-into-place needs write permission on the directory
    rather than on the file. `rmtree(ignore_errors=True)` then cannot unlink
    through it and BOTH the per-spec workdir and the sweep's entire work root
    survive the sweep. Everything under these roots was created by this process
    and is owned by it, so restoring u+rwx on the way down is always ours to do;
    a check must not be able to make the sweep leak its own scratch state."""
    for root, dirs, _files in os.walk(str(path)):
        for target in [root] + [os.path.join(root, d) for d in dirs]:
            try:
                os.chmod(target, os.stat(target).st_mode | stat.S_IRWXU)
            except OSError:
                pass
    shutil.rmtree(str(path), ignore_errors=True)


def _spawn_pgid(proc):
    """The process-group id of a just-spawned gate subprocess.

    Read AT SPAWN, never after waiting: `communicate()` reaps the child and
    `os.getpgid()` on a reaped pid raises ProcessLookupError -- which would make
    the kill below a silent no-op, exactly the failure shape this tool exists to
    close. `start_new_session=True` makes the child a session and group leader,
    so its pgid IS its pid; getpgid is consulted first only to notice a platform
    where that did not happen."""
    try:
        return os.getpgid(proc.pid)
    except OSError:
        return proc.pid


def _kill_process_group(pgid):
    """Kill everything left in a returned gate subprocess's process group.

    F5 round 4 (A25). Each gate subprocess is started with
    `start_new_session=True`, so it leads its own group and nothing of
    gate_sweep's own is in it. The kill happens ONLY AFTER the subprocess has
    returned (or after its timeout has expired) -- never before, or honest slow
    FOREGROUND work would be truncated, which is a different silent lie rather
    than a fix."""
    if pgid is None:
        return
    try:
        own = os.getpgid(0)
    except OSError:  # pragma: no cover -- getpgid(0) cannot fail for a live process
        return
    if pgid in (own, 0, 1):
        # Defensive: start_new_session did not take effect. Killing our own
        # group would take the sweep down with it.
        return
    try:
        os.killpg(pgid, signal.SIGKILL)
    except OSError:
        pass


# ------------------------------------------------- symlink-refusing shared I/O
# Round-2 P1-1: an unguarded `target.write_bytes(old)` in the ignore-source
# restore made GATE_SWEEP ITSELF an arbitrary-file-overwrite primitive for any
# check that could plant a symlink. The rule is not "guard .gitignore" -- it is
# that NO file operation this tool performs on the sandbox may follow a symlink
# out of it. One shared helper, both the read and the write side.

def _safe_read_bytes(path: Path) -> bytes:
    """Read a path WITHOUT following a symlink. Raises OSError (ELOOP) rather
    than silently reading whatever the link aims at."""
    fd = os.open(str(path), os.O_RDONLY | _O_NOFOLLOW)
    try:
        chunks = []
        while True:
            block = os.read(fd, 1 << 20)
            if not block:
                return b"".join(chunks)
            chunks.append(block)
    finally:
        os.close(fd)


def _safe_write_bytes(path: Path, data: bytes):
    """Unlink-then-create, never write THROUGH an existing path: a check that
    replaced the target with a symlink must not make this tool write to the
    link's target."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _safe_unlink(path)
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_NOFOLLOW, 0o644)
    try:
        os.write(fd, data)
    finally:
        os.close(fd)


def _safe_unlink(path: Path):
    """Remove a path whatever it currently is -- file, symlink or (a check's
    file->directory swap) directory -- without following it."""
    p = str(path)
    try:
        if os.path.islink(p) or os.path.isfile(p):
            os.unlink(p)
        elif os.path.isdir(p):
            shutil.rmtree(p)
    except FileNotFoundError:
        pass


def _snapshot_file(path: Path):
    """t0 value of one snapshotted path: its bytes, a symlink sentinel, or None
    when it does not exist. A type change is drift by construction."""
    p = str(path)
    if os.path.islink(p):
        return _SYMLINK_SENTINEL + os.readlink(p).encode()
    if not os.path.isfile(p):
        return None
    return _safe_read_bytes(path)


def _restore_file(path: Path, value):
    """Put one snapshotted path back to its t0 value inside the (disposable,
    about-to-be-destroyed) sandbox, so post-sweep grading consults the rules
    that were in force at t0 rather than rules a graded check installed."""
    if value is None:
        _safe_unlink(path)
        return
    if value.startswith(_SYMLINK_SENTINEL):
        _safe_unlink(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        os.symlink(value[len(_SYMLINK_SENTINEL):].decode(), str(path))
        return
    _safe_write_bytes(path, value)


def _diff_and_restore(root: Path, t0: dict, t1: dict) -> list:
    """Shared body of both restore passes: report every path whose value
    changed since t0 -- edit, creation, deletion, or a change of TYPE -- then
    put the t0 value back. Returns the drifted paths, by name."""
    drifted = []
    for rel in sorted(set(t0) | set(t1)):
        if t0.get(rel) != t1.get(rel):
            drifted.append(rel)
        _restore_file(root / rel, t0.get(rel))
    return drifted


def _git(root: Path, *args):
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True,
                          env=child_env()).stdout


def tree_fingerprint(root: Path, include_ignored: bool = False) -> str:
    """CANONICAL definition, must stay byte-identical to the golden checker's
    copy in goldens/verify_gate_sweep_isolation.py.

    sha256 over, in this exact order, newline-joined:
      1. the HEAD sha (`git rev-parse HEAD`), or "NO-HEAD"
      2. every line of `git status --porcelain=v1` in the order git emits it
      3. for each of those lines' paths, sorted: "<path>\\t<sha256 of file bytes>",
         or "<path>\\tABSENT" when the path does not exist (a deletion)

    This is a content fingerprint, not a status fingerprint: `git status
    --porcelain` alone cannot distinguish two different edits to the same
    already-dirty file.

    `include_ignored` (round-2 P2-3) adds `--ignored=matching`, and is used by
    the ADVISORY real-tree canary ONLY -- never for the manifest's
    `tree_fingerprint`, whose definition F3's freshness parity depends on and
    which must not move. Ignored paths never appear in plain `git status`, and
    they are exactly where machine noise lands (`.agent/memory/scratch/`,
    `contract-results/`) and where an absolute-path escape is least likely to
    be noticed. Measured cost on this repo: 103 entries, 0.33s.
    """
    head = (_git(root, "rev-parse", "HEAD").strip() or "NO-HEAD")
    status_args = ["status", "--porcelain=v1"]
    if include_ignored:
        status_args.append("--ignored=matching")
    status = _git(root, *status_args).splitlines()
    parts = [head] + status
    paths = sorted({line[3:].split(" -> ")[-1].strip().strip('"') for line in status})
    for rel in paths:
        f = root / rel
        if f.is_file():
            # An unreadable path is a value, never a crash: a fingerprint that
            # raises turns a containment-machinery failure into an uncaught
            # traceback and the softer exit 1 (round-2 P2-2).
            try:
                parts.append(f"{rel}\t{hashlib.sha256(f.read_bytes()).hexdigest()}")
            except OSError:
                parts.append(f"{rel}\t{_UNREADABLE}")
        else:
            parts.append(f"{rel}\tABSENT")
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def _reap_stale_sandboxes(sandbox_dir: Path, prefix: str = "gate_sweep_sandbox_"):
    """A SIGKILLed sweep never reaches main()'s finally, so its sandbox leaks.
    Best-effort, age-only reap of `prefix`* leftovers under sandbox_dir at
    startup -- the sandbox copies, and (F5 round 4) the per-spec workdir roots,
    which leak the same way for the same reason. Age-only matters: a reaper
    that also caught fresh leftovers would let two concurrent sweeps destroy
    each other's copies mid-gate, a worse failure than the leak it fixes.
    Warns rather than raising -- a reap failure must never abort a sweep that
    could otherwise proceed."""
    try:
        candidates = list(sandbox_dir.glob(prefix + "*"))
    except OSError:
        return
    now = time.time()
    for p in candidates:
        try:
            if not p.is_dir():
                continue
            if now - p.stat().st_mtime <= STALE_SANDBOX_AGE_SECONDS:
                continue
            shutil.rmtree(p)
        except OSError as exc:
            print(f"WARNING: could not reap stale leftover {p}: {exc}", file=sys.stderr)


def _cleanup_partial_sandbox(dest: Path):
    """Remove a partially-created sandbox on any make_sandbox failure path.
    make_sandbox raises before main()'s try/finally exists to clean up, so
    the cleanup has to live here. Warns rather than silently swallowing --
    `rmtree(ignore_errors=True)` is defeated by a check that chmod 000's a
    directory, and a swallowed cleanup failure is exactly the kind of
    machinery-breaking-and-reading-as-normal this mission exists to close."""
    if not dest.exists():
        return
    try:
        shutil.rmtree(dest)
    except OSError as exc:
        print(f"WARNING: could not remove partial sandbox {dest}: {exc}", file=sys.stderr)


def _is_inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


_GITDIR_RE = re.compile(r"^gitdir:\s*(.+?)\s*$", re.MULTILINE)


def _find_git_file_pointers(root: Path):
    """Every FILE (never directory) literally named `.git` under root --
    the shape a linked worktree or submodule checkout uses to point at its
    real gitdir. Mirrors probe_gitdirs.sh's own search exactly (prune
    directories named `.git`, so the sandbox's own top-level .git dir and its
    internals are never descended into; only nested pointer FILES matter)."""
    found = []
    for dirpath, dirnames, filenames in os.walk(root):
        if ".git" in dirnames:
            dirnames.remove(".git")
        if ".git" in filenames:
            found.append(Path(dirpath) / ".git")
    return found


def _resolve_gitdir_pointer(gitfile: Path):
    """Resolve a `.git` FILE's `gitdir:` target to an absolute path, or None
    if the file is unreadable or not a gitdir pointer."""
    try:
        text = gitfile.read_text()
    except OSError:
        return None
    m = _GITDIR_RE.search(text)
    if not m:
        return None
    ptr = m.group(1)
    target = Path(ptr)
    if not target.is_absolute():
        target = gitfile.parent / ptr
    try:
        return target.resolve()
    except OSError:
        return target


def _iter_gitdirs(sandbox_root: Path):
    """Every gitdir reachable from inside the sandbox: the sandbox's own `.git`,
    plus the resolved target of every `.git` FILE pointer that lands inside it.
    Nested worktree gitdirs live under the top-level `.git` and are therefore
    covered by walking it."""
    root = sandbox_root.resolve()
    dirs = []
    top = root / ".git"
    if top.is_dir():
        dirs.append(top)
    for gitfile in _find_git_file_pointers(sandbox_root):
        target = _resolve_gitdir_pointer(gitfile)
        if (target is not None and target.is_dir() and _is_inside(target, root)
                and not any(_is_inside(target, d) for d in dirs)):
            dirs.append(target)
    return dirs


def _gitdir_metadata_files(gitdir: Path):
    """Every file under a gitdir except the object stores and the binary index.
    Deliberately generic (A17): commondir, objects/info/alternates,
    core.worktree, core.excludesFile, core.hooksPath, include.path,
    modules/*/gitdir, sequencer state and anything not yet invented are covered
    by the same rule, unenumerated -- which is the shape that would have caught
    round-2 P1-3 for free.

    The bulk stores are pruned by RELATIVE PATH (F5 round 4). Pruning by bare
    directory name discarded `objects/info` with `objects/ab` and left
    `objects/info/alternates` -- named in this docstring as covered -- outside
    the walk entirely, which made this invariant a claim with a known
    exception."""
    gitdir = Path(gitdir)
    for dirpath, dirnames, filenames in os.walk(gitdir):
        try:
            here = Path(dirpath).relative_to(gitdir)
        except ValueError:  # pragma: no cover -- os.walk cannot leave its root
            here = Path(".")
        kept = []
        for d in dirnames:
            rel = (here / d).as_posix()
            if _SKIP_GITDIR_RELDIR_RE.match(rel):
                continue
            kept.append(d)
        dirnames[:] = kept
        for name in filenames:
            if name in _SKIP_GITDIR_NAMES:
                continue
            yield Path(dirpath) / name


def _text_of(path: Path):
    """The file's bytes if it is a regular file whose content is text we can
    reason about, else None. Binary metadata is never rewritten: replacing
    bytes inside a format this tool does not understand corrupts the sandbox."""
    if os.path.islink(str(path)):
        return None
    try:
        data = _safe_read_bytes(path)
        data.decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    return data


def _remap_gitdir_metadata(sandbox_root: Path, source_root: Path = REPO_ROOT):
    """Rewrite every absolute reference to `source_root` in the sandbox's git
    metadata to its sandbox equivalent -- one generic rule instead of a list of
    pointer names. This repo's `.git/config` carries an absolute
    `core.hooksPath`, and every `.git/worktrees/<name>/gitdir` back-pointer is
    absolute; round-2 P1-3 was precisely the back-pointer that the round-1
    forward-pointer fix's own traversal pruned away.

    `source_root` is REPO_ROOT when sealing the per-sweep MASTER copy, and the
    MASTER's path when re-sealing a per-spec CLONE of it (F5 round 6): the master
    is already sealed to its own path, so every reference a fresh clone inherits
    names the master, and the clone is sealed by remapping the master's path to
    the clone's."""
    root = sandbox_root.resolve()
    real, new = str(Path(source_root).resolve()).encode(), str(root).encode()
    for gitdir in _iter_gitdirs(sandbox_root):
        for f in _gitdir_metadata_files(gitdir):
            if os.path.islink(str(f)):
                target = Path(os.path.realpath(str(f)))
                if not _is_inside(target, root):
                    _safe_unlink(f)
                continue
            data = _text_of(f)
            if data is None or real not in data:
                continue
            _safe_write_bytes(f, data.replace(real, new))


def _prune_unmappable_worktrees(sandbox_root: Path) -> list:
    """A worktree entry whose paths cannot be remapped into the sandbox must be
    PRUNED from the copy, not left pointing out. This repository has exactly one
    such entry (a worktree living outside REPO_ROOT entirely), and leaving it
    means `git worktree list` from the sandbox still names real directories and
    every worktree subcommand operates on them -- which is how round-2 P1-3's
    `git worktree repair` rewrote five real pointers into a directory the sweep
    then deleted."""
    root = sandbox_root.resolve()
    pruned = []
    for gitdir in _iter_gitdirs(sandbox_root):
        worktrees = gitdir / "worktrees"
        if not worktrees.is_dir():
            continue
        for entry in sorted(worktrees.iterdir()):
            if not entry.is_dir():
                continue
            data = _text_of(entry / "gitdir") if (entry / "gitdir").is_file() else None
            target = None
            if data:
                text = data.decode("utf-8").strip()
                if text:
                    target = Path(os.path.realpath(text))
            if target is None or not _is_inside(target, root):
                shutil.rmtree(entry, ignore_errors=True)
                pruned.append(str(entry.relative_to(root)))
    return pruned


def _seal_symlinks(sandbox_root: Path, source_root: Path = REPO_ROOT):
    """No symlink inside the sandbox may resolve outside it. One that aims into
    `source_root` is re-pointed at the sandbox equivalent (it stays functional);
    one aiming anywhere else cannot be reconstructed locally and is removed.
    `source_root` is REPO_ROOT for the master, the master's path for a clone."""
    root = sandbox_root.resolve()
    src = Path(source_root).resolve()
    for dirpath, dirnames, filenames in os.walk(sandbox_root):
        for name in list(dirnames) + list(filenames):
            p = Path(dirpath) / name
            if not os.path.islink(str(p)):
                continue
            target = Path(os.path.realpath(str(p)))
            if _is_inside(target, root):
                continue
            os.unlink(str(p))
            if _is_inside(target, src):
                os.symlink(str(root / target.relative_to(src)), str(p))


def _is_git_location(token: str) -> bool:
    """Is this absolute path a GIT location? The qualifier is what keeps the
    generic token scan quiet -- a hook shebang's `/bin/sh` is not an outward
    git reference -- while leaving it blind to nothing."""
    p = Path(token)
    if not p.exists():
        return False
    if (p / "HEAD").exists() and (p / "refs").is_dir():
        return True
    current = p if p.is_dir() else p.parent
    for _ in range(64):
        if (current / ".git").exists():
            return True
        if current.parent == current:
            break
        current = current.parent
    return False


def containment_violations(sandbox_root: Path) -> list:
    """THE INVARIANT, checkable at any moment: no reference inside the sandbox
    resolves to a git location outside it.

    Checked three ways, none of which is a list of known escapes -- `.git`
    pointer FILES, git's own worktree view, and a generic absolute-path token
    scan of every gitdir's text metadata.

    Returned rather than raised because it is asserted TWICE: once at sandbox
    creation, and again after the sweep before grading. Round-2 P1-2 is
    entirely the absence of the second assertion -- neutralisation was one-shot
    at t0, so a check could rewrite a pointer back and land a real ref in
    silence, at exit 0."""
    root = sandbox_root.resolve()
    found = []
    for gitfile in _find_git_file_pointers(sandbox_root):
        target = _resolve_gitdir_pointer(gitfile)
        if target is not None and not _is_inside(target, root):
            found.append(f"`.git` pointer file {gitfile} -> {target}")
    for line in _git(root, "worktree", "list", "--porcelain").splitlines():
        if line.startswith("worktree "):
            worktree = Path(line[len("worktree "):].strip())
            if not _is_inside(worktree, root):
                found.append(f"`git worktree list` reports a worktree outside the "
                             f"sandbox: {worktree}")
    prefix = str(root)
    for gitdir in _iter_gitdirs(sandbox_root):
        for f in _gitdir_metadata_files(gitdir):
            data = _text_of(f)
            if data is None:
                continue
            for raw in sorted(set(_ABS_TOKEN_RE.findall(data))):
                token = raw.decode()
                if token == prefix or token.startswith(prefix + "/"):
                    continue
                if _is_git_location(token):
                    found.append(f"gitdir metadata {f} references a git location "
                                 f"outside the sandbox: {token}")
    return sorted(set(found))


def seal_sandbox(sandbox_root: Path, source_root: Path = REPO_ROOT):
    """Close the copy, then ASSERT that it is closed.

    The copy is defence in depth now, not the boundary -- OS-enforced
    confinement is -- but "nothing inside points out" is still worth holding,
    because a sandbox whose git metadata addresses the real repository makes
    every read wrong even when every write is refused.

    `source_root` is the path whose absolute references this copy inherited and
    must be remapped into the copy: REPO_ROOT for the per-sweep MASTER, and the
    master's own path for a per-spec CLONE of it (F5 round 6). A clone inherits
    the master's already-sealed references, so sealing it means remapping the
    master's path -- not REPO_ROOT, which no longer appears anywhere in it."""
    _redirect_git_file_pointers(sandbox_root, source_root)
    _remap_gitdir_metadata(sandbox_root, source_root)
    _prune_unmappable_worktrees(sandbox_root)
    _seal_symlinks(sandbox_root, source_root)
    violations = containment_violations(sandbox_root)
    if violations:
        raise SandboxError(
            "the sandbox is not closed after sealing -- references still resolve to git "
            "locations outside it: " + "; ".join(violations)
        )


def _redirect_git_file_pointers(sandbox_root: Path, source_root: Path = REPO_ROOT):
    """Every `.git` FILE copied into the sandbox (each
    `.claude/worktrees/agent-*` has one) carries its `gitdir:` pointer
    VERBATIM, and a linked worktree's pointer is ABSOLUTE into the real
    repository -- so refs, objects, index, reflog, config and HEAD all
    escape while ordinary file writes stay contained.

    An escaping pointer that resolves INSIDE REPO_ROOT (the ordinary case:
    `.git/worktrees/<name>`, or the main `.git` dir itself) is rewritten to
    its already-copied SANDBOX equivalent rather than deleted -- `cp -Rc`
    already copied that metadata verbatim, so redirecting the pointer there
    keeps the pointer fully functional (same HEAD, same refs at t0) while
    containing every read AND write inside the sandbox. This also keeps
    `git status` at the sandbox root reporting the SAME gitlink state as the
    real tree (deleting the pointer instead would desynchronise the two --
    breaking the tree_fingerprint() parity the manifest depends on). A
    pointer that resolves outside REPO_ROOT entirely, or whose sandbox
    equivalent was not copied, cannot be reconstructed locally and is
    neutralised by removing the pointer file instead, so no git command
    through it can reach anything outside the sandbox.

    The invariant is then ASSERTED, before gating anything: raises
    SandboxError if any escaping pointer survives either treatment."""
    root_resolved = sandbox_root.resolve()
    src_resolved = Path(source_root).resolve()

    def _redirect_or_remove(gitfile, target):
        try:
            rel = target.relative_to(src_resolved)
        except ValueError:
            rel = None
        # Built from root_resolved (already .resolve()d), not the possibly-
        # unresolved sandbox_root: on macOS /tmp is itself a symlink to
        # /private/tmp, and a pointer written with the unresolved prefix
        # would string-compare as escaping to any consumer (e.g. this
        # checker's own probe, `pwd -P`-based) that resolves symlinks first.
        sandbox_equivalent = (root_resolved / rel) if rel is not None else None
        if sandbox_equivalent is not None and sandbox_equivalent.exists():
            _safe_write_bytes(gitfile, f"gitdir: {sandbox_equivalent}\n".encode())
            return
        try:
            _safe_unlink(gitfile)
        except OSError as exc:
            raise SandboxError(
                f"could not neutralize escaping git pointer {gitfile} -> {target}: {exc}"
            ) from exc

    for gitfile in _find_git_file_pointers(sandbox_root):
        target = _resolve_gitdir_pointer(gitfile)
        if target is None or _is_inside(target, root_resolved):
            continue
        _redirect_or_remove(gitfile, target)

    remaining = []
    for gitfile in _find_git_file_pointers(sandbox_root):
        target = _resolve_gitdir_pointer(gitfile)
        if target is not None and not _is_inside(target, root_resolved):
            remaining.append(f"{gitfile} -> {target}")
    if remaining:
        raise SandboxError(
            "git pointer(s) still escape the sandbox after containment: " + ", ".join(remaining)
        )


def _manifest_grant_conflict(manifest_path, roots):
    """The granted write root the manifest would live inside, or None.

    F5 round 4. The `--manifest` document is the artifact F3 consumes -- a
    sweep that had correctly computed exit 2 shipped an all-clean FORGED
    manifest, written by a check's surviving background process. Narrowing the
    grant to a per-spec workdir puts it out of reach by construction, but an
    operator can still aim `--manifest` straight into a granted root, so that
    destination is refused UP FRONT (A13's rule, applied to the second
    artifact). Resolved via the PARENT, so a manifest that does not exist yet is
    graded on where it would land."""
    if manifest_path is None:
        return None
    manifest_path = Path(manifest_path)
    target = Path(os.path.realpath(str(manifest_path.parent))) / manifest_path.name
    for root in roots:
        if _is_inside(target, Path(os.path.realpath(str(root)))):
            return str(root)
    return None


def _reject_manifest_inside_grant(manifest_path, roots):
    """Refuse a --manifest destination inside a granted write root: exit 2."""
    conflict = _manifest_grant_conflict(manifest_path, roots)
    if conflict is None:
        return
    raise SandboxError(
        f"--manifest {manifest_path} resolves inside a directory confined checks are "
        f"granted write access to ({conflict}); the artifact F3 consumes would be "
        "forgeable by the very checks the sweep is grading. Choose a destination "
        "outside the sandbox and outside the sweep's per-spec workdirs."
    )


def make_sandbox(sandbox_dir: Path, manifest_path: Path = None) -> Path:
    """Materialise ONE disposable copy of the whole repository (.git included)
    under sandbox_dir. Prefers a clonefile/reflink copy (`cp -Rc` on APFS,
    ~3.1s / 122M measured on this repo) and falls back to a plain recursive
    copy where the platform does not offer one. Raises SandboxError on any
    failure -- callers must never fall back to gating in place -- and cleans
    up any partial copy itself, since it raises before main()'s try/finally
    is entered."""
    sandbox_dir = Path(sandbox_dir)
    try:
        resolved_dir = sandbox_dir.resolve()
    except OSError:
        resolved_dir = None
    if resolved_dir is not None and _is_inside(resolved_dir, REPO_ROOT):
        # Copying the repository into a destination inside itself recurses
        # without bound (measured: ~13 levels, 894MB, before the disk filled).
        # Reject up front, before creating or copying anything.
        raise SandboxError(
            f"--sandbox-dir {sandbox_dir} resolves inside REPO_ROOT ({REPO_ROOT}); copying "
            "the repository into itself recurses without bound. Choose a destination "
            "outside the repository."
        )
    try:
        sandbox_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise SandboxError(f"could not create --sandbox-dir {sandbox_dir}: {exc}") from exc

    _reap_stale_sandboxes(sandbox_dir)

    try:
        dest = Path(tempfile.mkdtemp(prefix="gate_sweep_sandbox_", dir=str(sandbox_dir)))
    except OSError as exc:
        raise SandboxError(f"could not create sandbox workdir under {sandbox_dir}: {exc}") from exc

    # BEFORE ANY BYTES ARE COPIED: the sandbox is the other granted write root,
    # so a --manifest aimed inside it is refused here rather than after a
    # 122MB copy (F5 round 4).
    try:
        _reject_manifest_inside_grant(manifest_path, [dest])
    except SandboxError:
        _cleanup_partial_sandbox(dest)
        raise

    try:
        # dest already exists (mkdtemp); cp -Rc / copytree both need to write
        # INTO it, so copy contents rather than the directory itself.
        cp = subprocess.run(
            ["cp", "-Rc", str(REPO_ROOT) + "/.", str(dest)],
            capture_output=True, text=True,
        )
        if cp.returncode != 0:
            shutil.rmtree(dest, ignore_errors=True)
            shutil.copytree(REPO_ROOT, dest, symlinks=True)
        if not (dest / ".git").exists():
            raise OSError(f"sandbox copy at {dest} is missing .git -- copy did not complete")
        seal_sandbox(dest)
    except SandboxError:
        _cleanup_partial_sandbox(dest)
        raise
    except OSError as exc:
        _cleanup_partial_sandbox(dest)
        raise SandboxError(f"sandbox copy of the repository failed: {exc}") from exc
    return dest


def clone_sandbox(master_root: Path, work_root: Path) -> Path:
    """A fresh, disposable, per-SPEC copy of the sealed per-sweep master (F5
    round 6). The master is created once, sealed once, and never mutated -- it is
    the source of `tree_fingerprint` at t0 and the pristine clone source. Every
    discovered spec gates inside its own clone of it and then destroys the clone,
    so no neighbouring spec ever runs in this spec's tree: the graded inputs
    (contract.yaml, goldens, the shared helper scripts an assertion invokes)
    cannot be substituted -- not by rewriting them, which A31 already denied, and
    not by substituting a common ANCESTOR with a symlink, which A31 did NOT close
    and which is the round-6 finding. There is no shared tree left to poison.

    Prefers an APFS clonefile (`cp -Rc`, ~3.1s/122M measured, block-shared COW so
    N live clones stay cheap) and falls back to a plain recursive copy where the
    platform offers none. The clone is then re-sealed by remapping the MASTER's
    path to the clone's -- the master is already sealed to its own path, so that
    is the only reference a fresh clone inherits. Raises SandboxError on any
    failure and removes any partial clone itself, exactly as make_sandbox does
    for the master (the ENOSPC / A14 path is inherited unchanged)."""
    master_root = Path(master_root)
    try:
        dest = Path(tempfile.mkdtemp(prefix="gate_sweep_spec_", dir=str(work_root)))
    except OSError as exc:
        raise SandboxError(f"could not create per-spec sandbox workdir: {exc}") from exc
    try:
        cp = subprocess.run(
            ["cp", "-Rc", str(master_root) + "/.", str(dest)],
            capture_output=True, text=True,
        )
        if cp.returncode != 0:
            shutil.rmtree(dest, ignore_errors=True)
            shutil.copytree(master_root, dest, symlinks=True)
        if not (dest / ".git").exists():
            raise OSError(f"per-spec clone at {dest} is missing .git -- copy did not complete")
        seal_sandbox(dest, source_root=master_root)
    except SandboxError:
        _cleanup_partial_sandbox(dest)
        raise
    except OSError as exc:
        _cleanup_partial_sandbox(dest)
        raise SandboxError(f"per-spec clone of the sandbox failed: {exc}") from exc
    return dest


def translate_to_sandbox(path: Path, sandbox_root: Path):
    """Translate a discovered spec path into its sandbox equivalent via
    path.resolve().relative_to(REPO_ROOT) -- resolve() first, so a /tmp
    symlink farm still gates the sandbox's copy rather than the symlink
    target. Returns None when the spec resolves outside REPO_ROOT and
    therefore cannot be sandboxed."""
    try:
        rel = path.resolve().relative_to(REPO_ROOT)
    except ValueError:
        return None
    return sandbox_root / rel


def _dirty_paths(root: Path) -> set:
    lines = _git(root, "status", "--porcelain=v1").splitlines()
    return {line[3:].split(" -> ")[-1].strip().strip('"') for line in lines}


def _hash_paths(root: Path, paths) -> dict:
    """{repo-relative path -> sha256 of its bytes, "ABSENT" if it does not
    exist, or "UNREADABLE" if its bytes cannot be read at all}. Used for
    CONTENT-based drift grading, not status-line presence.

    Unreadable is a VALUE, never an exception: an uncaught PermissionError here
    produced no summary, no manifest and exit 1 -- the containment machinery
    breaking while presenting as an ordinary failing spec (round-2 P2-2). As a
    value it is simply drift, which is exit 2, named."""
    out = {}
    for rel in paths:
        f = root / rel
        if os.path.islink(str(f)):
            # A file->symlink swap with identical content is invisible to a
            # content hash unless the TYPE is part of the value.
            out[rel] = f"SYMLINK:{os.readlink(str(f))}"
            continue
        if not f.is_file():
            out[rel] = "ABSENT"
            continue
        try:
            out[rel] = hashlib.sha256(_safe_read_bytes(f)).hexdigest()
        except OSError:
            out[rel] = _UNREADABLE
    return out


def snapshot_dirty_content(sandbox_root: Path) -> dict:
    """T0 snapshot for content-based drift grading: {dirty path -> sha256}
    for every path `git status` reports dirty at sandbox creation."""
    return _hash_paths(sandbox_root, _dirty_paths(sandbox_root))


def _collect_ignore_sources(root: Path) -> dict:
    """{repo-relative path -> snapshot value} for every ignore-rule source
    under root: `.git/info/exclude` and every `.gitignore` at any directory
    level. `.git/` itself is pruned from the walk (its internals are not ignore
    sources). Read through the symlink-refusing helper, so a check that swaps an
    ignore source for a symlink is recorded as the type change it is rather
    than silently read through (round-2 P1-1's read side)."""
    sources = {}
    exclude = root / ".git" / "info" / "exclude"
    if os.path.islink(str(exclude)) or exclude.is_file():
        sources[".git/info/exclude"] = _snapshot_file(exclude)
    for dirpath, dirnames, filenames in os.walk(root):
        if ".git" in dirnames:
            dirnames.remove(".git")
        if _GITIGNORE_NAME in filenames or _GITIGNORE_NAME in dirnames:
            p = Path(dirpath) / _GITIGNORE_NAME
            try:
                sources[str(p.relative_to(root))] = _snapshot_file(p)
            except OSError:
                sources[str(p.relative_to(root))] = _UNREADABLE.encode()
    return sources


def _restore_ignore_sources(root: Path, t0_sources: dict) -> list:
    """Diff the CURRENT ignore-rule sources against the t0 snapshot (any
    change -- edit, creation, deletion, or a change of TYPE -- is drift in its
    own right, since `.git/` never appears in `git status` and a check could
    otherwise rewrite `.gitignore`/`.git/info/exclude` to hide what it wrote),
    then restore the t0 value into the (disposable, about-to-be-destroyed)
    sandbox so subsequent `git check-ignore` calls grade against the rules that
    were in force at t0, never rules a graded check controls."""
    return _diff_and_restore(root, t0_sources, _collect_ignore_sources(root))


def _collect_git_metadata(root: Path) -> dict:
    """{repo-relative path -> snapshot value} for the git metadata whose CONTENT
    changes how git grades or executes (round-2 P2-1). `.git/config` never
    appears in `git status`, so `git config core.excludesFile <a file the check
    wrote>` let a graded check supply its own grading rules and leave no trace.

    Deliberately NOT all of `.git`: `index`, `logs/` and `refs/` move under
    ordinary read-only gating and would make every sweep red.

    Each value has this root's own absolute path replaced by _SANDBOX_PATH_TOKEN
    (F5 round 6), so the master's t0 baseline and a per-spec clone's post-gate
    reading -- which live at different addresses -- differ only where a check
    actually changed something, never merely because the clone is a copy."""
    meta = {}
    # _iter_gitdirs yields paths under the RESOLVED root (on macOS the system
    # temp dir is itself a symlink), so relativise against the same.
    base = root.resolve()
    base_token = str(base).encode()

    def add(path: Path):
        try:
            rel = str(path.relative_to(base))
        except ValueError:
            return
        if os.path.islink(str(path)) or path.is_file():
            try:
                value = _snapshot_file(path)
            except OSError:
                value = _UNREADABLE.encode()
            if value is not None:
                value = value.replace(base_token, _SANDBOX_PATH_TOKEN)
            meta[rel] = value

    for gitdir in _iter_gitdirs(root):
        for name in _GIT_METADATA_FILES:
            add(gitdir / name)
        for name in _GIT_METADATA_DIRS:
            d = gitdir / name
            if d.is_dir():
                for child in sorted(d.iterdir()):
                    add(child)
        worktrees = gitdir / "worktrees"
        if worktrees.is_dir():
            for entry in sorted(worktrees.iterdir()):
                for name in _GIT_WORKTREE_METADATA_FILES:
                    add(entry / name)
    return meta


def _restore_git_metadata(root: Path, t0_metadata: dict) -> list:
    """Name every change to the behaviour-bearing git metadata as drift, then
    put the t0 bytes back -- so the `git check-ignore` grading that follows
    consults the t0 `core.excludesFile`, not one a graded check installed.

    Both snapshots carry _SANDBOX_PATH_TOKEN in place of their own root's path
    (F5 round 6), so the diff is address-independent; on restore the token is
    resolved back to THIS root's real path, so the bytes written into the clone
    are valid for the clone rather than for the master they were snapshotted on."""
    t1 = _collect_git_metadata(root)
    base_token = str(root.resolve()).encode()
    drifted = []
    for rel in sorted(set(t0_metadata) | set(t1)):
        if t0_metadata.get(rel) != t1.get(rel):
            drifted.append(rel)
        value = t0_metadata.get(rel)
        if value is not None:
            value = value.replace(_SANDBOX_PATH_TOKEN, base_token)
        _restore_file(root / rel, value)
    return drifted


def sandbox_drift(sandbox_root: Path, t0_hashes: dict, t0_ignore_sources: dict,
                  t0_git_metadata: dict) -> list:
    """Attributable drift detection: nothing but this sweep touches the
    sandbox, so any content change is real drift. Graded by CONTENT, not by
    status-line presence -- a write into a path already dirty at t0, or a
    revert of one, changes no status line either way, so presence/absence of
    a line cannot be the signal. Ignore rules AND the behaviour-bearing git
    metadata are read from the T0 SNAPSHOT (never rules a graded check can
    rewrite), and any change to either is itself reported as drift, by name."""
    # Metadata first: `core.excludesFile` must be back at its t0 value before a
    # single `git check-ignore` runs, or the graded party still grades itself.
    metadata_drift = _restore_git_metadata(sandbox_root, t0_git_metadata)
    ignore_drift = _restore_ignore_sources(sandbox_root, t0_ignore_sources)

    candidates = set(t0_hashes) | _dirty_paths(sandbox_root)
    current_hashes = _hash_paths(sandbox_root, candidates)
    content_drift = [
        rel for rel in candidates
        if t0_hashes.get(rel, "<CLEAN-AT-T0>") != current_hashes[rel]
    ]

    non_ignored = []
    for rel in content_drift:
        check = subprocess.run(["git", "check-ignore", "-q", rel], cwd=sandbox_root,
                               env=child_env())
        if check.returncode != 0:  # not ignored under the t0 rules -> real drift
            non_ignored.append(rel)
    return sorted(set(non_ignored) | set(ignore_drift) | set(metadata_drift))


class SpecResult:
    __slots__ = ("path", "slug", "status", "detail", "elapsed", "rc",
                 "unsandboxed", "drift", "breaches")

    def __init__(self, path, slug, status, detail, elapsed, rc, unsandboxed=False,
                 drift=None, breaches=None):
        self.path = path
        self.slug = slug
        self.status = status
        self.detail = detail
        self.elapsed = elapsed
        self.rc = rc
        # True iff this spec was gated with cwd=REPO_ROOT against the REAL
        # tree -- either because sandboxing is off (--no-sandbox), or this
        # spec's path resolves outside REPO_ROOT and could not be translated.
        self.unsandboxed = unsandboxed
        # Per-spec drift and containment findings, graded against the master's
        # t0 snapshot inside THIS spec's own clone before it is destroyed (F5
        # round 6). Aggregated by run_sweep's caller into the manifest and the
        # exit code, exactly as the once-per-sweep grading did before.
        self.drift = drift or []
        self.breaches = breaches or []


def discover(specs_root: Path):
    """Same glob shape as verify_all_contracts_parse.py's SPECS_ROOT.glob("**/
    contract*.yaml") -- one entry per contract*.yaml FILE, not per directory.

    Walked manually (os.walk with followlinks=True) rather than
    Path.glob("**/...") directly: plain pathlib glob does not descend into
    symlinked directories on Python < 3.13 (no recurse_symlinks param), and
    this tool must be runnable against a fixture tree assembled from
    symlinked spec directories (see goldens/verify_gate_sweep.py's
    _single_fixture_dir/_subset_fixture_dir helpers) without depending on
    interpreter version.
    """
    found = []
    for dirpath, _dirnames, filenames in os.walk(specs_root, followlinks=True):
        for name in filenames:
            if fnmatch.fnmatch(name, "contract*.yaml"):
                found.append(Path(dirpath) / name)
    return sorted(found)


def _identify_slug(path: Path) -> str:
    """Best-effort spec identifying token for report lines. Tries a real
    YAML parse first (so normal specs get their declared `slug:`/`spec:`
    field); falls back to a raw regex scan of the file text for a `slug:`
    line when the file doesn't parse at all (a malformed contract must
    still be named in the report, never dropped for lack of a parseable
    slug -- see DECISIONS.md "Never trust the absence of a bad word").
    Final fallback is a path-derived token so discovery never produces an
    unnamed spec."""
    text = ""
    try:
        text = path.read_text()
    except OSError:
        pass
    try:
        import yaml
        data = yaml.safe_load(text)
        if isinstance(data, dict):
            slug = data.get("slug") or data.get("spec") or data.get("feature")
            if slug:
                return str(slug)
    except Exception:
        pass
    m = _SLUG_LINE_RE.search(text)
    if m:
        return m.group(1)
    try:
        rel = path.relative_to(REPO_ROOT)
    except ValueError:
        rel = path
    return str(rel.parent.name + "/" + rel.stem)


def _read_report_fd(fd: int) -> bytes:
    """Everything contract.py wrote to the descriptor we own, from offset 0.

    Read only after the gate subprocess has exited, so no partial-write window
    exists and no atomic rename is needed: nothing else holds this descriptor.
    An empty result is the fail-closed "no report" case, identical in meaning to
    round 4's absent file."""
    try:
        os.lseek(fd, 0, os.SEEK_SET)
        chunks = []
        while True:
            block = os.read(fd, 1 << 16)
            if not block:
                break
            chunks.append(block)
        return b"".join(chunks)
    except OSError:
        return b""


def _classify_from_report(report: bytes, rc: int, stderr: str):
    """Classify one spec from contract.py's STRUCTURED report, never from text.

    `contract.py gate --report-fd N` writes an athanor.gate-report/v1
    document that contract.py alone produces. No check's stdout can reach it,
    so unlike the combined stdout/stderr stream it cannot be spoofed by an
    assertion that happens to echo summary-shaped text (the round-1 defect:
    check_cmd relays up to 200 chars of every assertion's own output as
    "evidence" BEFORE the authoritative summary line, and _print_gate_errors()
    re-prints an erroring assertion's evidence AFTER it -- so neither the first
    nor the last text match is trustworthy).

    THE CHANNEL IS A CAPABILITY, NOT A NAME (F5 round 5). Rounds 1-4 fixed one
    defect four times by narrowing a name -- check stdout, then `gettempdir()`,
    then a sibling's workdir -- and round 4's remaining grant was the spec's OWN
    workdir, where `<workdir>/gate-report.json` sat: reachable from inside the
    profile as `$TMPDIR/../gate-report.json`. A check armed a spinner, contract.py
    wrote the true verdict at exit, the spinner overwrote it, and a genuinely
    FAILING spec reported PASS at rc 0, deterministically. Narrowing cannot
    terminate, because `confine()` wraps the contract.py invocation itself: every
    path grant that lets contract.py write the report lets a descendant overwrite
    it. Nor can the kill be re-ordered ahead of the read -- a double-fork daemon
    leaves the process group entirely. So gate_sweep opens the destination itself
    in the UNGRANTED work root, unlinks it so no name exists at all, and passes
    the DESCRIPTOR. Seatbelt checks write authority at OPEN, so the confined
    process writes the inherited fd while being refused that directory by name,
    and its descendants do not inherit the fd (close_fds).

    Fail-closed: if nothing was written the gate never got far enough to write
    a report, and the spec is INVALID or ERROR -- never PASS. Only in that case
    are contract.py's marker strings consulted, and only against STDERR, a
    channel check evidence never reaches.
    """
    if not report:
        for marker, detail in _STDERR_INVALID_MARKERS:
            if marker in stderr:
                return "INVALID", detail
        # No report and no known abort marker: the gate process itself died
        # before producing a verdict (e.g. an uncaught FileNotFoundError from
        # a codex_qa wrapper script -- check_cmd only catches TimeoutExpired
        # for codex_qa, so a missing wrapper crashes `gate` outright).
        return "ERROR", (f"gate produced no structured report (rc={rc}) -- "
                         "it crashed before reaching a phase-4 verdict")
    try:
        data = json.loads(report.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        return "ERROR", f"gate report unreadable ({type(exc).__name__}) -- no usable verdict"

    phases = data.get("phases") or []
    record = next((ph for ph in phases if str(ph.get("phase")) == "4"), None)
    if record is None:
        return "ERROR", "gate report carries no phase-4 record -- no usable verdict"

    status = _REPORT_STATUS_MAP.get(record.get("status"))
    if status is None:
        return "ERROR", f"gate report carries an unknown status {record.get('status')!r}"

    counts = (record.get("pass", 0), record.get("skip", 0),
              record.get("fail", 0), record.get("error", 0))
    detail = "{0} pass, {1} skip, {2} fail, {3} error".format(*counts)
    reason = record.get("reason")
    if reason:
        detail += f" [{reason}]"
    if status == "PASS" and counts[1]:
        detail += " (skips allowed)"
    if status == "QA_BLOCKED":
        detail = "codex_qa adversarial finding -- " + detail
    return status, detail


def _evaluate_one(path: Path, allow_skips: bool, master_root: Path = None,
                  backend: str = None, work_root: Path = None,
                  t0_hashes: dict = None, t0_ignore_sources: dict = None,
                  t0_git_metadata: dict = None) -> SpecResult:
    """Gate ONE spec inside its OWN disposable clone of the sealed per-sweep
    master (F5 round 6), grade that clone's drift and containment against the
    master's t0 snapshot, then destroy the clone. No neighbouring spec ever runs
    in this spec's tree, so nothing -- contract, goldens, or a shared helper
    script -- can be substituted for the question or the answer."""
    slug = _identify_slug(path)
    unsandboxed_note = ""
    unsandboxed = False
    drift = []
    breaches = []
    clone_root = None
    if master_root is not None:
        if translate_to_sandbox(path, master_root) is None:
            # Cannot be sandboxed (resolves outside REPO_ROOT) -- gate in
            # place and say so on the report line, never silently.
            gate_target, cwd = path, REPO_ROOT
            unsandboxed_note = " [un-sandboxed: path resolves outside REPO_ROOT]"
            unsandboxed = True
        else:
            try:
                clone_root = clone_sandbox(master_root, work_root)
            except SandboxError as exc:
                # A per-spec clone that cannot be created is a containment-
                # machinery failure, not a failing spec: ERROR -> exit 2, never
                # the exit 1 reserved for a codex_qa finding, and no traceback.
                return SpecResult(
                    path, slug, "ERROR",
                    f"could not create this spec's disposable sandbox clone ({exc}) "
                    "-- a containment-machinery failure, exit 2 not 1", 0.0, -1)
            gate_target = translate_to_sandbox(path, clone_root)
            cwd = clone_root
    else:
        gate_target, cwd = path, REPO_ROOT
        unsandboxed = True

    elapsed = 0.0
    rc = -1
    status = "ERROR"
    detail = "spec was not evaluated"
    try:
        # A private workdir per spec, and it is now the ONLY writable place a
        # confined check has outside the clone (F5 round 4). It holds a `tmp/`
        # scratch directory that TMPDIR/TMP/TEMP point at. It lives outside
        # REPO_ROOT and the clone alike, so it is not part of either tree and
        # cannot register as drift in either. The grant is per-spec, so nothing
        # in the sweep can reach the manifest.
        workdir = Path(tempfile.mkdtemp(prefix="gate_sweep_report_",
                                        dir=str(work_root) if work_root else None))
        spec_tmpdir = workdir / "tmp"
        spec_tmpdir.mkdir(exist_ok=True)
        cmd = [sys.executable, str(CONTRACT_PY), "gate", str(gate_target), "--phase", "4",
               "--run-checks"]
        if allow_skips:
            cmd.append("--allow-skips")
        # OS-ENFORCED CONFINEMENT (F5 round 3). A check is an ordinary child
        # process with the operator's full filesystem privileges, so an absolute
        # path is the entire exploit; only the OS can revoke the privilege. A
        # spec gated in place (--no-sandbox, or a path that resolves outside
        # REPO_ROOT) is a declared, manifest-visible exception and is NOT
        # confined -- confining it would break the very writes the operator asked
        # for. The write grant is this spec's own clone plus its workdir; no
        # neighbour's clone is reachable, so the round-5 deny-list is gone.
        if not unsandboxed:
            cmd = confine(cmd, backend, clone_root, cwd, workdir)
        t0 = time.monotonic()
        pgid = None
        report_fd = None
        try:
            # THE VERDICT CHANNEL IS A CAPABILITY, NOT A NAME (F5 round 5). The
            # report file is created in the UNGRANTED work root -- one level up
            # from the only directory this spec's checks may write -- and UNLINKED
            # immediately, so no name for it exists anywhere. What crosses into
            # the profile is the open descriptor, which the checks can neither
            # address nor inherit (close_fds). Its lifetime is scoped to the
            # Popen/communicate call (F5 round 6): held only from here to the read
            # below, never across the whole spec, so a low RLIMIT_NOFILE under
            # --jobs N does not accrete one long-lived descriptor per concurrent
            # spec (round-5's regression, @qa's A34).
            report_fd, report_name = tempfile.mkstemp(
                prefix="gate_report_", dir=str(work_root) if work_root else None)
            os.unlink(report_name)
            spawn_cmd = cmd + ["--report-fd", str(report_fd)]
            try:
                # start_new_session: the gate subprocess LEADS ITS OWN PROCESS
                # GROUP, so every descendant it backgrounds is reachable by a
                # single killpg that cannot touch the sweep itself (A25).
                proc = subprocess.Popen(
                    spawn_cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    text=True, env=child_env(spec_tmpdir), start_new_session=True,
                    pass_fds=(report_fd,),
                )
            except OSError as exc:
                # A spawn that fails (EMFILE under fd pressure, the round-5
                # regression @qa reproduced) is a containment-machinery failure,
                # NOT an ordinary failing spec: classify ERROR so it drives the
                # sweep's exit 2, and never let the OSError propagate as a
                # traceback that would exit 1 (A21 widened / A34).
                status = "ERROR"
                detail = (f"could not spawn this spec's gate subprocess "
                          f"({type(exc).__name__}: {exc}) -- a containment-machinery "
                          "failure such as fd exhaustion under --jobs; exit 2, never "
                          "the exit 1 reserved for a codex_qa adversarial finding")
                rc = -1
            else:
                pgid = _spawn_pgid(proc)
                try:
                    _, stderr = proc.communicate(timeout=PER_SPEC_TIMEOUT_SECONDS)
                    rc = proc.returncode
                    status, detail = _classify_from_report(
                        _read_report_fd(report_fd), rc, stderr)
                except subprocess.TimeoutExpired:
                    # Kill the group FIRST here -- the subprocess has not returned
                    # and never will -- then reap, so communicate() cannot block on
                    # pipes held open by a survivor.
                    _kill_process_group(pgid)
                    proc.communicate()
                    rc = -1
                    status = "ERROR"
                    detail = (f"sweep timed out waiting on this spec's gate "
                              f"({PER_SPEC_TIMEOUT_SECONDS}s)")
            elapsed = time.monotonic() - t0
        finally:
            # AFTER the subprocess has returned, never before: a kill that fires
            # early truncates honest slow FOREGROUND work. What this reaps is
            # exactly what should not exist -- a check's backgrounded grandchild
            # outliving the spec that spawned it.
            _kill_process_group(pgid)
            if report_fd is not None:
                try:
                    os.close(report_fd)
                except OSError:
                    pass
            _rmtree_force(workdir)

        # Grade THIS spec's own clone against the master's t0 snapshot, before
        # the clone is destroyed. Containment is re-asserted BEFORE sandbox_drift
        # (which restores the t0 metadata and would repair the evidence). Any
        # failure of the grading machinery is ERROR -> exit 2, never a traceback.
        if clone_root is not None and not unsandboxed:
            try:
                breaches = containment_violations(clone_root)
                drift = sandbox_drift(clone_root, t0_hashes or {},
                                      t0_ignore_sources or {}, t0_git_metadata or {})
            except Exception as exc:  # ANY machinery failure, not only anticipated ones
                status = "ERROR"
                detail = (f"{detail} [containment grading of this spec's clone failed "
                          f"({type(exc).__name__}: {exc}) -- exit 2, never a traceback]")
                drift, breaches = [], []
    except Exception as exc:  # noqa: BLE001 -- _evaluate_one must NEVER raise (A21/A34)
        # A worker thread that raises would propagate out of run_sweep and exit
        # the process with a traceback at exit 1 -- the exact shape A34 forbids
        # (e.g. an OSError/EMFILE from mkdtemp or a subprocess under fd pressure).
        # Any escape is a containment-machinery failure: classify ERROR -> exit 2.
        status = "ERROR"
        detail = (f"the sweep's own machinery failed evaluating this spec "
                  f"({type(exc).__name__}: {exc}) -- a containment-machinery failure; "
                  "exit 2, never the exit 1 reserved for a codex_qa finding")
        rc = -1
        drift, breaches = [], []
    finally:
        if clone_root is not None:
            _rmtree_force(clone_root)
    return SpecResult(path, slug, status, detail + unsandboxed_note, elapsed, rc,
                      unsandboxed, drift=drift, breaches=breaches)


def _emit_line(text: str):
    """Write one complete per-spec line and flush immediately.

    Streaming (not buffer-then-emit) is mandatory: a sweep over the real
    corpus runs for many minutes, and a killed or timed-out run must not
    discard the results it already computed. The whole line is built first
    and written inside a lock, so per-line atomicity -- which is all the
    --jobs N interleaving concern ever required -- still holds.
    """
    with _PRINT_LOCK:
        print(text, flush=True)


def run_sweep(specs_root: Path, jobs: int, allow_skips: bool, emit=None,
              master_root: Path = None, backend: str = None,
              work_root: Path = None, t0_hashes: dict = None,
              t0_ignore_sources: dict = None, t0_git_metadata: dict = None):
    specs = discover(specs_root)
    t_start = time.monotonic()
    results = []

    def _record(result: SpecResult):
        results.append(result)
        if emit is not None:
            emit(format_result_line(result))

    def _one(path):
        return _evaluate_one(path, allow_skips, master_root, backend, work_root,
                             t0_hashes, t0_ignore_sources, t0_git_metadata)

    if jobs <= 1:
        for path in specs:
            _record(_one(path))
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
            futures = {pool.submit(_one, path): path for path in specs}
            for fut in concurrent.futures.as_completed(futures):
                _record(fut.result())
    wall_clock = time.monotonic() - t_start

    results.sort(key=lambda r: str(r.path))
    return results, wall_clock


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def format_result_line(result: SpecResult) -> str:
    """One spec, one complete line: an EXPLICIT status token plus the spec's
    identifying slug. Status is never inferred from the absence of a bad word
    (DECISIONS.md "Never trust the absence of a bad word")."""
    return (f"{result.status:<11} {result.slug} [{_rel(result.path)}] "
            f"({result.elapsed:.2f}s) -- {result.detail}")


def render_summary(results, wall_clock: float, specs_root: Path) -> str:
    """The trailing summary block. Per-spec lines are streamed as each spec
    completes, so this block names no spec -- keeping exactly one line per
    spec in the whole report."""
    lines = []
    counts = {s: 0 for s in STATUSES}
    for r in results:
        counts[r.status] += 1

    lines.append("=" * 72)
    lines.append(f"Gate sweep: {len(results)} specs discovered under {specs_root}")
    lines.append(
        "  " + "  ".join(f"{s}={counts[s]}" for s in STATUSES)
    )
    lines.append(f"  wall-clock elapsed: {wall_clock:.2f}s")
    lines.append("=" * 72)
    return "\n".join(lines)


def aggregate_exit_code(results) -> int:
    counts = {s: 0 for s in STATUSES}
    for r in results:
        counts[r.status] += 1
    if counts["INVALID"] > 0 or counts["ERROR"] > 0:
        return 2
    if counts["FAIL"] > 0 or counts["QA_BLOCKED"] > 0:
        return 1
    return 0


def _write_manifest(manifest_path: Path, *, sandboxed, sandbox_path, sandbox_coverage,
                     unsandboxed_specs, head, tree_fp, drift, real_fp_before, real_fp_after,
                     results, wall_clock, exit_code, containment, containment_backend,
                     containment_violations_found):
    counts = {s: 0 for s in STATUSES}
    for r in results:
        counts[r.status] += 1
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sandboxed": sandboxed,
        "sandbox_path": str(sandbox_path) if sandbox_path is not None else None,
        "sandbox_coverage": sandbox_coverage,
        # HOW the gate subprocesses were contained, in the machine-readable
        # channel F3 actually reads. Whether they were OS-confined or merely
        # audited afterwards is the single most important fact about a sweep's
        # trustworthiness, and a platform without a backend must say so LOUDLY
        # rather than present an audited sweep as a contained one.
        "containment": containment,
        "containment_backend": containment_backend,
        # WHAT is contained, bounded where it is consumed (F5 round 4). The
        # profile is `(allow default)` + `(deny file-write*)`: "os-enforced"
        # reads far broader than what it enforces, and it is the exact phrase a
        # downstream consumer over-reads. Narrow the claim rather than widen
        # the enforcement -- checks legitimately read the whole repository,
        # shell out to git and may reach the network, so there is no enumerable
        # read set, and F5's charter is mutation.
        "containment_scope": CONTAINMENT_SCOPE,
        "containment_unconfined": list(CONTAINMENT_UNCONFINED),
        # The two round-6 caveats, verbatim, in the channel F3 reads: the
        # corrected post-sweep-forensics bound (per-spec isolation, not the false
        # "unwritable tree" one) and the Seatbelt ps-table blindness that is a
        # property of the profile rather than a guarantee F5 offers.
        "containment_notes": [_POST_SWEEP_FORENSICS_JUSTIFICATION,
                              _PS_TABLE_BLINDNESS_NOTE],
        "containment_violations": containment_violations_found,
        "unsandboxed_specs": unsandboxed_specs,
        "head": head,
        "tree_fingerprint": tree_fp,
        "sandbox_drift": drift,
        # Advisory real-tree canary (DECISIONS.md "F5 round 2" -- moved from
        # stderr into the machine-readable channel F3 actually reads). NEVER
        # affects exit_code above: real-tree drift is unattributable while
        # other agents are active in this repo.
        "real_tree_fingerprint_before": real_fp_before,
        "real_tree_fingerprint_after": real_fp_after,
        "real_tree_changed": real_fp_before != real_fp_after,
        "specs": [
            {"path": _rel(r.path), "slug": r.slug, "status": r.status, "detail": r.detail}
            for r in results
        ],
        "counts": counts,
        "wall_clock_seconds": wall_clock,
        "exit_code": exit_code,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="Run every contract*.yaml's Phase 4 gate, live, repo-wide."
    )
    parser.add_argument(
        "--specs-root", type=Path, default=DEFAULT_SPECS_ROOT,
        help="Root dir to glob contract*.yaml under (default: .agent/memory/project/specs)",
    )
    parser.add_argument(
        "--jobs", type=int, default=1,
        help="Bounded parallelism: number of specs to gate concurrently (default: 1)",
    )
    parser.add_argument(
        "--allow-skips", action="store_true", default=False,
        help="Pass --allow-skips through to each spec's contract.py gate call",
    )
    parser.add_argument(
        "--no-sandbox", action="store_true", default=False,
        help="Gate in place against the real working tree. Explicit operator opt-out of "
             "the default sandbox; never an automatic fallback.",
    )
    parser.add_argument(
        "--sandbox-dir", type=Path, default=Path(tempfile.gettempdir()),
        help="Parent directory under which the disposable sandbox copy is created "
             "(default: system temp)",
    )
    parser.add_argument(
        "--manifest", type=Path, default=None, metavar="PATH",
        help="Write the athanor.gate-sweep/v1 JSON manifest to PATH. PATH must not "
             "resolve inside the sandbox or inside the sweep's per-spec workdirs -- the "
             "artifact F3 consumes may not be writable by the checks being graded.",
    )
    args = parser.parse_args()

    if args.jobs < 1:
        print("ERROR: --jobs must be >= 1", file=sys.stderr)
        sys.exit(2)
    if not args.specs_root.exists():
        print(f"ERROR: --specs-root does not exist: {args.specs_root}", file=sys.stderr)
        sys.exit(2)

    # ONE sweep-level root holding every per-spec workdir (F5 round 4). Each
    # spec's own subdirectory of this is the ONLY place outside the sandbox its
    # confined gate subprocess may write, so the roots the sweep must keep out
    # of the manifest's way are known before any bytes are copied.
    _reap_stale_sandboxes(Path(tempfile.gettempdir()), prefix="gate_sweep_work_")
    try:
        work_root = Path(tempfile.mkdtemp(prefix="gate_sweep_work_"))
    except OSError as exc:
        print(f"ERROR: could not create the sweep's per-spec workdir root: {exc}",
              file=sys.stderr)
        sys.exit(2)
    try:
        _reject_manifest_inside_grant(args.manifest, [work_root])
    except SandboxError as exc:
        shutil.rmtree(work_root, ignore_errors=True)
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(2)

    sandbox_root = None
    backend = None
    containment = CONTAINMENT_NONE
    containment_backend = BACKEND_NONE
    t0_hashes = {}
    t0_ignore_sources = {}
    t0_git_metadata = {}
    # Advisory-only canary on the REAL tree, computed regardless of sandbox
    # mode. Never affects the exit code: ambient agent activity in this repo
    # makes real-tree drift unattributable by nature (DECISIONS.md "Ambient
    # drift"). It is the detector for a sandbox ESCAPE specifically (P2-A):
    # a spec gated in place because it could not be translated writes to the
    # real tree at exit 0, and this is the only channel that can say so. It
    # includes IGNORED paths (round-2 P2-3) -- unlike tree_fingerprint below,
    # whose definition F3's freshness parity depends on and must not move.
    real_fp_before = tree_fingerprint(REPO_ROOT, include_ignored=True)
    if not args.no_sandbox:
        backend = detect_containment_backend()
        if backend is None:
            # DEGRADE LOUDLY. A6's rule applied to the new layer: containment
            # machinery that is not there must never read as normal operation.
            containment, containment_backend = CONTAINMENT_AUDIT_ONLY, BACKEND_NONE
            print("WARNING: no OS confinement backend is available on this platform "
                  "(sandbox-exec on darwin, bwrap on linux). This sweep is "
                  "audit-only: an escaping check is DETECTED AFTER THE FACT, not "
                  "prevented. Three rounds of after-the-fact detection produced three "
                  "escapes -- treat this sweep's containment claims accordingly.",
                  file=sys.stderr, flush=True)
        else:
            containment, containment_backend = CONTAINMENT_OS_ENFORCED, backend
        try:
            sandbox_root = make_sandbox(args.sandbox_dir, manifest_path=args.manifest)
        except SandboxError as exc:
            # FAIL LOUD, NEVER FALL BACK: an uncreatable sandbox aborts the
            # sweep outright. Running in place is only ever --no-sandbox, an
            # explicit operator choice made before the sweep starts.
            shutil.rmtree(work_root, ignore_errors=True)
            print(f"ERROR: could not create disposable sandbox: {exc}", file=sys.stderr)
            sys.exit(2)
        try:
            t0_hashes = snapshot_dirty_content(sandbox_root)
            t0_ignore_sources = _collect_ignore_sources(sandbox_root)
            t0_git_metadata = _collect_git_metadata(sandbox_root)
        except Exception as exc:  # ANY machinery failure, not only the anticipated ones
            shutil.rmtree(sandbox_root, ignore_errors=True)
            shutil.rmtree(work_root, ignore_errors=True)
            print(f"ERROR: the containment machinery failed while snapshotting the "
                  f"sandbox at t0 ({type(exc).__name__}: {exc}). A failure of the "
                  "machinery exits 2, never the softer 1 -- exit 1 means an ordinary "
                  "failing spec.", file=sys.stderr)
            sys.exit(2)

    try:
        gate_root = sandbox_root if sandbox_root is not None else REPO_ROOT
        tree_fp = tree_fingerprint(gate_root)
        head = (_git(gate_root, "rev-parse", "HEAD").strip() or "NO-HEAD")

        results, wall_clock = run_sweep(
            args.specs_root, args.jobs, args.allow_skips, emit=_emit_line,
            master_root=sandbox_root, backend=backend, work_root=work_root,
            t0_hashes=t0_hashes, t0_ignore_sources=t0_ignore_sources,
            t0_git_metadata=t0_git_metadata)

        if not results:
            print(f"ERROR: no contract*.yaml files found under {args.specs_root}",
                  file=sys.stderr)
            sys.exit(2)

        # Drift and containment are graded PER SPEC now (F5 round 6): each spec's
        # own clone is graded against the master's t0 snapshot inside
        # _evaluate_one, before that clone is destroyed. Aggregate the per-spec
        # findings here for the manifest and the exit code -- the union across
        # specs is exactly what the once-per-sweep grading produced when every
        # spec shared one copy, minus the cross-spec forgery that sharing enabled.
        # A grading-machinery failure inside a clone surfaces as that spec's
        # status=ERROR, which already drives exit 2 via aggregate_exit_code.
        drift = sorted({rel for r in results for rel in r.drift})
        breaches = sorted({b for r in results for b in r.breaches})
        if sandbox_root is not None:
            if breaches:
                print("CONTAINMENT VIOLATION (an invariant that held when a spec's clone "
                      "was created no longer holds at the end of that spec's gate -- a "
                      "check re-armed a reference out of the sandbox; a `.git` pointer "
                      "neutralised once at t0 is not containment):", flush=True)
                for breach in breaches:
                    print(f"  {breach}", flush=True)
            if drift:
                print("SANDBOX DRIFT (non-ignored paths changed inside a disposable "
                      "per-spec sandbox -- reported by name, never swallowed):", flush=True)
                for rel in drift:
                    print(f"  {rel}", flush=True)

        real_fp_after = tree_fingerprint(REPO_ROOT, include_ignored=True)
        if real_fp_after != real_fp_before:
            print("ADVISORY: the real working tree changed during this sweep. This is "
                  "unattributable (other agents may be active) and does not affect the "
                  "exit code.", file=sys.stderr, flush=True)

        # sandbox_coverage is a tri-state on its OWN key so `sandboxed` keeps
        # its boolean type for existing consumers. unsandboxed_specs names
        # every spec gated against the real tree, never just counts them.
        unsandboxed_specs = [_rel(r.path) for r in results if r.unsandboxed]
        if sandbox_root is None:
            sandbox_coverage = "none"
        elif unsandboxed_specs:
            sandbox_coverage = "partial"
        else:
            sandbox_coverage = "full"

        print(render_summary(results, wall_clock, args.specs_root), flush=True)
        exit_code = aggregate_exit_code(results)
        if drift or breaches:
            # Both are failures of the machinery or of containment, never of a
            # spec: exit 2, never the softer 1.
            exit_code = max(exit_code, 2)

        if args.manifest is not None:
            _write_manifest(
                args.manifest,
                sandboxed=sandbox_root is not None,
                sandbox_path=sandbox_root,
                sandbox_coverage=sandbox_coverage,
                unsandboxed_specs=unsandboxed_specs,
                head=head,
                tree_fp=tree_fp,
                drift=drift,
                real_fp_before=real_fp_before,
                real_fp_after=real_fp_after,
                results=results,
                wall_clock=wall_clock,
                exit_code=exit_code,
                containment=containment,
                containment_backend=containment_backend,
                containment_violations_found=breaches,
            )

        sys.exit(exit_code)
    finally:
        if sandbox_root is not None:
            _rmtree_force(sandbox_root)
        _rmtree_force(work_root)


if __name__ == "__main__":
    main()

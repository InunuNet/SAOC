#!/usr/bin/env python3
"""
update_template.py — Safe harness update driver.

Reads .agent/update-manifest.yaml and applies harness updates
from a source directory, respecting HARNESS/WORKSPACE/DERIVED/MERGE boundaries.

Usage:
  python3 execution/update_template.py [--dry-run] [--apply] [--source DIR]

Default mode is --dry-run (safe, read-only). Pass --apply to write changes.
"""
import argparse
import base64
import errno
import fnmatch
import hashlib
import json
import os
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path


# Baseline hash store for the HARNESS overwrite guard (GitHub issue #104).
# Flat JSON map of manifest "path" string -> sha256 hex digest of the content
# last written to that path FROM the template/upstream source. Used to detect
# whether a HARNESS file has in-flight local modifications since the last
# sync before silently clobbering it.
TEMPLATE_BASELINES_PATH = Path(".agent/memory/scratch/template_baselines.json")

# Operator opt-in allow-list for the symlink guard (update-template-write-
# safety-hardening F2). Plain-text, one fnmatch pattern per line, same
# comment/blank-line-skipping convention as .agent/no-update. Off by default
# -- when this file doesn't exist, _refuse_symlinked_write() behaves exactly
# as before this feature.
ALLOWED_SYMLINKS_PATH = Path(".agent/allowed-symlinks")

# Populated once by main() (persistent file + any --allow-symlink CLI
# values) before the first write-capable guard call in a real --apply run.
# _refuse_symlinked_write() reads this module-level list directly so the
# opt-in is enforced at the single shared choke-point without touching any
# of its ~15 call sites individually.
_ALLOWED_SYMLINK_PATTERNS: list[str] = []

# Applied-version state file (issue #1293 follow-on) — direct-write updater-owned
# state, tracked outside .agent/update-manifest.yaml entirely (same pattern as
# .agent/version itself). Written on EVERY --apply run (delivery-integrity F4b),
# carrying a "delivery" field of "complete" or "partial" plus the withheld/failed
# paths, so the stamp describes what actually landed instead of freezing at an
# old value on exactly the runs that delivered most of their content.
TEMPLATE_STATE_PATH = Path(".agent/.template_state")

# Workspace-provenance field inside .agent/.template_state (delivery-integrity
# F4b addendum). The stamp is a TRACKED file, so every clone and fork of a
# harness repo inherits the upstream workspace's stamp as its own: a checkout
# that has never applied anything starts life asserting that it has, and the
# receipt looks perfectly current because bump_version.sh keeps it moving. An
# inherited stamp reads as HIGH confidence to _stamp_is_high_confidence() and
# can drive a hard refusal on a workspace it says nothing about.
#
# Gitignoring the file was rejected: it makes an inherited stamp less likely
# while leaving it exactly as undetectable, and does nothing about the stamps
# already sitting in every existing clone. Identity flags those on the very
# next read, with no migration.
#
# ABSENCE OF IDENTITY IS THE INHERITED SIGNATURE, not a compatibility
# exemption. Every stamp written before this feature — including the one
# committed in this repo — carries no identity, which is exactly the
# population that must stop being trusted. There is deliberately no
# "unstamped means local" escape hatch.
WORKSPACE_IDENTITY_FIELD = "workspace_id"

# How far .agent/.template_state may trail local .agent/version, in patch
# releases, before it stops being trustworthy evidence about upstream
# (delivery-integrity F4). Consulted ONLY when the incoming version sorts
# BELOW the stamp: a healthy consumer restamps on every --apply, so more than
# a handful of patch releases of drift means deliveries are not landing or not
# stamping — which is a fact about this workspace, not about upstream. Its
# only effect is to DOWNGRADE a hard refusal to a warning, so erring generous
# is the safe direction.
STAMP_STALENESS_PATCH_LIMIT = 5


def _sha256_of_file(path: Path) -> str:
    """Return the sha256 hex digest of a file's current byte content."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_template_baselines(store_path: Path = TEMPLATE_BASELINES_PATH) -> dict:
    """Load the HARNESS baseline hash store.

    Missing file, missing directory tree, or corrupt/malformed JSON all
    degrade gracefully to "no baselines recorded" (empty dict) — this must
    never raise or block the update.
    """
    if not store_path.exists():
        return {}
    try:
        data = json.loads(store_path.read_text())
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return data


def save_template_baselines(baselines: dict, store_path: Path = TEMPLATE_BASELINES_PATH) -> None:
    """Write the baseline hash store, creating parent directories as needed.

    Also serves as the self-heal path: a corrupt store gets overwritten with
    a fresh, valid one the next time a baseline is recorded.

    Symlink refusal (template-update-actually-updates F10, #11): lower
    blast radius than a HARNESS delivery (this is our own bookkeeping, and
    a refused write here just means the baseline that would have been
    recorded is not, which degrades to F5's already-safe "no record ->
    treat as diverged" default), but the missing-check pattern is
    identical, so it is closed for consistency. No caller inspects this
    function's return value, so a refusal degrades silently to a no-op
    write, exactly like the pre-existing corrupt-store degrade path.
    """
    if _refuse_symlinked_write(store_path, "template baseline store"):
        return
    store_path.parent.mkdir(parents=True, exist_ok=True)
    _write_text_nofollow(
        store_path, json.dumps(baselines, indent=2, sort_keys=True) + "\n",
        "template baseline store",
    )


# Critical harness files that MUST exist in any onboarded workspace.
# Backstop pass guarantees these land even when the main manifest loop is
# bypassed by (a) .agent/no-update protection on a covering glob, (b) gh fetch
# fallback to a missing template/ dir, or (c) downstream that never ran
# update_template.py during initial onboard.
REQUIRED_FILES: list[str] = [
    "execution/handoff_check.py",
    "execution/mission.py",
    "execution/contract.py",
    ".agent/handoffs.yaml",
]


def _contains_symlink_component(path: Path, stop_at: Path) -> tuple[bool, Path | None]:
    """Walk `path`'s ancestor chain (leaf first, inclusive) up to and
    including `stop_at`, returning (True, offending_component) if ANY
    component in that chain is itself a symlink -- not just the leaf.

    `stop_at` is normally the workspace root (Path.cwd() when this script
    runs) — every write this script performs targets a path under it, so
    checking further up the filesystem than that adds nothing. Relative vs.
    absolute symlink targets make no difference (is_symlink()/lstat do not
    distinguish target format).

    This is the SINGLE walk implementation (template-update-actually-
    updates F10) reused by _sync_file_with_guard()'s leaf check,
    copy_harness()'s and apply_fresh_manifest_backstop()'s directory
    branches (checked once against the entry root itself before entering),
    and merge_line_union()/merge_json_deep() (which had ZERO symlink
    awareness at any level before this fix) -- so the ancestor-walk logic
    exists once, not reimplemented at each call site.
    """
    p = path if path.is_absolute() else Path.cwd() / path
    try:
        stop_resolved = stop_at.resolve()
    except OSError:
        stop_resolved = stop_at if stop_at.is_absolute() else Path.cwd() / stop_at

    for comp in [p] + list(p.parents):
        try:
            comp_resolved = comp.resolve()
        except OSError:
            comp_resolved = comp
        if comp_resolved == stop_resolved:
            break
        if comp.is_symlink():
            return True, comp
    return False, None


def _describe_symlink_target(offending: Path) -> str:
    """Format an offending symlink component's resolved (or unresolvable) target."""
    try:
        return str(offending.resolve())
    except OSError:
        return f"{os.readlink(offending)} (unresolvable)"


def _load_allowed_symlinks(path: Path = ALLOWED_SYMLINKS_PATH) -> list[str]:
    """Load the operator opt-in allow-list for _refuse_symlinked_write()
    (update-template-write-safety-hardening F2), following the same
    comment/blank-line-skipping plain-text convention as the .agent/no-update
    loader in main(). Returns an empty list when the file doesn't exist --
    the opt-in is off by default, and default (opt-in-unset) behavior stays
    byte-for-byte unchanged.
    """
    patterns: list[str] = []
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                patterns.append(line)
    return patterns


def _is_allowed_symlink(offending: Path, patterns: list[str], stop_at: Path) -> bool:
    """Check whether `offending` -- the actual symlinked ancestor component
    _contains_symlink_component() flagged, not necessarily the leaf write
    target -- matches an operator-declared allow-list pattern.

    Matches `offending`'s path relative to `stop_at` (the same relative form
    operators write in .agent/allowed-symlinks, e.g. ".agent/memory/scratch")
    against each pattern with the same fnmatch-or-exact-match rule main()'s
    is_protected() already uses for .agent/no-update. Because `offending` is
    the symlinked component itself, an allow-listed ancestor still matches
    when a deeper file under it is the real write target.
    """
    if not patterns:
        return False
    try:
        stop_resolved = stop_at.resolve()
    except OSError:
        stop_resolved = stop_at if stop_at.is_absolute() else Path.cwd() / stop_at
    try:
        rel_str = str(offending.relative_to(stop_resolved))
    except ValueError:
        rel_str = str(offending)
    for pattern in patterns:
        if fnmatch.fnmatch(rel_str, pattern) or rel_str == pattern:
            return True
    return False


def _refuse_symlinked_write(path: Path, label: str, stop_at: Path | None = None) -> bool:
    """Full-path symlink guard shared by every write site in this file
    (template-update-actually-updates F10, extended beyond contract-f5's 6
    rows to all ~15 write-to-destination sites enumerated from source: the
    HARNESS delivery/backstop paths, the MERGE category, the state-file
    writers (update_profile_version, write_template_state,
    save_template_baselines), and backup creation itself).

    Checks `path`'s full ancestor chain via _contains_symlink_component();
    if any component is a symlink, prints a standard WARN naming `label`
    (the caller's description of what was being written), the offending
    component, and its resolved target, and returns True (caller MUST
    refuse the write -- never unlink-and-replace). Returns False when the
    path is clear to write.
    """
    stop_at = stop_at if stop_at is not None else Path.cwd()
    contains_symlink, offending = _contains_symlink_component(path, stop_at=stop_at)
    if not contains_symlink:
        return False
    target_desc = _describe_symlink_target(offending)
    if _is_allowed_symlink(offending, _ALLOWED_SYMLINK_PATTERNS, stop_at):
        print(
            f"  INFO  {label} is reached through a symlink at {offending} -> "
            f"{target_desc} — proceeding (allow-listed via "
            f"{ALLOWED_SYMLINKS_PATH} or --allow-symlink)."
        )
        return False
    print(
        f"  WARN  {label} is reached through a symlink at {offending} -> "
        f"{target_desc} — REFUSING to write through a symlinked "
        "destination (would write content to an external, potentially "
        "attacker- or operator-controlled path). Replace or remove the "
        "symlink manually, then re-run, if this path should hold "
        "canonical content."
    )
    return True


def _open_fd_nofollow(path: Path, label: str, stop_at: Path | None = None) -> int | None:
    """Fd-pinned successor to _refuse_symlinked_write() (update-template-
    write-safety-hardening F3) that closes the check-then-write TOCTOU
    window: the ancestor-walk check and the write now happen against the
    SAME open() syscall/fd instead of a path-string check followed by a
    separately re-resolved write call.

    Runs the identical ancestor-walk check _refuse_symlinked_write() uses
    (same helper, same messages, same F2 allow-list consultation):
      - Symlink found, NOT allow-listed -> WARN, return None (refused).
      - Symlink found, allow-listed -> INFO, open the leaf WITHOUT
        O_NOFOLLOW (follows the symlink, writes through it) -- required so
        F2's operator-authorized escape hatch keeps working unchanged.
      - No symlink found at check time -> open the leaf WITH O_NOFOLLOW.
        If the leaf was swapped for a symlink in the race window between
        the check above and this exact syscall, the kernel refuses to
        follow it and raises OSError(errno.ELOOP) -- caught explicitly and
        treated as a refusal, same as a normal symlink-refusal WARN. Any
        other OSError is a real, unrelated filesystem error and propagates.

    Returns a writable fd on success, or None if refused.
    """
    stop_at = stop_at if stop_at is not None else Path.cwd()
    contains_symlink, offending = _contains_symlink_component(path, stop_at=stop_at)
    if contains_symlink:
        target_desc = _describe_symlink_target(offending)
        if _is_allowed_symlink(offending, _ALLOWED_SYMLINK_PATTERNS, stop_at):
            print(
                f"  INFO  {label} is reached through a symlink at {offending} -> "
                f"{target_desc} — proceeding (allow-listed via "
                f"{ALLOWED_SYMLINKS_PATH} or --allow-symlink)."
            )
            return os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
        print(
            f"  WARN  {label} is reached through a symlink at {offending} -> "
            f"{target_desc} — REFUSING to write through a symlinked "
            "destination (would write content to an external, potentially "
            "attacker- or operator-controlled path). Replace or remove the "
            "symlink manually, then re-run, if this path should hold "
            "canonical content."
        )
        return None

    try:
        return os.open(
            str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o644
        )
    except OSError as e:
        if e.errno == errno.ELOOP:
            print(
                f"  WARN  {label} was swapped for a symlink between the "
                "ancestor check and the write (race window) — REFUSING to "
                "write through a symlinked destination."
            )
            return None
        raise


def _write_text_nofollow(path: Path, text: str, label: str, stop_at: Path | None = None) -> bool:
    """Fd-pinned replacement for the "_refuse_symlinked_write() then
    Path.write_text()" pattern. Returns True on success, False if refused
    (symlinked destination, not allow-listed, or swapped mid-race)."""
    fd = _open_fd_nofollow(path, label, stop_at=stop_at)
    if fd is None:
        return False
    with os.fdopen(fd, "w") as f:
        f.write(text)
    return True


def _copy2_nofollow(src: Path, dst: Path, label: str, stop_at: Path | None = None) -> bool:
    """Fd-pinned replacement for the "_refuse_symlinked_write() then
    shutil.copy2()" pattern. Preserves shutil.copy2()'s mode/mtime copy
    semantics via fchmod/utime on the already-open fd. Returns True on
    success, False if refused (symlinked destination, not allow-listed, or
    swapped mid-race)."""
    fd = _open_fd_nofollow(dst, label, stop_at=stop_at)
    if fd is None:
        return False
    src_stat = os.stat(src)
    with os.fdopen(fd, "wb") as f:
        with open(src, "rb") as sf:
            shutil.copyfileobj(sf, f)
        f.flush()
        os.fchmod(f.fileno(), stat.S_IMODE(src_stat.st_mode))
        os.utime(f.fileno(), ns=(src_stat.st_atime_ns, src_stat.st_mtime_ns))
    return True


class BackupDirRefused(Exception):
    """Raised by _create_guarded_backup_dir() when the constructed backup
    directory's own ancestor chain contains a symlink. This function never
    decides what "refused" means for the caller's run -- main()'s --apply
    aborts the whole run over it; cmd_reconcile_from_history() degrades to
    "delivery deferred" for this run, same as an unavailable live tree.
    """


def _create_guarded_backup_dir(prefix: str) -> Path:
    """Construct, symlink-check, and mkdir a fresh timestamped backup
    directory under .agent/memory/scratch/ -- the single implementation
    shared by main()'s --apply backup_dir and cmd_reconcile_from_history()'s
    reconcile-backup dir (template-update-actually-updates F14). Lowest
    severity of the write sites this mission has closed (the timestamp
    component is partially unpredictable), but .agent/memory/scratch/
    itself is a fixed, predictable, symlinkable path an attacker can plant
    ahead of any run, so it gets the same ancestor-walk check as every
    other write site here.

    `prefix` is the label before the timestamp (e.g. "update-backup",
    "reconcile-backup"); the timestamp is generated fresh on every call so
    two calls never collide.

    Raises BackupDirRefused (never returns a partially-created directory)
    if any component of the resulting path's ancestor chain, up to the
    workspace root, is a symlink.
    """
    ts = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    backup_dir = Path(f".agent/memory/scratch/{prefix}-{ts}")
    if _refuse_symlinked_write(backup_dir, f"{prefix} directory"):
        raise BackupDirRefused(str(backup_dir))
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def _sync_file_with_guard(
    src_file: Path, dst_file: Path, backup_dir: Path | None, baseline_key: str,
    force: bool = False, predict: bool = False,
    refused_out: list[str] | None = None,
    untracked_out: list[str] | None = None,
) -> str:
    """Single point of write for one HARNESS file (issue #104, round 2; force=
    True path is issue #1348's remediation / F6).

    Checks the baseline-hash guard for dst_file, then either backs up + copies
    src_file over it and refreshes the baseline, or WARNs and leaves dst_file
    byte-for-byte untouched. Both copy_harness()'s single-file branch and its
    directory/rglob branch route every individual file write through this
    helper, so the guard applies uniformly and is independent of manifest
    entry order — a directory entry can never clobber a file before a later
    file-level entry's own guard would have run, because the check lives here,
    at the point of write, not in the manifest-loop dispatch.

    force=True bypasses the guard for THIS baseline_key only, when (and only
    when) this function actually reaches the guarded branch below — the
    caller (main()) only ever invokes copy_harness()/this function from the
    --apply code path; the --dry-run branch of the manifest loop never calls
    into copy_harness at all, so passing --force-path without --apply can
    never write anything, by construction, not by an extra check here. A
    backup is still taken before a forced overwrite, exactly like the normal
    unguarded path below — --force-path's entire purpose is to deliberately
    destroy a local hand-patch, and the backup is the cheap, unconditional
    undo for that irreversible-by-default action; there is no reason to skip
    it just because the guard was bypassed.

    Returns "copied", "unchanged", "skipped", or "forced". "forced" is
    returned ONLY when the guard-bypass branch below actually fired (a local
    baseline mismatch was found and force=True let it through) — never
    merely because the caller passed force=True. A --force-path name for a
    file with no local modifications (or no baseline recorded yet, e.g. a
    fresh delivery that was never installed locally) has nothing to force;
    reporting "forced" for that case would announce that local modifications
    were cleared when none existed, which is exactly the kind of overstated
    success this feature exists to eliminate, not reproduce.

    predict=True (template-update-actually-updates F10) runs every decision
    branch below exactly as normal -- symlink refusal, byte-identical
    short-circuit, baseline-hash divergence check, --force-path bypass --
    and returns the SAME outcome vocabulary, but suppresses every actual
    write (backup copy, destination write, baseline-store update). This is
    the single point of write AND the single point of prediction: --dry-run
    calls this exact function (via predict_harness() below) instead of
    re-deriving a second, independently maintained guess from
    src_path.exists(), which is how the preview and the real --apply
    outcome silently drifted apart in the first place.

    untracked_out (baseline-guard-clearability F1/D1) is an optional
    accumulator, parallel to refused_out: every baseline_key withheld
    because it carries NO recorded baseline (as opposed to a real baseline
    mismatch) is appended to it. "No record of whether this file ever
    diverged" is a state distinct from "this file was locally modified" --
    conflating the two is exactly what made Omarchy's byte-identical,
    never-edited execution/bump_version.sh read as a local hand-edit and
    get withheld forever. main() uses this list to annotate the WITHHELD
    report honestly and to decide whether .agent/.template_state needs a
    `reconcile_from` anchor written (see write_template_state()).
    """
    guard_bypassed = False

    # Symlink refusal (template-update-actually-updates F8 EDGE 1, extended to
    # full-path ancestor checking by F10) -- checked FIRST, unconditionally,
    # before anything else in this function. A HARNESS destination reached
    # through a symlink -- whether the leaf itself, an intermediate directory,
    # or the manifest entry root -- is a write-target-confusion / potential
    # escape hazard, not a staleness question: Path.is_file() returns True for
    # a symlink pointing at a regular file (and normal OS path resolution
    # transparently follows a symlinked ANCESTOR directory before ever
    # lstat-ing the leaf), so without a full-chain check a legitimate row-C
    # write (local matches baseline, incoming differs -- exactly the case F5
    # delivers freely) would fall through to shutil.copy2() below, which
    # follows symlinks and writes attacker- or operator-controlled content to
    # whatever external path the link resolves to, possibly outside the
    # workspace entirely. Refuse unconditionally -- this is NOT bypassable via
    # --force-path (force clears a recorded/no-record content divergence; it
    # does not authorize redirecting a write through an arbitrary external
    # target) and never silently unlinks-and-replaces the link, since an
    # operator may have created it deliberately. Name the path AND its
    # resolved target so the operator can act explicitly.
    if _refuse_symlinked_write(dst_file, baseline_key):
        print(f"  ({baseline_key}: refusal above is NOT overridable via --force-path)")
        # delivery-integrity F4c-2: recorded in its OWN bucket, not merged into
        # the ordinary withheld one. This is a security event about the write
        # PATH, not a content disagreement, and the two must stay separable all
        # the way to the terminal report and the exit code.
        if refused_out is not None and baseline_key not in refused_out:
            refused_out.append(baseline_key)
        return "skipped"

    if dst_file.exists() and dst_file.is_file():
        # Idempotency short-circuit: if dst already holds byte-identical
        # content to src, there is nothing to sync — skip the backup +
        # rewrite entirely so a second --apply run on an already-current
        # workspace is a true no-op (no new backup-dir entries, no touched
        # mtimes). Applies whether or not force was requested — there is
        # nothing to force when dst already matches src.
        try:
            dst_hash = _sha256_of_file(dst_file)
            if dst_hash == _sha256_of_file(src_file):
                # F11: this is the ONE moment a baseline can be recorded for
                # free -- content already matches upstream, so nothing is at
                # risk. Returning "unchanged" without recording it (the old
                # behavior) is a dead end: an operator who hand-edits a
                # diverged file to exactly match upstream gets a clean-
                # looking "unchanged" and no baseline, so the NEXT genuine
                # upstream advance finds no record and refuses all over
                # again, forever. Gated on `not predict` like every other
                # write in this function (F10), and only writes when the
                # stored value is actually missing/stale -- an
                # already-correct record is left untouched (no pointless
                # store rewrite on every byte-identical hit).
                if not predict:
                    # Best-effort baseline recording, guaranteed-correct
                    # verdict: scoped to its OWN try/except, separate from
                    # the outer one above (which exists for the hash
                    # comparison, not for this). save_template_baselines()
                    # can raise OSError (e.g. a read-only or full
                    # .agent/memory/scratch/) -- if it does, that must NOT
                    # fall through to the outer except and skip past
                    # `return "unchanged"` below into the diverged/no-record
                    # branch, which would then report a false "no baseline,
                    # differs from incoming" refusal for content already
                    # proven byte-identical.
                    try:
                        baselines = load_template_baselines()
                        if baselines.get(baseline_key) != dst_hash:
                            baselines[baseline_key] = dst_hash
                            save_template_baselines(baselines)
                    except OSError:
                        pass
                return "unchanged"
        except OSError:
            pass

        baselines = load_template_baselines()
        baseline_hash = baselines.get(baseline_key)
        try:
            current_hash = _sha256_of_file(dst_file)
        except OSError:
            current_hash = None

        if baseline_hash:
            diverged = current_hash is not None and current_hash != baseline_hash
            no_record = False
        else:
            # No recorded baseline (template-update-actually-updates F5): the
            # store may be absent entirely, missing this key, corrupt/
            # unparseable, or present-but-empty -- load_template_baselines()
            # already collapses all four to the same falsy baseline_hash, so
            # they reach this branch identically, by construction, not by
            # four coincidentally-matching special cases.
            #
            # "No record of whether this file ever diverged" is NOT the same
            # claim as "this file has never diverged" -- only the second is
            # safe to act on by overwriting. The byte-identical short-circuit
            # above already handled the one truly safe no-record case (local
            # already matches incoming, nothing to lose); reaching this far
            # means local DIFFERS from incoming with no history to consult,
            # so the conservative default is to treat it exactly like a
            # confirmed divergence -- skip, WARN, name --force-path -- rather
            # than silently overwrite content that might be a real, precious,
            # never-synced hand-edit (GH #1343's failure mode arriving
            # through the no-baseline door instead of the old whole-directory
            # skip this mission already closed).
            diverged = current_hash is not None
            no_record = True

        if diverged:
            if not force:
                # Shell-quoted for the "Re-run with ..." suggestions below: a
                # manifest path containing a space would otherwise be pasted
                # back as two wrong targets. Ordinary paths are unchanged.
                quoted_key = shlex.quote(baseline_key)
                if no_record:
                    # baseline-guard-clearability F1/F2: this state must never
                    # be reported as a local edit -- the operator has no
                    # evidence one happened, and a careful operator who reads
                    # a false "local modifications" claim correctly declines
                    # the remedy and stays broken forever (the live Omarchy
                    # report). Named "no baseline recorded" (the literal
                    # phrase the goldens key on), and the remedy is ordered
                    # by evidence -- reconcile first, since it can prove the
                    # file was never edited -- then force, then adopt, with
                    # the force/adopt asymmetry stated here at the point of
                    # offer, not only in --help.
                    if untracked_out is not None and baseline_key not in untracked_out:
                        untracked_out.append(baseline_key)
                    print(
                        f"  WARN  {baseline_key} has no baseline recorded "
                        "(this workspace has no record that it was ever "
                        "synced) and differs from incoming content -- "
                        "SKIPPING overwrite. Recovery: --reconcile-from-history "
                        "checks this path against the release this workspace "
                        "records and delivers it only if the bytes match. "
                        "--force-path delivers the incoming content NOW, "
                        "this run, and prints a loud FORCE line naming what "
                        "it destroyed (a backup is taken first) -- the "
                        "overwrite is visible immediately. --adopt-baseline "
                        "does not touch this file now, but the NEXT --apply "
                        "after it delivers the incoming content silently, "
                        "with no further warning -- adopt is only safe when "
                        "you are confident this file was never edited; if "
                        "you cannot tell, treat it as one that was. Re-run "
                        f"with --reconcile-from-history {quoted_key}, "
                        f"--force-path {quoted_key}, or --adopt-baseline "
                        f"{quoted_key} as appropriate."
                    )
                else:
                    print(
                        f"  WARN  {baseline_key} has local modifications "
                        "since the last template sync -- SKIPPING overwrite "
                        "(baseline mismatch; see .agent/memory/scratch/"
                        "template_baselines.json). Recovery: "
                        "--reconcile-from-history checks this path against "
                        "the release this workspace records and delivers it "
                        "only if the bytes match (unlikely for a real edit). "
                        "--force-path delivers the incoming content NOW, "
                        "this run, discarding these local modifications, "
                        "and prints a loud FORCE line naming what it "
                        "destroyed (a backup is taken first) -- the "
                        "overwrite is visible immediately. --adopt-baseline "
                        "does not touch this file now, but the NEXT --apply "
                        "after it delivers the incoming content silently, "
                        "with no further warning -- adopt is only safe when "
                        "you are confident this file was never edited; if "
                        "you cannot tell, treat it as one that was. Re-run "
                        f"with --force-path {quoted_key} or "
                        f"--adopt-baseline {quoted_key} as appropriate."
                    )
                return "skipped"
            # Explicit opt-in via --force-path for this exact path. State
            # what is about to be overwritten BEFORE overwriting it —
            # naming the file and the fact that local modifications are
            # being cleared, not just printing a generic "copied" line.
            # Only reached when the guard actually had something to
            # bypass (a real baseline mismatch OR a no-record divergence),
            # so this is the one and only place "forced" may be reported.
            guard_bypassed = True
            divergence_desc = (
                "no baseline recorded for it" if no_record else
                "local modifications detected (baseline mismatch)"
            )
            print(
                f"  FORCE {baseline_key} — {divergence_desc}; overwriting "
                "with canonical content because --force-path was passed "
                "explicitly for this path"
                + (f" (backup: {backup_dir / dst_file})" if backup_dir is not None else " (no backup_dir configured)")
            )

    if dst_file.exists() and backup_dir is not None:
        # Backup-target symlink refusal (F10) -- backup_path's structure
        # under backup_dir mirrors dst_file, which is not itself attacker-
        # shaped, but a symlink planted anywhere in backup_path's OWN
        # ancestor chain (e.g. inside backup_dir from an earlier file in
        # this same run) would redirect the backup of the user's EXISTING
        # content to an attacker-chosen location -- an exfiltration path,
        # not merely a write primitive. Refuse the whole sync (not just the
        # backup) rather than proceed without the backup that protects
        # dst_file's pre-overwrite content.
        backup_path = backup_dir / dst_file
        if _refuse_symlinked_write(backup_path, f"{baseline_key} backup target"):
            # Also a refusal, and a sharper one: a symlink in the BACKUP path
            # redirects the user's existing content outward, which is an
            # exfiltration primitive rather than merely a write one.
            if refused_out is not None and baseline_key not in refused_out:
                refused_out.append(baseline_key)
            return "skipped"
        if not predict:
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            _copy2_nofollow(dst_file, backup_path, f"{baseline_key} backup target")

    if not predict:
        dst_file.parent.mkdir(parents=True, exist_ok=True)
        _copy2_nofollow(src_file, dst_file, baseline_key)

        try:
            new_hash = _sha256_of_file(dst_file)
        except OSError:
            new_hash = None
        if new_hash is not None:
            baselines = load_template_baselines()
            baselines[baseline_key] = new_hash
            save_template_baselines(baselines)

    return "forced" if guard_bypassed else "copied"


def _workspace_identity() -> str:
    """Opaque, offline identity for the workspace rooted at the current
    directory (delivery-integrity F4b).

    Truncated sha256 of the workspace root's real path. Properties this must
    hold, in the order they matter:

      unique per checkout -- two checkouts on one machine, and a fork on
        another, never collide, so an inherited stamp is DISTINGUISHABLE
        rather than merely less likely;
      stable across applies -- derived from the path alone, so repeated
        --apply runs in one workspace agree and a local bump never turns a
        trusted stamp into a foreign-looking one;
      offline -- no subprocess, no `git`, no network. The stamp must be
        writable with PATH stripped to an empty directory;
      opaque -- the stamp is committed to public repos, so a raw path would
        publish a username and directory layout. A hash publishes nothing.

    A workspace that is legitimately MOVED reads as foreign afterwards. That
    is deliberate and safe: foreign only ever DOWNGRADES confidence to
    warn-and-proceed, never to a refusal, and the next --apply restamps it.
    """
    return hashlib.sha256(
        os.path.realpath(os.getcwd()).encode("utf-8")
    ).hexdigest()[:16]


def _stamp_identity_fields() -> dict:
    """The provenance fields every stamp writer must record. Single source of
    truth for both writers -- execution/bump_version.sh obtains these through
    `update_template.py --print-workspace-identity` rather than recomputing
    them, so the two can never drift (delivery-integrity F4b B15).
    """
    return {WORKSPACE_IDENTITY_FIELD: _workspace_identity()}


def _stamp_is_from_this_workspace(state: dict) -> bool:
    """Was this stamp written by an --apply/bump IN this workspace?

    False for a stamp carrying another workspace's identity AND for one
    carrying no identity at all -- see WORKSPACE_IDENTITY_FIELD's note on why
    absence is the inherited signature rather than an exemption.
    """
    if not isinstance(state, dict):
        return False
    return state.get(WORKSPACE_IDENTITY_FIELD) == _workspace_identity()


def _paths_have_identical_content(src: Path, dst: Path) -> bool:
    """True iff both are regular files with byte-identical content.

    Used to retract a withheld-delivery claim (delivery-integrity F1): a key
    the baseline guard refused to write may still have been delivered by a
    later direct writer in the same run (update_profile_version() writes
    .agent/version itself), and claiming a file was withheld when the
    workspace demonstrably holds the canonical content is the same false
    report, inverted. Never raises -- an unreadable side means "cannot prove
    delivery", which keeps the withheld claim.
    """
    try:
        if not (src.is_file() and dst.is_file()):
            return False
        return _sha256_of_file(src) == _sha256_of_file(dst)
    except OSError:
        return False


def copy_harness(
    src: Path, dst: Path, backup_dir: Path, path_key: str | None = None,
    force_paths: frozenset[str] = frozenset(),
    withheld_out: list[str] | None = None,
    refused_out: list[str] | None = None,
    untracked_out: list[str] | None = None,
) -> tuple[str, bool]:
    """Copy a HARNESS path (file or directory) with backup.

    Returns (message, changed) -- changed is True iff at least one byte
    was actually written somewhere under this entry (copied or forced
    count > 0 for a directory entry; status in ("copied", "forced") for a
    single-file entry). The caller must classify paths_changed/paths_skipped
    off this boolean, NOT by re-parsing the message string (template-update-
    actually-updates F9): a directory entry's message always reads
    "update (dir) ..." regardless of whether anything inside it actually
    changed -- a bare `msg.startswith("SKIP")` check only ever matches the
    single-file entry's guarded format, so a directory entry whose every
    file was guarded (0 bytes written) was misclassified as paths_changed,
    a false-success claim recurring one layer down inside F5's own fix.

    path_key is the manifest "path" string this entry corresponds to, used to key
    the baseline-hash overwrite guard (issue #104). For directory entries, every
    file discovered via rglob gets its own baseline key of
    f"{path_key.rstrip('/')}/{relative_posix_path}" so nested files (e.g.
    execution/pulse_mission_loop.sh inside the execution/ directory entry) are
    guarded individually.

    .agent/no-update protection is enforced SOLELY by the per-file baseline-hash
    guard in _sync_file_with_guard() below (issue: template-update-actually-
    updates F2). A prior version of this function also short-circuited on a
    whole-path is_protected() match before ever reaching the guard; that skipped
    delivery of safe upstream content to unmodified local files sitting in a
    directory-style .agent/no-update entry (e.g. ".agent/skills/") and, for
    wildcard-style entries (e.g. ".agent/skills/*"), skipped every single file
    unconditionally regardless of whether it had ever diverged locally. The
    baseline guard already implements the correct 3-row model (new file ->
    deliver; local matches baseline, incoming differs -> update freely; local
    diverges from baseline -> skip + WARN + name --force-path) on its own, so a
    second, coarser protection check here only ever throws away safe deliveries
    it should have let through.

    force_paths (issue #1348 remediation / F6) is a set of exact baseline keys
    (single-file path_key, or "{dir_path_key}/{relative}" for a file inside a
    directory entry) whose guard should be bypassed for this run only. Default
    is empty — normal `--apply` behavior (no --force-path on the CLI) is
    completely unaffected; force_paths must be built explicitly by main() from
    an explicit --force-path argument, never inferred, and is validated for
    manifest membership AND real-path containment before this function is ever
    called (see _collect_valid_harness_keys / main()).

    withheld_out (delivery-integrity F1) is an optional accumulator: every
    per-file baseline key whose _sync_file_with_guard() call returned
    "skipped" — i.e. content this run was carrying but did NOT deliver — is
    appended to it, in the same key format force_paths uses. This is the
    STRUCTURAL report of a partial delivery; main() drives its exit code and
    its WITHHELD summary block off this list, never off the returned message
    string (F9's rule: a directory entry's message reads "update (dir) ..."
    whether it delivered everything or nothing). The parameter is an
    accumulator rather than a third return element deliberately — the return
    shape (message, changed) is unpacked by existing golden verifiers.

    untracked_out (baseline-guard-clearability F1) is passed straight through
    to every _sync_file_with_guard() call this function makes -- the subset
    of withheld_out withheld because no baseline was ever recorded, as
    opposed to a real local edit. See _sync_file_with_guard()'s own docstring.
    """
    if path_key is None:
        path_key = str(dst)

    if not src.exists():
        return f"  SKIP  (source missing: {src})", False

    if src.is_dir():
        # Entry-root symlink refusal (template-update-actually-updates F10,
        # ROW 1/1b) -- checked BEFORE dst.mkdir(parents=True, exist_ok=True)
        # below, whose exist_ok path checks is_dir() and follows the
        # symlink, succeeding silently with no check of its own. Without
        # this, every file the rglob loop below discovers would still be
        # individually caught by _sync_file_with_guard()'s own ancestor
        # walk (same helper), but only after one WARN per file instead of
        # one clear WARN for the whole entry -- refuse the entire entry up
        # front instead.
        if _refuse_symlinked_write(dst, f"{path_key} entry root"):
            print(f"  ({path_key}: refusal above is NOT overridable via --force-path)")
            if refused_out is not None and path_key not in refused_out:
                refused_out.append(path_key)
            return f"  SKIP  (symlinked entry root) {dst}", False

        dst.mkdir(parents=True, exist_ok=True)
        base_key = path_key.rstrip("/")
        copied: list[str] = []
        unchanged_count = 0
        guarded: list[str] = []
        forced: list[str] = []
        for src_file in sorted(src.rglob("*")):
            if src_file.is_dir():
                continue
            rel = src_file.relative_to(src)
            dst_file = dst / rel
            file_key = f"{base_key}/{rel.as_posix()}"
            status = _sync_file_with_guard(
                src_file, dst_file, backup_dir, file_key, force=file_key in force_paths,
                refused_out=refused_out, untracked_out=untracked_out,
            )
            if status == "copied":
                copied.append(str(rel))
            elif status == "forced":
                forced.append(str(rel))
            elif status == "unchanged":
                unchanged_count += 1
            else:
                guarded.append(str(rel))
                # A refusal already claimed this key; it must not ALSO be
                # reported as an ordinary withholding.
                if withheld_out is not None and not (
                        refused_out is not None and file_key in refused_out):
                    withheld_out.append(file_key)
        detail = f"copied {len(copied)}, unchanged {unchanged_count}"
        if forced:
            detail += f", FORCED {forced}"
        if guarded:
            detail += f", guarded {guarded}"
        changed = bool(copied or forced)
        return f"  update (dir)  {dst}  [{detail}]", changed
    else:
        status = _sync_file_with_guard(src, dst, backup_dir, path_key,
                                       force=path_key in force_paths,
                                       refused_out=refused_out,
                                       untracked_out=untracked_out)
        if status == "copied":
            return f"  update (file) {dst}", True
        if status == "forced":
            return f"  FORCE (file)  {dst}", True
        if status == "unchanged":
            return f"  unchanged     {dst}", False
        if withheld_out is not None and not (
                refused_out is not None and path_key in refused_out):
            withheld_out.append(path_key)
        return f"  SKIP  (guarded) {dst}", False


# Translates _sync_file_with_guard()'s real outcome vocabulary into the
# --dry-run preview vocabulary contract-f10 (template-update-actually-
# updates) requires. Kept as the single place this translation happens --
# predict_harness() returns the UNTRANSLATED real vocabulary so a caller
# that wants the real outcome names (e.g. future tooling) is not forced to
# reverse a preview-only renaming.
PREDICT_STATUS_TO_PREVIEW_WORD = {
    "copied": "would-update",
    "unchanged": "would-skip",
    "skipped": "would-refuse",
    "forced": "would-force",
}


def predict_harness(
    src: Path, dst: Path, path_key: str, force_paths: frozenset[str] = frozenset(),
) -> list[tuple[str, str]]:
    """Read-only --dry-run companion to copy_harness() (template-update-
    actually-updates F10). Walks the exact same source-tree structure
    copy_harness() would deliver from, and classifies each real file's
    predicted --apply outcome via _sync_file_with_guard(predict=True) --
    the SAME decision function --apply itself calls at the point of write,
    not a second, independently maintained guess re-derived from
    src_path.exists() (which is how the old preview and the real --apply
    outcome silently drifted apart). Performs NO writes: predict=True
    suppresses every write inside _sync_file_with_guard(), and this
    function itself never creates dst or any backup directory (unlike
    copy_harness(), which mkdir()s dst up front).

    Returns a list of (file_key, status) pairs, one per real on-disk file
    under `src` -- file_key is the SAME per-file key format copy_harness()'s
    directory branch and F6's baseline-adoption path already use
    ("{path_key}/{relative}" for a directory entry, path_key itself for a
    single-file entry), and status is _sync_file_with_guard()'s own
    unmodified return vocabulary ("copied"/"unchanged"/"skipped"/"forced").
    The caller translates status via PREDICT_STATUS_TO_PREVIEW_WORD.
    """
    if not src.exists():
        return []

    if src.is_dir():
        # Entry-root symlink refusal, mirrored from copy_harness() (see the
        # matching check there) so the dry-run preview matches the real
        # --apply outcome instead of walking into a symlinked directory and
        # emitting one WARN + one result tuple per file.
        if _refuse_symlinked_write(dst, f"{path_key} entry root"):
            return [(path_key, "skipped")]

        base_key = path_key.rstrip("/")
        results: list[tuple[str, str]] = []
        for src_file in sorted(src.rglob("*")):
            if src_file.is_dir():
                continue
            rel = src_file.relative_to(src)
            dst_file = dst / rel
            file_key = f"{base_key}/{rel.as_posix()}"
            status = _sync_file_with_guard(
                src_file, dst_file, None, file_key,
                force=file_key in force_paths, predict=True,
            )
            results.append((file_key, status))
        return results
    else:
        status = _sync_file_with_guard(
            src, dst, None, path_key, force=path_key in force_paths, predict=True,
        )
        return [(path_key, status)]


def merge_line_union(src: Path, dst: Path, backup_dir: Path) -> str:
    """Merge strategy: union of lines (src lines added if not already in dst)."""
    if not src.exists():
        return f"  SKIP  (source missing: {src})"

    # Symlink refusal (template-update-actually-updates F10, ROW 3) -- the
    # MERGE category had ZERO symlink awareness at any level before this
    # fix: dst.write_text() below follows symlinks unconditionally. Checked
    # before reading dst's existing content so a symlinked destination is
    # never even opened.
    if _refuse_symlinked_write(dst, f"{dst} (MERGE destination)"):
        return f"  SKIP  (symlinked destination) {dst}"

    src_lines = src.read_text().splitlines()
    dst_lines = dst.read_text().splitlines() if dst.exists() else []

    dst_set = set(dst_lines)
    new_lines = [line for line in src_lines if line not in dst_set]

    if not new_lines:
        return f"  unchanged (line_union): {dst}"

    if dst.exists():
        # Backup-target symlink refusal (F10) -- same rationale as
        # _sync_file_with_guard's backup block: a symlink planted in
        # backup_path's own ancestor chain would redirect the backup of
        # dst's pre-merge content to an attacker-chosen location.
        backup_path = backup_dir / dst
        if _refuse_symlinked_write(backup_path, f"{dst} backup target"):
            return f"  SKIP  (symlinked backup target) {dst}"
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        _copy2_nofollow(dst, backup_path, f"{dst} backup target")

    merged = dst_lines + new_lines
    dst.parent.mkdir(parents=True, exist_ok=True)
    _write_text_nofollow(dst, "\n".join(merged) + "\n", f"{dst} (MERGE destination)")
    return f"  merge  (line_union, +{len(new_lines)} lines): {dst}"


def merge_list_union(base_list: list, override_list: list) -> list:
    """Union two JSON lists, preserving base order, then appending anything
    from override not already present.

    Claude Code hook-group entries have the shape
    {"matcher": ..., "hooks": [...]}. For lists made entirely of that shape
    on both sides, union by "matcher": a matcher present on both sides gets
    its inner "hooks" list unioned recursively (so a local-only hook
    *inside* an existing matcher group -- the exact incident this fixes --
    is preserved instead of the whole group being replaced); a matcher only
    present on one side is kept as-is.

    Every other list shape (permissions.allow/deny/ask string arrays,
    plain hook-command dicts, scalars) is unioned by exact-value dedup,
    preserving first-seen order -- base items first, then novel override
    items.
    """

    def _is_hook_group_list(lst):
        return len(lst) > 0 and all(
            isinstance(e, dict) and "matcher" in e and "hooks" in e for e in lst
        )

    if _is_hook_group_list(base_list) and _is_hook_group_list(override_list):
        result = [dict(e) for e in base_list]
        by_matcher = {e["matcher"]: e for e in result}
        for entry in override_list:
            matcher = entry["matcher"]
            if matcher in by_matcher:
                existing = by_matcher[matcher]
                existing["hooks"] = merge_list_union(
                    existing.get("hooks", []), entry.get("hooks", [])
                )
            else:
                new_entry = dict(entry)
                result.append(new_entry)
                by_matcher[matcher] = new_entry
        return result

    # Generic order-preserving dedup union. dict/list elements are compared
    # by their JSON-serialized form (sort_keys, so key order never causes a
    # spurious duplicate); scalars compare by value directly.
    import json as _json

    def _dedupe_key(e):
        return _json.dumps(e, sort_keys=True) if isinstance(e, (dict, list)) else e

    seen = set()
    result = []
    for e in list(base_list) + list(override_list):
        k = _dedupe_key(e)
        if k not in seen:
            seen.add(k)
            result.append(e)
    return result


def deep_merge(base: dict, override: dict) -> dict:
    """Deep merge: override values take priority; nested dicts are merged
    recursively; lists present on both sides are unioned (see
    merge_list_union) instead of replaced."""
    result = dict(base)
    for key, val in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(val, dict):
            result[key] = deep_merge(result[key], val)
        elif key in result and isinstance(result[key], list) and isinstance(val, list):
            result[key] = merge_list_union(result[key], val)
        else:
            result[key] = val
    return result


def merge_json_deep(src: Path, dst: Path, backup_dir: Path) -> str:
    """Merge strategy: deep merge JSON objects (src values win on conflict)."""
    if not src.exists():
        return f"  SKIP  (source missing: {src})"

    # Symlink refusal (template-update-actually-updates F10, ROW 3 sibling)
    # -- same rationale as merge_line_union(): this MERGE strategy had ZERO
    # symlink awareness before this fix, and dst.write_text() below follows
    # symlinks unconditionally.
    if _refuse_symlinked_write(dst, f"{dst} (MERGE destination)"):
        return f"  SKIP  (symlinked destination) {dst}"

    src_data = json.loads(src.read_text())
    if dst.exists():
        try:
            dst_data = json.loads(dst.read_text())
        except json.JSONDecodeError:
            # Corrupt destination degrades gracefully to "no existing
            # content" (mirrors load_template_baselines()'s corrupt-JSON
            # handling) instead of raising and aborting the whole apply run.
            dst_data = {}
    else:
        dst_data = {}

    merged = deep_merge(dst_data, src_data)

    if merged == dst_data:
        return f"  unchanged (json_deep_merge): {dst}"

    if dst.exists():
        # Backup-target symlink refusal (F10) -- same rationale as
        # merge_line_union()'s backup block.
        backup_path = backup_dir / dst
        if _refuse_symlinked_write(backup_path, f"{dst} backup target"):
            return f"  SKIP  (symlinked backup target) {dst}"
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        _copy2_nofollow(dst, backup_path, f"{dst} backup target")

    dst.parent.mkdir(parents=True, exist_ok=True)
    _write_text_nofollow(dst, json.dumps(merged, indent=2) + "\n", f"{dst} (MERGE destination)")
    return f"  merge  (json_deep_merge): {dst}"


RETRACTIONS_LOG_PATH = Path(".agent/memory/scratch/retractions_applied.json")


def _resolve_retraction_key_path(data: dict, key_path: str) -> tuple[dict | None, str | None]:
    """Walk a dotted key_path ("env.FOO") into a nested dict.

    Returns (parent_dict, leaf_key) if every intermediate segment exists and
    is itself a dict, or (None, None) if the path cannot be resolved at all
    (e.g. an intermediate segment is absent or not a dict). Callers must
    still check `leaf_key in parent_dict` themselves -- a resolvable parent
    with an absent leaf key is the ordinary "nothing to retract" case, not
    an error.
    """
    parts = key_path.split(".")
    parent = data
    for part in parts[:-1]:
        if not isinstance(parent, dict) or part not in parent:
            return None, None
        parent = parent[part]
    if not isinstance(parent, dict):
        return None, None
    return parent, parts[-1]


def apply_retractions(
    manifest: dict,
    project_root: Path,
    backup_dir: Path | None,
    dry_run: bool,
) -> list[dict]:
    """Retract known-bad values this tool previously delivered that
    deep_merge()/json_deep_merge() can never remove on their own
    (delivered-value-retraction F1, SPEC.md): deep_merge only ever adds or
    overwrites keys present in the incoming source, so a key upstream has
    since dropped is never touched in the workspace's own copy, no matter
    how many future --apply runs happen.

    Runs as its own pass, AFTER the normal manifest loop (same shape as
    apply_missing_file_backstop). Reads manifest["retractions"] -- an
    optional list of {path, key_path, bad_value, action, replacement,
    reason, issue} entries (see .agent/update-manifest.yaml). For each
    entry: load `path` (workspace-relative) as JSON, resolve the dotted
    `key_path`, and act ONLY if the CURRENT value there is JSON-equal to
    `bad_value` -- never on "key absent" (that would clobber a legitimate
    local customization upstream never shipped) and never dependent on any
    prior delivery record, so this fires correctly on a workspace that has
    never seen this mechanism before (every real affected workspace today).
    On a match: back up the file under backup_dir (mirrors
    merge_json_deep()'s own backup step -- same backup_dir + symlink-
    refusal machinery every other write site in this module already uses),
    remove or replace the key per `action`, write the file, print an audit
    line, and append a record to
    .agent/memory/scratch/retractions_applied.json.

    Honors dry_run: reports what WOULD fire, writes nothing.

    Returns the list of fired-retraction records (empty if none fired).
    """
    fired: list[dict] = []
    entries = manifest.get("retractions") or []
    if not isinstance(entries, list):
        print(
            f"  WARN  retractions: expected a list, got {type(entries).__name__} "
            "— skipping retraction pass entirely",
            file=sys.stderr,
        )
        return fired
    if not entries:
        return fired

    # Resolve once so the symlink guard's ancestor walk compares like-for-
    # like against `stop_at` (mirrors the `Path(tempfile.mkdtemp()).resolve()`
    # convention used by this module's own tmp-root test fixtures elsewhere
    # in execution/checks/ -- an unresolved macOS tmp root's ancestor chain
    # passes through the /var -> /private/var symlink, which would otherwise
    # make every path under it look symlink-reached even though nothing an
    # operator controls is symlinked).
    project_root = project_root.resolve()
    if backup_dir is not None:
        backup_dir = backup_dir.resolve()

    print("Retraction pass:")

    for entry in entries:
        try:
            rel_path = entry["path"]
            key_path = entry["key_path"]
            bad_value = entry["bad_value"]
        except (KeyError, TypeError) as e:
            print(
                f"  WARN  retraction entry {entry!r} missing required field(s) "
                f"or malformed: {e} — skipping this entry, continuing",
                file=sys.stderr,
            )
            continue
        action = entry.get("action", "remove")
        replacement = entry.get("replacement")
        reason = entry.get("reason", "")
        issue = entry.get("issue", "")

        dst = project_root / rel_path

        if not dst.exists():
            print(f"  retraction SKIP   {rel_path} (file absent)")
            continue

        if _refuse_symlinked_write(dst, f"{rel_path} (retraction target)", stop_at=project_root):
            continue

        try:
            data = json.loads(dst.read_text())
        except (json.JSONDecodeError, OSError) as e:
            print(f"  retraction SKIP   {rel_path} (unreadable/invalid JSON: {e})")
            continue

        parent, leaf = _resolve_retraction_key_path(data, key_path)
        if parent is None or leaf not in parent:
            print(f"  retraction SKIP   {rel_path}::{key_path} (key absent -- never touched)")
            continue

        current_value = parent[leaf]
        if current_value != bad_value:
            print(
                f"  retraction SKIP   {rel_path}::{key_path} (current value "
                "differs from known-bad signature -- left untouched)"
            )
            continue

        if dry_run:
            print(f"  retraction WOULD  {rel_path}::{key_path} -- would {action} (currently {current_value!r})")
            continue

        # Backup before write -- mirrors merge_json_deep()'s own backup step.
        if backup_dir is not None:
            rel_for_backup = dst.relative_to(project_root) if dst.is_relative_to(project_root) else Path(rel_path)
            backup_path = backup_dir / rel_for_backup
            if _refuse_symlinked_write(backup_path, f"{rel_path} backup target", stop_at=project_root):
                continue
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            _copy2_nofollow(dst, backup_path, f"{rel_path} backup target", stop_at=project_root)

        if action == "remove":
            del parent[leaf]
            new_value = "removed"
        elif action == "replace":
            parent[leaf] = replacement
            new_value = replacement
        else:
            print(f"  retraction SKIP   {rel_path}::{key_path} (unknown action {action!r})")
            continue

        try:
            wrote = _write_text_nofollow(
                dst, json.dumps(data, indent=2) + "\n",
                f"{rel_path} (retraction target)", stop_at=project_root,
            )
        except OSError as e:
            print(f"  retraction SKIP   {rel_path}::{key_path} (write failed: {e})", file=sys.stderr)
            continue
        if not wrote:
            print(
                f"  retraction SKIP   {rel_path}::{key_path} "
                "(write refused: symlinked destination)",
                file=sys.stderr,
            )
            continue

        print(f"  retraction FIRED  {rel_path}::{key_path} -- {action} (was {current_value!r}) -- {reason}")

        # Retraction only edits the on-disk settings file -- it cannot un-export
        # a variable a running process already inherited into its own environment
        # (delivered-value-retraction cannot self-heal a live session, see
        # .agent/memory/project/data/p2-env-var-retraction-cannot-self-heal-a.md).
        # If this process's own environment still carries the retracted var, the
        # session that spawned this run needs a restart before the fix applies.
        env_var_name = key_path.split(".", 1)[1] if key_path.startswith("env.") else None
        if env_var_name is not None and env_var_name in os.environ:
            print(
                f"  ⚠️  RESTART REQUIRED: {env_var_name} was retracted from {rel_path} but is "
                "still set in this process's live environment -- it will not take effect until "
                "you restart your Claude Code session."
            )

        fired.append({
            "path": rel_path,
            "key_path": key_path,
            "old_value": current_value,
            "new_value": new_value,
            "reason": reason,
            "issue": issue,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })

    if fired:
        log_path = project_root / RETRACTIONS_LOG_PATH
        if _refuse_symlinked_write(log_path, "retraction audit log", stop_at=project_root):
            print("  WARN  retraction(s) applied above, but the audit log write was refused (symlinked ancestor)")
        else:
            try:
                existing = json.loads(log_path.read_text()) if log_path.exists() else []
                if not isinstance(existing, list):
                    existing = []
            except Exception:
                existing = []
            existing.extend(fired)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            _write_text_nofollow(
                log_path, json.dumps(existing, indent=2) + "\n",
                "retraction audit log", stop_at=project_root,
            )

    return fired


def update_profile_version(source: Path, profile_path: Path) -> str:
    """After a successful apply, bump template_version in profile.json AND sync the
    standalone .agent/version file, both from the fetched source's .agent/version.

    The two files are kept in lockstep so full_boot.sh/init and
    pulse_mission_loop.sh never see a stale local .agent/version while
    profile.json.template_version has already moved on (issue #1285).
    """
    version_file = source / ".agent" / "version"
    if not version_file.exists():
        return "  SKIP  template_version update (source .agent/version not found)"

    new_version = version_file.read_text().strip()
    if not new_version:
        return "  SKIP  template_version update (source .agent/version is empty)"

    changes = []

    # Sync the standalone .agent/version file (created if missing), independent
    # of whether profile.json exists/parses — this is the file #1285 is about.
    local_version_path = profile_path.parent / "version"
    if local_version_path.is_dir():
        changes.append(
            "WARN local .agent/version is a directory, not a file — skipping local version sync"
        )
    elif _refuse_symlinked_write(local_version_path, "local .agent/version"):
        # F10 (#9): a fixed workspace-relative path narrows this to an
        # attacker who has planted a symlink at exactly .agent/version, but
        # does not eliminate it -- close it like every other write site.
        changes.append("WARN local .agent/version is symlinked — skipping local version sync")
    else:
        old_local_version = (
            local_version_path.read_text().strip() if local_version_path.exists() else None
        )
        if old_local_version != new_version:
            local_version_path.parent.mkdir(parents=True, exist_ok=True)
            _write_text_nofollow(local_version_path, new_version + "\n", "local .agent/version")
            changes.append(
                f".agent/version: {old_local_version if old_local_version is not None else 'missing'} → {new_version}"
            )

    if not profile_path.exists():
        if changes:
            return f"  updated: {'; '.join(changes)} (profile.json not found — skipped)"
        return "  SKIP  template_version update (profile.json not found)"

    try:
        profile = json.loads(profile_path.read_text())
    except Exception as e:
        if changes:
            return f"  updated: {'; '.join(changes)}; WARN template_version update failed (bad profile.json): {e}"
        return f"  WARN  template_version update failed (bad profile.json): {e}"

    profile_changed = False
    old_version = profile.get("template_version", "unknown")
    if old_version != new_version:
        profile["template_version"] = new_version
        changes.append(f"template_version: {old_version} → {new_version}")
        profile_changed = True

    # Seed autonomy.level if absent — runs regardless of version match
    # (check_autonomy.sh falls back to "low" when missing)
    autonomy = profile.get("autonomy")
    if not (isinstance(autonomy, dict) and autonomy.get("level")):
        matrix_path = profile_path.parent.parent / ".agent" / "autonomy_matrix.json"
        try:
            matrix = json.loads(matrix_path.read_text())
            seed_level = matrix.get("onboarding_default", "low")
        except Exception:
            seed_level = "medium"
        if not isinstance(autonomy, dict):
            profile["autonomy"] = {}
        profile["autonomy"]["level"] = seed_level
        changes.append(f"autonomy.level: seeded as {seed_level}")
        profile_changed = True

    if profile_changed:
        # F10 (#10): symlink refusal before the profile.json write itself.
        if _refuse_symlinked_write(profile_path, "profile.json"):
            changes.append("WARN profile.json is symlinked — skipping template_version update")
        else:
            _write_text_nofollow(profile_path, json.dumps(profile, indent=2) + "\n", "profile.json")

    if not changes:
        return f"  unchanged template_version ({new_version})"

    return f"  updated: {'; '.join(changes)}"


def write_template_state(
    source: Path, state_path: Path = TEMPLATE_STATE_PATH,
    delivery: str = "complete", withheld: list[str] | None = None,
    failed: list[str] | None = None, refused: list[str] | None = None,
    untracked: list[str] | None = None,
    prior_local_version: str | None = None,
) -> str:
    """Persist the applied template_version to .agent/.template_state.

    Called on EVERY --apply run, including one that withheld or failed paths
    (delivery-integrity F4b). Gating the write on a clean run was rejected
    deliberately: a partial run has still delivered most of its content, so
    freezing the stamp at the old version understates delivery and produces
    exactly the frozen-stamp ambiguity that destroys the version guard's
    discriminator. The run's honesty lives in the `delivery` field instead —
    "complete" or "partial", accompanied by the withheld/failed keys on a
    partial run — so a later reader can tell WHICH content is missing rather
    than only that the number moved.

    Rewrites when the version OR the recorded delivery outcome changed, so a
    no-op second --apply run leaves the file byte-identical instead of
    refreshing applied_at every time, while a partial run at an unchanged
    version can never leave a stale "complete" behind.

    untracked (baseline-guard-clearability F1/D3, the keystone fix) is the
    subset of `withheld` that carries NO recorded baseline. Whenever this run
    leaves at least one such path undelivered, `reconcile_from` is written
    (or preserved, if already set) as the version this workspace held
    IMMEDIATELY BEFORE this run -- the one anchor an untracked file's bytes
    can still be proven against. Without this, `template_version` below
    advances to the version this very run just applied on every single call,
    including this one, and --reconcile-from-history would resolve against
    the release it just applied and never find a match again (D-B in
    DECISIONS.md).

    Three rules govern that anchor, and the first two are the whole point:

    1. The pre-run version is read from the EXISTING stamp when there is one,
       and otherwise from `prior_local_version` -- the local .agent/version
       captured by the caller BEFORE update_profile_version() overwrote it.
       A workspace that predates baseline tracking is exactly the population
       this mission exists for, and it has no stamp at all; reading only the
       stamp there yields None, drops the anchor, and mints one equal to the
       applied version on the following run.
    2. An anchor equal to `new_version` is NEVER minted. That value is the
       version this run just applied, so a withheld file's bytes cannot match
       it by construction -- recording it turns the printed remedy into the
       trap this field was added to close, and reports a file byte-identical
       to a real release as a hand-edit, forever. No usable anchor means no
       anchor: absence degrades to "could not resolve", presence of a wrong
       one degrades to a false accusation.
    3. A run that leaves ZERO untracked paths undelivered CLEARS the anchor,
       UNLESS a refused path (symlinked destination, F4c-2) still carries no
       recorded baseline -- a refusal removes a path from the untracked
       bucket without delivering it, and the anchor must survive until that
       path is truly delivered or baselined. Otherwise the anchor has been
       spent, and a stale anchor pointing at an ancient release would
       send a LATER reconcile (for a file that first appears untracked at
       some newer version) at the wrong tree, which resolves as UNRESOLVED
       and calls a never-edited file a hand-edit. Clearing it lets the next
       withholding run mint a correct one.
    """
    version_file = source / ".agent" / "version"
    if not version_file.exists():
        return "  SKIP  .template_state update (source .agent/version not found)"

    new_version = version_file.read_text().strip()
    if not new_version:
        return "  SKIP  .template_state update (source .agent/version is empty)"

    withheld = sorted(withheld or [])
    failed = list(failed or [])
    refused = sorted(refused or [])
    untracked = sorted(untracked or [])

    current: dict = {}
    if state_path.exists():
        try:
            current = json.loads(state_path.read_text())
        except Exception:
            current = {}
        if not isinstance(current, dict):
            current = {}

    # D3: preserve an existing reconcile_from anchor across every later run
    # while any untracked path remains -- overwriting it with THIS run's own
    # prior template_version one run later is the same trap with a delay.
    # Set it fresh, from the version this workspace held before this write,
    # only the first time an untracked path is left undelivered. See the
    # three numbered rules in the docstring.
    reconcile_from = current.get("reconcile_from")
    if not untracked:
        # Rule 3: the anchor is spent when nothing is being withheld for lack
        # of a baseline -- with ONE narrow exception (D9/C11): a refused path
        # (symlink at the destination, F4c-2) leaves the untracked bucket
        # without being delivered and without a baseline, and clearing there
        # loses the anchor permanently (once the symlink is removed the only
        # mintable candidate equals the applied version, which rule 2
        # correctly refuses). `paths_refused` holds real path keys -- never
        # the decorated strings `paths_failed` carries -- so baseline
        # membership is safe to read as debt here. The wider stamp-debt
        # carry that once lived here was REVERTED (D17): one scalar anchor
        # cannot serve paths of different provenance, and pinning it at an
        # old era makes a LATER untracked path reconcile against the wrong
        # tree and read as a hand-edit. Other undelivered exits (a failed
        # write, a path absent from this run's source or manifest) clear the
        # anchor; recovery for those falls back to --force-path -- an
        # accepted, documented limitation, not a silent one.
        owing_refused: list[str] = []
        if refused and reconcile_from:
            known_baselines = load_template_baselines()
            owing_refused = [p for p in refused if p not in known_baselines]
        if not owing_refused:
            reconcile_from = None
    elif not reconcile_from:
        # Rule 1: the stamp first, then the pre-run local .agent/version --
        # a pre-baseline-tracking workspace has no stamp, and that is the
        # case this whole field exists to serve.
        candidate = current.get("template_version") or prior_local_version
        # Rule 2: an anchor equal to the version this run just applied is
        # worse than no anchor at all.
        reconcile_from = candidate if candidate and candidate != new_version else None

    if (
        current.get("template_version") == new_version
        and current.get("delivery") == delivery
        and list(current.get("withheld") or []) == withheld
        and current.get("reconcile_from") == reconcile_from
        # F4b: an inherited stamp must be REPLACED by a local one on the
        # first apply here, even when every other field already matches
        # — otherwise a fresh clone whose incoming version equals the
        # inherited one keeps the foreign receipt forever.
        and _stamp_is_from_this_workspace(current)
    ):
        return f"  unchanged .template_state ({new_version}, delivery={delivery})"

    # F10 (#9): same fixed-workspace-relative-path caveat as
    # update_profile_version()'s local .agent/version write above.
    if _refuse_symlinked_write(state_path, ".agent/.template_state"):
        return (
            "  WARN  .template_state NOT updated (destination is symlinked) — "
            f"the recorded template version does not describe this workspace's "
            f"delivered content ({new_version} was applied)"
        )

    applied_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    state_path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "template_version": new_version,
        "applied_at": applied_at,
        "delivery": delivery,
    }
    # Provenance (F4b): records WHERE this delivery happened, so a clone that
    # inherits this file through git cannot present it as its own receipt.
    record.update(_stamp_identity_fields())
    if withheld:
        record["withheld"] = withheld
    if failed:
        record["failed"] = failed
    if refused:
        record["refused"] = refused
    if untracked:
        record["untracked"] = untracked
    if reconcile_from:
        record["reconcile_from"] = reconcile_from
    _write_text_nofollow(
        state_path,
        json.dumps(record, indent=2) + "\n",
        ".agent/.template_state",
    )
    return (
        f"  updated .template_state: template_version → {new_version} "
        f"(delivery={delivery}"
        + (f", withheld={len(withheld)}" if withheld else "")
        + (f", failed={len(failed)}" if failed else "")
        + (f", refused={len(refused)}" if refused else "")
        + ")"
    )


def apply_missing_file_backstop(
    source: Path,
    is_protected,
    dry_run: bool,
    backup_dir: Path | None,
) -> tuple[list[str], list[str]]:
    """Copy any REQUIRED_FILES absent in the workspace.

    Runs AFTER the main manifest loop, BEFORE update_profile_version.
    Additive only: never overwrites existing files. Respects is_protected().

    Returns (copied, warnings) for summary integration.
    """
    copied: list[str] = []
    warnings: list[str] = []

    print("Missing-file backstop pass:")

    for rel_path in REQUIRED_FILES:
        src = source / rel_path
        dst = Path(rel_path)

        # Idempotency: skip when target already exists.
        if dst.exists():
            print(f"  backstop ok       {rel_path} (present)")
            continue

        # Protection check: never bypass project opt-out, but make it loud.
        if is_protected(rel_path):
            msg = (
                f"  backstop WARN     {rel_path} is MISSING and PROTECTED"
                " — manual intervention required"
            )
            print(msg)
            warnings.append(rel_path)
            continue

        # Source-side check: cannot copy what we don't have.
        if not src.exists():
            msg = f"  backstop WARN     {rel_path} missing in source ({src}) — cannot restore"
            print(msg)
            warnings.append(rel_path)
            continue

        if dry_run:
            print(f"  backstop would    {rel_path} -> would copy from {src}")
            continue

        # Apply. Routed through _sync_file_with_guard() (issue:
        # template-update-actually-updates F5's category-(b) finding) rather
        # than a bare shutil.copy2 -- a direct copy here recorded no baseline
        # for the delivered file, so a REQUIRED_FILES entry created by this
        # backstop was permanently born into the "no record" danger bucket:
        # the first time it was later hand-edited and then re-synced via a
        # HARNESS directory entry covering the same path (e.g. execution/),
        # that edit would be silently overwritten with no history to consult.
        # dst is guaranteed not to exist here (the idempotency check above
        # already `continue`d otherwise), so this always takes the plain
        # create-and-record path -- same file-system effect as before, now
        # with a baseline recorded going forward.
        status = _sync_file_with_guard(src, dst, backup_dir, rel_path)
        if status in ("copied", "forced"):
            print(f"  backstop copy     {rel_path} (restored from source, {status})")
            copied.append(rel_path)
        else:
            print(f"  backstop REFUSED  {rel_path} (guard returned {status}, not counted)")

    return copied, warnings


def apply_fresh_manifest_backstop(
    manifest_path: Path,
    source: Path,
    dry_run: bool,
    backup_dir: Path | None,
) -> list[str]:
    """Re-read .agent/update-manifest.yaml from disk and deliver any HARNESS
    entry whose destination is still missing (issue #1293).

    The main manifest loop in main() drives off an in-memory snapshot loaded
    at the top of the run from the WORKSPACE's own (possibly stale)
    .agent/update-manifest.yaml — a downstream copy that can predate a
    brand-new entry the upstream source has just introduced. That entry is
    invisible to the stale in-memory snapshot, and
    REQUIRED_FILES/apply_missing_file_backstop() only guards a fixed list of
    4 paths, not arbitrary new manifest entries.

    This pass re-reads the manifest fresh off disk — preferring the SOURCE's
    copy (the authoritative, current definition of what HARNESS paths should
    exist; when .agent/update-manifest.yaml is itself a self-syncing HARNESS
    entry, the main loop will already have overwritten the workspace's own
    copy to match it, so the two agree) and falling back to the workspace's
    own manifest_path if the source has none — and delivers any missing
    HARNESS destination in the SAME run instead of requiring a second
    invocation.

    Returns the list of destination paths delivered (empty list in dry-run
    mode, since dry-run never writes).

    Does NOT consult .agent/no-update / is_protected() (template-update-
    actually-updates F4): protection is a property of files that already
    exist, and this pass by construction only ever reaches its sync call
    for a destination that does NOT exist yet (the exists() check always
    runs first and short-circuits delivery of anything already present).
    A prior version of this function skipped missing files whose path
    matched a protected pattern regardless of existence — for a wildcard-
    style .agent/no-update entry (e.g. ".agent/skills/*"), that silently
    blocked delivery of brand-new files into a protected directory, which
    is the exact "new file must be delivered" row (row A) this backstop
    exists to guarantee.
    """
    import yaml

    delivered: list[str] = []

    source_manifest_path = source / ".agent" / "update-manifest.yaml"
    fresh_source = source_manifest_path if source_manifest_path.exists() else manifest_path

    try:
        fresh_manifest = yaml.safe_load(fresh_source.read_text())
    except Exception as e:
        print(f"  WARN  fresh-manifest backstop: failed to re-read manifest ({fresh_source}): {e}")
        return delivered

    for entry in fresh_manifest.get("paths", []):
        if entry.get("category") != "HARNESS":
            continue
        path = entry["path"]
        # Isolate-and-continue per entry (template-update-actually-updates F8
        # EDGE 3): this loop runs OUTSIDE the main manifest loop in main(),
        # which already wraps each entry in its own try/except so one bad
        # entry can never abort the whole run. This loop previously had no
        # such protection -- a directory/file manifest-entry mismatch (e.g.
        # `path: .agent/skills/` while the workspace has a plain FILE named
        # `.agent/skills`) crashed with an uncaught FileExistsError from
        # dst_file.parent.mkdir() deep in _sync_file_with_guard(), producing a
        # raw traceback with no WARN naming the actual problem. The explicit
        # is_dir()/exists() checks below catch the common, nameable mismatch
        # proactively (clear WARN, no exception needed); the try/except is
        # defense-in-depth for anything else this entry's processing could
        # raise (e.g. a permission error walking the source tree).
        try:
            if path.endswith("/"):
                dst_dir = Path(path.rstrip("/"))
                if dst_dir.exists() and not dst_dir.is_dir():
                    print(
                        f"  WARN  fresh-manifest backstop: manifest entry {path!r} "
                        f"expects a DIRECTORY at {dst_dir}, but a FILE with that "
                        "name already exists in the workspace — skipping this "
                        "entry (directory/file manifest mismatch)"
                    )
                    continue
                # Entry-root symlink refusal (template-update-actually-
                # updates F10, ROW 4) -- same rationale as copy_harness()'s
                # directory branch: refuse the whole entry up front rather
                # than one WARN per file (the per-file _sync_file_with_guard
                # call below would still independently catch each file via
                # the same ancestor-walk helper, since dst_dir is itself an
                # ancestor of every dst_file it computes).
                if _refuse_symlinked_write(dst_dir, f"fresh-manifest backstop entry {path!r}"):
                    continue
                src_dir = source / path.rstrip("/")
                if not src_dir.exists():
                    continue
                for src_file in sorted(src_dir.rglob("*")):
                    if src_file.is_dir():
                        continue
                    rel = src_file.relative_to(src_dir)
                    dst_file = dst_dir / rel
                    dst_key = f"{path.rstrip('/')}/{rel.as_posix()}"
                    if dst_file.exists():
                        continue
                    if not dry_run:
                        status = _sync_file_with_guard(src_file, dst_file, backup_dir, dst_key)
                        if status in ("copied", "forced"):
                            delivered.append(dst_key)
            else:
                dst_file = Path(path)
                src_file = source / path
                if dst_file.is_dir():
                    print(
                        f"  WARN  fresh-manifest backstop: manifest entry {path!r} "
                        f"expects a FILE at {dst_file}, but a DIRECTORY with that "
                        "name already exists in the workspace — skipping this "
                        "entry (directory/file manifest mismatch)"
                    )
                    continue
                if dst_file.exists() or not src_file.exists():
                    continue
                if not dry_run:
                    status = _sync_file_with_guard(src_file, dst_file, backup_dir, path)
                    if status in ("copied", "forced"):
                        delivered.append(path)
        except Exception as e:
            print(
                f"  WARN  fresh-manifest backstop: entry {path!r} failed "
                f"({e.__class__.__name__}: {e}) — continuing"
            )

    if delivered:
        print(f"  fresh-manifest backstop delivered: {delivered}")

    return delivered


def fetch_latest_from_github(tmpdir: Path) -> bool:
    """Stream the current InunuNet/Athanor main tarball into tmpdir.

    Uses: gh api repos/InunuNet/Athanor/tarball/main | tar xz -C <tmpdir> --strip-components=1

    Returns True on success (tmpdir now contains the upstream tree at root level —
    i.e. <tmpdir>/execution/, <tmpdir>/.agent/, <tmpdir>/template/, etc.).
    Returns False on any failure; caller falls back to local template/.
    """
    try:
        if shutil.which("gh") is None:
            print("[fetch] WARN: 'gh' not found on PATH — skipping upstream fetch")
            return False

        p1 = subprocess.Popen(
            ["gh", "api", "repos/InunuNet/Athanor/tarball/main"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        p2 = subprocess.Popen(
            ["tar", "xz", "-C", str(tmpdir), "--strip-components=1"],
            stdin=p1.stdout,
            stderr=subprocess.PIPE,
        )
        p1.stdout.close()  # allow p1 to receive SIGPIPE if p2 exits early
        _, tar_err = p2.communicate(timeout=120)
        _, gh_err = p1.communicate(timeout=120)

        if p1.returncode != 0:
            summary = gh_err.decode(errors="replace").strip()[:200] if gh_err else ""
            print(f"[fetch] WARN: gh api exited {p1.returncode}: {summary}")
            return False

        if p2.returncode != 0:
            summary = tar_err.decode(errors="replace").strip()[:200] if tar_err else ""
            print(f"[fetch] WARN: tar exited {p2.returncode}: {summary}")
            return False

        sanity = tmpdir / "execution" / "update_template.py"
        if not sanity.exists():
            print(
                f"[fetch] WARN: sanity check failed — {sanity} not found after extraction. "
                "Tarball layout may have changed. Falling back to local template/."
            )
            return False

        return True

    except subprocess.TimeoutExpired:
        print("[fetch] WARN: gh/tar timed out after 120 s — falling back to local template/")
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"[fetch] WARN: unexpected error during GitHub fetch: {exc}")
        return False


def _collect_valid_harness_keys(manifest: dict, source: Path) -> dict[str, list[Path]]:
    """Enumerate every baseline key a --force-path value is allowed to name
    (issue #1348 remediation / F6), mapped to the destination path(s) it
    would resolve to.

    Walks only HARNESS-category manifest entries (the only category the
    baseline-hash guard ever applies to — DERIVED entries are regenerated by
    `make sync` and MERGE entries have no guard) and, for directory entries,
    the SOURCE side's rglob (the same walk copy_harness() will perform),
    producing the same "{dir_path}/{relative}" keys copy_harness() computes,
    paired with the exact destination Path each key would write to.

    Returned as key -> list[Path] (not key -> Path) so a caller can detect
    collisions: two distinct manifest entries that happen to compute the same
    string key but a different destination. That should never legitimately
    happen, but a --force-path value is a deliberate bypass of a safety
    guard, so an ambiguous key must be refused rather than resolved by
    picking one of the candidates arbitrarily.

    This lets main() validate --force-path values up front and refuse a
    request that does not correspond to any real HARNESS file, is ambiguous,
    or escapes the project tree, BEFORE touching disk — --force-path is a
    targeted rescue for one #104-guarded file, not a generic "overwrite
    anything" primitive, and a typo or a path outside the manifest's HARNESS
    tree must fail loud rather than silently match nothing (which would look
    like success while forcing nothing).
    """
    valid: dict[str, list[Path]] = {}
    for entry in manifest.get("paths", []):
        if entry.get("category") != "HARNESS":
            continue
        path = entry["path"]
        if path.endswith("/"):
            src_dir = source / path.rstrip("/")
            if not src_dir.exists():
                continue
            base_key = path.rstrip("/")
            for src_file in sorted(src_dir.rglob("*")):
                if src_file.is_dir():
                    continue
                rel = src_file.relative_to(src_dir)
                key = f"{base_key}/{rel.as_posix()}"
                dst = Path(base_key) / rel
                valid.setdefault(key, []).append(dst)
        else:
            valid.setdefault(path, []).append(Path(path))
    return valid


def _validate_force_paths(
    force_paths: frozenset[str], manifest: dict, source: Path, project_root: Path,
) -> None:
    """Validate every requested --force-path value BEFORE any disk write
    (issue #1348 remediation / F6, path-traversal/collision hardening).

    Exits the process with code 2 and a clear message naming the offending
    value(s) — never returns a partial/best-effort result — for any of:
      - a path that does not correspond to any real HARNESS manifest entry
      - a key that resolves ambiguously (collides) across manifest entries
      - a resolved destination that escapes the project tree (`..`
        traversal, an absolute path outside the project, or a symlink that
        resolves outside the project) — checked via real path containment
        (`Path.resolve()` + `is_relative_to`), never string-prefix matching,
        so a crafted value cannot slip past a naive `startswith()` check.

    Refusing is always safe here; guessing is not — every branch below is a
    hard error, not a WARN-and-continue.
    """
    valid_force_keys = _collect_valid_harness_keys(manifest, source)

    unknown = sorted(force_paths - set(valid_force_keys.keys()))
    if unknown:
        print(
            "ERROR: --force-path given for path(s) not found in any HARNESS "
            f"manifest entry (nothing will be forced): {unknown}\n"
            "--force-path only rescues a file the #104 baseline guard is "
            "already protecting; it is not a generic overwrite-anything flag.",
            file=sys.stderr,
        )
        sys.exit(2)

    # NOTE: unreachable by construction under today's key scheme — every key
    # is a deterministic string serialization of its own destination
    # (base_key + "/" + relative-posix-path, or the bare manifest path for a
    # file entry), so two manifest entries can never map the same key to two
    # different destinations. This branch exists as a guardrail against a
    # FUTURE change (e.g. an alias layer, a case-insensitive key, or a
    # differently-derived key -> destination mapping) that could reintroduce
    # ambiguity; see execution/checks/test_force_path_traversal.sh's
    # collision_rejected case, which exercises it via monkeypatch since a
    # real fixture cannot currently trigger it.
    ambiguous = sorted(
        key for key in force_paths if len({str(p) for p in valid_force_keys[key]}) > 1
    )
    if ambiguous:
        print(
            "ERROR: --force-path value(s) are ambiguous — they match more than "
            f"one distinct destination across manifest entries: {ambiguous}\n"
            "Refusing rather than guessing which destination was intended.",
            file=sys.stderr,
        )
        sys.exit(2)

    escapes: list[str] = []
    for key in sorted(force_paths):
        candidate = valid_force_keys[key][0]
        resolved = candidate.resolve()
        if not resolved.is_relative_to(project_root):
            escapes.append(f"{key} -> {resolved}")
    if escapes:
        print(
            "ERROR: --force-path value(s) resolve outside the project tree "
            f"(rejected before any write): {escapes}\n"
            "This includes `..` traversal, absolute paths that escape the "
            "project, and symlinks that resolve outside the project.",
            file=sys.stderr,
        )
        sys.exit(2)

    # D20 (baseline-guard-clearability round 5): a key that IS a real HARNESS
    # manifest entry but is ABSENT from this payload is the same class of
    # unsatisfiable request as the unknown-key case above -- an explicit,
    # destructive-intent flag naming exactly one path must never complete
    # with exit 0 having delivered nothing, its only trace a "SKIP (source
    # missing: ...)" line lumped among ordinary skips. That is non-delivery
    # reporting success, the exact shape delivery-integrity closed. Only
    # single-file manifest entries can reach here: directory-derived keys are
    # enumerated FROM the source-side rglob above, so a source-missing file
    # under a directory entry is already refused as unknown. Ordinary --apply
    # skips of source-missing paths are untouched -- this fires only for
    # explicitly requested --force-path values.
    missing_from_payload = sorted(
        key for key in force_paths if not (source / key).is_file()
    )
    if missing_from_payload:
        print(
            "ERROR: --force-path given for path(s) that ARE in the HARNESS "
            "manifest but are ABSENT from this payload (nothing can be "
            f"forced from a payload that does not carry them): {missing_from_payload}\n"
            "The local file was NOT touched. Re-run once the update source "
            "actually ships these path(s) — with the default fetch, or with "
            "a --source that contains them.",
            file=sys.stderr,
        )
        sys.exit(2)


# --- F6: baseline reconciliation for already-stale workspaces -------------
# (template-update-actually-updates F6). Two strictly opt-in affordances,
# neither ever invoked by a plain --apply -- see cmd_reconcile_from_history()
# and cmd_adopt_baseline() docstrings for the full design rationale. Both
# are reachable ONLY via their own explicit CLI flag's handler in main(),
# short-circuiting before the normal --apply/--dry-run manifest loop runs.

ATHANOR_REPO = "InunuNet/Athanor"


def _enumerate_no_baseline_harness_paths(manifest_path: Path) -> list[str]:
    """Walk .agent/update-manifest.yaml's HARNESS entries and return every
    on-disk file with no recorded baseline. Used by --adopt-baseline all and
    --reconcile-from-history's default target set. Never returns a symlinked
    destination -- a symlink is never a valid adopt/reconcile target (F8
    EDGE 1); the same refusal that guards writes also guards baseline
    adoption, since adopting a baseline for a symlink would let a LATER
    normal --apply treat "local matches baseline" as license to write
    through it on a future divergence.
    """
    import yaml

    if not manifest_path.exists():
        return []
    try:
        manifest = yaml.safe_load(manifest_path.read_text())
    except Exception:
        return []

    baselines = load_template_baselines()
    no_baseline: list[str] = []
    for entry in manifest.get("paths", []):
        if entry.get("category") != "HARNESS":
            continue
        path = entry["path"]
        if path.endswith("/"):
            dst_dir = Path(path.rstrip("/"))
            if not dst_dir.is_dir():
                continue
            for f in sorted(dst_dir.rglob("*")):
                if f.is_symlink() or f.is_dir() or not f.is_file():
                    continue
                # F9: compiled Python bytecode is never real HARNESS content
                # -- it is the interpreter's own cached compile of a sibling
                # .py file, regenerated with zero human involvement, so a
                # baseline recorded for it goes stale the moment the
                # interpreter recompiles it. Excludes any __pycache__/
                # directory at any depth (not just directly under this
                # entry) and any stray *.pyc/*.pyo file even outside a
                # __pycache__ dir. Deliberately NOT a substring match on
                # "pyc" -- that would also drop a legitimately-named file
                # like mypycfile.py.
                if "__pycache__" in f.relative_to(dst_dir).parts:
                    continue
                if f.suffix in (".pyc", ".pyo"):
                    continue
                key = f"{path.rstrip('/')}/{f.relative_to(dst_dir).as_posix()}"
                if not baselines.get(key):
                    no_baseline.append(key)
        else:
            dst_file = Path(path)
            if dst_file.is_symlink():
                continue
            if dst_file.exists() and dst_file.is_file() and not baselines.get(path):
                no_baseline.append(path)
    return no_baseline


def cmd_adopt_baseline(targets: list[str]) -> int:
    """--adopt-baseline PATH...|all handler (F6).

    Records baseline = sha256(CURRENT local content) for each named
    no-baseline HARNESS path, WITHOUT touching the file itself. This is a
    broad, UNREVIEWED trust decision ("whatever is on disk right now is
    accepted as ground truth") in exchange for avoiding per-file manual
    review -- an acceptable trade for a DELIBERATE, RARE, one-time migration
    bridging pre-baseline-tracking history to F5-era operation. It becomes
    actively dangerous only if ever automated or run repeatedly as part of
    normal operation (see the golden's docstring for the exact mechanism:
    it would continuously re-stamp each file's baseline to match whatever is
    there immediately before the divergence check runs, defeating detection
    entirely) -- this function is reachable ONLY from this explicit CLI
    flag's own handler in main(), never from the ordinary --apply flow.

    Prints an explicit count of what was adopted; never silent.
    """
    if targets == ["all"]:
        paths = _enumerate_no_baseline_harness_paths(Path(".agent/update-manifest.yaml"))
        if not paths:
            print("--adopt-baseline all: no no-baseline HARNESS files found — nothing to adopt.")
            return 0
        print(f"--adopt-baseline all: found {len(paths)} no-baseline HARNESS file(s) to consider.")
    else:
        paths = targets

    baselines = load_template_baselines()
    adopted: list[str] = []
    skipped: list[str] = []
    for key in paths:
        p = Path(key)
        if p.is_symlink():
            print(f"  SKIP  {key}: is a symlink — refusing to adopt a baseline through a symlink (F8 EDGE 1)")
            skipped.append(key)
            continue
        if not p.exists() or not p.is_file():
            # D19 family: .exists() is False for a MISSING path and for one
            # that cannot be stat'd (e.g. EACCES on a parent) alike, so this
            # message must not assert the file is not there — that sends an
            # operator hunting for a missing file that is sitting on disk
            # with a permission problem.
            print(f"  SKIP  {key}: no readable regular file at this path (missing, not a regular file, or not readable) — nothing to adopt")
            skipped.append(key)
            continue
        try:
            content_hash = _sha256_of_file(p)
        except OSError as e:
            print(f"  SKIP  {key}: could not read ({e}) — nothing to adopt")
            skipped.append(key)
            continue
        baselines[key] = content_hash
        adopted.append(key)
        print(f"  ADOPT {key} -> baseline recorded from CURRENT local content ({content_hash[:12]}...)")

    if adopted:
        save_template_baselines(baselines)

    print()
    print(f"--adopt-baseline: adopted {len(adopted)}, skipped {len(skipped)}")
    if adopted:
        # baseline-guard-clearability F2/B11 -- the FOURTH offer point. This
        # summary used to end "ONLY a subsequent real upstream change delivers
        # normally", which is false for exactly the case adopt is invoked in:
        # the incoming content ALREADY differs, so adopt puts these files on
        # the "local matches baseline, incoming differs" row -- the DELIVER
        # FREELY row -- and the next plain --apply delivers this very payload.
        # An operator told nothing will happen until upstream moves again is
        # precisely the operator who will not read the next run's output.
        print(
            "  Nothing about these files was touched by this run -- only the "
            "baseline store was. The NEXT --apply DELIVERS the incoming "
            "content over them, silently: no FORCE line, no warning, no "
            "acknowledgement that a divergence was ever cleared. That is the "
            "intended outcome for a file that truly was never edited. For a "
            "file that WAS edited, it is a deferred overwrite of that edit, "
            "one run later, in a run that reports success."
        )
    return 0


def _read_recorded_template_version() -> str | None:
    """Recorded version this workspace last knew itself to be at. Prefers
    .agent/.template_state (updater-owned, written on every --apply run and
    carrying its own delivery-completeness field) over profile.json's
    template_version -- the same precedence full_boot.sh uses (issue
    #1295/#1312), since profile.json can lag or never move if a prior run
    bailed early.

    NOTE (delivery-integrity F4): this fallback to profile.json is why this
    helper must NOT be the evidence the version-monotonicity guard refuses
    on. profile.json's template_version moves in lockstep with a local
    `bump_version.sh`, so with no stamp a locally-bumped consumer would be
    compared against its OWN bump and refused on a perfectly healthy
    checkout. _classify_version_and_guard() reads the stamp directly and
    treats its absence as missing evidence, never as evidence of a
    regression.
    """
    if TEMPLATE_STATE_PATH.exists():
        try:
            data = json.loads(TEMPLATE_STATE_PATH.read_text())
            v = data.get("template_version")
            if v:
                return str(v)
        except Exception:
            pass
    profile_path = Path(".agent/profile.json")
    if profile_path.exists():
        try:
            data = json.loads(profile_path.read_text())
            v = data.get("template_version")
            if v:
                return str(v)
        except Exception:
            pass
    return None


def _read_reconcile_from_version() -> tuple[str | None, bool]:
    """(version, came_from_anchor) --reconcile-from-history resolves against
    (baseline-guard-clearability D3, the keystone half of this feature).

    Prefers .agent/.template_state's `reconcile_from` field -- the version
    the stamp held IMMEDIATELY BEFORE the run that last left an untracked
    path undelivered -- over its `template_version` field, which a plain
    --apply advances on EVERY run, including one that withheld files (D-B).
    Resolving against template_version here would resolve against the
    release this workspace just applied, which by construction is not what
    a withheld, never-edited file's content still matches, so the recovery
    the WITHHELD report names could never succeed. Falls back to
    _read_recorded_template_version()'s ordinary precedence when no
    reconcile_from is recorded (nothing was ever withheld here, the state
    predates this field, or the field was removed by hand).

    The second element says WHICH of the two was used, because the caller
    must say so out loud: a silent fallback prints an authoritative-looking
    "recorded version = ..." for the version this workspace just applied,
    which is the trap this feature exists to close, wearing the fix's own
    output as a disguise.
    """
    if TEMPLATE_STATE_PATH.exists():
        try:
            data = json.loads(TEMPLATE_STATE_PATH.read_text())
            v = data.get("reconcile_from")
            if v:
                return str(v), True
        except Exception:
            pass
    return _read_recorded_template_version(), False


def _parse_dotted_version(v) -> tuple[int, ...] | None:
    """Parse a dotted version string ("3.7.10") into a tuple of ints.

    Never raises -- returns None on any unparseable input (missing,
    non-numeric component, etc.) so callers can degrade safely.
    """
    if v is None:
        return None
    try:
        parts = str(v).strip().split(".")
        if not parts:
            return None
        return tuple(int(p) for p in parts)
    except (ValueError, AttributeError):
        return None


def _compare_dotted_versions(a, b) -> int | None:
    """Numeric (not lexicographic) comparison of two dotted version strings.

    Shorter tuple is zero-padded to the longer one's length before
    comparing, so "3.7" == "3.7.0". Returns negative/zero/positive like a
    standard comparator, or None if either side is unparseable -- e.g.
    "3.7.9" vs "3.7.10" must resolve as 3.7.9 < 3.7.10 numerically, not as
    strings (lexicographically "3.7.9" > "3.7.10" because '9' > '1').
    """
    pa = _parse_dotted_version(a)
    pb = _parse_dotted_version(b)
    if pa is None or pb is None:
        return None
    length = max(len(pa), len(pb))
    pa = pa + (0,) * (length - len(pa))
    pb = pb + (0,) * (length - len(pb))
    if pa < pb:
        return -1
    if pa > pb:
        return 1
    return 0


def _check_version_regression(payload_version, installed_version, force) -> None:
    """Refuse an --apply whose payload template version is older than the
    installed one, unless --force was passed.

    No-op (returns normally) when force is truthy, when either version is
    missing/unparseable (degrade-safe -- never block on an unrelated
    versioning defect), or when payload >= installed. Otherwise exits via
    sys.exit(2) with a stderr message naming both version strings.
    """
    if force:
        return
    cmp_result = _compare_dotted_versions(payload_version, installed_version)
    if cmp_result is None:
        return
    if cmp_result < 0:
        print(
            f"ERROR: refusing to apply older template version "
            f"{payload_version!r} over installed version {installed_version!r} "
            "-- pass --force to override.",
            file=sys.stderr,
        )
        sys.exit(2)


def _read_template_state_record() -> dict:
    """Parsed .agent/.template_state, or {} when absent, unreadable or not a
    JSON object. Never raises -- an unparseable stamp is missing evidence,
    handled identically to an absent one.
    """
    if not TEMPLATE_STATE_PATH.exists():
        return {}
    try:
        data = json.loads(TEMPLATE_STATE_PATH.read_text())
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _stamp_is_high_confidence(stamp_version, stamp_delivery, local_version,
                              stamp_is_local: bool = True) -> bool:
    """Is the recorded last-delivered version trustworthy enough to REFUSE on?

    Only consulted when the incoming version sorts below the stamp (see
    _classify_version_and_guard) -- when incoming is at or above the stamp,
    upstream demonstrably has not regressed and staleness is irrelevant.

    Low confidence when the stamp was not written in THIS workspace (F4b: an
    inherited receipt is not evidence about the workspace that inherited it),
    when it is absent, unparseable, records a partial delivery (it names a
    version this workspace never fully received), or has drifted from local
    .agent/version by a different major/minor or by more than
    STAMP_STALENESS_PATCH_LIMIT patch releases. A stamp with no `delivery`
    field at all predates that feature and is not penalised for it --
    staleness is the fallback confidence signal for those.

    THE DRIFT WINDOW IS ONE-SIDED, DELIBERATELY (delivery-integrity F4d).
    STAMP_STALENESS_PATCH_LIMIT applies only when the stamp is BEHIND local.
    A stamp strictly AHEAD of local .agent/version is LOW confidence at ANY
    distance -- ahead-ness is not a tolerance window, because no honest
    sequence produces any ahead-ness at all. After an --apply,
    update_profile_version() sets .agent/version to the payload version, so
    local == stamp; local then only moves AHEAD, via bump_version.sh. Getting
    local BELOW the stamp requires a hand-edit down, a restore from an old
    backup, a stamp inherited from a further-ahead workspace (the F4c case),
    or a partial run where the stamp moved and .agent/version did not -- every
    one of them a reason to distrust the stamp, not to refuse on it. Refusing
    there hard-bricks the workspace behind a --force-only verdict, on the
    single record we have the most specific cause to doubt. Warn-and-proceed
    is the safe failure direction: incoming still sorts above local, so
    nothing regresses relative to what is actually installed.

    Reading this as a SYMMETRIC window is what hid the defect: every fixture
    that existed was stamp-behind, so `local[2] - stamp[2] <= LIMIT` -- trivially
    true for every negative difference -- was never exercised in the other
    direction.
    """
    if not stamp_is_local:
        return False
    stamp_parts = _parse_dotted_version(stamp_version)
    local_parts = _parse_dotted_version(local_version)
    if stamp_parts is None or local_parts is None:
        return False
    if stamp_delivery == "partial":
        return False
    length = max(len(stamp_parts), len(local_parts), 3)
    stamp_parts = stamp_parts + (0,) * (length - len(stamp_parts))
    local_parts = local_parts + (0,) * (length - len(local_parts))
    if stamp_parts[:2] != local_parts[:2]:
        return False
    if stamp_parts > local_parts:
        # Stamp AHEAD of local -- low confidence at any distance (F4d). Checked
        # BEFORE the staleness arithmetic below, which is satisfied by every
        # negative difference and so silently rated this state HIGH.
        return False
    return local_parts[2] - stamp_parts[2] <= STAMP_STALENESS_PATCH_LIMIT


def _stamp_is_ahead_of_local(stamp_version, local_version) -> bool:
    """Is the recorded stamp strictly AHEAD of local .agent/version?

    Used only to NAME the condition in the low-confidence warning (F4d D1/D2):
    a generic "low confidence" line leaves the operator with no idea which of
    the two records to repair. Returns False whenever either side is missing or
    unparseable -- an unresolvable comparison is a different report, handled by
    the unparseable branch in _classify_version_and_guard.
    """
    stamp_parts = _parse_dotted_version(stamp_version)
    local_parts = _parse_dotted_version(local_version)
    if stamp_parts is None or local_parts is None:
        return False
    length = max(len(stamp_parts), len(local_parts), 3)
    stamp_parts = stamp_parts + (0,) * (length - len(stamp_parts))
    local_parts = local_parts + (0,) * (length - len(local_parts))
    return stamp_parts > local_parts


def _classify_version_and_guard(payload_version, force) -> str:
    """Classify this --apply's version movement, report it in one line, and
    refuse only on evidence that actually supports a refusal.

    Returns the classification: UPGRADE, NO-CHANGE, RECONCILE-DOWN,
    REGRESSION or UNKNOWN. Exits 2 (via _check_version_regression) on a
    refused regression unless --force was passed.

    ORDERING IS THE DESIGN (delivery-integrity F4). incoming-vs-STAMP is
    consulted BEFORE stamp confidence:

      incoming >= stamp -- upstream cannot have regressed below a version it
        has already delivered here. Positive evidence, true no matter how
        stale the stamp is, so staleness is not even consulted. A local bump
        ahead of upstream lands here: informational, never a warning. Warning
        on this common, healthy case is what teaches a fleet to ignore the
        signal.
      incoming < stamp -- a regression is possible, so confidence decides:
        HIGH -> refuse (exit 2), naming both versions and --force.
        LOW  -> never refuse; warn loudly, proceed, converge. An honest weak
                guard beats a confident wrong one.

    The classification itself is measured against local .agent/version,
    because that is the number a human reads: a downward reconciliation and
    an ordinary upgrade previously printed the same "updated: .agent/version:
    X -> Y" line, and that ambiguity is what cost a consumer whole sessions.
    """
    local_version_path = Path(".agent/version")
    local_version = None
    if local_version_path.is_file():
        try:
            local_version = local_version_path.read_text().strip() or None
        except OSError:
            local_version = None

    state = _read_template_state_record()
    stamp_version = state.get("template_version") or None
    stamp_delivery = state.get("delivery")

    cmp_local = _compare_dotted_versions(payload_version, local_version)
    cmp_stamp = _compare_dotted_versions(payload_version, stamp_version)

    # F4b: provenance is consulted ONLY inside the decisive branch below.
    # Announcing it on every run — including the ordinary forward upgrade that
    # never consults the stamp at all — would put a WARN on every consumer
    # forever, which is the same credibility burn this feature exists to end,
    # re-entering through the door it just closed.
    stamp_is_local = _stamp_is_from_this_workspace(state)

    warning = None
    refuse_against = None
    if cmp_stamp is not None and cmp_stamp < 0:
        if _stamp_is_high_confidence(stamp_version, stamp_delivery, local_version,
                                     stamp_is_local=stamp_is_local):
            refuse_against = stamp_version
        elif not stamp_is_local:
            warning = (
                f"incoming template version {payload_version} sorts below the "
                f"recorded last-delivered version ({stamp_version}), but that record "
                "was NOT applied in this workspace — .agent/.template_state is a "
                "tracked file, so it arrives inherited through git in every clone "
                "and fork"
                + ("" if state.get(WORKSPACE_IDENTITY_FIELD)
                   else " (this one carries no workspace identity at all, which is "
                        "how every stamp written before this check looks)")
                + ". An inherited receipt is not evidence about this workspace, so "
                "it cannot justify refusing the update — proceeding and restamping "
                "it locally."
            )
        else:
            warning = (
                f"incoming template version {payload_version} sorts below the last "
                f"version recorded as delivered here ({stamp_version}), but that "
                f"record is low-confidence (delivery={stamp_delivery!r}, local "
                f".agent/version={local_version}, staleness limit "
                f"{STAMP_STALENESS_PATCH_LIMIT} patch releases) — proceeding "
                "instead of refusing"
                # F4d: name the specific inconsistency when it is ahead-ness.
                # "Low confidence" alone does not tell the operator WHICH of the
                # two records to repair, and this one is repairable: the stamp is
                # ahead of a version this workspace claims to be running.
                + (f". The recorded version {stamp_version} is AHEAD of local "
                   f".agent/version ({local_version}), which no honest sequence "
                   "produces — an --apply leaves them equal and bump_version.sh "
                   "only ever moves .agent/version up — so the record is treated "
                   "as corrupt or inherited rather than as grounds for a refusal"
                   if _stamp_is_ahead_of_local(stamp_version, local_version) else "")
            )
    elif cmp_stamp is None and cmp_local is not None and cmp_local < 0:
        warning = (
            f"no usable last-delivered version record (.agent/.template_state is "
            f"absent or unparseable), so the incoming version {payload_version} "
            f"cannot be checked against what upstream actually delivered here; "
            f"local .agent/version is {local_version}. A missing record is "
            "missing evidence, not evidence of an upstream rollback — proceeding."
        )

    # F4d: an UNRESOLVABLE comparison must be loud, not silent. When a version
    # string exists but does not parse, both _compare_dotted_versions() calls
    # return None, no branch above fires, and the run proceeds having checked
    # nothing while stdout prints an ordinary-looking classification line and
    # the exit code says the guard ran. That is a guard quietly declining to
    # run, which is worse than no guard.
    #
    # Loud, NOT refusing: refusing on an unparseable version would brick
    # legitimate pre-release workflows (3.7.149-rc1 is a plausible thing for a
    # consumer to be running) and would convert a reporting defect into an
    # availability one. Scoped strictly to strings that EXIST and fail to parse
    # -- an ABSENT stamp is already covered by the branch above, and warning on
    # absence would put a WARN on every fresh workspace's first apply.
    if warning is None and refuse_against is None:
        unresolvable = [
            (label, value)
            for label, value in (
                ("the incoming template version", payload_version),
                ("local .agent/version", local_version),
                ("the recorded version in .agent/.template_state", stamp_version),
            )
            if value is not None and _parse_dotted_version(value) is None
        ]
        if unresolvable:
            named = "; ".join(f"{label} ({value!r})" for label, value in unresolvable)
            warning = (
                f"{named} could not be parsed as a dotted numeric version, so NO "
                "monotonicity verdict was reached for this run — nothing was "
                "compared, and neither an upstream regression nor a local "
                "divergence would have been detected. The update proceeds (a "
                "pre-release or build-metadata version is a legitimate thing to "
                "be running, so this is reported rather than refused) and is "
                "classified UNKNOWN below."
            )

    if refuse_against is not None:
        classification = "REGRESSION"
        detail = (
            f"incoming {payload_version} sorts below {stamp_version}, the last "
            "version upstream actually delivered into this workspace"
        )
    elif cmp_local is None:
        classification = "UNKNOWN"
        detail = (
            f"cannot compare local .agent/version ({local_version!r}) with the "
            f"incoming version ({payload_version!r}) numerically — proceeding "
            "without a monotonicity verdict"
        )
    elif cmp_local > 0:
        classification = "UPGRADE"
        detail = f"{local_version} → {payload_version}"
    elif cmp_local == 0:
        classification = "NO-CHANGE"
        detail = f"already at {payload_version}"
    else:
        classification = "RECONCILE-DOWN"
        detail = (
            f"local {local_version} is AHEAD of upstream {payload_version}: this is "
            "a local bump ahead of upstream being reconciled downward, not an "
            "upstream rollback (last upstream delivery recorded here: "
            f"{stamp_version or 'none recorded'}). Converging on {payload_version}."
        )

    print(f"  version: {classification} — {detail}")
    if warning is not None:
        print(f"  WARN  version: {warning}", file=sys.stderr)
    if refuse_against is not None:
        # Reuses the existing refusal primitive verbatim: same message shape,
        # same exit 2, same --force bypass. Only the evidence it is handed
        # changed -- the stamp, never profile.json's local-bump-mirroring
        # template_version.
        _check_version_regression(payload_version, refuse_against, force=force)
    return classification


def _resolve_version_to_commit(version: str, repo: str = ATHANOR_REPO) -> str | None:
    """Bounded search over the .agent/version-touching commit history to find
    the commit whose resulting .agent/version content equals `version`.

    Tags are NOT usable for this -- confirmed empirically against the real
    Athanor repo: `git rev-parse v3.7.29` fails outright (no such tag) even
    though .agent/version's own history clearly passed through that value.
    ONE bounded search here resolves ONE sha for the whole recorded version,
    reused for every no-baseline file in the run -- the cost is a handful of
    `gh api` calls total, not one per file.

    Returns the commit sha, or None if `gh` is unavailable, any API call
    fails, or no commit in the searched history produced this exact version
    string. NEVER raises -- the caller must degrade to UNRESOLVED on None,
    never treat a failed/absent resolution as "safe to overwrite" (that
    would reopen exactly the defect class F5 fixed).
    """
    if shutil.which("gh") is None:
        print("  [reconcile] WARN: 'gh' not found on PATH — cannot resolve version to a commit")
        return None

    try:
        # --method GET is required: `gh api` defaults to POST the moment any
        # -f/-F param is present, which 404s against a read-only listing
        # endpoint like this one (confirmed empirically against the real
        # repo -- silently wrong without this flag, not a hypothetical).
        result = subprocess.run(
            ["gh", "api", f"repos/{repo}/commits", "--method", "GET",
             "-f", "path=.agent/version", "-f", "per_page=100",
             "--paginate", "--jq", ".[].sha"],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            print(f"  [reconcile] WARN: gh api commit history lookup failed: {result.stderr.strip()[:200]}")
            return None
        shas = [s for s in result.stdout.splitlines() if s.strip()]
    except (subprocess.TimeoutExpired, OSError) as e:
        print(f"  [reconcile] WARN: gh api commit history lookup failed: {e}")
        return None

    if not shas:
        print("  [reconcile] WARN: no commits found touching .agent/version — cannot resolve")
        return None

    target = version.strip()
    for sha in shas:
        try:
            result = subprocess.run(
                ["gh", "api", f"repos/{repo}/contents/.agent/version", "--method", "GET",
                 "-f", f"ref={sha}", "--jq", ".content"],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0:
                continue
            content = base64.b64decode(result.stdout.strip()).decode(errors="replace").strip()
        except Exception:
            continue
        if content == target:
            return sha

    print(
        f"  [reconcile] WARN: version {target!r} not found among "
        f"{len(shas)} commits touching .agent/version — cannot resolve"
    )
    return None


def _fetch_historical_tree(sha: str, tmpdir: Path, repo: str = ATHANOR_REPO) -> bool:
    """Stream the tarball at a specific historical commit sha into tmpdir.
    Same mechanism and cost class as fetch_latest_from_github() (one tarball
    fetch), parameterized by ref instead of always using main. Returns True
    on success; never raises.
    """
    try:
        p1 = subprocess.Popen(
            ["gh", "api", f"repos/{repo}/tarball/{sha}"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        p2 = subprocess.Popen(
            ["tar", "xz", "-C", str(tmpdir), "--strip-components=1"],
            stdin=p1.stdout, stderr=subprocess.PIPE,
        )
        p1.stdout.close()
        _, tar_err = p2.communicate(timeout=120)
        _, gh_err = p1.communicate(timeout=120)
        if p1.returncode != 0:
            summary = gh_err.decode(errors="replace").strip()[:200] if gh_err else ""
            print(f"  [reconcile] WARN: gh api tarball fetch at {sha} exited {p1.returncode}: {summary}")
            return False
        if p2.returncode != 0:
            summary = tar_err.decode(errors="replace").strip()[:200] if tar_err else ""
            print(f"  [reconcile] WARN: tar extract at {sha} exited {p2.returncode}: {summary}")
            return False
        return True
    except (subprocess.TimeoutExpired, OSError) as e:
        print(f"  [reconcile] WARN: historical tarball fetch at {sha} failed: {e}")
        return False


# baseline-guard-clearability F2/D5 (QA Q14): every degrade path below names
# --adopt-baseline as the next thing to try, which makes each of them an offer
# point. An offer without its hazard is how the operator ends up authorising a
# silent overwrite of a real edit one run later -- state it wherever the flag
# is suggested, not only in --help.
ADOPT_HAZARD_NOTE = (
    "    --adopt-baseline records the CURRENT local bytes as never diverged; "
    "the NEXT --apply then delivers the incoming content over them silently, "
    "with no FORCE line and no further warning. That is the intended outcome "
    "for a file you are confident was never edited, and a deferred silent "
    "overwrite of a real edit otherwise -- and a path withheld here is one "
    "this workspace could not tell apart."
)


def cmd_reconcile_from_history(targets: list[str]) -> int:
    """--reconcile-from-history PATH... handler (F6).

    Resolves the version recorded in .agent/.template_state (profile.json
    fallback) to a historical commit, fetches that historical tree ONCE, and
    for each named no-baseline path: if local content matches what THAT
    version shipped, the file was never edited -- DELIVER the incoming
    update immediately, IN THIS SAME RUN (not deferred to a second
    --apply), and record a baseline for it. If local already matches the
    CURRENT live content (nothing to deliver), still record a baseline so
    the file is protected going forward. If local matches NEITHER the old
    nor the new upstream content, it is a genuine hand-edit -- leave it
    exactly as F5 already treats it (skip + WARN on the next --apply), do
    not touch it.

    Delivery reuses _sync_file_with_guard() itself (issue: template-update-
    actually-updates F6) rather than a bare copy: for a confirmed-old-match,
    this function seeds the in-memory baseline to the historical hash
    (which equals local's current hash, by definition of the match) BEFORE
    calling the guard, so the guard's own existing, already-correct logic
    ("local matches baseline, incoming differs -> deliver freely") does the
    actual write -- including the symlink refusal (F8 EDGE 1) and backup
    creation that guard already implements, uniformly, with nothing
    duplicated here.

    NEVER records a baseline for, or delivers to, a file this function
    could not positively verify against a real historical or current
    snapshot -- degrading to "unresolved" is always the safe failure mode,
    overwriting never is. Every degrade path below returns 0 (a degraded
    recovery attempt is not a failure to complete the command) and never
    writes anything.
    """
    # baseline-guard-clearability D4: this revisits delivery-integrity F4b's
    # refusal for THIS call site only (F4b's own version-regression guard
    # elsewhere is untouched). The refusal's original justification -- that
    # reconciling against the wrong upstream snapshot overwrites local
    # content -- does not hold here: this function DELIVERS a file only when
    # its local bytes match a real historical release byte-for-byte, so the
    # recorded version is a hypothesis SELECTOR, not the safety gate. A wrong
    # hypothesis degrades to UNRESOLVED below, never to an overwrite. And
    # .agent/.template_state is a TRACKED file, so a foreign-identity stamp is
    # exactly what every fresh clone and fork inherits -- refusing outright
    # blocked the entire population this command exists for, while protecting
    # against nothing. Warn that the provenance is unverified, and proceed.
    state = _read_template_state_record()
    if state.get("template_version") and not _stamp_is_from_this_workspace(state):
        print(
            "--reconcile-from-history: WARN — the recorded version in "
            ".agent/.template_state was NOT applied in this workspace (the "
            "file is tracked, so it arrives inherited through git in every "
            "clone and fork) — its provenance is unverified. Proceeding "
            "anyway: this command only ever delivers a file when its local "
            "bytes match a real historical release byte-for-byte, so the "
            "hash comparison below is the safety gate, not this stamp — a "
            "wrong version hypothesis degrades to UNRESOLVED, never to an "
            "overwrite."
        )

    recorded_version, from_anchor = _read_reconcile_from_version()
    if not recorded_version:
        print(
            "--reconcile-from-history: no recorded version to reconcile from "
            "(.agent/.template_state missing, and .agent/profile.json has no "
            f"template_version either) — {len(targets)} file(s) unreconciled; "
            "try --adopt-baseline instead.\n" + ADOPT_HAZARD_NOTE
        )
        return 0

    if from_anchor:
        print(
            f"--reconcile-from-history: recorded version = {recorded_version!r} "
            "(from the `reconcile_from` anchor in .agent/.template_state — the "
            "version this workspace held before the run that withheld these "
            "paths)"
        )
    else:
        # D5/Q13: never let a fallback look like an anchor. Without this the
        # run prints a confident "recorded version = '9.9.9'" for the release
        # it just applied, and the resulting UNRESOLVED reads as proof the
        # file was hand-edited when it is only proof the anchor is missing.
        print(
            f"--reconcile-from-history: recorded version = {recorded_version!r} "
            "— WARN: NO `reconcile_from` anchor is recorded in "
            ".agent/.template_state, so this is the version this workspace "
            "last APPLIED, not the one it held before these paths were "
            "withheld. A never-edited file's bytes will not match a release "
            "applied after it was withheld, so expect UNRESOLVED here; that "
            "would be missing evidence, NOT evidence of a local edit."
        )
    sha = _resolve_version_to_commit(recorded_version)
    if sha is None:
        print(
            f"--reconcile-from-history: could not resolve version {recorded_version!r} "
            f"to a commit — {len(targets)} file(s) unreconciled; try --adopt-baseline instead.\n"
            + ADOPT_HAZARD_NOTE
        )
        return 0

    print(f"--reconcile-from-history: resolved {recorded_version!r} -> commit {sha} "
          "(a match against this is provisional evidence, not proof -- a WRONG "
          "recorded version cannot be detected by this mechanism alone; "
          "sanity-check the resolved version if you suspect drift)")

    old_tmpdir = Path(tempfile.mkdtemp(prefix="athanor-reconcile-old-"))
    new_tmpdir = Path(tempfile.mkdtemp(prefix="athanor-reconcile-new-"))
    try:
        if not _fetch_historical_tree(sha, old_tmpdir):
            print(
                f"--reconcile-from-history: could not fetch historical tree at {sha} — "
                f"{len(targets)} file(s) unreconciled; try --adopt-baseline instead.\n"
                + ADOPT_HAZARD_NOTE
            )
            return 0

        # Current live tree, fetched ONCE and reused for every target -- same
        # mechanism and cost class as a plain --apply's own default fetch.
        # If this fails, degrade to record-only (still correct, non-
        # destructive) rather than aborting the whole command over a
        # secondary fetch failure -- a partial win over none.
        have_new_tree = fetch_latest_from_github(new_tmpdir)
        if not have_new_tree:
            print(
                "  [reconcile] WARN: could not fetch current live tree — will still "
                "verify against history and record baselines, but cannot deliver "
                "in this run; a subsequent plain --apply will deliver once a "
                "baseline is recorded."
            )

        # F14: created eagerly (mirroring main()'s own pattern) only when
        # there is a live tree to potentially deliver from -- if the
        # backup directory itself can't be safely created, every RECONCILED
        # target below degrades to "delivery deferred" for this run rather
        # than a mid-delivery refusal, same policy as an unavailable live
        # tree.
        backup_dir: Path | None = None
        backup_dir_refused = False
        if have_new_tree:
            try:
                backup_dir = _create_guarded_backup_dir("reconcile-backup")
            except BackupDirRefused:
                backup_dir_refused = True
                print(
                    "  [reconcile] WARN: refusing to create the reconcile "
                    "backup directory (symlinked ancestor) — delivery "
                    "deferred for all targets this run; baselines will "
                    "still be recorded where resolvable."
                )

        baselines = load_template_baselines()
        reconciled: list[str] = []
        already_current: list[str] = []
        unreconciled: list[str] = []
        for key in targets:
            local_path = Path(key)
            if local_path.is_symlink():
                print(f"  UNRESOLVED  {key}: is a symlink — never a valid reconcile target (F8 EDGE 1)")
                unreconciled.append(key)
                continue
            if not local_path.exists() or not local_path.is_file():
                # D19 family: same caveat as --adopt-baseline's SKIP — an
                # unreadable path and a missing one are indistinguishable
                # here, so assert neither; this is missing evidence of
                # provenance, not evidence about the file.
                print(f"  UNRESOLVED  {key}: no readable regular file at this path (missing, not a regular file, or not readable) — provenance could not be established")
                unreconciled.append(key)
                continue

            historical_path = old_tmpdir / key
            if not historical_path.exists():
                print(f"  UNRESOLVED  {key}: did not exist in the historical tree at {sha}")
                unreconciled.append(key)
                continue

            try:
                local_hash = _sha256_of_file(local_path)
                historical_hash = _sha256_of_file(historical_path)
            except OSError as e:
                print(f"  UNRESOLVED  {key}: could not read for comparison ({e})")
                unreconciled.append(key)
                continue

            if local_hash != historical_hash:
                # Does not match the OLD snapshot either -- check the NEW
                # (current live) content too before giving up: a file that
                # already matches current upstream exactly has nothing to
                # deliver, but is still worth protecting with a retroactive
                # baseline. Only a match to NEITHER is treated as a genuine
                # hand-edit.
                new_path = new_tmpdir / key
                if have_new_tree and new_path.exists():
                    try:
                        new_hash = _sha256_of_file(new_path)
                    except OSError:
                        new_hash = None
                    if new_hash is not None and local_hash == new_hash:
                        baselines[key] = local_hash
                        save_template_baselines(baselines)
                        already_current.append(key)
                        print(f"  CURRENT     {key}: already matches live upstream content — nothing to deliver, baseline recorded")
                        continue
                unreconciled.append(key)
                if from_anchor:
                    # D19: "likely a real hand-edit" is only warranted when
                    # the anchor is known to be contemporaneous with THIS
                    # path becoming untracked, and a single scalar anchor
                    # cannot establish that -- one anchor serves every
                    # untracked path, however different their eras (D14). So
                    # even with a real anchor the mismatch is degraded to
                    # what is actually known, reusing the fallback branch's
                    # honest wording rather than asserting an edit nobody
                    # may have made.
                    print(f"  UNRESOLVED  {key}: differs from historical content at {recorded_version!r} — but a single anchor cannot prove it dates from when this path became untracked, so this is missing evidence of provenance, NOT evidence of a local edit; left as-is")
                else:
                    # No `reconcile_from` anchor: the version compared against
                    # is only the one this workspace last APPLIED (the header
                    # WARN above already conceded a never-edited file cannot
                    # match it). Asserting a hand-edit here would contradict
                    # that concession -- this mismatch is missing evidence,
                    # not evidence of a local edit.
                    print(f"  UNRESOLVED  {key}: differs from historical content at {recorded_version!r} — no `reconcile_from` anchor was available, so this is missing evidence of provenance, NOT evidence of a local edit; left as-is")
                continue

            # Matches OLD exactly -- never edited. Seed the baseline to the
            # historical (== current local) hash BEFORE calling the guard,
            # so _sync_file_with_guard()'s own existing "local matches
            # baseline, incoming differs" logic performs the actual delivery
            # -- reusing the guard rather than duplicating its write path.
            baselines[key] = historical_hash
            save_template_baselines(baselines)
            if have_new_tree and backup_dir is not None and (new_tmpdir / key).exists():
                status = _sync_file_with_guard(new_tmpdir / key, local_path, backup_dir, key)
                reconciled.append(key)
                print(f"  RECONCILED  {key}: matches historical content at {recorded_version!r} — never edited, delivered ({status})")
            else:
                reconciled.append(key)
                defer_reason = (
                    "backup directory unavailable (symlinked ancestor)" if backup_dir_refused
                    else "current live tree unavailable this run"
                )
                print(f"  RECONCILED  {key}: matches historical content at {recorded_version!r} — never edited, baseline recorded "
                      f"(delivery deferred: {defer_reason})")

        print()
        print(
            f"--reconcile-from-history: reconciled {len(reconciled)}, "
            f"already-current {len(already_current)}, unreconciled {len(unreconciled)}"
        )
        if unreconciled:
            print(f"  {len(unreconciled)} file(s) not reconciled: {unreconciled}")
            print("  These are UNCHANGED and remain protected under F5's default (skip + WARN). "
                  "Review individually, then consider --adopt-baseline for any confirmed safe.\n"
                  + ADOPT_HAZARD_NOTE)
        return 0
    finally:
        shutil.rmtree(old_tmpdir, ignore_errors=True)
        shutil.rmtree(new_tmpdir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(
        description="Athanor harness update driver — reads update-manifest.yaml, applies changes safely."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Show what would change without writing (safe default — use --apply to write)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes (writes files, creates backups). Requires explicit flag.",
    )
    parser.add_argument(
        "--source",
        default=None,
        help="Source directory for harness files (default: fetch from upstream GitHub, fall back to template/)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        default=False,
        help=(
            "Bypass the pre-apply version-regression guard -- allows applying "
            "a payload whose declared template version is older than the "
            "installed version. Distinct from --force-path (which bypasses "
            "the #104 baseline-hash guard for a single named path)."
        ),
    )
    parser.add_argument(
        "--force-path",
        action="append",
        default=None,
        metavar="PATH",
        help=(
            "DELIVERS the incoming content for exactly this one HARNESS path "
            "(repeatable) NOW, this run, replacing whatever is here now, "
            "even if it was hand-patched locally — a loud FORCE line names "
            "what it destroyed (a backup is taken first); the overwrite is "
            "visible immediately. Clears the #104 baseline-hash guard and "
            "force-overwrites it with canonical content. Opposite in effect "
            "to --adopt-baseline, which delivers nothing now — it silently "
            "defers delivery to the NEXT --apply instead. Never fires "
            "implicitly — requires --apply; a bare --force-path with "
            "--dry-run only previews what would be forced, it writes "
            "nothing. issue #1348 remediation: the supported 'un-stick this "
            "one file' path, narrower than FORCE_UPDATE=true (which "
            "re-applies everything)."
        ),
    )
    parser.add_argument(
        "--print-workspace-identity",
        action="store_true",
        default=False,
        help=(
            "Print this workspace's provenance fields as JSON and exit. Pure "
            "local read — no network, no writes. Used by execution/"
            "bump_version.sh so both stamp writers record identity the same "
            "way, and useful for diagnosing an 'inherited stamp' warning."
        ),
    )
    parser.add_argument(
        "--allow-skips",
        action="store_true",
        default=False,
        help=(
            "Acknowledge withheld deliveries: restore exit 0 on an --apply run "
            "that withheld or failed paths, while STILL printing the full "
            "WITHHELD report. Changes nothing about which files are delivered. "
            "Intended for automated loops that must keep going across a "
            "downstream with a permanent, deliberate local divergence — "
            "execution/fleet_update.sh (which reaches the updater indirectly, "
            "via `make update-template`) and execution/pulse_mission_loop.sh. "
            "NEITHER passes it today, and no caller in this repo does: it is "
            "CLI-only, per-invocation, and cannot be set out of band by an env "
            "var or a config file. Never implied by --force or --force-path, "
            "and it never clears a symlink refusal (see REFUSED, below)."
        ),
    )
    parser.add_argument(
        "--allow-symlink",
        action="append",
        default=None,
        metavar="PATH",
        help=(
            "One-shot supplement to .agent/allowed-symlinks (repeatable): "
            "let _refuse_symlinked_write() proceed through a symlinked "
            "ancestor at this path for THIS run only, without touching the "
            "project's committed allow-list. Matched the same way as "
            ".agent/allowed-symlinks entries (fnmatch pattern, or exact "
            "match, against the offending symlinked path relative to the "
            "workspace root)."
        ),
    )
    parser.add_argument(
        "--adopt-baseline",
        nargs="+",
        default=None,
        metavar="PATH_OR_ALL",
        help=(
            "Record baseline = sha256(CURRENT local content) for the named "
            "no-baseline HARNESS path(s), WITHOUT touching the file itself "
            "now — the NEXT plain --apply after this then delivers the "
            "incoming content over it silently, with no further warning, "
            "because the baseline now matches local exactly. Opposite in "
            "effect to --force-path, which delivers now, this run, "
            "visibly. Only safe when you are confident this path was never "
            "edited; if you cannot tell, treat it as one that was. Pass "
            "the single value 'all' to adopt every no-baseline HARNESS "
            "file found via the manifest. A DELIBERATE, one-time trust "
            "decision for migrating a pre-baseline-tracking workspace to "
            "F5-era operation — never invoked by --apply on its own, never "
            "safe to automate/run repeatedly (see docstring). Exits "
            "immediately after; does not run the normal update flow. "
            "template-update-actually-updates F6."
        ),
    )
    parser.add_argument(
        "--reconcile-from-history",
        nargs="+",
        default=None,
        metavar="PATH",
        help=(
            "Resolve the version recorded in .agent/.template_state (or "
            "profile.json fallback) to a historical commit, fetch that "
            "historical tree once, and for each named no-baseline HARNESS "
            "path: if local content matches what that version shipped, "
            "record a baseline retroactively (the file was never edited); "
            "otherwise leave it exactly as F5 already treats it (skip + "
            "WARN on the next run). Degrades to 'unresolved' — never to "
            "'safe to overwrite' — if the recorded version cannot be "
            "resolved. Exits immediately after; does not run the normal "
            "update flow. template-update-actually-updates F6."
        ),
    )
    args = parser.parse_args()

    # F6's two recovery affordances are standalone commands, not modifiers of
    # a normal --apply/--dry-run run: neither reads/writes HARNESS content,
    # both operate purely on the baseline store, and both must be reachable
    # ONLY via their own explicit flag being parsed here — never from inside
    # the ordinary --apply flow below, which is exactly what
    # verify_baseline_reconciliation.py's grep-level check exists to catch a
    # future regression of. Checked before any of the normal --apply/--source
    # setup below, so a plain --apply invocation is byte-for-byte unaffected
    # by either flag existing.
    # F4b: reported BEFORE every other gate (including the self-update guard),
    # because it is a pure local read that writes nothing — and because
    # execution/bump_version.sh, the other stamp writer, shells out to it as
    # the single source of truth for provenance rather than reimplementing the
    # hash. Two writers computing identity two ways is exactly the drift B15
    # exists to catch.
    if args.print_workspace_identity:
        print(json.dumps(_stamp_identity_fields()))
        sys.exit(0)
    if args.adopt_baseline is not None:
        sys.exit(cmd_adopt_baseline(args.adopt_baseline))
    if args.reconcile_from_history is not None:
        sys.exit(cmd_reconcile_from_history(args.reconcile_from_history))

    force_paths = frozenset(args.force_path or [])

    # Symlink allow-list opt-in (update-template-write-safety-hardening F2):
    # persistent .agent/allowed-symlinks file plus any one-shot --allow-symlink
    # values, merged and loaded into the module-level list
    # _refuse_symlinked_write() consults directly. Loaded here, before any
    # write-capable guard call (the guarded backup-dir creation below is the
    # first one in a real --apply run), so the opt-in covers every call site.
    global _ALLOWED_SYMLINK_PATTERNS
    _ALLOWED_SYMLINK_PATTERNS = _load_allowed_symlinks()
    _ALLOWED_SYMLINK_PATTERNS.extend(args.allow_symlink or [])
    if _ALLOWED_SYMLINK_PATTERNS:
        print(f"Symlink allow-list active: {_ALLOWED_SYMLINK_PATTERNS}")

    dry_run = not args.apply

    # Self-update guard: refuse to run inside the Athanor template repo itself.
    # Checked before fetch_latest_from_github() below -- a run this guard would
    # refuse must never perform the network fetch at all.
    workspace_file = Path("WORKSPACE")
    profile_file = Path(".agent/profile.json")
    is_template_repo = False

    if workspace_file.exists():
        if workspace_file.read_text().strip() == "Athanor":
            is_template_repo = True

    # Removed: bare project_name == "Athanor" check that could self-block
    # downstream workspaces with project_name set to "Athanor".
    # The WORKSPACE file (lines above) is the only reliable signal.

    if is_template_repo and not os.environ.get("FORCE_UPDATE") and not dry_run:
        print(
            "ERROR: Running inside the Athanor template repo. "
            "This command is for downstream workspaces only.\n"
            "Set FORCE_UPDATE=1 to proceed (development use only).",
            file=sys.stderr,
        )
        sys.exit(2)

    # Track whether we own a temp dir so we can clean it up in finally.
    fetched_tmpdir: Path | None = None

    if args.source is None:
        fetched_tmpdir = Path(tempfile.mkdtemp(prefix="athanor-update-"))
        if fetch_latest_from_github(fetched_tmpdir):
            source = fetched_tmpdir
            print(f"[fetch] Using upstream main from {source}")
        else:
            print("[fetch] WARN: gh fetch failed — falling back to local template/")
            source = Path("template")
            # We won't use fetched_tmpdir but we still own it; finally will clean it.
    else:
        source = Path(args.source)

    try:
        if not source.exists():
            print(f"ERROR: source directory not found: {source}", file=sys.stderr)
            sys.exit(1)

        if dry_run:
            print("[dry-run] No changes will be written. Pass --apply to apply changes.")
        else:
            print(f"[apply] Source: {source}. Backups created before overwriting.")

            # Pre-apply version-regression guard: refuse to install a payload
            # whose declared template version is older than what's already
            # installed, unless --force was passed. Gated to real --apply
            # runs only -- a --dry-run preview never writes anything so
            # there's nothing to regress.
            payload_version_file = source / ".agent" / "version"
            payload_version = (
                payload_version_file.read_text().strip()
                if payload_version_file.exists()
                else None
            )
            # delivery-integrity F4: classify the movement in one explicit
            # line and refuse only on evidence that supports a refusal (the
            # stamp, never profile.json's local-bump-mirroring
            # template_version -- see _classify_version_and_guard).
            _classify_version_and_guard(payload_version, force=args.force)

        # Load manifest
        manifest_path = Path(".agent/update-manifest.yaml")
        if not manifest_path.exists():
            print("ERROR: .agent/update-manifest.yaml not found", file=sys.stderr)
            sys.exit(1)

        try:
            import yaml
            manifest = yaml.safe_load(manifest_path.read_text())
        except ImportError:
            print("ERROR: PyYAML not available. Install with: pip install pyyaml", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: Failed to parse .agent/update-manifest.yaml: {e}", file=sys.stderr)
            sys.exit(1)

        # --force-path validation (issue #1348 remediation / F6) — fail fast,
        # before touching disk, if a requested path does not correspond to
        # any real HARNESS manifest entry, is ambiguous, or would resolve
        # outside the project tree. A silently-matching-nothing --force-path
        # would look like success while forcing nothing, which is exactly
        # the kind of quiet non-propagation this mission exists to
        # eliminate — so any of these is a hard error, not a WARN.
        if force_paths:
            _validate_force_paths(force_paths, manifest, source, project_root=Path.cwd().resolve())
            print(f"--force-path requested for: {sorted(force_paths)}")

        # Load .agent/no-update protected file list (optional)
        no_update_path = Path(".agent/no-update")
        protected_patterns: list[str] = []
        if no_update_path.exists():
            for line in no_update_path.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    protected_patterns.append(line)
            if protected_patterns:
                print(f"Protected patterns from .agent/no-update: {protected_patterns}")

        def is_protected(path: str) -> bool:
            for pattern in protected_patterns:
                if fnmatch.fnmatch(path, pattern) or path == pattern:
                    return True
            return False

        paths_changed = []
        paths_skipped = []
        paths_failed = []
        # delivery-integrity F1: content this run was carrying and did NOT
        # deliver. Deliberately NOT paths_skipped, which also collects
        # WORKSPACE entries, DERIVED entries, .agent/no-update protected
        # entries and every entry of a --dry-run -- keying the exit code off
        # that bucket would make every run in the fleet exit non-zero forever,
        # a louder version of the same lie.
        paths_withheld: list[str] = []
        # F4c-2: symlink refusals, kept apart from paths_withheld. A refusal is
        # a fact about the write PATH being unsafe, not about content
        # disagreeing, so it is exempt from the identical-content retraction
        # below (the bytes are there because whoever controls the symlink
        # target put them there, and they can change them a moment later) and
        # is not clearable with --allow-skips. The sanctioned hatch is the
        # per-path, auditable allow-list, which makes the write PROCEED.
        paths_refused: list[str] = []
        # baseline-guard-clearability F1: the subset of paths_withheld that
        # carries NO recorded baseline, as opposed to a real local edit. Used
        # to annotate the WITHHELD report honestly and to decide whether
        # .agent/.template_state needs a `reconcile_from` anchor.
        paths_untracked: list[str] = []
        backup_dir = None

        if not dry_run:
            # F14: every write this run performs relies on backup_dir being
            # real -- if it isn't, continuing would mean running the whole
            # apply WITHOUT the backup protection every other write site
            # assumes exists. Abort the run entirely rather than silently
            # degrade to unbacked writes.
            try:
                backup_dir = _create_guarded_backup_dir("update-backup")
            except BackupDirRefused:
                print("ERROR: refusing to run --apply with a symlinked backup directory ancestor.", file=sys.stderr)
                sys.exit(1)
            print(f"Backup directory: {backup_dir}")

        # baseline-guard-clearability D3/rule 1: capture the version this
        # workspace held BEFORE any writer this run touches it, so
        # write_template_state still has a real pre-run anchor to record for
        # a workspace that carries no .agent/.template_state at all -- the
        # pre-baseline-tracking population this feature exists for. This
        # MUST run before the manifest loop below: .agent/version is itself
        # a HARNESS manifest path, so on a workspace where it is
        # tracked-clean the loop overwrites it to the payload version --
        # reading it afterwards yields the applied version, which rule 2
        # correctly refuses to mint, and the anchor is lost entirely.
        prior_local_version: str | None = None
        if not dry_run:
            local_version_file = profile_file.parent / "version"
            try:
                if local_version_file.is_file():
                    prior_local_version = local_version_file.read_text().strip() or None
            except OSError:
                prior_local_version = None

        for entry in manifest.get("paths", []):
            path = entry["path"]
            category = entry["category"]

            # One bad manifest entry must never abort the whole run — a
            # single uncaught exception here used to skip the trailing
            # version-bump entirely, stranding the workspace in a permanent
            # "behind" state (issue #1295/#1312). Isolate each entry's
            # processing instead of letting it propagate out of main().
            try:
                if category == "WORKSPACE":
                    print(f"  skip  {path} (WORKSPACE — project-owned, never overwritten)")
                    paths_skipped.append(path)

                elif category == "DERIVED":
                    print(f"  skip  {path} (DERIVED — regenerated by make sync)")
                    paths_skipped.append(path)

                elif category == "HARNESS":
                    if dry_run:
                        # F10: per-file preview via predict_harness(), which
                        # calls the SAME _sync_file_with_guard() decision
                        # function --apply uses, in a predict=True (no-write)
                        # mode -- not a second, independently maintained
                        # guess from src_path.exists(). One would-* line per
                        # real on-disk file under this entry, not one line
                        # for the whole entry.
                        src_path = source / path.rstrip("/")
                        if not src_path.exists():
                            print(f"  would update: {path}  [MISSING in source]")
                        else:
                            dst_path = Path(path.rstrip("/"))
                            predictions = predict_harness(
                                src_path, dst_path, path, force_paths=force_paths
                            )
                            if not predictions:
                                print(f"  would update: {path}  [exists, no files found]")
                            for file_key, status in predictions:
                                word = PREDICT_STATUS_TO_PREVIEW_WORD.get(status, "would-update")
                                print(f"  {word}  {file_key}")
                        paths_skipped.append(path)
                    else:
                        src_path = source / path.rstrip("/")
                        dst_path = Path(path.rstrip("/"))

                        # The baseline-hash overwrite guard (issue #104) now lives
                        # inside copy_harness() / _sync_file_with_guard() — the
                        # actual point of write — so it applies uniformly whether
                        # this entry is a single file or a directory whose rglob
                        # walk touches many nested files, and regardless of
                        # whether a directory entry or a file entry for the same
                        # path is processed first. force_paths (F6) only ever
                        # bypasses the guard for the exact keys the caller passed
                        # via --force-path — empty by default, so a plain --apply
                        # run is byte-for-byte the same as before this feature.
                        msg, entry_changed = copy_harness(
                            src_path, dst_path, backup_dir, path_key=path,
                            force_paths=force_paths,
                            withheld_out=paths_withheld,
                            refused_out=paths_refused,
                            untracked_out=paths_untracked,
                        )
                        print(msg)
                        # F9: classify off copy_harness()'s own changed
                        # boolean, not by re-parsing msg -- a directory
                        # entry's message always reads "update (dir) ..."
                        # even when every file inside it was guarded (0
                        # bytes written), so a bare "SKIP" string check
                        # only ever caught the single-file guarded format.
                        if entry_changed:
                            paths_changed.append(path)
                        else:
                            paths_skipped.append(path)

                elif category == "MERGE":
                    strategy = entry.get("strategy", "unknown")
                    if is_protected(path):
                        print(f"  protected: {path} (.agent/no-update)")
                        paths_skipped.append(path)
                    elif dry_run:
                        print(f"  would merge ({strategy}): {path}")
                        paths_skipped.append(path)
                    else:
                        src_path = source / path
                        dst_path = Path(path)
                        if strategy == "line_union":
                            msg = merge_line_union(src_path, dst_path, backup_dir)
                        elif strategy == "json_deep_merge":
                            msg = merge_json_deep(src_path, dst_path, backup_dir)
                        else:
                            msg = f"  WARN  unknown merge strategy {strategy!r} for {path}"
                        print(msg)
                        paths_changed.append(path)

                else:
                    print(f"  WARN: unknown category {category!r} for {path}", file=sys.stderr)
            except Exception as e:
                print(f"  WARN  entry {path!r} failed: {e} — continuing", file=sys.stderr)
                paths_skipped.append(path)
                # template-update-actually-updates F8 EDGE 2: an exception
                # caught here (e.g. PermissionError writing a read-only
                # destination) previously only appeared as this one WARN line
                # mid-run -- easy to miss in scrollback, and the Summary block
                # never referenced it while template_version still bumped in
                # the same run (the exact false-success shape F1 already
                # closed for the skip-vs-version-bump case, recurring one
                # layer down for exception-caught failures specifically).
                # Tracked separately from routine paths_skipped (WORKSPACE/
                # DERIVED/protected entries, which are expected, benign skips)
                # so the Summary can name failures explicitly, not bury them
                # in a skip count that also contains ordinary non-events.
                paths_failed.append(f"{path}: {e.__class__.__name__}: {e}")

        # --- Missing-file backstop (orthogonal to manifest loop) ---
        backstop_copied, backstop_warnings = apply_missing_file_backstop(
            source=source,
            is_protected=is_protected,
            dry_run=dry_run,
            backup_dir=backup_dir,
        )
        paths_changed.extend(backstop_copied)
        # warnings flow into the printed summary; no exit code change

        # --- Fresh-manifest backstop (issue #1293) ---
        # Re-reads .agent/update-manifest.yaml from disk (it may have just been
        # updated by its own HARNESS entry above) and delivers any HARNESS
        # destination that is still missing — closes the stale in-memory
        # manifest-snapshot gap that REQUIRED_FILES alone cannot cover.
        fresh_backstop_delivered = apply_fresh_manifest_backstop(
            manifest_path=manifest_path,
            source=source,
            dry_run=dry_run,
            backup_dir=backup_dir,
        )
        paths_changed.extend(fresh_backstop_delivered)

        # --- Retraction pass (delivered-value-retraction F1) ---
        # Runs after the normal manifest loop and both backstops -- a value
        # we delivered once and now know was wrong (e.g. the unexpanded
        # $ANTHROPIC_DEFAULT_HAIKU_MODEL literal) can never be corrected by
        # deep_merge()/json_deep_merge() above, since that loop only ever
        # adds/overwrites keys the incoming source currently has.
        retractions_fired = apply_retractions(
            manifest=manifest,
            project_root=Path.cwd(),
            backup_dir=backup_dir,
            dry_run=dry_run,
        )

        # After applying all HARNESS/MERGE updates AND backstop,
        # bump template_version in profile.json
        stamp_divergent = False
        if not dry_run:
            # prior_local_version was captured above, BEFORE the manifest
            # loop -- .agent/version is a HARNESS path the loop itself may
            # have just overwritten (baseline-guard-clearability D3/rule 1).
            version_msg = update_profile_version(source, profile_file)
            print(version_msg)

            # F1/F14: a key the manifest loop guarded may still have been
            # delivered by a LATER writer in this same run --
            # update_profile_version() writes .agent/version directly, so a
            # consumer who locally bumped it trips the baseline guard and
            # then receives the file anyway. Reporting it as withheld would
            # be a false partial-delivery claim, the exact inverse of the lie
            # this feature closes. Decided on content, not on a hardcoded
            # exemption list: if the destination now matches the payload,
            # it was delivered.
            paths_withheld = [
                key for key in paths_withheld
                if not _paths_have_identical_content(source / key, Path(key))
            ]
            # Keep paths_untracked in lockstep with the same retraction --
            # a key removed above because a later writer already delivered
            # it must not still be reported/tracked as an untracked no-record
            # withholding either.
            paths_untracked = [key for key in paths_untracked if key in paths_withheld]

            delivery_status = (
                "partial" if (paths_withheld or paths_refused or paths_failed)
                else "complete"
            )
            try:
                state_msg = write_template_state(
                    source, delivery=delivery_status,
                    withheld=paths_withheld, failed=paths_failed,
                    refused=paths_refused, untracked=paths_untracked,
                    prior_local_version=prior_local_version,
                )
            except OSError as e:
                state_msg = (
                    "  ERROR .template_state update failed "
                    f"({e.__class__.__name__}: {e})"
                )
            print(state_msg)

            # The stamp is what every downstream drift check reads. If it did
            # not actually record the version this run applied, the workspace
            # is left with divergent version records -- say so here, at the
            # moment it happens, and never exit 0 on it.
            recorded = _read_template_state_record().get("template_version")
            if payload_version and recorded != payload_version:
                stamp_divergent = True
                print(
                    "  WARN  .agent/.template_state does not record the applied "
                    f"template version {payload_version} (reads {recorded!r}) — "
                    "this workspace's version records are divergent",
                    file=sys.stderr,
                )

        print()
        print("Summary:")
        print(f"  paths_changed:    {len(paths_changed)}")
        print(f"  paths_skipped:    {len(paths_skipped)}")
        print(f"  paths_withheld:   {len(paths_withheld)}")
        print(f"  paths_refused:    {len(paths_refused)}")
        print(f"  paths_failed:     {len(paths_failed)}")
        if paths_failed:
            # Named explicitly, in the Summary block itself (F8 EDGE 2) --
            # a version bump printed just above must never be the last word
            # a human reading only the tail of a log sees when a legitimate
            # write actually failed mid-run.
            for pf in paths_failed:
                print(f"    - {pf}")
        print(f"  backstop_copies:  {len(backstop_copied)}")
        print(f"  backstop_warns:   {len(backstop_warnings)}")
        print(f"  retractions:      {len(retractions_fired)}")
        if backup_dir:
            print(f"  backup_dir:       {backup_dir}")

        # --- Withheld-delivery report + exit code (delivery-integrity F1) ---
        # A per-file WARN mid-run is easy to lose in scrollback, and the run
        # exiting 0 told `make update-template` and every automated caller
        # that a security fix had landed when it had not (GH #1319 / #1348).
        # Name every undelivered path HERE, in the terminal block, with the
        # two remedies that actually clear it.
        if paths_withheld:
            print()
            print("WITHHELD — these paths were NOT delivered by this run:")
            untracked_set = set(paths_untracked)
            for key in paths_withheld:
                tag = "no baseline recorded" if key in untracked_set else "local modifications"
                print(f"    - {key}  [{tag}]")
            print(
                "  Remedy, ordered by evidence then destructiveness:\n"
                "    1. --reconcile-from-history <path...> checks each "
                "withheld path against the release this workspace records "
                "and DELIVERS only the ones proven byte-identical to what "
                "that release shipped; every other path is left untouched. "
                "It moves a matched file FORWARD to what upstream currently "
                "ships -- a file you deliberately pinned to an older "
                "release is byte-identical to one never touched, so hold "
                "intentional pins in .agent/no-update rather than relying "
                "on this to skip them.\n"
                "    2. --force-path <path> delivers the incoming content "
                "NOW, this run, and prints a loud FORCE line naming what it "
                "destroyed (a backup is taken first) -- the overwrite is "
                "visible immediately.\n"
                "    3. --adopt-baseline <path> does not touch the file "
                "now, but the NEXT --apply after it delivers the incoming "
                "content silently, with no further warning -- only safe "
                "when you are confident the file was never edited; if you "
                "cannot tell, treat it as one that was.\n"
                "  Pass --allow-skips to acknowledge these and exit 0 "
                "without changing what is delivered."
            )
            if paths_untracked:
                print(
                    "  This workspace has no baseline recorded for: "
                    + ", ".join(sorted(paths_untracked))
                    + " -- that is absence of a record, not evidence they "
                    "were edited. Recover them in one step:\n"
                    "    python3 execution/update_template.py "
                    "--reconcile-from-history "
                    # Shell-quoted: a manifest path containing a space would
                    # otherwise paste as two wrong targets, and this command
                    # exists precisely so the operator does not retype it.
                    + " ".join(shlex.quote(p) for p in sorted(paths_untracked))
                )

        if paths_refused:
            print()
            print("REFUSED — symlinked destinations, nothing was written to them:")
            for key in paths_refused:
                print(f"    - {key}  [symlink refusal — this destination is reached "
                      "through a symlink to an external, potentially attacker- or "
                      "operator-controlled path]")
            print(
                "  This is a security refusal about the write PATH, not a content "
                "disagreement, so it is deliberately NOT cleared by --allow-skips "
                "and NOT retracted by the destination happening to hold matching "
                "bytes right now. Remedy: replace or remove the symlink and re-run, "
                "or — if the indirection is intentional — declare that exact path "
                "in .agent/allowed-symlinks (or pass --allow-symlink), which lets "
                "the write actually proceed instead of muting the report."
            )

        # exit 0 for every --dry-run: a preview writes nothing, so it cannot
        # deliver partially. backstop_warns stays deliberately out of the
        # exit code -- it describes an incomplete SOURCE payload, not a
        # withheld local delivery.
        if not dry_run:
            if stamp_divergent:
                sys.exit(1)
            # --allow-skips acknowledges CONTENT the operator knowingly keeps;
            # it may not mute a compromised write path (F4c-2 C12).
            if paths_refused:
                sys.exit(1)
            if (paths_withheld or paths_failed) and not args.allow_skips:
                sys.exit(1)

    finally:
        if fetched_tmpdir is not None:
            shutil.rmtree(fetched_tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()

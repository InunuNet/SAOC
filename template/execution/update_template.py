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
import fnmatch
import hashlib
import json
import os
import shutil
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

# Applied-version state file (issue #1293 follow-on) — direct-write updater-owned
# state, tracked outside .agent/update-manifest.yaml entirely (same pattern as
# .agent/version itself). Written only on a fully successful --apply run so a
# partial-failure run never reports a false "current" state to full_boot.sh.
TEMPLATE_STATE_PATH = Path(".agent/.template_state")


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
    store_path.write_text(json.dumps(baselines, indent=2, sort_keys=True) + "\n")


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
        if comp.is_symlink():
            return True, comp
        if comp == stop_resolved:
            break
    return False, None


def _describe_symlink_target(offending: Path) -> str:
    """Format an offending symlink component's resolved (or unresolvable) target."""
    try:
        return str(offending.resolve())
    except OSError:
        return f"{os.readlink(offending)} (unresolvable)"


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
    print(
        f"  WARN  {label} is reached through a symlink at {offending} -> "
        f"{target_desc} — REFUSING to write through a symlinked "
        "destination (would write content to an external, potentially "
        "attacker- or operator-controlled path). Replace or remove the "
        "symlink manually, then re-run, if this path should hold "
        "canonical content."
    )
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
                reason = (
                    "has local modifications since the last template sync"
                    if not no_record else
                    "has no recorded baseline (no prior sync tracked this file, "
                    "or the baseline store is missing/corrupt) and differs from "
                    "incoming content -- treated as diverged, not as safe to "
                    "overwrite"
                )
                print(
                    f"  WARN  {baseline_key} {reason} — SKIPPING overwrite "
                    "(baseline mismatch; see .agent/memory/scratch/"
                    "template_baselines.json). To deliberately clear local "
                    f"modifications and restore canonical content, re-run "
                    f"with: --force-path {baseline_key}"
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
            print(
                f"  FORCE {baseline_key} — local modifications detected "
                "(baseline mismatch); overwriting with canonical content "
                "because --force-path was passed explicitly for this path"
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
            return "skipped"
        if not predict:
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dst_file, backup_path)

    if not predict:
        dst_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_file, dst_file)

        try:
            new_hash = _sha256_of_file(dst_file)
        except OSError:
            new_hash = None
        if new_hash is not None:
            baselines = load_template_baselines()
            baselines[baseline_key] = new_hash
            save_template_baselines(baselines)

    return "forced" if guard_bypassed else "copied"


def copy_harness(
    src: Path, dst: Path, backup_dir: Path, path_key: str | None = None,
    force_paths: frozenset[str] = frozenset(),
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
                src_file, dst_file, backup_dir, file_key, force=file_key in force_paths
            )
            if status == "copied":
                copied.append(str(rel))
            elif status == "forced":
                forced.append(str(rel))
            elif status == "unchanged":
                unchanged_count += 1
            else:
                guarded.append(str(rel))
        detail = f"copied {len(copied)}, unchanged {unchanged_count}"
        if forced:
            detail += f", FORCED {forced}"
        if guarded:
            detail += f", guarded {guarded}"
        changed = bool(copied or forced)
        return f"  update (dir)  {dst}  [{detail}]", changed
    else:
        status = _sync_file_with_guard(src, dst, backup_dir, path_key, force=path_key in force_paths)
        if status == "copied":
            return f"  update (file) {dst}", True
        if status == "forced":
            return f"  FORCE (file)  {dst}", True
        if status == "unchanged":
            return f"  unchanged     {dst}", False
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
        shutil.copy2(dst, backup_path)

    merged = dst_lines + new_lines
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text("\n".join(merged) + "\n")
    return f"  merge  (line_union, +{len(new_lines)} lines): {dst}"


def deep_merge(base: dict, override: dict) -> dict:
    """Deep merge: override values take priority; nested dicts are merged recursively."""
    result = dict(base)
    for key, val in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(val, dict):
            result[key] = deep_merge(result[key], val)
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
        shutil.copy2(dst, backup_path)

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(merged, indent=2) + "\n")
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
            shutil.copy2(dst, backup_path)

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
            dst.write_text(json.dumps(data, indent=2) + "\n")
        except OSError as e:
            print(f"  retraction SKIP   {rel_path}::{key_path} (write failed: {e})", file=sys.stderr)
            continue

        print(f"  retraction FIRED  {rel_path}::{key_path} -- {action} (was {current_value!r}) -- {reason}")

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
            log_path.write_text(json.dumps(existing, indent=2) + "\n")

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
            local_version_path.write_text(new_version + "\n")
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
            profile_path.write_text(json.dumps(profile, indent=2) + "\n")

    if not changes:
        return f"  unchanged template_version ({new_version})"

    return f"  updated: {'; '.join(changes)}"


def write_template_state(source: Path, state_path: Path = TEMPLATE_STATE_PATH) -> str:
    """Persist the applied template_version to .agent/.template_state.

    Only called from the full-success path in main() (never from a partial-failure
    run — see A6). Only rewrites when the version actually changed, so a no-op
    second --apply run leaves the file byte-identical (see A8) instead of
    refreshing applied_at every time.
    """
    version_file = source / ".agent" / "version"
    if not version_file.exists():
        return "  SKIP  .template_state update (source .agent/version not found)"

    new_version = version_file.read_text().strip()
    if not new_version:
        return "  SKIP  .template_state update (source .agent/version is empty)"

    if state_path.exists():
        try:
            current = json.loads(state_path.read_text())
        except Exception:
            current = {}
        if current.get("template_version") == new_version:
            return f"  unchanged .template_state ({new_version})"

    # F10 (#9): same fixed-workspace-relative-path caveat as
    # update_profile_version()'s local .agent/version write above.
    if _refuse_symlinked_write(state_path, ".agent/.template_state"):
        return "  SKIP  .template_state update (destination is symlinked)"

    applied_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(
        json.dumps({"template_version": new_version, "applied_at": applied_at}, indent=2) + "\n"
    )
    return f"  updated .template_state: template_version → {new_version}"


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
            print(f"  SKIP  {key}: not found on disk (or not a regular file) — nothing to adopt")
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
        print(
            "  The NEXT --apply will treat these as an ordinary 'local matches "
            "baseline' file -- ONLY a subsequent real upstream change delivers "
            "normally; nothing about the file itself was touched by this run."
        )
    return 0


def _read_recorded_template_version() -> str | None:
    """Recorded version this workspace last knew itself to be at. Prefers
    .agent/.template_state (updater-owned, written only on a fully
    successful --apply run) over profile.json's template_version -- the
    same precedence full_boot.sh uses (issue #1295/#1312), since profile.json
    can lag or never move if a prior run bailed early.
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
    recorded_version = _read_recorded_template_version()
    if not recorded_version:
        print(
            "--reconcile-from-history: no recorded version to reconcile from "
            "(.agent/.template_state missing, and .agent/profile.json has no "
            f"template_version either) — {len(targets)} file(s) unreconciled; "
            "try --adopt-baseline instead."
        )
        return 0

    print(f"--reconcile-from-history: recorded version = {recorded_version!r}")
    sha = _resolve_version_to_commit(recorded_version)
    if sha is None:
        print(
            f"--reconcile-from-history: could not resolve version {recorded_version!r} "
            f"to a commit — {len(targets)} file(s) unreconciled; try --adopt-baseline instead."
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
                f"{len(targets)} file(s) unreconciled; try --adopt-baseline instead."
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
                print(f"  UNRESOLVED  {key}: not found on disk (or not a regular file)")
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
                print(f"  UNRESOLVED  {key}: differs from historical content at {recorded_version!r} — likely a real hand-edit, left as-is")
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
                  "Review individually, then consider --adopt-baseline for any confirmed safe.")
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
        "--force-path",
        action="append",
        default=None,
        metavar="PATH",
        help=(
            "Clear the #104 baseline-hash guard for exactly this one HARNESS "
            "path (repeatable) and force-overwrite it with canonical content, "
            "even if it was hand-patched locally. Never fires implicitly — "
            "requires --apply; a bare --force-path with --dry-run only "
            "previews what would be forced, it writes nothing. issue #1348 "
            "remediation: the supported 'un-stick this one file' path, "
            "narrower than FORCE_UPDATE=true (which re-applies everything)."
        ),
    )
    parser.add_argument(
        "--adopt-baseline",
        nargs="+",
        default=None,
        metavar="PATH_OR_ALL",
        help=(
            "Record baseline = sha256(CURRENT local content) for the named "
            "no-baseline HARNESS path(s), WITHOUT touching the file itself. "
            "Pass the single value 'all' to adopt every no-baseline HARNESS "
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
    if args.adopt_baseline is not None:
        sys.exit(cmd_adopt_baseline(args.adopt_baseline))
    if args.reconcile_from_history is not None:
        sys.exit(cmd_reconcile_from_history(args.reconcile_from_history))

    force_paths = frozenset(args.force_path or [])

    dry_run = not args.apply

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

        # Self-update guard: refuse to run inside the Athanor template repo itself
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
        if not dry_run:
            version_msg = update_profile_version(source, profile_file)
            print(version_msg)
            state_msg = write_template_state(source)
            print(state_msg)

        print()
        print("Summary:")
        print(f"  paths_changed:    {len(paths_changed)}")
        print(f"  paths_skipped:    {len(paths_skipped)}")
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

    finally:
        if fetched_tmpdir is not None:
            shutil.rmtree(fetched_tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()

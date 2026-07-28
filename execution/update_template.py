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
    """
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


def _sync_file_with_guard(
    src_file: Path, dst_file: Path, backup_dir: Path | None, baseline_key: str
) -> str:
    """Single point of write for one HARNESS file (issue #104, round 2).

    Checks the baseline-hash guard for dst_file, then either backs up + copies
    src_file over it and refreshes the baseline, or WARNs and leaves dst_file
    byte-for-byte untouched. Both copy_harness()'s single-file branch and its
    directory/rglob branch route every individual file write through this
    helper, so the guard applies uniformly and is independent of manifest
    entry order — a directory entry can never clobber a file before a later
    file-level entry's own guard would have run, because the check lives here,
    at the point of write, not in the manifest-loop dispatch.

    Returns "copied", "unchanged", or "skipped".
    """
    if dst_file.exists() and dst_file.is_file():
        # Idempotency short-circuit: if dst already holds byte-identical
        # content to src, there is nothing to sync — skip the backup +
        # rewrite entirely so a second --apply run on an already-current
        # workspace is a true no-op (no new backup-dir entries, no touched
        # mtimes).
        try:
            if _sha256_of_file(dst_file) == _sha256_of_file(src_file):
                return "unchanged"
        except OSError:
            pass

        baselines = load_template_baselines()
        baseline_hash = baselines.get(baseline_key)
        if baseline_hash:
            try:
                current_hash = _sha256_of_file(dst_file)
            except OSError:
                current_hash = None
            if current_hash is not None and current_hash != baseline_hash:
                print(
                    f"  WARN  {baseline_key} has local modifications since the "
                    "last template sync — SKIPPING overwrite "
                    "(baseline mismatch; see .agent/memory/scratch/"
                    "template_baselines.json)"
                )
                return "skipped"

    if dst_file.exists() and backup_dir is not None:
        backup_path = backup_dir / dst_file
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dst_file, backup_path)

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

    return "copied"


def copy_harness(
    src: Path, dst: Path, backup_dir: Path, is_protected=None, path_key: str | None = None
) -> str:
    """Copy a HARNESS path (file or directory) with backup. Returns change description.

    path_key is the manifest "path" string this entry corresponds to, used to key
    the baseline-hash overwrite guard (issue #104). For directory entries, every
    file discovered via rglob gets its own baseline key of
    f"{path_key.rstrip('/')}/{relative_posix_path}" so nested files (e.g.
    execution/pulse_mission_loop.sh inside the execution/ directory entry) are
    guarded individually. When is_protected is provided and src is a directory,
    files listed in .agent/no-update are skipped entirely (existing behavior,
    unrelated to the baseline guard).
    """
    if path_key is None:
        path_key = str(dst)

    if not src.exists():
        return f"  SKIP  (source missing: {src})"

    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        base_key = path_key.rstrip("/")
        copied: list[str] = []
        unchanged_count = 0
        guarded: list[str] = []
        protected: list[str] = []
        for src_file in sorted(src.rglob("*")):
            if src_file.is_dir():
                continue
            rel = src_file.relative_to(src)
            dst_file = dst / rel
            workspace_rel = str(dst_file)
            if is_protected is not None and is_protected(workspace_rel):
                protected.append(str(rel))
                continue
            file_key = f"{base_key}/{rel.as_posix()}"
            status = _sync_file_with_guard(src_file, dst_file, backup_dir, file_key)
            if status == "copied":
                copied.append(str(rel))
            elif status == "unchanged":
                unchanged_count += 1
            else:
                guarded.append(str(rel))
        detail = f"copied {len(copied)}, unchanged {unchanged_count}"
        if guarded:
            detail += f", guarded {guarded}"
        if protected:
            detail += f", protected {protected}"
        return f"  update (dir)  {dst}  [{detail}]"
    else:
        status = _sync_file_with_guard(src, dst, backup_dir, path_key)
        if status == "copied":
            return f"  update (file) {dst}"
        if status == "unchanged":
            return f"  unchanged     {dst}"
        return f"  SKIP  (guarded) {dst}"


def merge_line_union(src: Path, dst: Path, backup_dir: Path) -> str:
    """Merge strategy: union of lines (src lines added if not already in dst)."""
    if not src.exists():
        return f"  SKIP  (source missing: {src})"

    src_lines = src.read_text().splitlines()
    dst_lines = dst.read_text().splitlines() if dst.exists() else []

    dst_set = set(dst_lines)
    new_lines = [line for line in src_lines if line not in dst_set]

    if not new_lines:
        return f"  unchanged (line_union): {dst}"

    if dst.exists():
        backup_path = backup_dir / dst
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

    src_data = json.loads(src.read_text())
    dst_data = json.loads(dst.read_text()) if dst.exists() else {}

    merged = deep_merge(dst_data, src_data)

    if merged == dst_data:
        return f"  unchanged (json_deep_merge): {dst}"

    if dst.exists():
        backup_path = backup_dir / dst
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dst, backup_path)

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(merged, indent=2) + "\n")
    return f"  merge  (json_deep_merge): {dst}"


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

        # Apply.
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"  backstop copy     {rel_path} (restored from source)")
        copied.append(rel_path)

    return copied, warnings


def apply_fresh_manifest_backstop(
    manifest_path: Path,
    source: Path,
    is_protected,
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
        if path.endswith("/"):
            src_dir = source / path.rstrip("/")
            if not src_dir.exists():
                continue
            for src_file in sorted(src_dir.rglob("*")):
                if src_file.is_dir():
                    continue
                rel = src_file.relative_to(src_dir)
                dst_file = Path(path.rstrip("/")) / rel
                dst_key = f"{path.rstrip('/')}/{rel.as_posix()}"
                if dst_file.exists() or is_protected(dst_key):
                    continue
                if not dry_run:
                    _sync_file_with_guard(src_file, dst_file, backup_dir, dst_key)
                    delivered.append(dst_key)
        else:
            dst_file = Path(path)
            src_file = source / path
            if dst_file.exists() or is_protected(path) or not src_file.exists():
                continue
            if not dry_run:
                _sync_file_with_guard(src_file, dst_file, backup_dir, path)
                delivered.append(path)

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
    args = parser.parse_args()

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
        backup_dir = None

        if not dry_run:
            ts = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
            backup_dir = Path(f".agent/memory/scratch/update-backup-{ts}")
            backup_dir.mkdir(parents=True, exist_ok=True)
            print(f"Backup directory: {backup_dir}")

        for entry in manifest.get("paths", []):
            path = entry["path"]
            category = entry["category"]

            if category == "WORKSPACE":
                print(f"  skip  {path} (WORKSPACE — project-owned, never overwritten)")
                paths_skipped.append(path)

            elif category == "DERIVED":
                print(f"  skip  {path} (DERIVED — regenerated by make sync)")
                paths_skipped.append(path)

            elif category == "HARNESS":
                if is_protected(path):
                    print(f"  protected: {path} (.agent/no-update)")
                    paths_skipped.append(path)
                elif dry_run:
                    src_path = source / path.rstrip("/")
                    exists = "exists" if src_path.exists() else "MISSING in source"
                    print(f"  would update: {path}  [{exists}]")
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
                    # path is processed first.
                    msg = copy_harness(
                        src_path, dst_path, backup_dir, is_protected=is_protected, path_key=path
                    )
                    print(msg)
                    if msg.strip().startswith("SKIP"):
                        paths_skipped.append(path)
                    else:
                        paths_changed.append(path)

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
            is_protected=is_protected,
            dry_run=dry_run,
            backup_dir=backup_dir,
        )
        paths_changed.extend(fresh_backstop_delivered)

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
        print(f"  backstop_copies:  {len(backstop_copied)}")
        print(f"  backstop_warns:   {len(backstop_warnings)}")
        if backup_dir:
            print(f"  backup_dir:       {backup_dir}")

    finally:
        if fetched_tmpdir is not None:
            shutil.rmtree(fetched_tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()

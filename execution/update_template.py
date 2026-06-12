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
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path


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


def copy_harness(src: Path, dst: Path, backup_dir: Path) -> str:
    """Copy a HARNESS path (file or directory) with backup. Returns change description."""
    if not src.exists():
        return f"  SKIP  (source missing: {src})"

    if src.is_dir():
        if dst.exists():
            shutil.copytree(dst, backup_dir / dst, dirs_exist_ok=True)
        shutil.copytree(src, dst, dirs_exist_ok=True)
        return f"  update (dir)  {dst}"
    else:
        if dst.exists():
            backup_path = backup_dir / dst
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dst, backup_path)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return f"  update (file) {dst}"


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
    """After a successful apply, bump template_version in profile.json from source version file."""
    version_file = source / ".agent" / "version"
    if not version_file.exists():
        return "  SKIP  template_version update (source .agent/version not found)"

    new_version = version_file.read_text().strip()
    if not profile_path.exists():
        return "  SKIP  template_version update (profile.json not found)"

    try:
        profile = json.loads(profile_path.read_text())
    except Exception as e:
        return f"  WARN  template_version update failed (bad profile.json): {e}"

    old_version = profile.get("template_version", "unknown")
    if old_version == new_version:
        return f"  unchanged template_version ({new_version})"

    profile["template_version"] = new_version
    profile_path.write_text(json.dumps(profile, indent=2) + "\n")
    return f"  updated template_version: {old_version} → {new_version}"


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
                    msg = copy_harness(src_path, dst_path, backup_dir)
                    print(msg)
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

        # After applying all HARNESS/MERGE updates AND backstop,
        # bump template_version in profile.json
        if not dry_run:
            version_msg = update_profile_version(source, profile_file)
            print(version_msg)

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

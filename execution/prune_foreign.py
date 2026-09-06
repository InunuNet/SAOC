#!/usr/bin/env python3
"""prune_foreign.py — safe-by-construction removal of foreign-platform files
that a delivery or update left behind (platform-scoped-delivery D2).

    python3 execution/prune_foreign.py --workspace-root W --template-root T \
        [--manifest PATH] [--dry-run]
    python3 execution/prune_foreign.py --restore TRASHDIR --workspace-root W

Candidacy — a file may be pruned ONLY if ALL three hold:
  1. GOVERNED  -- its longest-prefix manifest entry declares a `platforms:`
     scope that EXCLUDES the host. Undeclared is never "excludes" -- it is
     never prunable ("we don't know whose file this is" must not resolve to
     "delete it").
  2. SHIPPED   -- the same relpath exists under --template-root. Not shipped
     => UNMANAGED (user-authored), never touched.
  3. IDENTICAL -- local bytes == the template copy's bytes. Diverged => local
     edits => PRUNE-BLOCKED, kept, exit 2.

Every pruned byte therefore provably exists in the template payload the
pruner was handed -- the worst possible wrong prune loses zero unique bytes.
Prune is a MOVE (never a delete) to <W>/.agent/trash/prune-<UTC>/, mirroring
relpaths, plus a pruned-manifest.txt; --restore reverses it byte-exact.

--restore treats pruned-manifest.txt as UNTRUSTED input (it is a file on disk
that anything could have written): entries that are absolute, contain `..`,
or otherwise resolve outside --workspace-root are refused, and a destination
already occupied by DIFFERENT bytes is never silently overwritten -- the
restore refuses as a whole (exit 2) unless --force is given, which first
moves the occupying file into <trashdir>/restore-backup/. The recovery path
is the layer the "zero unique bytes lost" guarantee rests on; it must not be
the thing that loses them.

What --restore guarantees, stated exactly (D13 -- atomicity is NOT among
them, and is not implementable here without a journal):
  * a PLAN-TIME refusal (unsafe entry, missing trash source, occupied
    destination without --force) moves NOTHING;
  * an APPLY-TIME failure destroys no unique byte-content, exits nonzero,
    and prints RESTORE-INCOMPLETE whenever anything was already moved. A
    partial restore is therefore possible, but never silent and never
    reported as success.

Refusals (before any write, exit 3): a harness checkout (template/execution/
present -- the Athanor repo carries all three platforms by design, and there
is deliberately no override flag for this refusal), --template-root equal to
--workspace-root (guards 2 and 3 are vacuous when a tree is compared against
itself), or an undetectable platform with ATHANOR_PLATFORM unset.

Report tokens are exact (goldens/prune_report_format_f1.md); exit codes: 0
clean, 2 blocked-present (or restore blocked by an occupied destination), 3
refused, 1 malformed/unsafe manifest.
"""
from __future__ import annotations

import argparse
import datetime
import filecmp
import hashlib
import os
import platform as _platform
import shutil
import sys
from pathlib import Path, PurePosixPath

PLATFORMS = ("macos", "linux", "windows")
MANIFEST_DEFAULT_REL = ".agent/update-manifest.yaml"
TRASH_ROOT_REL = ".agent/trash"


def detect_platform() -> str:
    override = os.environ.get("ATHANOR_PLATFORM", "").strip().lower()
    if override in PLATFORMS:
        return override
    system = _platform.system()
    if system == "Darwin":
        return "macos"
    if system == "Linux":
        return "linux"
    if system == "Windows" or system.startswith(("MINGW", "MSYS", "CYGWIN")):
        return "windows"
    return "unknown"


def load_yaml(path: Path):
    import yaml
    return yaml.safe_load(path.read_text()) or {}


def load_manifest_entries(path: Path):
    if not path.exists():
        return []
    return load_yaml(path).get("paths", []) or []


def resolve_platforms(entries, relpath: str):
    """Longest-prefix match against manifest `path:` entries. Returns the
    list of platform tokens for the winning entry, or None if undeclared.

    The match is on PATH COMPONENT boundaries, never bare string prefixes:
    the entry `execution/platform/macos` governs that path and everything
    under `execution/platform/macos/`, but NOT `execution/platform/macos-NOTES.md`.
    The live manifest carries 20 non-slash entries (init.sh, Makefile,
    WORKSPACE, README.md, .gitignore, ...), so a bare-prefix match would make
    `Makefile.local` and `init.sh.bak` prunable the moment any of them gained
    a `platforms:` scope."""
    best = None
    best_len = -1
    for entry in entries:
        prefix = str(entry.get("path", "")).strip().rstrip("/")
        if not prefix:
            continue
        if relpath == prefix or relpath.startswith(prefix + "/"):
            if len(prefix) > best_len:
                best_len = len(prefix)
                best = entry
    if best is None:
        return None, None
    plats = best.get("platforms")
    if not isinstance(plats, list) or not plats:
        return None, best
    return [str(p).strip().lower() for p in plats], best


def iter_files(root: Path):
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.is_symlink():
                continue
            yield p.relative_to(root)


def bytes_equal(a: Path, b: Path) -> bool:
    try:
        return filecmp.cmp(a, b, shallow=False)
    except OSError:
        return False


def _print_block(header: str, lines: list) -> None:
    print(header)
    for line in lines:
        print(f"  {line}")


def safe_restore_target(relpath: str, ws: Path):
    """Resolve one pruned-manifest.txt entry against the workspace root, or
    return None if the entry is not a workspace-relative path.

    pruned-manifest.txt is a plain text file on disk that anything could have
    written, so every line is UNTRUSTED input. `ws / "/etc/hosts"` in pathlib
    discards ws entirely and yields /etc/hosts, and `..` walks out the same
    way -- either would let the recovery path write outside the workspace it
    was pointed at."""
    if not relpath:
        return None
    if relpath.startswith(("/", "\\")) or "\\" in relpath:
        return None
    if ":" in relpath.split("/")[0]:      # drive-letter / UNC forms
        return None
    parts = PurePosixPath(relpath).parts
    if not parts or any(part in ("..", ".") for part in parts):
        return None
    dst = ws / relpath
    try:
        # resolve() is symlink-aware, so a symlinked parent cannot smuggle the
        # write out of the workspace either.
        dst.resolve().relative_to(ws)
    except ValueError:
        return None
    return dst


def _dedup_key(src: Path, dst: Path):
    """Identity of one planned restore, used to collapse duplicate manifest
    lines into ONE decision.

    Two keys, because two different manifest lines can name the SAME file:
      * the resolved destination path (verbatim duplicate lines);
      * the source file's (st_dev, st_ino) -- on a case-insensitive or
        unicode-normalizing filesystem `a/pulse.sh` and `a/PULSE.sh` are one
        inode, so the destination strings differ while the file does not.
    Either match means the same bytes would be moved twice; the second move
    would operate on a filesystem the first one already mutated, which is
    exactly the re-probing the plan exists to avoid.

    The inode key is NARROW by construction: see `_is_literal_path` and its
    caller. "Same inode" alone is NOT "same restore" -- two hardlinked trash
    entries are two distinct destinations and must both be restored."""
    try:
        st = src.stat()
        src_id = (st.st_dev, st.st_ino)
    except OSError:
        src_id = None
    return src_id, os.path.normcase(os.path.normpath(str(dst)))


def _is_literal_path(root: Path, relpath: str) -> bool:
    """True when every component of `relpath` is an ACTUAL directory entry
    under `root` -- i.e. the filesystem did not have to fold case or
    normalize unicode to find the file.

    This is the discriminator that narrows the inode dedup arm (D14). A
    hardlink is its own directory entry, so two hardlinked trash paths are
    two distinct restores and both must land. An alias spelling
    (`PULSE.sh` for `pulse.sh` on APFS, or the NFC form of an NFD name) is
    NOT a directory entry -- os.listdir reports only the stored byte-name --
    so it names a restore that another line already claimed. Consulting the
    inode key only when one of the two spellings is such an alias keeps the
    arm doing the job it exists for without conflating genuine duplicates
    of a destination with genuine sharing of an inode."""
    current = root
    for part in PurePosixPath(relpath).parts:
        try:
            names = os.listdir(current)
        except OSError:
            return False
        if part not in names:
            return False
        current = current / part
    return True


def _fresh_backup_path(base: Path, reserved: set) -> Path:
    """A backup destination that is NOT already taken -- neither on disk nor
    by an earlier entry in this same plan.

    restore-backup/ holds the ONLY copy of an occupant's unique bytes.
    shutil.move onto an existing path replaces it silently, so a second
    --force run against the same trashdir would destroy the first run's
    backup. Never overwrite; pick the next free suffix instead."""
    candidate = base
    n = 0
    while candidate.exists() or candidate in reserved:
        n += 1
        candidate = base.with_name(f"{base.name}.{n}")
    reserved.add(candidate)
    return candidate


def cmd_restore(args) -> int:
    trash = Path(args.restore).resolve()
    ws = Path(args.workspace_root).resolve()
    manifest_txt = trash / "pruned-manifest.txt"
    if not manifest_txt.exists():
        print(f"ERROR: no pruned-manifest.txt under {trash}", file=sys.stderr)
        return 1

    # Plan the whole restore before moving a single byte. The plan is decided
    # ONCE -- every decision below (duplicate? conflict? backup where?) is
    # recorded here and executed verbatim; the apply loop never re-probes the
    # filesystem, because by then the filesystem is one the loop itself has
    # already changed.
    #
    # What planning DOES buy (D13): a PLAN-TIME refusal moves nothing at all.
    # What it does NOT buy, and must not be claimed to: atomicity. shutil.move
    # is not transactional and no amount of plan-time probing can exclude a
    # mid-loop I/O failure, so an APPLY-TIME failure CAN leave earlier entries
    # moved. The guarantee there is weaker but true: no unique byte-content is
    # destroyed, the exit is nonzero, and the output says RESTORE-INCOMPLETE
    # whenever anything was applied -- never a silent partial, never a lying
    # exit 0.
    plan = []        # (relpath, src, dst, backup_dst | None)
    errors = []
    conflicts = []   # (relpath, dst)
    duplicates = []  # (lineno, relpath, prior relpath)
    seen_dst = {}    # normalized destination -> relpath that claimed it
    seen_inode = {}  # (st_dev, st_ino) -> (relpath that claimed it, was_alias)
    reserved = set()
    backup_root = trash / "restore-backup"
    for lineno, raw in enumerate(manifest_txt.read_text().splitlines(), 1):
        relpath = raw.strip()
        if not relpath:
            continue
        dst = safe_restore_target(relpath, ws)
        if dst is None:
            errors.append(f"line {lineno}: refusing unsafe manifest entry "
                          f"{relpath!r} — entries must be workspace-relative "
                          "and must stay inside the workspace")
            continue
        src = trash / relpath
        if not src.exists():
            errors.append(f"line {lineno}: trash missing {relpath}")
            continue
        src_id, dst_key = _dedup_key(src, dst)
        is_alias = not _is_literal_path(trash, relpath)
        prior = seen_dst.get(dst_key)
        if prior is None and src_id is not None:
            # NARROW inode arm (D14): a shared inode means "the same restore"
            # only when one of the two spellings is a filesystem alias for the
            # other. Two hardlinked trash entries are two real directory
            # entries and therefore two distinct destinations -- deduping them
            # would print "RESTORED n" while silently never restoring one.
            prior_inode = seen_inode.get(src_id)
            if prior_inode is not None and (is_alias or prior_inode[1]):
                prior = prior_inode[0]
        if prior is not None:
            duplicates.append((lineno, relpath, prior))
            continue
        seen_dst[dst_key] = relpath
        if src_id is not None:
            seen_inode.setdefault(src_id, (relpath, is_alias))
        backup_dst = None
        if dst.exists() and not bytes_equal(src, dst):
            conflicts.append((relpath, dst))
            backup_dst = _fresh_backup_path(backup_root / relpath, reserved)
        plan.append((relpath, src, dst, backup_dst))

    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        print("RESTORE-REFUSED: nothing was moved.", file=sys.stderr)
        return 1

    if duplicates:
        _print_block(
            f"DEDUPED — {len(duplicates)} duplicate pruned-manifest.txt "
            "line(s) collapsed into the entry that already claimed the same "
            "destination:",
            [f"line {lineno}: {rp}  (already planned as {prior})"
             for lineno, rp, prior in duplicates])

    if conflicts and not args.force:
        _print_block(
            f"RESTORE-BLOCKED — {len(conflicts)} path(s) already hold DIFFERENT "
            "content than the trashed copy (kept; nothing was moved):",
            [f"{rp}  occupied by different bytes — review by hand"
             for rp, _dst in conflicts])
        print("Re-run with --force to move the occupying files into "
              "<trashdir>/restore-backup/ and then restore.", file=sys.stderr)
        return 2

    for relpath, src, dst, backup_dst in plan:
        try:
            if backup_dst is not None:
                backup_dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(dst), str(backup_dst))
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
        except OSError as exc:
            # The plan was validated against the filesystem it was built from;
            # an error here is a genuine I/O failure, not a planning mistake.
            # Report it as a named error rather than a traceback.
            print(f"ERROR: restoring {relpath} failed: {exc}", file=sys.stderr)
            print("RESTORE-INCOMPLETE: the remaining entries were not applied.",
                  file=sys.stderr)
            return 1

    if conflicts:
        print(f"BACKED-UP {len(conflicts)} occupying file(s) under "
              f"{backup_root} before overwriting.")
    print(f"RESTORED {len(plan)} file(s) from {trash} into {ws}")
    return 0


def cmd_prune(args) -> int:
    ws = Path(args.workspace_root).resolve()
    tpl = Path(args.template_root).resolve()

    platform_source = "ATHANOR_PLATFORM" if os.environ.get("ATHANOR_PLATFORM", "").strip() else "detected"
    host = detect_platform()

    # Refusals, before any write.
    if ws == tpl:
        print("PRUNE-REFUSED: --template-root and --workspace-root resolve to "
              "the same directory. Guard 2 (shipped by the template) and "
              "guard 3 (byte-identical to the template copy) are vacuously "
              "true when a tree is compared against itself, so the trash copy "
              "would become the ONLY copy of every pruned file.")
        return 3
    if (ws / "template" / "execution").is_dir():
        print("PRUNE-REFUSED: this is a harness checkout (template/execution/ "
              "present); the Athanor repo carries all platforms by design.")
        return 3
    if host == "unknown":
        print("PRUNE-REFUSED: platform is 'unknown' and ATHANOR_PLATFORM is "
              "unset. Re-run with ATHANOR_PLATFORM=<macos|linux|windows>.")
        return 3

    print(f"PRUNE (platform: {host}; source: {platform_source})")

    manifest_path = Path(args.manifest) if args.manifest else ws / MANIFEST_DEFAULT_REL
    entries = load_manifest_entries(manifest_path)

    pruned = []       # (relpath, scope, governing_path)
    blocked = []       # (relpath, scope)
    unmanaged = []      # relpath

    for relpath_p in sorted(iter_files(ws), key=str):
        relpath = str(relpath_p).replace(os.sep, "/")
        if relpath.startswith(".agent/trash/"):
            continue
        scope, entry = resolve_platforms(entries, relpath)
        if scope is None:
            continue  # undeclared -- never prunable
        if host in scope or "all" in scope:
            continue  # governed FOR this host -- in scope, untouched

        # GOVERNED with a scope excluding the host. Check SHIPPED + IDENTICAL.
        tpl_file = tpl / relpath_p
        if not tpl_file.exists():
            unmanaged.append(relpath)
            continue
        local_file = ws / relpath_p
        if not bytes_equal(local_file, tpl_file):
            blocked.append((relpath, scope))
            continue
        pruned.append((relpath, scope, str(entry.get("path", ""))))

    if unmanaged:
        _print_block(
            f"UNMANAGED — {len(unmanaged)} file(s) out of platform scope but not "
            "template-shipped (kept):",
            unmanaged)

    if args.dry_run:
        if pruned:
            _print_block(
                f"WOULD-PRUNE — {len(pruned)} file(s) would be moved:",
                [f"{rp}  [{','.join(scope)}]  via manifest entry {gov}"
                 for rp, scope, gov in pruned])
        if blocked:
            _print_block(
                f"PRUNE-BLOCKED — {len(blocked)} file(s) out of scope but LOCALLY "
                "MODIFIED (kept):",
                [f"{rp}  [{','.join(scope)}]  differs from template copy — review by hand"
                 for rp, scope in blocked])
        return 0

    trash_dir = None
    if pruned:
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        trash_dir = ws / TRASH_ROOT_REL / f"prune-{stamp}"
        # exist_ok: two prunes inside the same UTC second share a stamp; a
        # raw FileExistsError there would abort the run mid-flight.
        trash_dir.mkdir(parents=True, exist_ok=True)
        manifest_lines = []
        for relpath, _scope, _gov in pruned:
            src = ws / relpath
            dst = trash_dir / relpath
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            manifest_lines.append(relpath)
        (trash_dir / "pruned-manifest.txt").write_text("\n".join(manifest_lines) + "\n")
        _print_block(
            f"PRUNED — {len(pruned)} file(s) moved to {trash_dir.relative_to(ws)}/:",
            [f"{rp}  [{','.join(scope)}]  via manifest entry {gov}"
             for rp, scope, gov in pruned])

    if blocked:
        _print_block(
            f"PRUNE-BLOCKED — {len(blocked)} file(s) out of scope but LOCALLY "
            "MODIFIED (kept):",
            [f"{rp}  [{','.join(scope)}]  differs from template copy — review by hand"
             for rp, scope in blocked])
        return 2

    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace-root", default=".")
    ap.add_argument("--template-root", default=None)
    ap.add_argument("--manifest", default=None)
    ap.add_argument("--dry-run", action="store_true", default=False)
    ap.add_argument("--restore", default=None, metavar="TRASHDIR")
    ap.add_argument("--force", action="store_true", default=False,
                    help="--restore only: back occupying files up into "
                         "<trashdir>/restore-backup/ and overwrite them")
    args = ap.parse_args()

    if args.restore:
        return cmd_restore(args)
    if not args.template_root:
        print("ERROR: --template-root is required unless --restore is given", file=sys.stderr)
        return 1
    return cmd_prune(args)


if __name__ == "__main__":
    sys.exit(main())

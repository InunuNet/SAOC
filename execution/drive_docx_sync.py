#!/usr/bin/env python3
"""drive_docx_sync.py -- read-only sync of Lee-Ann's Drive .docx source content
into a local versioned store (content/drive-source/), so it can be parsed by
execution/doc2md.py.

Mission: .agent/memory/project/specs/drive-docx-version-export/contract-f1.yaml
Design record: .agent/memory/project/specs/drive-docx-version-export/goldens/README.md

Structural read-only guarantee (design answer 7, mirrors execution/gws_inbox_check.sh):
this script's source references exactly two gws subcommand shapes -- "drive
files list" and "drive files get" -- and nothing else. There is no dynamic
code execution and no subprocess argv assembled by string-formatting a value
pulled out of Drive-returned content; the two gws invocations below are fixed,
literal argv lists, with only opaque parameter values (a folder id, a file id,
a JSON params blob, an output path) passed in as arguments. Calling any Drive
mutation verb is not reachable from this source at all, not merely avoided in
the paths this script happens to exercise today.

Version semantics (design answer 2):
  - First time a Drive file id is seen: v1.0.
  - Any later sync where the file's md5Checksum differs from the last
    recorded value for that id: automatic MINOR bump (v1.0 -> v1.1 -> ...).
    modifiedTime is recorded as provenance but NEVER used as the change
    signal -- it changes on rename/move/comment/permission touches that carry
    no content change at all.
  - MAJOR bump (vX.0 -> v(X+1).0, minor resets to 0): manual-only, via
    `--major <fileId>` on that run. Never inferred from diff size or any
    other heuristic.

Rename/move (design answer 4): a file id whose name and/or folder path
changes while its md5Checksum stays the same mints no new version. The
index's current name/path update, and an entry is appended (never
overwritten) to that file's path_history. The version directory chosen at
first-sync time never moves -- a rename must not touch history already on
disk.

Deletion (design answer 5): a file id previously seen but absent from the
live Drive listing keeps every local version directory and manifest exactly
as they are, forever. Its index entry flips status to "missing" with
missing_since set. Nothing is ever deleted locally.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)
import doc2md  # noqa: E402  (sibling module in execution/, see doc2md.convert())

DEFAULT_STORE_ROOT = "content/drive-source"
DEFAULT_DRIVE_ROOT_ID = "1rZJVrYwrWM92vqmPw2c9E_HABQKEQoGa"  # "Docs for Brad"

FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"


class DriveSyncError(RuntimeError):
    """Raised for any failure that must stop the run loudly rather than be
    swallowed: a failed gws call, a missing/empty download, or extracted
    text that isn't real content."""


class UnsafePathComponentError(DriveSyncError):
    """Raised for exactly one file whose Drive-supplied name(s) would place
    it outside store_root once joined into a filesystem path -- traversal
    (`..`), a path separator embedded in a name, or any other value whose
    resolved destination escapes the store. Handled per-file in run(): this
    one file is skipped, named on stderr, and every other file in the run
    keeps syncing; the whole process still exits non-zero -- this genuinely
    is an error, unlike a same-name storage-path collision (see
    _disambiguate_storage_relpath), which is expected and handled without
    ever raising. Names come from a Drive folder that is shared and
    hand-edited outside our control, so this is a real boundary, not a
    hypothetical -- reject loudly rather than rewriting the name into
    something safe, since a rewritten name would silently diverge from
    Drive and break the mapping the whole store depends on."""


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# --- gws access: exactly two read-only subcommand shapes, both fixed literal
#     argv lists with only opaque values passed in ---------------------------

def gws_list(parent_id):
    """`gws drive files list` for the direct children of parent_id."""
    query = "'" + parent_id + "' in parents and trashed=false"
    params = json.dumps({
        "q": query,
        "fields": "files(id,name,mimeType,modifiedTime,md5Checksum)",
    })
    argv = ["gws", "drive", "files", "list", "--params", params, "--page-all"]
    result = subprocess.run(argv, capture_output=True, text=True)
    if result.returncode != 0:
        raise DriveSyncError(
            f"gws drive files list failed for parent {parent_id!r}: {result.stderr.strip()}"
        )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise DriveSyncError(
            f"gws drive files list returned non-JSON output for parent {parent_id!r}: {exc}"
        ) from exc
    return payload.get("files", [])


def gws_get(file_id, output_path):
    """`gws drive files get` -- downloads one file's raw bytes to output_path."""
    params = json.dumps({"fileId": file_id, "alt": "media"})
    argv = ["gws", "drive", "files", "get", "--params", params, "-o", output_path]
    result = subprocess.run(argv, capture_output=True, text=True)
    if result.returncode != 0:
        raise DriveSyncError(
            f"gws drive files get failed for file {file_id!r}: {result.stderr.strip()}"
        )
    if not os.path.isfile(output_path) or os.path.getsize(output_path) == 0:
        raise DriveSyncError(
            f"gws drive files get produced no/empty bytes for file {file_id!r} at {output_path!r}"
        )


# --- Drive tree walk ---------------------------------------------------------

def _is_unsafe_path_component(value):
    """True iff `value` cannot safely become one filesystem path component
    under store_root. Drive names come from a shared, hand-edited folder
    outside our control -- Drive permits almost any string as a name,
    including '..', names containing '/', or otherwise path-like values --
    so this is the boundary check for a real (not hypothetical) path
    traversal risk.

    Only genuine traversal/injection is rejected: empty, '.', '..', a NUL
    byte, or an embedded path separator ('/' or '\\', which also catches
    any leading-slash "absolute-looking" value, since it necessarily
    contains '/'). Unicode, emoji, trailing/leading whitespace, and very
    long names are all legitimate Drive names and MUST keep working -- the
    real tree already has a folder literally named "SAOC " with a trailing
    space."""
    if not value:
        return True
    if value in (".", ".."):
        return True
    if "\x00" in value:
        return True
    if "/" in value or "\\" in value:
        return True
    return False


def walk_drive_tree(root_id):
    """Recursively lists every .docx file reachable under root_id, returning
    (discovered, had_unsafe_skip):
      - discovered: a flat list of dicts with
        id/name/modified_time/md5_checksum/path_in_tree. path_in_tree is the
        "/"-joined chain of ancestor folder names, verbatim as Drive reports
        them (no renumbering, no trimming -- design answer 2 of
        goldens/README.md), excluding the root folder's own name.
      - had_unsafe_skip: True iff at least one folder or file was skipped
        because its Drive-supplied name is not safe as a path component
        (see _is_unsafe_path_component) -- an unsafe folder name skips that
        whole subtree (nothing under it can be discovered at all); an
        unsafe file name skips just that one file. Either way the walk
        continues over every sibling; nothing here aborts the run.

    Non-.docx files are in-scope-to-skip, not in-scope-to-sync, but a silent
    drop is exactly the failure mode this project has been burned by before
    -- so every skip is counted and reported to stderr once the walk ends."""
    discovered = []
    skipped_non_docx = 0
    had_unsafe_skip = False

    def recurse(folder_id, path_parts):
        nonlocal skipped_non_docx, had_unsafe_skip
        for entry in gws_list(folder_id):
            name = entry.get("name", "")
            if entry.get("mimeType") == FOLDER_MIME_TYPE:
                if _is_unsafe_path_component(name):
                    had_unsafe_skip = True
                    print(
                        f"drive_docx_sync: skipping folder {entry.get('id')!r} "
                        f"named {name!r} under {'/'.join(path_parts) or '(root)'!r} "
                        "-- not safe as a filesystem path component; every file "
                        "under it is skipped too",
                        file=sys.stderr,
                    )
                    continue
                recurse(entry["id"], path_parts + [name])
                continue
            if not name.lower().endswith(".docx"):
                skipped_non_docx += 1
                continue  # out of scope: this tool only syncs .docx Office files
            basename_no_ext = os.path.splitext(name)[0]
            if _is_unsafe_path_component(name) or _is_unsafe_path_component(basename_no_ext):
                had_unsafe_skip = True
                print(
                    f"drive_docx_sync: skipping file {entry.get('id')!r} named "
                    f"{name!r} under {'/'.join(path_parts) or '(root)'!r} -- not "
                    "safe as a filesystem path component",
                    file=sys.stderr,
                )
                continue
            discovered.append({
                "id": entry["id"],
                "name": name,
                "modified_time": entry.get("modifiedTime"),
                "md5_checksum": entry.get("md5Checksum"),
                "path_in_tree": "/".join(path_parts),
            })

    recurse(root_id, [])
    if skipped_non_docx:
        print(
            f"drive_docx_sync: skipped {skipped_non_docx} non-.docx file(s) under "
            f"{root_id!r} (out of scope for this sync)",
            file=sys.stderr,
        )
    return discovered, had_unsafe_skip


# --- index.json persistence --------------------------------------------------

def load_index(index_path):
    if not os.path.isfile(index_path):
        return {}
    with open(index_path, encoding="utf-8") as fh:
        try:
            return json.load(fh)
        except json.JSONDecodeError as exc:
            raise DriveSyncError(
                f"index.json at {index_path!r} is corrupt and cannot be parsed: {exc}. "
                "Refusing to proceed on an unreadable index rather than treating every "
                "file as brand-new."
            ) from exc


def save_index(index_path, index):
    """Writes index.json atomically: build the full new content in a temp
    file in the same directory, then os.replace() it over the real path.
    A crash mid-write leaves the temp file orphaned and the real index.json
    exactly as it was -- never truncated."""
    index_dir = os.path.dirname(index_path) or "."
    os.makedirs(index_dir, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=".index.json.", suffix=".tmp", dir=index_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(index, fh, indent=2, sort_keys=True)
            fh.write("\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, index_path)
    except BaseException:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


# --- version-bump decision ----------------------------------------------------

def _parse_version(version_label):
    major_str, minor_str = version_label[1:].split(".")
    return int(major_str), int(minor_str)


def _format_version(major, minor):
    return f"v{major}.{minor}"


def decide_bump(prev_entry, md5_checksum, is_major_requested):
    """Returns (version_label, minted) -- minted is True iff a new version
    directory must be written this run."""
    if prev_entry is None:
        return "v1.0", True
    if is_major_requested:
        major, _minor = _parse_version(prev_entry["current_version"])
        return _format_version(major + 1, 0), True
    if md5_checksum != prev_entry.get("md5_checksum"):
        major, minor = _parse_version(prev_entry["current_version"])
        return _format_version(major, minor + 1), True
    return prev_entry["current_version"], False


# --- text extraction ----------------------------------------------------------

def extract_text(docx_path):
    doc2md.check_dependency()
    text = doc2md.convert(docx_path)
    if not text or not text.strip():
        raise DriveSyncError(
            f"doc2md produced empty extracted text for {docx_path!r} -- "
            "refusing to write a placeholder content.md"
        )
    return text


# --- version minting -----------------------------------------------------------

def mint_version(store_root, storage_relpath, version_label, file_id, name,
                  path_in_tree, modified_time, md5_checksum):
    version_dir = os.path.join(store_root, storage_relpath, version_label)
    os.makedirs(version_dir, exist_ok=True)

    source_path = os.path.join(version_dir, "source.docx")
    gws_get(file_id, source_path)

    text = extract_text(source_path)
    content_md_path = os.path.join(version_dir, "content.md")
    with open(content_md_path, "w", encoding="utf-8") as fh:
        fh.write(text)

    manifest = {
        "drive_file_id": file_id,
        "name": name,
        "path_in_tree": path_in_tree,
        "modified_time": modified_time,
        "md5_checksum": md5_checksum,
        "version": version_label,
        "exported_at": now_iso(),
        "source_docx_relpath": "source.docx",
        "content_md_relpath": "content.md",
    }
    with open(os.path.join(version_dir, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, sort_keys=True)
        fh.write("\n")


# --- per-file processing -------------------------------------------------------

def _storage_relpath_for(path_in_tree, name):
    basename_no_ext = os.path.splitext(name)[0]
    return os.path.join(path_in_tree, basename_no_ext) if path_in_tree else basename_no_ext


def _assert_storage_relpath_contained(store_root, storage_relpath, file_id, path_in_tree, name):
    """Defense-in-depth: resolves the full candidate path and asserts it is
    genuinely contained within store_root. This is the check that actually
    holds regardless of what the per-component rules in
    _is_unsafe_path_component miss (unusual normalization, symlink
    weirdness, a future path-building change elsewhere) -- component rules
    alone are not trusted as sufficient on their own."""
    store_root_real = Path(store_root).resolve()
    candidate_real = (Path(store_root) / storage_relpath).resolve()
    if candidate_real != store_root_real and store_root_real not in candidate_real.parents:
        raise UnsafePathComponentError(
            f"unsafe path: file {file_id!r} ({path_in_tree}/{name}) resolves to "
            f"{candidate_real} which escapes store_root {store_root_real} -- "
            "refusing to write outside the store. Skipping this file; every "
            "other file in this run still syncs."
        )


def _find_storage_relpath_owner(index, storage_relpath, exclude_file_id):
    """Returns the file_id of another indexed entry already occupying
    storage_relpath, or None. Drive allows two different files to share a
    name in the same folder, which would otherwise make two distinct
    drive_file_ids resolve to the same on-disk version directory -- the
    second file's mint_version() would silently overwrite the first's
    source.docx/content.md/manifest.json while index.json kept pointing the
    first file_id at a manifest that now belongs to someone else."""
    for other_file_id, other_entry in index.items():
        if other_file_id == exclude_file_id:
            continue
        if other_entry.get("storage_relpath") == storage_relpath:
            return other_file_id
    return None


def _disambiguated_relpath(storage_relpath, file_id):
    """Deterministic collision-breaker: <storage_relpath>-<short stable hash
    of file_id>. Derived only from drive_file_id, so it is identical on
    every future run, unaffected by the other file being renamed or
    deleted, and never shifts -- unlike a positional counter, which could
    land differently depending on discovery order."""
    short_hash = hashlib.sha256(file_id.encode("utf-8")).hexdigest()[:10]
    return f"{storage_relpath}-{short_hash}"


def _resolve_storage_relpath(store_root, index, file_id, path_in_tree, name):
    """Computes the storage_relpath for a brand-new file_id, disambiguating
    on collision rather than skipping: Drive genuinely allows two different
    files to share a name in one folder, and neither document's history
    should go unversioned over that. The file that already owns the plain
    path keeps it untouched; only the NEW file gets the hash-suffixed
    variant, so both files' full histories survive under distinct, stable
    on-disk locations. Reported on stderr, never raised -- a same-name
    collision is expected and handled, not an error."""
    storage_relpath = _storage_relpath_for(path_in_tree, name)
    _assert_storage_relpath_contained(store_root, storage_relpath, file_id, path_in_tree, name)
    collision_id = _find_storage_relpath_owner(index, storage_relpath, file_id)
    if collision_id is None:
        return storage_relpath
    plain_relpath = storage_relpath
    storage_relpath = _disambiguated_relpath(plain_relpath, file_id)
    _assert_storage_relpath_contained(store_root, storage_relpath, file_id, path_in_tree, name)
    print(
        f"drive_docx_sync: storage-path collision: new file {file_id!r} "
        f"({path_in_tree}/{name}) shares its name+folder with existing file "
        f"{collision_id!r}, which already owns on-disk location {plain_relpath!r}. "
        f"Disambiguating {file_id!r} to {storage_relpath!r} (a stable hash of its "
        "own drive_file_id) so both files keep their full independent version "
        "history.",
        file=sys.stderr,
    )
    return storage_relpath


def process_file(store_root, index, discovered_file, major_ids):
    file_id = discovered_file["id"]
    name = discovered_file["name"]
    path_in_tree = discovered_file["path_in_tree"]
    modified_time = discovered_file["modified_time"]
    md5_checksum = discovered_file["md5_checksum"]
    is_major = file_id in major_ids

    prev = index.get(file_id)
    version_label, minted = decide_bump(prev, md5_checksum, is_major)

    if prev is None:
        storage_relpath = _resolve_storage_relpath(store_root, index, file_id, path_in_tree, name)
        entry = {
            "name": name,
            "path_in_tree": path_in_tree,
            "status": "active",
            "current_version": version_label,
            "md5_checksum": md5_checksum,
            "modified_time": modified_time,
            "missing_since": None,
            "path_history": [],
            "storage_relpath": storage_relpath,
        }
        index[file_id] = entry
    else:
        entry = prev
        # The physical storage location is frozen at first-sync time and
        # never moves on a later rename -- only the index's current
        # name/path (and its path_history) change (design answer 4).
        storage_relpath = entry["storage_relpath"]
        renamed_or_moved = (
            entry.get("name") != name or entry.get("path_in_tree") != path_in_tree
        )
        if renamed_or_moved:
            entry.setdefault("path_history", []).append({
                "old_name": entry.get("name"),
                "old_path": entry.get("path_in_tree"),
                "new_name": name,
                "new_path": path_in_tree,
                "detected_at": now_iso(),
            })
            entry["name"] = name
            entry["path_in_tree"] = path_in_tree
        entry["status"] = "active"
        entry["missing_since"] = None
        entry["md5_checksum"] = md5_checksum
        entry["modified_time"] = modified_time
        entry["current_version"] = version_label

    if minted:
        mint_version(
            store_root, storage_relpath, version_label, file_id, name,
            path_in_tree, modified_time, md5_checksum,
        )


def mark_missing(index, seen_ids):
    """Any indexed file id not observed in this run's live listing is
    flagged missing (never deleted locally) -- design answer 5. A file id
    that reappears in a later run is reactivated by process_file() before
    this runs, so it is already excluded from seen_ids-complement here."""
    for file_id, entry in index.items():
        if file_id in seen_ids:
            continue
        if entry.get("status") != "missing":
            entry["status"] = "missing"
            entry["missing_since"] = now_iso()


# --- CLI -------------------------------------------------------------------

def build_arg_parser():
    parser = argparse.ArgumentParser(
        description=(
            "Read-only sync of Lee-Ann's Drive .docx source content into a "
            "local versioned store."
        )
    )
    parser.add_argument(
        "--store-root", default=DEFAULT_STORE_ROOT,
        help=f"Local versioned store root (default: {DEFAULT_STORE_ROOT})",
    )
    parser.add_argument(
        "--drive-root-id", default=DEFAULT_DRIVE_ROOT_ID,
        help="Drive folder id to walk (default: the 'Docs for Brad' root)",
    )
    parser.add_argument(
        "--major", action="append", default=[], metavar="FILE_ID",
        help="Force a manual MAJOR version bump for this Drive file id this run "
             "(repeatable). Never inferred automatically.",
    )
    return parser


def run(store_root, drive_root_id, major_ids):
    """Returns True iff at least one file was skipped this run due to an
    unsafe/traversal path component (UnsafePathComponentError), or an
    unsafe folder/file name caught during the walk itself -- the caller
    uses this to exit non-zero even though every other file synced fine.
    A same-name storage-path collision is NOT a skip condition: it is
    resolved by disambiguation inside process_file() (both files end up
    indexed and versioned) and does not affect this return value or the
    process exit code -- nothing is wrong when a collision is merely
    disambiguated, so it must not read as failure."""
    index_path = os.path.join(store_root, "index.json")
    index = load_index(index_path)

    discovered, had_unsafe_walk_skip = walk_drive_tree(drive_root_id)
    seen_ids = set()
    had_skip = had_unsafe_walk_skip
    for discovered_file in discovered:
        seen_ids.add(discovered_file["id"])
        try:
            process_file(store_root, index, discovered_file, major_ids)
        except UnsafePathComponentError as exc:
            # This ONE file is skipped -- it mints nothing and gets no
            # index entry -- but the run keeps going: a hostile/accidental
            # path-traversal name anywhere in a large, actively-reorganised
            # Drive tree must not stop every other document from syncing.
            # Reported now so multiple such problems in one run are each
            # individually surfaced, not just the first.
            print(f"drive_docx_sync: {exc}", file=sys.stderr)
            had_skip = True
            continue
        # Persist after every file, not just once at the end: if a later
        # file in this same run fails (e.g. its gws get errors out), every
        # file that already fully minted/updated above this line keeps its
        # index entry -- the append-only version history on disk is never
        # left with no index provenance pointing at it.
        save_index(index_path, index)

    mark_missing(index, seen_ids)
    save_index(index_path, index)
    return had_skip


def main():
    args = build_arg_parser().parse_args()
    os.makedirs(args.store_root, exist_ok=True)
    try:
        had_skip = run(args.store_root, args.drive_root_id, set(args.major))
    except DriveSyncError as exc:
        print(f"drive_docx_sync: {exc}", file=sys.stderr)
        sys.exit(1)
    if had_skip:
        # Every other file in the run synced fine, but a run containing an
        # unsafe/traversal path must never read as success to a caller or a
        # scheduler. (A same-name collision alone does NOT set had_skip --
        # it is resolved by disambiguation, not a failure.)
        sys.exit(1)


if __name__ == "__main__":
    main()

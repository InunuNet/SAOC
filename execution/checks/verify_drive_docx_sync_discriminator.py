#!/usr/bin/env python3
"""F1 (mission drive-docx-version-export) -- proves execution/drive_docx_sync.py,
once @dev implements it per goldens/README.md, satisfies the version-semantics,
idempotency, rename, and deletion contract this mission exists to define -- not
just that the script runs without crashing.

RED today (script does not exist yet) -- expected, mirrors this project's own
established pattern (see verify_browser_deployed_check_discriminator.py) of
architect-authored discriminators that fail for the correct reason (missing
implementation) until @dev builds against them, at which point the SAME
unmodified checks must go green.

Drives execution/drive_docx_sync.py through scripted runs against a fake
`gws` CLI (goldens/fake_gws_stub.py) reading goldens/fixtures/drive_world_run*.json
world snapshots -- no real Drive API call is ever made. Each run's fixture
isolates exactly one behaviour this contract specifies:

  run1 initial            -- first sync of a new file mints v1.0
  run2 unchanged          -- idempotency: zero new versions/writes, AND the
                             existing version directory's bytes are untouched
                             (not just "the same set of paths exist")
  run3 metadata-only touch-- modifiedTime changes, md5Checksum does not: NO
                             bump, version bytes untouched, but index
                             modified_time still advances (provenance)
  run4 content changed    -- md5Checksum changes: auto MINOR bump (v1.0 -> v1.1)
  run5 --major flag       -- unchanged content but explicit --major: v1.1 -> v2.0
  run6 renamed + moved    -- same fileId/md5, new name+folder: no new version,
                             index updates, a path_history entry is appended
  run7 deleted            -- fileId vanishes from Drive: local files untouched,
                             index flips to status "missing" with missing_since
  run8 storage collision  -- two DIFFERENT fileIds, SAME name in the SAME
                             folder. RULING (final, see goldens/README.md
                             addendum): BOTH survive independently at
                             DISTINCT on-disk locations (disambiguated via a
                             fileId-derived suffix on the new file; the
                             existing owner keeps its plain path), each
                             manifest matches its own file's checksum, an
                             unrelated file in the same run still syncs, and
                             the run exits 0 (a resolved collision is not a
                             failure)
  run9 freed-slot reuse   -- a file renamed/moved away, then a NEW file takes
                             the name+path it vacated: same ruling as run8 --
                             the new file is disambiguated and indexed (not
                             skipped), the original's history is
                             byte-identical at its frozen plain path, an
                             unrelated file still syncs, exit 0
 run10 partial failure    -- two files, the first mints cleanly, the second's
                             `gws get` fails: the first file's index entry
                             must survive the run
 run11 corrupt index      -- index.json is truncated on disk, then re-run:
                             must fail with a clean, distinguishable error,
                             not a raw JSONDecodeError traceback
 run12 pagination         -- a folder with more children than one Drive page:
                             every child must be discovered (proves --page-all
                             is actually being used, not just present in a
                             docstring)
 run13 path traversal     -- a folder named ".." and a file name containing
                             "/" (untrusted Drive-controlled path components):
                             rejected, run continues, exits non-zero; the
                             legitimate "SAOC " folder (real trailing space)
                             is the negative control and must keep syncing

Each assertion states what a WRONG implementation that still "runs successfully"
would look like, and confirms the real defect is what's being caught -- not just
an exit code.
"""
import json
import os
import subprocess
import sys
import tempfile

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPEC_DIR = os.path.join(
    REPO_ROOT, ".agent", "memory", "project", "specs", "drive-docx-version-export"
)
FIXTURES_DIR = os.path.join(SPEC_DIR, "goldens", "fixtures")
FAKE_GWS_STUB = os.path.join(SPEC_DIR, "goldens", "fake_gws_stub.py")
PRODUCT_SCRIPT = os.path.join(REPO_ROOT, "execution", "drive_docx_sync.py")
DRIVE_ROOT_ID = "docs-for-brad-root"

V1_MD5 = "2abe0277ed9f9782654cc8dc12311f77"
V2_MD5 = "7b7b069d4a64ab8189f8f936b4420b4e"

failures = []


def fail(check_id, msg):
    failures.append(f"{check_id}: {msg}")


def make_gws_shim(tmp_path):
    """A `gws` on PATH that just execs the fake stub -- lets the product
    script call the literal binary name `gws`, exactly as it will in prod."""
    shim_dir = os.path.join(tmp_path, "shim")
    os.makedirs(shim_dir, exist_ok=True)
    shim_path = os.path.join(shim_dir, "gws")
    with open(shim_path, "w") as f:
        f.write(f"#!/usr/bin/env bash\nexec python3 {FAKE_GWS_STUB} \"$@\"\n")
    os.chmod(shim_path, 0o755)
    return shim_dir


def run_sync(store_root, shim_dir, world_fixture, extra_args=None, drive_root_id=DRIVE_ROOT_ID):
    env = dict(os.environ)
    env["PATH"] = shim_dir + os.pathsep + env["PATH"]
    env["FAKE_GWS_WORLD"] = os.path.join(FIXTURES_DIR, world_fixture)
    env["FAKE_GWS_FIXTURES_DIR"] = FIXTURES_DIR
    args = [
        sys.executable,
        PRODUCT_SCRIPT,
        "--store-root",
        store_root,
        "--drive-root-id",
        drive_root_id,
    ]
    if extra_args:
        args += extra_args
    return subprocess.run(args, env=env, capture_output=True, text=True, timeout=60)


def load_index(store_root):
    index_path = os.path.join(store_root, "index.json")
    if not os.path.isfile(index_path):
        return None
    with open(index_path) as f:
        return json.load(f)


def find_version_dirs(store_root):
    """All manifest.json paths anywhere under store_root, as a set of
    relative paths -- used to detect whether a run minted a new version
    (found a NEW manifest path) or not (same set as before)."""
    found = set()
    for dirpath, _dirnames, filenames in os.walk(store_root):
        if "manifest.json" in filenames:
            found.add(os.path.relpath(os.path.join(dirpath, "manifest.json"), store_root))
    return found


def read_manifest(store_root, rel_path):
    with open(os.path.join(store_root, rel_path)) as f:
        return json.load(f)


def snapshot_version_bytes(store_root, manifest_rel_paths):
    """Byte-content snapshot of every file (manifest.json, content.md,
    source.docx) inside each given manifest's version directory. Used to
    prove a run did NOT silently re-mint into the same version label --
    an implementation that re-downloads/rewrites a version on every run
    (even re-writing an identical exported_at-bearing manifest) would still
    show the same SET of on-disk paths as before, but would fail a
    byte-identity comparison against this snapshot."""
    snap = {}
    version_dirs = {os.path.dirname(p) for p in manifest_rel_paths}
    for version_dir in version_dirs:
        abs_dir = os.path.join(store_root, version_dir)
        if not os.path.isdir(abs_dir):
            continue
        for fname in os.listdir(abs_dir):
            fpath = os.path.join(abs_dir, fname)
            if os.path.isfile(fpath):
                with open(fpath, "rb") as fh:
                    snap[os.path.join(version_dir, fname)] = fh.read()
    return snap


def assert_bytes_unchanged(check_id, before_snap, after_snap, context):
    if before_snap.keys() != after_snap.keys():
        fail(
            check_id,
            f"{context}: the set of files inside existing version directories changed "
            f"(before={sorted(before_snap.keys())}, after={sorted(after_snap.keys())}). "
            "A wrong implementation that re-mints or partially rewrites an unchanged "
            "version's directory would fail exactly here.",
        )
        return
    for path, before_bytes in before_snap.items():
        if after_snap[path] != before_bytes:
            fail(
                check_id,
                f"{context}: file {path!r} inside an existing version directory changed "
                "byte-for-byte even though no content change was reported by Drive. "
                "A wrong implementation that re-mints into the SAME version label on "
                "every run (re-downloading bytes, rewriting exported_at) would show the "
                "identical SET of on-disk paths -- passing a path-only comparison -- "
                "but fails this byte-identity check.",
            )


def main():
    if not os.path.isfile(PRODUCT_SCRIPT):
        print(f"RED (expected pre-implementation): {PRODUCT_SCRIPT} does not exist yet.")
        print("This check will go GREEN, unmodified, once @dev implements it per goldens/README.md.")
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmp:
        store_root = os.path.join(tmp, "content", "drive-source")
        os.makedirs(store_root, exist_ok=True)
        shim_dir = make_gws_shim(tmp)

        # --- run1: initial sync mints v1.0 ------------------------------
        r1 = run_sync(store_root, shim_dir, "drive_world_run1_initial.json")
        versions_after_r1 = find_version_dirs(store_root)
        if r1.returncode != 0:
            fail("A_run1", f"initial sync exited {r1.returncode}: {r1.stderr[-500:]}")
        v1_manifests = [p for p in versions_after_r1 if os.sep + "v1.0" + os.sep in p or p.startswith("v1.0" + os.sep)]
        if len(v1_manifests) != 1:
            fail(
                "A_run1",
                f"expected exactly one v1.0 manifest after first sync of one new file, found {len(v1_manifests)}: {sorted(versions_after_r1)}. "
                "A wrong implementation that never creates a version at all, or creates two, would show up here.",
            )
        else:
            m = read_manifest(store_root, v1_manifests[0])
            required = [
                "drive_file_id", "name", "path_in_tree", "modified_time",
                "md5_checksum", "version", "exported_at",
                "source_docx_relpath", "content_md_relpath",
            ]
            missing = [k for k in required if not m.get(k)]
            if missing:
                fail("A_provenance", f"v1.0 manifest missing/null required provenance fields: {missing}. "
                     "A wrong implementation that writes a manifest but omits fields (e.g. no exported_at) passes 'a manifest exists' but fails real provenance.")
            if m.get("md5_checksum") != V1_MD5:
                fail("A_run1", f"v1.0 manifest md5_checksum {m.get('md5_checksum')!r} != expected {V1_MD5!r}")
            content_md_rel = m.get("content_md_relpath")
            if content_md_rel:
                # tolerate either a path relative to the version dir or to store_root
                candidates = [
                    os.path.join(store_root, os.path.dirname(v1_manifests[0]), content_md_rel),
                    os.path.join(store_root, content_md_rel),
                ]
                found_md = next((c for c in candidates if os.path.isfile(c)), None)
                if not found_md:
                    fail("A_parseable", f"content.md referenced by manifest ({content_md_rel}) does not exist on disk.")
                else:
                    text = open(found_md, encoding="utf-8").read()
                    if "R3800" not in text or len(text.split()) < 5:
                        fail(
                            "A_parseable",
                            f"content.md exists but does not contain the extracted fixture text ('R3800 per bay'); got: {text[:200]!r}. "
                            "A wrong implementation that writes an empty or placeholder content.md would pass a bare file-exists check but fails here.",
                        )

        index1 = load_index(store_root)
        if not index1 or "fileA" not in index1:
            fail("A_run1", "index.json missing or missing fileA entry after first sync")

        snapshot_after_r1 = snapshot_version_bytes(store_root, versions_after_r1)

        # --- run2: identical world -> idempotent, zero new versions -----
        r2 = run_sync(store_root, shim_dir, "drive_world_run2_unchanged.json")
        versions_after_r2 = find_version_dirs(store_root)
        if r2.returncode != 0:
            fail("A_run2_idempotent", f"unchanged re-run exited {r2.returncode}: {r2.stderr[-500:]}")
        if versions_after_r2 != versions_after_r1:
            fail(
                "A_run2_idempotent",
                f"re-running against an UNCHANGED Drive world created/removed version manifests "
                f"(before={sorted(versions_after_r1)}, after={sorted(versions_after_r2)}). "
                "A wrong implementation that blindly mints a new version on every run, regardless of "
                "whether content actually changed, would fail exactly this check.",
            )
        snapshot_after_r2 = snapshot_version_bytes(store_root, versions_after_r2)
        assert_bytes_unchanged(
            "A_run2_idempotent_bytes", snapshot_after_r1, snapshot_after_r2,
            "unchanged re-run (run2)",
        )

        # --- run3: modifiedTime changes, md5Checksum does not -> NO bump
        r3 = run_sync(store_root, shim_dir, "drive_world_run3_metadata_only_touch.json")
        versions_after_r3 = find_version_dirs(store_root)
        if r3.returncode != 0:
            fail("A_run3_no_bump_on_metadata", f"metadata-only-touch run exited {r3.returncode}: {r3.stderr[-500:]}")
        if versions_after_r3 != versions_after_r2:
            fail(
                "A_run3_no_bump_on_metadata",
                f"a modifiedTime-only change (md5Checksum unchanged) minted a new version "
                f"(before={sorted(versions_after_r2)}, after={sorted(versions_after_r3)}). "
                "A wrong implementation that uses modifiedTime as the change signal instead of "
                "md5Checksum would fail here -- this is the specific false-bump this contract forbids, "
                "since Drive updates modifiedTime on metadata-only touches (rename, comment, permission "
                "change) with no content change at all.",
            )
        snapshot_after_r3 = snapshot_version_bytes(store_root, versions_after_r3)
        assert_bytes_unchanged(
            "A_run3_no_bump_bytes", snapshot_after_r2, snapshot_after_r3,
            "metadata-only-touch run (run3)",
        )
        index_after_r3 = load_index(store_root)
        entry3 = (index_after_r3 or {}).get("fileA", {})
        if entry3.get("modified_time") != "2026-08-05T11:30:00Z":
            fail(
                "A_run3_modified_time_provenance",
                f"index fileA.modified_time did not advance to the new Drive modifiedTime "
                f"('2026-08-05T11:30:00Z') after a metadata-only touch, got {entry3.get('modified_time')!r}. "
                "A wrong implementation that stops updating modified_time whenever it correctly "
                "decides not to bump the version would pass 'no spurious version' but silently lose "
                "provenance of when the touch was actually observed -- this contract requires "
                "modified_time be recorded on every touch, bump or not.",
            )

        # --- run4: real content change (md5Checksum differs) -> v1.1 ----
        r4 = run_sync(store_root, shim_dir, "drive_world_run4_content_changed.json")
        versions_after_r4 = find_version_dirs(store_root)
        if r4.returncode != 0:
            fail("A_run4_minor_bump", f"content-changed run exited {r4.returncode}: {r4.stderr[-500:]}")
        new_after_r4 = versions_after_r4 - versions_after_r3
        v11_manifests = [p for p in new_after_r4 if "v1.1" in p]
        v20_manifests = [p for p in new_after_r4 if "v2.0" in p]
        if len(v11_manifests) != 1:
            fail(
                "A_run4_minor_bump",
                f"expected exactly one new v1.1 manifest when md5Checksum changed without --major, "
                f"got new manifests: {sorted(new_after_r4)}. A wrong implementation that never bumps "
                "on real content change (data loss risk: silently drops Lee-Ann's edit) or that jumps "
                "straight to a MAJOR version without being told to would both fail here.",
            )
        if v20_manifests:
            fail(
                "A_run4_minor_bump",
                f"a content change with no --major flag produced a MAJOR version bump: {v20_manifests}. "
                "Major version bumps must be manual-only per this contract's version-semantics decision.",
            )
        if v11_manifests:
            m4 = read_manifest(store_root, v11_manifests[0])
            if m4.get("md5_checksum") != V2_MD5:
                fail("A_run4_minor_bump", f"v1.1 manifest md5_checksum {m4.get('md5_checksum')!r} != expected {V2_MD5!r}")
            content_md_rel = m4.get("content_md_relpath")
            candidates = [
                os.path.join(store_root, os.path.dirname(v11_manifests[0]), content_md_rel or ""),
                os.path.join(store_root, content_md_rel or ""),
            ]
            found_md = next((c for c in candidates if content_md_rel and os.path.isfile(c)), None)
            if found_md:
                text = open(found_md, encoding="utf-8").read()
                if "R500" not in text:
                    fail("A_run4_minor_bump", f"v1.1 content.md does not contain the updated fixture text ('R500 late-registration surcharge'); got {text[:200]!r}")

        # --- run5: same content, --major fileA -> explicit v2.0 ---------
        r5 = run_sync(store_root, shim_dir, "drive_world_run5_major_flag.json", extra_args=["--major", "fileA"])
        versions_after_r5 = find_version_dirs(store_root)
        if r5.returncode != 0:
            fail("A_run5_major_manual", f"--major run exited {r5.returncode}: {r5.stderr[-500:]}")
        new_after_r5 = versions_after_r5 - versions_after_r4
        v20_manifests_r5 = [p for p in new_after_r5 if "v2.0" in p]
        if len(v20_manifests_r5) != 1:
            fail(
                "A_run5_major_manual",
                f"expected exactly one new v2.0 manifest after explicit '--major fileA' "
                f"(content unchanged from run4), got: {sorted(new_after_r5)}. A wrong implementation "
                "that ignores --major, or that requires a content change to honor it, would fail here.",
            )

        # --- run6: rename + move, md5 unchanged -> no new version, -------
        #     index updates, path_history appended
        r6 = run_sync(store_root, shim_dir, "drive_world_run6_renamed_moved.json")
        versions_after_r6 = find_version_dirs(store_root)
        if r6.returncode != 0:
            fail("A_run6_rename", f"rename/move run exited {r6.returncode}: {r6.stderr[-500:]}")
        if versions_after_r6 != versions_after_r5:
            fail(
                "A_run6_rename",
                f"a rename+move with UNCHANGED md5Checksum minted/removed a version "
                f"(before={sorted(versions_after_r5)}, after={sorted(versions_after_r6)}). "
                "A wrong implementation that treats any Drive metadata change (including a rename) "
                "as a content change would fail here.",
            )
        index_after_r6 = load_index(store_root)
        entry6 = (index_after_r6 or {}).get("fileA", {})
        if entry6.get("name") != "Vendor Pricing (Updated).docx":
            fail("A_run6_rename", f"index fileA.name did not update to the new Drive name after rename, got {entry6.get('name')!r}. "
                 "A wrong implementation that silently keeps stale metadata would fail here.")
        if "SAOC" not in (entry6.get("path_in_tree") or ""):
            fail("A_run6_rename", f"index fileA.path_in_tree did not update to reflect the move into SAOC, got {entry6.get('path_in_tree')!r}")
        path_history = entry6.get("path_history") or []
        if not path_history:
            fail(
                "A_run6_rename",
                "index has no path_history entry recording the rename/move -- a wrong implementation "
                "that silently overwrites name/path with no audit trail would pass 'index updated' but "
                "fail this contract's explicit 'must not silently vanish/change' requirement.",
            )

        # --- run7: deleted from Drive -> local files untouched, ----------
        #     index status flips to missing
        manifests_before_r7 = find_version_dirs(store_root)
        manifest_bytes_before = {
            p: open(os.path.join(store_root, p), "rb").read() for p in manifests_before_r7
        }
        r7 = run_sync(store_root, shim_dir, "drive_world_run7_deleted.json")
        manifests_after_r7 = find_version_dirs(store_root)
        if r7.returncode != 0:
            fail("A_run7_deleted", f"deleted-file run exited {r7.returncode}: {r7.stderr[-500:]}")
        if manifests_after_r7 != manifests_before_r7:
            fail(
                "A_run7_deleted",
                f"a file vanishing from Drive changed the set of local manifests on disk "
                f"(before={sorted(manifests_before_r7)}, after={sorted(manifests_after_r7)}). "
                "A wrong implementation that deletes local history when Drive no longer lists the "
                "file would cause real data loss and would fail exactly here.",
            )
        for p, before_bytes in manifest_bytes_before.items():
            after_bytes = open(os.path.join(store_root, p), "rb").read()
            if before_bytes != after_bytes:
                fail("A_run7_deleted", f"manifest {p} content changed after the file vanished from Drive -- local history must be append-only.")
        index_after_r7 = load_index(store_root)
        entry7 = (index_after_r7 or {}).get("fileA", {})
        if entry7.get("status") != "missing":
            fail(
                "A_run7_deleted",
                f"index fileA.status did not flip to 'missing' once the file vanished from Drive, got {entry7.get('status')!r}. "
                "A wrong implementation that leaves stale entries marked 'active' forever would fail here -- "
                "the mission requires a deleted/renamed/moved file to never silently vanish from view.",
            )
        if not entry7.get("missing_since"):
            fail("A_run7_deleted", "index fileA.missing_since not set once flipped to missing")

    # --- run8: storage-path collision -- two DIFFERENT fileIds, SAME name
    #     in the SAME folder. RULING (final, reversing an intermediate
    #     skip-and-continue draft of this run): skip-and-continue means
    #     Lee-Ann's second file silently gets no history until a human
    #     reads a stderr line -- that is the silent-drop pattern this
    #     project has been burned by before. The correct design -- and
    #     what run8 asserts -- is disambiguation: BOTH files are indexed
    #     and minted at DISTINCT on-disk locations, each manifest carries
    #     its own checksum, and nothing is lost. Disambiguation is via a
    #     deterministic suffix derived from the fileId, applied only to
    #     the file that collides with an ALREADY-established owner (the
    #     existing owner keeps its plain human-readable path -- path
    #     stability for the common, non-colliding case is preserved, and
    #     the suffix never shifts across future runs since it is derived
    #     from the fileId, not from anything that could change). A
    #     successful disambiguation is NOT an error: the run must exit 0.
    with tempfile.TemporaryDirectory() as tmp8:
        store_root8 = os.path.join(tmp8, "content", "drive-source")
        os.makedirs(store_root8, exist_ok=True)
        shim_dir8 = make_gws_shim(tmp8)

        run_sync(store_root8, shim_dir8, "drive_world_run8a_collision_setup.json", drive_root_id="coll-root")
        manifests_8a = find_version_dirs(store_root8)
        fileX_manifest_path = next(
            (p for p in manifests_8a if read_manifest(store_root8, p).get("drive_file_id") == "fileX"), None
        )
        if not fileX_manifest_path:
            fail("A_run8_collision", "fileX did not mint a v1.0 manifest on the collision fixture's initial (pre-collision) run")
        else:
            fileX_bytes_before = open(os.path.join(store_root8, fileX_manifest_path), "rb").read()

            r8b = run_sync(store_root8, shim_dir8, "drive_world_run8b_collision_and_continue.json", drive_root_id="coll-root")

            if "Traceback (most recent call last)" in r8b.stderr:
                fail("A_run8_collision", f"the collision run crashed with a raw Python traceback instead of a clean, handled outcome: {r8b.stderr[-500:]}")

            if r8b.returncode != 0:
                fail(
                    "A_run8_collision",
                    f"a successfully-disambiguated collision exited {r8b.returncode} (non-zero) -- a "
                    "wrong implementation that treats a resolved collision as a run failure would fail "
                    f"here (stderr tail: {r8b.stderr[-300:]!r}).",
                )

            fileX_bytes_after = open(os.path.join(store_root8, fileX_manifest_path), "rb").read()
            if fileX_bytes_after != fileX_bytes_before:
                fail(
                    "A_run8_collision",
                    f"fileX's manifest ({fileX_manifest_path}) changed after fileY collided with it on "
                    "name+folder. The existing owner's plain path must stay untouched -- a wrong "
                    "implementation that renames/moves the FIRST file to disambiguate (instead of "
                    "suffixing the NEW one) would fail here.",
                )

            index8 = load_index(store_root8)
            entryX = (index8 or {}).get("fileX", {})
            entryY = (index8 or {}).get("fileY", {})
            manifests8 = find_version_dirs(store_root8)
            fileY_manifest = next((p for p in manifests8 if read_manifest(store_root8, p).get("drive_file_id") == "fileY"), None)
            if not entryX or not entryY:
                fail(
                    "A_run8_collision",
                    f"expected both fileX and fileY indexed after a same-name/same-folder collision, "
                    f"got index keys {sorted((index8 or {}).keys())}. A wrong implementation that lets "
                    "the second file silently overwrite or drop the first's index entry would fail "
                    "here -- both files must be independently visible.",
                )
            elif not fileY_manifest:
                fail(
                    "A_run8_collision",
                    f"fileY has an index entry but no on-disk manifest.json -- disambiguation must "
                    f"actually mint the colliding file, not just record it. Manifests found: {sorted(manifests8)}",
                )
            elif fileY_manifest == fileX_manifest_path:
                fail(
                    "A_run8_collision",
                    f"fileX and fileY resolved to the SAME on-disk manifest path {fileX_manifest_path!r} "
                    "-- one file's data silently overwrote the other's. Disambiguation must produce "
                    "DISTINCT on-disk locations.",
                )
            else:
                mX = read_manifest(store_root8, fileX_manifest_path)
                mY = read_manifest(store_root8, fileY_manifest)
                if mX.get("md5_checksum") != V1_MD5:
                    fail("A_run8_collision", f"fileX's manifest md5_checksum {mX.get('md5_checksum')!r} != expected {V1_MD5!r} (fileY's checksum bled into fileX's manifest?)")
                if mY.get("md5_checksum") != V2_MD5:
                    fail("A_run8_collision", f"fileY's manifest md5_checksum {mY.get('md5_checksum')!r} != expected {V2_MD5!r} (fileX's checksum bled into fileY's manifest?)")

            entryZ = (index8 or {}).get("fileZ", {})
            fileZ_manifest = next((p for p in manifests8 if read_manifest(store_root8, p).get("drive_file_id") == "fileZ"), None)
            if not entryZ or entryZ.get("status") != "active" or not fileZ_manifest:
                fail(
                    "A_run8_collision",
                    f"fileZ (an entirely UNRELATED file, in a different folder, present in the same "
                    f"run as the fileX/fileY collision) was not synced/indexed (entry: {entryZ!r}, "
                    f"manifest: {fileZ_manifest!r}). A wrong implementation that lets one collision's "
                    "handling abort or skip processing of unrelated files would fail here.",
                )

    # --- run9: freed-slot reuse -- rename a file away, then a NEW file ----
    #     takes the name+path it vacated. Same ruling as run8: fileB (the
    #     new file colliding with fileA's frozen location) is disambiguated
    #     via its fileId-derived suffix and indexed/minted, NOT skipped;
    #     fileA's original history stays byte-identical at its plain path;
    #     an unrelated fileC elsewhere in the same run still syncs; the
    #     run exits 0 (a resolved collision is not a failure). -----------
    with tempfile.TemporaryDirectory() as tmp9:
        store_root9 = os.path.join(tmp9, "content", "drive-source")
        os.makedirs(store_root9, exist_ok=True)
        shim_dir9 = make_gws_shim(tmp9)
        run_sync(store_root9, shim_dir9, "drive_world_run9a_freed_slot_initial.json", drive_root_id="freed-root")
        manifests_9a = find_version_dirs(store_root9)
        fileA_manifest_path_9a = next(
            (p for p in manifests_9a if read_manifest(store_root9, p).get("drive_file_id") == "fileA"), None
        )
        if not fileA_manifest_path_9a:
            fail("A_run9_freed_slot", "fileA did not mint a v1.0 manifest on the freed-slot fixture's initial run")
        else:
            fileA_bytes_before = open(os.path.join(store_root9, fileA_manifest_path_9a), "rb").read()

            run_sync(store_root9, shim_dir9, "drive_world_run9b_freed_slot_renamed_away.json", drive_root_id="freed-root")
            r9c = run_sync(store_root9, shim_dir9, "drive_world_run9c_freed_slot_reused.json", drive_root_id="freed-root")

            if "Traceback (most recent call last)" in r9c.stderr:
                fail(
                    "A_run9_freed_slot",
                    f"the freed-slot-reuse run crashed with a raw Python traceback instead of a "
                    f"clean, handled outcome: {r9c.stderr[-500:]}",
                )
            if r9c.returncode != 0:
                fail(
                    "A_run9_freed_slot",
                    f"a successfully-disambiguated freed-slot collision exited {r9c.returncode} "
                    f"(non-zero) -- a resolved collision is not a run failure (stderr tail: "
                    f"{r9c.stderr[-300:]!r}).",
                )

            fileA_bytes_after = open(os.path.join(store_root9, fileA_manifest_path_9a), "rb").read()
            if fileA_bytes_after != fileA_bytes_before:
                fail(
                    "A_run9_freed_slot",
                    f"fileA's original manifest ({fileA_manifest_path_9a}) changed after a NEW file "
                    "(fileB) took over the name+path fileA vacated. fileA's plain path must stay "
                    "frozen -- a wrong implementation that lets the new file mint into (or otherwise "
                    "disturb) the previously-used location would silently corrupt fileA's history.",
                )

            index9 = load_index(store_root9)
            manifests_9c = find_version_dirs(store_root9)
            entryB = (index9 or {}).get("fileB", {})
            fileB_manifest = next((p for p in manifests_9c if read_manifest(store_root9, p).get("drive_file_id") == "fileB"), None)
            if not entryB or not fileB_manifest:
                fail(
                    "A_run9_freed_slot",
                    f"fileB (the new file reusing fileA's vacated name+path) was not indexed/minted "
                    f"(entry: {entryB!r}, manifest: {fileB_manifest!r}) -- disambiguation must actually "
                    "sync the new file at a distinct location, not silently drop it.",
                )
            elif fileB_manifest == fileA_manifest_path_9a:
                fail(
                    "A_run9_freed_slot",
                    f"fileB resolved to the SAME on-disk manifest path as fileA's frozen location "
                    f"({fileA_manifest_path_9a!r}) -- disambiguation must produce a distinct location.",
                )

            entryC = (index9 or {}).get("fileC", {})
            fileC_manifest = next((p for p in manifests_9c if read_manifest(store_root9, p).get("drive_file_id") == "fileC"), None)
            if not entryC or entryC.get("status") != "active" or not fileC_manifest:
                fail(
                    "A_run9_freed_slot",
                    f"fileC (an entirely UNRELATED file, present in the same run as the fileA/fileB "
                    f"freed-slot collision) was not synced/indexed (entry: {entryC!r}, manifest: "
                    f"{fileC_manifest!r}).",
                )

    # --- run10: partial failure -- first file mints cleanly, second's ----
    #     `gws get` fails: the first file's index entry must survive ------
    with tempfile.TemporaryDirectory() as tmp10:
        store_root10 = os.path.join(tmp10, "content", "drive-source")
        os.makedirs(store_root10, exist_ok=True)
        shim_dir10 = make_gws_shim(tmp10)
        r10 = run_sync(store_root10, shim_dir10, "drive_world_run10_partial_failure.json", drive_root_id="partial-root")
        if r10.returncode == 0:
            fail(
                "A_run10_partial_failure",
                "a run where one file's `gws get` fails exited 0 (success) -- a real download "
                "failure must be surfaced as a non-zero exit, not silently swallowed.",
            )
        if "Traceback (most recent call last)" in r10.stderr:
            fail(
                "A_run10_partial_failure",
                f"the partial-failure run crashed with a raw Python traceback instead of a clean, "
                f"handled DriveSyncError-style message: {r10.stderr[-500:]}",
            )
        index10 = load_index(store_root10)
        entryP = (index10 or {}).get("fileP", {})
        if not entryP or entryP.get("status") != "active" or not entryP.get("md5_checksum"):
            fail(
                "A_run10_partial_failure",
                f"fileP (which minted cleanly BEFORE fileQ's simulated `gws get` failure) is missing "
                f"or incomplete in index.json after the run: {entryP!r}. A wrong implementation that "
                "only persists index.json once at the very end of the run loses every already-"
                "successful file's provenance the moment a LATER file in the same run fails -- this "
                "is the exact defect this run isolates.",
            )
        else:
            manifests10 = find_version_dirs(store_root10)
            fileP_manifest = next(
                (p for p in manifests10 if read_manifest(store_root10, p).get("drive_file_id") == "fileP"), None
            )
            if not fileP_manifest:
                fail(
                    "A_run10_partial_failure",
                    "fileP has an index entry but no on-disk manifest.json survived the run's partial failure.",
                )

    # --- run11: corrupt index.json -- must fail cleanly, not with a raw ---
    #     JSONDecodeError traceback --------------------------------------
    with tempfile.TemporaryDirectory() as tmp11:
        store_root11 = os.path.join(tmp11, "content", "drive-source")
        os.makedirs(store_root11, exist_ok=True)
        shim_dir11 = make_gws_shim(tmp11)
        r11_setup = run_sync(store_root11, shim_dir11, "drive_world_run1_initial.json")
        index_path11 = os.path.join(store_root11, "index.json")
        if r11_setup.returncode != 0 or not os.path.isfile(index_path11):
            fail("A_run11_corrupt_index", "setup run for the corrupt-index scenario did not produce an index.json to corrupt")
        else:
            with open(index_path11, "w", encoding="utf-8") as fh:
                fh.write('{"fileA": {"name": "Vendor Pricing.docx", "status": "act')  # truncated on purpose
            r11 = run_sync(store_root11, shim_dir11, "drive_world_run1_initial.json")
            if r11.returncode == 0:
                fail(
                    "A_run11_corrupt_index",
                    "re-running against a truncated/corrupt index.json exited 0 -- a corrupt index "
                    "must be surfaced as a failure, not silently accepted (which risks treating every "
                    "already-versioned file as brand-new and re-minting v1.0 over real history).",
                )
            if "Traceback (most recent call last)" in r11.stderr:
                fail(
                    "A_run11_corrupt_index",
                    f"a corrupt index.json produced a raw Python traceback (json.JSONDecodeError "
                    f"propagating unhandled) instead of a clean, actionable error message: "
                    f"{r11.stderr[-500:]}. A wrong implementation that lets json.load() raise "
                    "straight out of main() would pass 'the run failed' but fails this contract's "
                    "requirement of a distinguishable, operator-readable failure.",
                )
            elif not r11.stderr.strip():
                fail(
                    "A_run11_corrupt_index",
                    "a corrupt index.json produced a non-zero exit but NO stderr message at all -- "
                    "an operator re-running this tool needs to know WHY it failed.",
                )

    # --- run12: pagination -- a folder with more children than one Drive -
    #     page: every child must be discovered, proving --page-all is -----
    #     actually being used, not merely present as a literal token -------
    with tempfile.TemporaryDirectory() as tmp12:
        store_root12 = os.path.join(tmp12, "content", "drive-source")
        os.makedirs(store_root12, exist_ok=True)
        shim_dir12 = make_gws_shim(tmp12)
        r12 = run_sync(store_root12, shim_dir12, "drive_world_run12_pagination.json", drive_root_id="pg-root")
        if r12.returncode != 0:
            fail("A_run12_pagination", f"pagination run exited {r12.returncode}: {r12.stderr[-500:]}")
        index12 = load_index(store_root12)
        expected_names = {"Doc1.docx", "Doc2.docx", "Doc3.docx", "Doc4.docx", "Doc5.docx"}
        found_names = {entry.get("name") for entry in (index12 or {}).values()}
        if found_names != expected_names:
            fail(
                "A_run12_pagination",
                f"expected all 5 files in the paginated folder to be discovered, got {sorted(found_names)} "
                f"(missing: {sorted(expected_names - found_names)}). The fake gws stub only returns the "
                "first page (2 items) of a folder listing unless the real `gws drive files list --page-all` "
                "flag is passed -- a wrong implementation that dropped that flag, or that only reads the "
                "first page of a `nextPageToken`-bearing response, would silently miss files in any Drive "
                "folder larger than one page and fail exactly here.",
            )

    # --- run13: path traversal -- Drive-controlled folder/file names used -
    #     directly as filesystem path components. A folder named ".." and -
    #     a file name containing "/" must be rejected (skip-and-continue, -
    #     same shape as runs 8/9: no escape, no crash, run continues, ------
    #     non-zero exit), while the legitimate "SAOC " folder (real -------
    #     trailing space) must keep syncing normally -- an over-eager -----
    #     sanitiser that rejects unusual-but-valid names would break -----
    #     Lee-Ann's actual tree, and only this negative control catches ---
    #     that. -------------------------------------------------------
    with tempfile.TemporaryDirectory() as tmp13:
        store_root13 = os.path.join(tmp13, "content", "drive-source")
        os.makedirs(store_root13, exist_ok=True)
        store_root13_parent = os.path.dirname(store_root13)  # tmp13/content
        listing_before = set(os.listdir(store_root13_parent))
        shim_dir13 = make_gws_shim(tmp13)
        r13 = run_sync(store_root13, shim_dir13, "drive_world_run13_path_traversal.json", drive_root_id="trav-root")

        if "Traceback (most recent call last)" in r13.stderr:
            fail(
                "A_run13_path_traversal",
                f"a Drive-controlled folder named '..' or a file name containing '/' crashed the "
                f"tool with a raw Python traceback instead of a clean, handled rejection: "
                f"{r13.stderr[-500:]}",
            )
        if r13.returncode == 0:
            fail(
                "A_run13_path_traversal",
                "a run containing a folder named '..' and a file name containing '/' exited 0 "
                "(success) -- both are invalid/untrusted path components and must be rejected with "
                "a non-zero exit, the same as any other skipped file.",
            )

        listing_after = set(os.listdir(store_root13_parent))
        escaped = listing_after - listing_before - {"drive-source"}
        if escaped:
            fail(
                "A_run13_path_traversal",
                f"unexpected new entries appeared ALONGSIDE the store root after syncing a folder "
                f"named '..': {sorted(escaped)}. A wrong implementation that joins an untrusted "
                "folder name directly into a filesystem path (os.path.join(store_root, '..', ...)) "
                "would write outside store_root -- exactly what this checks for.",
            )

        for dirpath, dirnames, _filenames in os.walk(store_root13):
            if ".." in dirnames or ".." in os.path.relpath(dirpath, store_root13).split(os.sep):
                fail(
                    "A_run13_path_traversal",
                    f"found a literal '..' path component on disk under store_root at {dirpath!r} -- "
                    "the Drive folder name '..' was used verbatim as a filesystem path segment instead "
                    "of being rejected.",
                )
                break

        index13 = load_index(store_root13)
        manifests13 = find_version_dirs(store_root13)
        for bad_id in ("dotdot-file", "slash-file"):
            entry = (index13 or {}).get(bad_id, {})
            manifest = next((p for p in manifests13 if read_manifest(store_root13, p).get("drive_file_id") == bad_id), None)
            if entry or manifest:
                fail(
                    "A_run13_path_traversal",
                    f"{bad_id!r} (an untrusted/invalid path component) was indexed and/or minted a "
                    f"manifest (index entry: {entry!r}, manifest: {manifest!r}) instead of being "
                    "rejected.",
                )

        entry_legit = (index13 or {}).get("legit-file", {})
        legit_manifest = next((p for p in manifests13 if read_manifest(store_root13, p).get("drive_file_id") == "legit-file"), None)
        if not entry_legit or entry_legit.get("status") != "active" or not legit_manifest:
            fail(
                "A_run13_path_traversal",
                f"the legitimate file inside the real 'SAOC ' folder (trailing space, a genuinely "
                f"valid Drive folder name in this tree) was NOT synced (entry: {entry_legit!r}, "
                f"manifest: {legit_manifest!r}). An over-eager sanitiser that rejects unusual-but-"
                "valid names would break Lee-Ann's actual tree and would fail exactly this negative "
                "control.",
            )
        elif legit_manifest:
            m_legit = read_manifest(store_root13, legit_manifest)
            content_md_rel = m_legit.get("content_md_relpath")
            candidates = [
                os.path.join(store_root13, os.path.dirname(legit_manifest), content_md_rel or ""),
                os.path.join(store_root13, content_md_rel or ""),
            ]
            found_md = next((c for c in candidates if content_md_rel and os.path.isfile(c)), None)
            if found_md and "R3800" not in open(found_md, encoding="utf-8").read():
                fail("A_run13_path_traversal", "the legit 'SAOC ' file's content.md does not contain the expected fixture text")

    if failures:
        print("FAIL")
        for f in failures:
            print(f"FAIL: {f}")
        sys.exit(1)
    print("PASS: all scripted sync runs (version-semantics/idempotency/rename/deletion/collision/partial-failure/corrupt-index/pagination/path-traversal) match the contract")
    sys.exit(0)


if __name__ == "__main__":
    main()

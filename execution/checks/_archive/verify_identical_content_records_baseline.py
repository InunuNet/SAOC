#!/usr/bin/env python3
"""
verify_identical_content_records_baseline.py — F11: the byte-identical
short-circuit in _sync_file_with_guard() must record a baseline for the
now-matching content before returning "unchanged", not skip straight past
the entire baseline read/write block.

CONTEXT (template-update-actually-updates F11, downstream Alembic report,
2026-08-16): the "operator hand-edits a diverged file to exactly match
upstream" recovery path -- the intuitive fix an operator reaches for when
--apply refuses a file -- currently leads to a DEAD END. Walk the actual
code path in _sync_file_with_guard() (execution/update_template.py,
~line 280-291):

    if dst_file.exists() and dst_file.is_file():
        try:
            if _sha256_of_file(dst_file) == _sha256_of_file(src_file):
                return "unchanged"          # <-- returns HERE
        except OSError:
            pass

        baselines = load_template_baselines()   # never reached on the
        ...                                      # byte-identical path
        save_template_baselines(baselines)       # never reached either

The guard is not lying when it says "unchanged" -- dst really does match
src right now. But by returning before ever touching the baseline store,
it throws away the one opportunity to record that this exact content is
now canonical. The very next time upstream advances (a real, later
change), the guard has NO baseline for this key, so a file that is
actually clean (matches the version it was hand-corrected to) gets
treated identically to a genuine unrecorded hand-edit -- REFUSED again,
forever, because nothing ever runs that could establish the baseline the
guard needs to tell the two cases apart. The mechanism is internally
consistent and communicates something false: it never had the chance to
learn the divergence was resolved.

FIX UNDER TEST (design (a), chosen over (b) "leave behavior unchanged,
just WARN and name --force-path"): record the baseline on the
byte-identical path too, before returning "unchanged" -- content already
matches upstream, so there is nothing at risk; recording is what actually
closes the dead end, a WARN alone would only document it. Must remain a
TRUE no-op on file bytes (no shutil.copy2, no backup, no mtime change);
only the baseline JSON record may change, and only when it is actually
stale or missing (writing an already-correct record back out is a
pointless store rewrite, not a functional requirement, and this check
holds the fix to not doing it). The pre-existing full-path symlink guard
(_refuse_symlinked_write, checked FIRST, unconditionally, before the
byte-identical block is ever reached) must still refuse a symlinked
destination -- this fix must not create a second, later code path that
could record a baseline for a write that was never actually inspected as
"real content at rest", and predict=True (the --dry-run companion,
template-update-actually-updates F10) must continue to suppress this new
baseline write exactly like every other write in this function.

THIS CHECK CALLS THE REAL _sync_file_with_guard() FUNCTION AGAINST A REAL
ON-DISK FIXTURE AND INSPECTS THE REAL BASELINE STORE FILE AFTERWARD -- it
does not grep update_template.py's source text (see F9's contract for why
that defect class is unacceptable here).

ROWS (the golden reports exactly which failed):
  ROW1 (the point of this contract): simulates the FULL three-cycle
    operator journey end to end -- diverged/no-baseline -> refused;
    operator hand-edits to match upstream -> "unchanged" AND a baseline
    gets recorded; upstream advances again -> the file that would have
    been refused forever under the bug is now delivered normally ("copied",
    not "skipped"). Defeats: the current bug outright, AND any fix that
    only satisfies a single-call check without actually closing the cycle
    (e.g. a fix that records a baseline but under the wrong key, or only
    when force=True, would pass a shallow "baseline got written" check
    but still fail this row's cycle-3 assertion).
  ROW2: byte-identical WITH an already-correct recorded baseline. Must
    stay a true no-op -- destination mtime AND the baseline store file's
    own mtime must both be unchanged. Defeats a fix that unconditionally
    rewrites the baseline store on every byte-identical hit regardless of
    whether anything actually needs to change.
  ROW3: byte-identical with NO baseline at all (the bug's minimal
    single-call reproduction). Defeats a fix that only handles the
    multi-cycle shape of ROW1 but not a bare first-contact byte-identical
    file (e.g. a fresh workspace where dst happens to already equal
    upstream). Also asserts dst's mtime is untouched -- proves the
    "content write" and "baseline write" are genuinely independent, not
    that the fix silently started re-copying identical content to force
    a baseline through the normal write path.
  ROW4: byte-identical destination reached through a SYMLINK. Must still
    return "skipped" via the pre-existing symlink guard, and must NOT
    record a baseline for that key. Defeats a fix that moves the
    byte-identical check earlier (ahead of the symlink guard) to simplify
    the new baseline-write logic, which would punch a hole in the
    guard this fix is explicitly required not to touch.
  ROW5: predict=True (the --dry-run companion) on a byte-identical/
    no-baseline file. Must still return "unchanged" but record NOTHING
    -- defeats a fix that gates the pre-existing writes on `not predict`
    but forgets to gate its OWN new baseline write the same way, which
    would silently break template-update-actually-updates F10's "MUST
    NOT write anything to disk while computing... a --dry-run preview"
    guarantee.
"""
import shutil
import sys
import tempfile
import time
from pathlib import Path


def _find_repo_root(start: Path) -> Path:
    """Walk upward from this file to find the repo root, identified by
    execution/update_template.py existing under it. Deliberately NOT a
    fixed parents[N] index -- this script is invoked from two different
    locations (execution/checks/ directly, and its .golden copy nested
    under .agent/memory/project/specs/.../goldens/), at different depths
    from the repo root.
    """
    for candidate in [start, *start.parents]:
        if (candidate / "execution" / "update_template.py").is_file():
            return candidate
    raise RuntimeError("could not locate repo root from " + str(start))


REPO_ROOT = _find_repo_root(Path(__file__).resolve().parent)
sys.path.insert(0, str(REPO_ROOT / "execution"))

import update_template  # noqa: E402


V1 = b"line one\nline two\n"
V2 = b"line one\nline two\nline three (v2)\n"


def _sha(data: bytes) -> str:
    import hashlib
    return hashlib.sha256(data).hexdigest()


def _sleep_for_mtime_resolution() -> None:
    # Guarantee a detectable mtime delta if a write DOES happen -- some
    # filesystems have coarse mtime granularity (whole seconds).
    time.sleep(1.05)


def main() -> int:
    # .resolve() is required here, not cosmetic: on macOS, tempfile.mkdtemp()
    # returns a path under /var/folders/..., and /var is ITSELF a symlink to
    # /private/var. Leaving the path unresolved makes every fixture path
    # contain a symlink ancestor component purely as a platform artifact,
    # which trips _refuse_symlinked_write() before this check's own fixture
    # content is ever reached -- a fixture bug, not a signal about the code
    # under test. Resolving up front keeps the fixture tree itself free of
    # incidental symlinks so ROW4 is the only row that intentionally has one.
    tmpdir = Path(tempfile.mkdtemp(prefix="identical_content_baseline_fixture_")).resolve()
    failures: list[str] = []
    import os

    cwd = os.getcwd()
    try:
        src_dir = tmpdir / "source"
        dst_dir = tmpdir / "dest"
        src_dir.mkdir(parents=True)
        dst_dir.mkdir(parents=True)

        os.chdir(tmpdir)

        baselines_path = Path(update_template.TEMPLATE_BASELINES_PATH)

        # ---------------------------------------------------------------
        # ROW1: full three-cycle operator journey.
        # ---------------------------------------------------------------
        key1 = "rowB1/file.txt"
        src1 = src_dir / "rowB1.txt"
        dst1 = dst_dir / "rowB1.txt"
        src1.write_bytes(V1)
        dst1.write_bytes(b"operator's own diverged local edit, never synced\n")

        # Cycle 1: genuinely diverged, no baseline -> must refuse.
        status = update_template._sync_file_with_guard(src1, dst1, None, key1)
        if status != "skipped":
            failures.append(
                f"ROW1 cycle1 FAIL: expected 'skipped' (no-baseline divergence "
                f"refusal), got {status!r}"
            )
        baselines = update_template.load_template_baselines()
        if key1 in baselines:
            failures.append(
                "ROW1 cycle1 FAIL: baseline was recorded for a REFUSED write "
                f"(key={key1!r}) -- a refusal must never record a baseline "
                "for content it did not deliver"
            )

        # Cycle 2: operator hand-edits dst to match upstream exactly.
        dst1.write_bytes(V1)
        _sleep_for_mtime_resolution()
        mtime_before = dst1.stat().st_mtime
        status = update_template._sync_file_with_guard(src1, dst1, None, key1)
        if status != "unchanged":
            failures.append(
                f"ROW1 cycle2 FAIL: expected 'unchanged' (content now matches "
                f"upstream), got {status!r}"
            )
        if dst1.stat().st_mtime != mtime_before or dst1.read_bytes() != V1:
            failures.append(
                "ROW1 cycle2 FAIL: destination bytes/mtime were touched on the "
                "byte-identical path -- this must remain a true no-op on file "
                "content"
            )
        baselines = update_template.load_template_baselines()
        if baselines.get(key1) != _sha(V1):
            failures.append(
                "ROW1 cycle2 FAIL (THE CORE BUG): after content converged to "
                f"exactly match upstream, no correct baseline was recorded for "
                f"key={key1!r} (found {baselines.get(key1)!r}, expected "
                f"{_sha(V1)!r}). This is the dead end: the operator's fix "
                "looks correct and produces no error, but the guard never "
                "learned it."
            )

        # Cycle 3: upstream advances again. dst is UNCHANGED since cycle 2
        # (still holds V1, exactly the recorded baseline). This must now be
        # a normal, safe delivery -- NOT a refusal.
        src1.write_bytes(V2)
        status = update_template._sync_file_with_guard(src1, dst1, None, key1)
        if status != "copied":
            failures.append(
                "ROW1 cycle3 FAIL (THE DEAD END): a file that exactly matched "
                "its recorded baseline was refused instead of updated when "
                f"upstream genuinely advanced -- got {status!r}, expected "
                "'copied'. Under the original bug this reproduces the "
                "'identical refusal, forever' failure mode one cycle later."
            )
        if dst1.exists() and dst1.read_bytes() != V2:
            failures.append(
                "ROW1 cycle3 FAIL: destination was not actually updated to "
                "the new upstream content despite a 'copied' status"
            )

        # ---------------------------------------------------------------
        # ROW2: byte-identical WITH an already-correct baseline -- must
        # stay a true no-op, including no pointless baseline-store rewrite.
        # ---------------------------------------------------------------
        key2 = "rowB2/file.txt"
        src2 = src_dir / "rowB2.txt"
        dst2 = dst_dir / "rowB2.txt"
        src2.write_bytes(V1)
        dst2.write_bytes(V1)
        baselines = update_template.load_template_baselines()
        baselines[key2] = _sha(V1)
        update_template.save_template_baselines(baselines)

        _sleep_for_mtime_resolution()
        dst_mtime_before = dst2.stat().st_mtime
        store_mtime_before = baselines_path.stat().st_mtime

        status = update_template._sync_file_with_guard(src2, dst2, None, key2)
        if status != "unchanged":
            failures.append(f"ROW2 FAIL: expected 'unchanged', got {status!r}")
        if dst2.stat().st_mtime != dst_mtime_before:
            failures.append(
                "ROW2 FAIL: destination mtime changed on an already-correct "
                "byte-identical, already-baselined file"
            )
        if baselines_path.stat().st_mtime != store_mtime_before:
            failures.append(
                "ROW2 FAIL: baseline store file was rewritten even though "
                "its recorded value for this key was already correct -- the "
                "byte-identical no-op path must not perform pointless writes"
            )
        baselines = update_template.load_template_baselines()
        if baselines.get(key2) != _sha(V1):
            failures.append("ROW2 FAIL: baseline value corrupted by the no-op call")

        # ---------------------------------------------------------------
        # ROW3: byte-identical with NO baseline at all -- minimal single-
        # call reproduction of the bug.
        # ---------------------------------------------------------------
        key3 = "rowB3/file.txt"
        src3 = src_dir / "rowB3.txt"
        dst3 = dst_dir / "rowB3.txt"
        src3.write_bytes(V2)
        dst3.write_bytes(V2)

        _sleep_for_mtime_resolution()
        dst3_mtime_before = dst3.stat().st_mtime
        status = update_template._sync_file_with_guard(src3, dst3, None, key3)
        if status != "unchanged":
            failures.append(f"ROW3 FAIL: expected 'unchanged', got {status!r}")
        if dst3.stat().st_mtime != dst3_mtime_before:
            failures.append(
                "ROW3 FAIL: destination content/mtime touched while merely "
                "recording a baseline for already-identical content"
            )
        baselines = update_template.load_template_baselines()
        if baselines.get(key3) != _sha(V2):
            failures.append(
                f"ROW3 FAIL: no correct baseline recorded for key={key3!r} on "
                "the bare byte-identical-with-no-prior-baseline path "
                f"(found {baselines.get(key3)!r}, expected {_sha(V2)!r})"
            )

        # ---------------------------------------------------------------
        # ROW4: byte-identical destination reached through a SYMLINK --
        # the pre-existing symlink guard must still win; no baseline may
        # be recorded for a write that was never really inspected.
        # ---------------------------------------------------------------
        key4 = "rowB4/file.txt"
        src4 = src_dir / "rowB4.txt"
        target4 = dst_dir / "rowB4_target.txt"
        link4 = dst_dir / "rowB4.txt"
        src4.write_bytes(V1)
        target4.write_bytes(V1)  # symlink resolves to byte-identical content
        link4.symlink_to(target4)

        status = update_template._sync_file_with_guard(src4, link4, None, key4)
        if status != "skipped":
            failures.append(
                f"ROW4 FAIL: symlinked destination with byte-identical "
                f"resolved content was not refused -- got {status!r}, "
                "expected 'skipped'"
            )
        if not link4.is_symlink():
            failures.append("ROW4 FAIL: symlink was replaced/removed")
        if target4.read_bytes() != V1:
            failures.append("ROW4 FAIL: symlink target content was modified")
        baselines = update_template.load_template_baselines()
        if key4 in baselines:
            failures.append(
                f"ROW4 FAIL: a baseline was recorded for key={key4!r} despite "
                "the write being refused by the symlink guard -- this would "
                "punch a hole in the symlink guard by making a future run "
                "trust a baseline for content that was never actually "
                "delivered through a safe path"
            )

        # ---------------------------------------------------------------
        # ROW5: predict=True must suppress the new baseline write exactly
        # like every other write in this function (F10 regression guard).
        # ---------------------------------------------------------------
        key5 = "rowB5/file.txt"
        src5 = src_dir / "rowB5.txt"
        dst5 = dst_dir / "rowB5.txt"
        src5.write_bytes(V1)
        dst5.write_bytes(V1)

        status = update_template._sync_file_with_guard(
            src5, dst5, None, key5, predict=True
        )
        if status != "unchanged":
            failures.append(f"ROW5 FAIL: expected 'unchanged', got {status!r}")
        baselines = update_template.load_template_baselines()
        if key5 in baselines:
            failures.append(
                f"ROW5 FAIL: predict=True recorded a baseline for key={key5!r} "
                "-- a --dry-run prediction must perform ZERO writes, including "
                "to the baseline store"
            )

    finally:
        os.chdir(cwd)
        shutil.rmtree(tmpdir, ignore_errors=True)

    # ---------------------------------------------------------------
    # ROW6: baseline-store SAVE fails (parent directory non-writable,
    # first-time key -- no pre-existing store FILE at all) on the
    # byte-identical path. QA-reported gap (2026-08-16): the new F11
    # save_template_baselines() call can raise OSError; if that error is
    # caught by the OUTER try/except OSError (the one that exists for the
    # sha256 comparison above it) instead of a try/except scoped to just
    # the load/save pair, execution falls THROUGH past `return
    # "unchanged"` into the diverged/no-record branch below it, which
    # reports a FALSE "no recorded baseline ... differs from incoming
    # content -- SKIPPING overwrite" for content already proven
    # byte-identical. Nothing raises out of _sync_file_with_guard() in
    # either version -- the defect is a WRONG VERDICT, silently, not a
    # crash, so this row asserts the returned status, not merely "did not
    # raise".
    #
    # Isolated in its OWN tmpdir/chdir, deliberately NOT reusing the
    # shared ROW1-5 fixture tree above: those rows already created
    # template_baselines.json (with keys 1-5 in it) via ordinary saves
    # earlier in this same run. Unix only requires write permission on a
    # FILE itself to truncate-overwrite its existing content -- NOT on
    # its parent directory -- so chmod'ing an already-populated store's
    # parent directory read-only would NOT reproduce a save failure for
    # an EXISTING key at all (a subtlety confirmed by inspection, not
    # guessed at: os.open() with O_TRUNC on an existing, writable file
    # succeeds regardless of the containing directory's permissions).
    # Only a genuinely first-time key -- store file entirely absent, so
    # save_template_baselines() must CREATE it, which DOES require
    # parent-directory write permission -- exercises the reported path.
    # A row built against the shared, already-populated store would look
    # like it tests the save-failure case while actually asserting
    # nothing about it.
    # ---------------------------------------------------------------
    row6_tmpdir = Path(tempfile.mkdtemp(prefix="identical_content_baseline_row6_")).resolve()
    row6_cwd = os.getcwd()
    row6_scratch_dir = row6_tmpdir / ".agent" / "memory" / "scratch"
    try:
        row6_src_dir = row6_tmpdir / "source"
        row6_dst_dir = row6_tmpdir / "dest"
        row6_src_dir.mkdir(parents=True)
        row6_dst_dir.mkdir(parents=True)
        os.chdir(row6_tmpdir)

        key6 = "rowB6/file.txt"
        src6 = row6_src_dir / "rowB6.txt"
        dst6 = row6_dst_dir / "rowB6.txt"
        src6.write_bytes(V1)
        dst6.write_bytes(V1)  # byte-identical, no baseline recorded for key6 yet

        row6_scratch_dir.mkdir(parents=True, exist_ok=True)
        row6_store_path = row6_scratch_dir / "template_baselines.json"
        if row6_store_path.exists():
            failures.append(
                "ROW6 FAIL (fixture bug): baseline store already existed "
                "before the row ran -- this row requires a genuine "
                "first-time-key save to reproduce the reported gap"
            )

        _sleep_for_mtime_resolution()
        dst6_mtime_before = dst6.stat().st_mtime
        dst6_bytes_before = dst6.read_bytes()

        row6_scratch_dir.chmod(0o555)  # r-x only -- blocks CREATING a new file inside it
        try:
            status = update_template._sync_file_with_guard(src6, dst6, None, key6)
        finally:
            row6_scratch_dir.chmod(0o755)  # restore immediately, even on failure/exception

        if status != "unchanged":
            failures.append(
                f"ROW6 FAIL (THE REPORTED GAP): a baseline-store save failure "
                f"on the byte-identical path produced a WRONG VERDICT -- "
                f"expected 'unchanged' (content is genuinely identical; "
                f"nothing was raising out of the function, the bug is a "
                f"silent false verdict), got {status!r}. This means the "
                "OSError from the failed save fell through past `return "
                "\"unchanged\"` into the diverged/no-record branch, which is "
                "exactly the false 'no recorded baseline ... differs from "
                "incoming' refusal QA reported."
            )
        if dst6.stat().st_mtime != dst6_mtime_before or dst6.read_bytes() != dst6_bytes_before:
            failures.append(
                "ROW6 FAIL: destination bytes/mtime were touched when the "
                "baseline-store save failed -- a save failure must never "
                "become a content write"
            )
        # Best-effort semantics, deliberately NOT asserted either way: the
        # baseline for key6 was almost certainly NOT recorded (the
        # directory genuinely could not be written to) -- this is
        # ACCEPTABLE and expected. Asserting it WAS recorded would demand
        # the impossible from a directory that really is non-writable, and
        # would push an implementer toward the wrong fix (e.g. retrying
        # against a different path, or raising instead of degrading) --
        # exactly what the task instructions for this row warned against.
    finally:
        os.chdir(row6_cwd)
        # Restore write permission before rmtree regardless of outcome --
        # some platforms cannot remove a non-writable directory's contents,
        # and leaving one behind would poison later runs sharing tmp.
        if row6_scratch_dir.exists():
            row6_scratch_dir.chmod(0o755)
        shutil.rmtree(row6_tmpdir, ignore_errors=True)

    if failures:
        print("FAIL: byte-identical path does not correctly record baselines")
        for f in failures:
            print(f"  {f}")
        return 1

    print(
        "PASS: byte-identical content correctly records/preserves baselines "
        "across the full refuse -> hand-edit -> converge -> resume-updating "
        "operator cycle, stays a true no-op on file bytes, never records a "
        "baseline through a refused symlinked write, and predict=True "
        "performs zero writes"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
verify_dry_run_apply_parity.py — F10: --dry-run must predict, per file, the
exact outcome --apply will actually produce for a HARNESS directory entry —
and must write nothing while doing so.

CONTEXT (template-update-actually-updates F10, P1, downstream Alembic
report): --dry-run for HARNESS entries (main()'s manifest loop) currently
only checks `src_path.exists()` and prints ONE line per MANIFEST ENTRY
("would update: <path>  [exists]") -- for a directory entry covering
hundreds of files, that is one line for the whole directory. It never
loads the baseline store, never hashes the destination, never calls
_sync_file_with_guard(). --apply's real per-file logic (copy_harness() ->
_sync_file_with_guard()) can and does REFUSE individual files (no baseline
recorded + local content diverged from incoming -- the F5/F6 guard's
conservative default). A path --apply will refuse currently previews as
"would update".

WHY THIS IS P1, NOT COSMETIC: the preview errs toward OVERSTATING change,
which sounds safe -- but Alembic's operator reported nearly hand-copying
their skills out before running --apply, specifically BECAUSE the preview
told them everything would update and they did not trust that a path with
real local edits would be protected. The bug's damage is to operator
behavior (defensive manual file-copying is itself a data-loss vector),
not to bytes on disk. A correct preview that can say "would refuse (local
modifications, no baseline)" is what removes the incentive to hand-copy
anything first.

REQUIRED PREVIEW FORMAT (this is the testable contract dev must implement
against, not merely a suggestion): for every HARNESS entry -- file or
directory -- --dry-run must print one line per REAL ON-DISK FILE UNDER
THAT ENTRY (a directory entry with N files -> N lines, not 1), each
matching:

    ^  (would-update|would-skip|would-refuse|would-force)  (.+)$

where the trailing path is the same per-file key format copy_harness()
and the F6 baseline-adoption path already use for directory entries
(f"{path.rstrip('/')}/{rel.as_posix()}"), and the status word is the
PREDICTED bucket matching _sync_file_with_guard()'s own real return-value
vocabulary 1:1:
    would-update  <-> real outcome "copied"    (new file, or local matches
                                                 recorded baseline and
                                                 incoming differs)
    would-skip    <-> real outcome "unchanged" (dst already byte-identical
                                                 to incoming)
    would-refuse  <-> real outcome "skipped"   (guard refusal: diverged,
                                                 with or without a recorded
                                                 baseline -- THE case this
                                                 contract exists to fix)
    would-force   <-> real outcome "forced"    (--force-path given for
                                                 this exact path; not
                                                 exercised by this fixture,
                                                 defined here for
                                                 vocabulary completeness)

THIS CHECK NEVER TRUSTS PRINTED APPLY OUTPUT AS GROUND TRUTH. The real
outcome for each fixture file is derived purely from ON-DISK CONTENT
before vs. after a REAL --apply run (a file that changes to match
incoming = copied; a file that stays exactly as it was despite differing
from incoming = refused; a file already matching incoming that stays put
= unchanged). This makes the parity check immune to cosmetic wording
choices in --apply's own print statements -- only --dry-run's predictive
text and --apply's actual filesystem effect are compared, which is
exactly the two things that must never drift apart.
"""
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def _find_repo_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "execution" / "update_template.py").is_file():
            return candidate
    raise RuntimeError("could not locate repo root from " + str(start))


REPO_ROOT = _find_repo_root(Path(__file__).resolve().parent)
UPDATE_TEMPLATE = REPO_ROOT / "execution" / "update_template.py"

PREVIEW_LINE_RE = re.compile(
    r"^\s*(would-update|would-skip|would-refuse|would-force)\s+(\S+)\s*$"
)

# The five provenance rows, keyed by their destination-relative filename
# under the "myharness/" directory HARNESS entry.
#   dst_before: content already on disk at the destination (None = file
#               does not exist yet -- the "new file lands" row).
#   src:        incoming content from the --source tree.
#   baseline:   recorded baseline content for this key (None = no record
#               at all -- the F5/F6 no-baseline-diverged REFUSE case).
FIXTURE_FILES = {
    "new_file.txt": dict(
        dst_before=None,
        src=b"NEW FILE CONTENT\n",
        baseline=None,
    ),
    "baseline_identical.txt": dict(
        dst_before=b"OLD SYNCED CONTENT\n",
        src=b"UPDATED CONTENT FROM UPSTREAM\n",
        baseline=b"OLD SYNCED CONTENT\n",  # matches dst_before -> safe update
    ),
    "diverged_with_baseline.txt": dict(
        dst_before=b"USER HAND EDIT\n",
        src=b"UPSTREAM UPDATE\n",
        baseline=b"ORIGINAL SYNCED CONTENT\n",  # != dst_before -> diverged, has record
    ),
    "no_baseline_diverged.txt": dict(
        dst_before=b"UNTRACKED LOCAL EDIT\n",
        src=b"UPSTREAM CONTENT\n",
        baseline=None,  # no record at all -> diverged, no record (the REFUSE case)
    ),
    "unchanged_file.txt": dict(
        dst_before=b"SAME CONTENT\n",
        src=b"SAME CONTENT\n",  # already matches incoming
        baseline=None,
    ),
}

HARNESS_DIR = "myharness"


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_fixture(root: Path) -> None:
    source_dir = root / "source" / HARNESS_DIR
    dst_dir = root / HARNESS_DIR
    source_dir.mkdir(parents=True)
    dst_dir.mkdir(parents=True)

    baselines = {}
    for name, spec in FIXTURE_FILES.items():
        (source_dir / name).write_bytes(spec["src"])
        if spec["dst_before"] is not None:
            (dst_dir / name).write_bytes(spec["dst_before"])
        if spec["baseline"] is not None:
            key = f"{HARNESS_DIR}/{name}"
            baselines[key] = _sha256(spec["baseline"])

    baseline_store = root / ".agent" / "memory" / "scratch" / "template_baselines.json"
    baseline_store.parent.mkdir(parents=True, exist_ok=True)
    import json

    baseline_store.write_text(json.dumps(baselines, indent=2))

    manifest = root / ".agent" / "update-manifest.yaml"
    manifest.write_text(
        "paths:\n"
        f"  - category: HARNESS\n"
        f"    path: {HARNESS_DIR}/\n"
    )


def snapshot_tree(root: Path) -> dict[str, bytes]:
    """Every file under root, keyed by path relative to root, mapped to its
    byte content. Used to prove --dry-run wrote NOTHING anywhere in the
    fixture -- not just under the HARNESS entry being previewed.
    """
    out = {}
    for p in sorted(root.rglob("*")):
        if p.is_file():
            out[str(p.relative_to(root))] = p.read_bytes()
    return out


def run_update_template(cwd: Path, extra_args: list[str]) -> str:
    proc = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--source", str(cwd / "source"), *extra_args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=60,
    )
    return proc.stdout + proc.stderr


def parse_preview(dry_run_output: str) -> dict[str, str]:
    """Map destination key ("myharness/<file>") -> predicted status word,
    for every per-file preview line found in --dry-run's output.
    """
    predicted = {}
    for line in dry_run_output.splitlines():
        m = PREVIEW_LINE_RE.match(line)
        if m:
            status, key = m.group(1), m.group(2)
            predicted[key] = status
    return predicted


def determine_ground_truth(before: dict[str, bytes], after: dict[str, bytes]) -> dict[str, str]:
    """Real outcome per fixture file, derived ONLY from on-disk content
    before vs. after a REAL --apply run -- never from --apply's own
    printed messages.
    """
    truth = {}
    for name, spec in FIXTURE_FILES.items():
        key = f"{HARNESS_DIR}/{name}"
        rel = f"{HARNESS_DIR}/{name}"
        pre = before.get(rel)
        post = after.get(rel)
        src = spec["src"]
        if post is None:
            truth[key] = "MISSING-AFTER-APPLY"
        elif pre is None:
            truth[key] = "copied" if post == src else "UNEXPECTED-NEW-FILE-MISMATCH"
        elif pre == src:
            truth[key] = "unchanged" if post == pre else "UNEXPECTED-CHANGED-ALREADY-CURRENT"
        elif post == src:
            truth[key] = "copied"
        elif post == pre:
            truth[key] = "skipped"
        else:
            truth[key] = "UNEXPECTED-PARTIAL-WRITE"
    return truth


STATUS_TO_REAL = {
    "would-update": "copied",
    "would-skip": "unchanged",
    "would-refuse": "skipped",
    "would-force": "forced",
}


def main() -> int:
    tmpdir = Path(tempfile.mkdtemp(prefix="dry_run_apply_parity_"))
    failures: list[str] = []
    try:
        build_fixture(tmpdir)

        before_dry_run = snapshot_tree(tmpdir)
        dry_run_output = run_update_template(tmpdir, ["--dry-run"])
        after_dry_run = snapshot_tree(tmpdir)

        # --- B2: dry-run must write NOTHING, anywhere in the fixture. ---
        if before_dry_run != after_dry_run:
            added = set(after_dry_run) - set(before_dry_run)
            removed = set(before_dry_run) - set(after_dry_run)
            changed = {
                k for k in (set(before_dry_run) & set(after_dry_run))
                if before_dry_run[k] != after_dry_run[k]
            }
            failures.append(
                "B2 FAIL: --dry-run wrote to the fixture tree -- "
                f"added={sorted(added)} removed={sorted(removed)} "
                f"changed={sorted(changed)}"
            )

        predicted = parse_preview(dry_run_output)

        # --- B3: directory-entry granularity -- one line per real file, ---
        # --- not one coarse line for the whole "myharness/" entry.      ---
        expected_keys = {f"{HARNESS_DIR}/{name}" for name in FIXTURE_FILES}
        found_keys = set(predicted) & expected_keys
        missing_keys = expected_keys - found_keys
        if missing_keys:
            failures.append(
                "B3 FAIL: --dry-run did not emit a distinct per-file preview "
                f"line for: {sorted(missing_keys)} (directory entry preview "
                "must be per-file, not one line for the whole entry)"
            )

        # Now establish ground truth via a REAL --apply run on the SAME
        # fixture (sequential: dry-run already proven to be a no-op above,
        # so this reflects the same pre-state predicted against).
        before_apply = snapshot_tree(tmpdir)
        run_update_template(tmpdir, ["--apply"])
        after_apply = snapshot_tree(tmpdir)
        ground_truth = determine_ground_truth(before_apply, after_apply)

        # --- B1: PARITY -- predicted bucket must equal the real bucket, ---
        # --- for every fixture file, including (especially) the        ---
        # --- no-baseline-diverged REFUSE case this contract exists for.---
        for key in expected_keys:
            real = ground_truth.get(key)
            if real is None or real.startswith(("UNEXPECTED", "MISSING")):
                failures.append(f"B1 FIXTURE FAIL: {key} real outcome was {real!r} (fixture bug, not the fix under test)")
                continue
            status_word = predicted.get(key)
            if status_word is None:
                # Already reported as B3; still note it against B1 for clarity.
                continue
            expected_real = STATUS_TO_REAL.get(status_word)
            if expected_real != real:
                failures.append(
                    f"B1 FAIL: {key} -- --dry-run predicted {status_word!r} "
                    f"(implying real outcome {expected_real!r}) but --apply's "
                    f"actual on-disk outcome was {real!r}"
                )

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if failures:
        print("FAIL: --dry-run / --apply parity")
        for f in failures:
            print(f"  {f}")
        return 1

    print("PASS: --dry-run predicts, per file, the exact outcome --apply "
          "produces, and writes nothing while doing so")
    return 0


if __name__ == "__main__":
    sys.exit(main())

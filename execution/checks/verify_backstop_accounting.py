#!/usr/bin/env python3
"""
verify_backstop_accounting.py — F8 (contract-f8): backstop RUN SUMMARY
must never count a refused (0-byte) write as delivered.

CONFIRMED DEFECT (QA, live E2E, 2026-08-15): three call sites in
execution/update_template.py invoke `_sync_file_with_guard(...)` and then
append to their tracking list UNCONDITIONALLY, without checking the
returned status string ("copied" | "unchanged" | "skipped" | "forced"):

  (A) apply_missing_file_backstop()      line ~767-769  -> copied.append(rel_path)
  (B) apply_fresh_manifest_backstop()    line ~876-878  -> delivered.append(dst_key)  [directory-entry branch]
  (C) apply_fresh_manifest_backstop()    line ~892-894  -> delivered.append(path)     [file-entry branch]

When the symlink guard REFUSES (status == "skipped", 0 bytes written), the
path is still counted as delivered/copied. Live repro against the current
tree produced the self-contradictory line:

    backstop copy     execution/mission.py (restored from source, skipped)

with Summary reporting `paths_changed: 1, backstop_copies: 1` while the
destination remained an untouched dangling symlink.

copy_harness() already fixed exactly this shape at line ~462-476 by
classifying off the returned `changed` boolean
(`changed = bool(copied or forced)`) rather than assuming every call site
reached succeeded. This check asserts sites (A), (B), (C) do the same:
count a path as delivered/copied ONLY when the guard's returned status
was "copied" or "forced" — never "skipped" (or any other non-write
status).

WHY THE EXISTING F10 SYMLINK GOLDEN (verify_symlink_full_path_refusal.py)
DOES NOT CATCH THIS: it asserts only that nothing escaped externally
(`outside.exists() == False` / content unchanged). It never inspects
paths_changed / backstop_copies / the `delivered` list, so it is
STRUCTURALLY BLIND to a write being correctly refused on disk while being
incorrectly counted as a success in the run's own accounting. This check
is deliberately about ACCOUNTING ONLY — disk-escape is out of scope here
(already covered) and is re-verified below only as a sanity precondition,
never as the pass/fail signal.

Each of the three rows below is independent: a fix that repairs one call
site while leaving the other two broken must still FAIL this check on the
other two. Row B and Row C exercise the two distinct branches of
apply_fresh_manifest_backstop() separately (directory-entry vs.
file-entry), since a fix to one branch's `if status == ...:` guard has no
bearing on the other. Row B uses a dangling LEAF symlink discovered
mid-rglob, not a symlinked entry root -- an entry-root symlink is already
fully guarded by the early `continue` at line ~863 (both the write AND
the count are skipped there), so it cannot reproduce this bug; only a
per-file guard refusal deeper in the loop can.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_backstop_accounting_sandbox")


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def run(ws: Path, up: Path):
    r = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--apply", "--source", str(up)],
        cwd=ws, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30,
    )
    return r.returncode, r.stdout


def base_ws(name):
    ws = SANDBOX / f"ws_{name}"
    up = SANDBOX / f"up_{name}"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)
    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")
    _write(up / ".agent/version", "2.0.0\n")
    return ws, up


def summary_field(output: str, label: str) -> str | None:
    """Extract e.g. 'backstop_copies:  0' -> '0' from the Summary block."""
    for line in output.splitlines():
        stripped = line.strip()
        if stripped.startswith(label):
            return stripped[len(label):].strip()
    return None


def main() -> int:
    failures = []

    # ============================================================
    # ROW A: apply_missing_file_backstop() -- REQUIRED_FILES entry
    # reached through a dangling leaf symlink. Guard must refuse the
    # write (status "skipped"); it must NOT be counted in
    # backstop_copies or paths_changed.
    # ============================================================
    ws, up = base_ws("missing_file")
    _write(ws / ".agent/update-manifest.yaml", "paths: []\n")
    # All REQUIRED_FILES except execution/mission.py already present,
    # so they idempotency-skip and contribute nothing to the counts --
    # isolates the assertion to the one refused path.
    _write(ws / "execution/handoff_check.py", "present\n")
    _write(ws / "execution/contract.py", "present\n")
    _write(ws / ".agent/handoffs.yaml", "present\n")
    (ws / "execution").mkdir(parents=True, exist_ok=True)
    # Dangling symlink: .exists() is False (looks "missing" to the
    # idempotency check) but the leaf IS a symlink, so
    # _sync_file_with_guard's _refuse_symlinked_write must refuse it.
    (ws / "execution/mission.py").symlink_to(ws / "OUTSIDE_missing_file" / "mission.py")
    _write(up / "execution/mission.py", "canonical incoming content\n")

    rc, out = run(ws, up)
    written = (ws / "execution/mission.py").read_text() if (ws / "execution/mission.py").exists() and not (ws / "execution/mission.py").is_symlink() else None
    still_symlink = (ws / "execution/mission.py").is_symlink()
    backstop_copies = summary_field(out, "backstop_copies:")
    paths_changed = summary_field(out, "paths_changed:")
    print(f"[ROW A: missing-file backstop, dangling leaf symlink] "
          f"still_symlink={still_symlink} written={written!r} "
          f"backstop_copies={backstop_copies!r} paths_changed={paths_changed!r}")
    if not still_symlink or written is not None:
        failures.append("ROW A: precondition violated -- guard did not actually refuse the write (disk-level escape)")
    if backstop_copies != "0":
        failures.append(
            f"ROW A: apply_missing_file_backstop() counted a REFUSED write (execution/mission.py, "
            f"status=skipped) as a backstop copy -- backstop_copies={backstop_copies!r}, expected '0'"
        )
    if paths_changed != "0":
        failures.append(
            f"ROW A: apply_missing_file_backstop() counted a REFUSED write (execution/mission.py) in "
            f"paths_changed -- paths_changed={paths_changed!r}, expected '0'"
        )

    # ============================================================
    # ROW B: apply_fresh_manifest_backstop() DIRECTORY-entry branch --
    # entry root is REAL (not symlinked -- that case is already fully
    # guarded by the early entry-root `continue` at line ~863, which
    # correctly skips BOTH the write and the append, so it cannot
    # reproduce this bug). Instead, the per-file destination discovered
    # by the rglob walk is itself a dangling leaf symlink -- the guard
    # inside _sync_file_with_guard() refuses it, but the directory
    # branch's per-file append is unconditional. This is the shape of
    # the second live repro (config.txt + execnest/sub/file.txt both
    # reported delivered with nothing written).
    # ============================================================
    ws2, up2 = base_ws("fresh_dir")
    _write(ws2 / ".agent/update-manifest.yaml", "paths: []\n")
    _write(up2 / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(up2 / ".agent/skills/foo.py", "canonical incoming -- must not be counted delivered\n")
    (ws2 / ".agent/skills").mkdir(parents=True, exist_ok=True)
    # Dangling leaf symlink: .exists() is False (looks "missing" to the
    # `if dst_file.exists(): continue` check) but the leaf IS a symlink.
    (ws2 / ".agent/skills/foo.py").symlink_to(ws2 / "OUTSIDE_fresh_dir" / "foo.py")

    rc2, out2 = run(ws2, up2)
    still_symlink2 = (ws2 / ".agent/skills/foo.py").is_symlink()
    materialized2 = (ws2 / ".agent/skills/foo.py").exists() and not still_symlink2
    wrongly_delivered2 = "'.agent/skills/foo.py'" in out2 and "delivered:" in out2
    paths_changed2 = summary_field(out2, "paths_changed:")
    print(f"[ROW B: fresh-manifest backstop, DIRECTORY branch, dangling leaf symlink] "
          f"still_symlink={still_symlink2} materialized={materialized2} "
          f"wrongly_reported_delivered={wrongly_delivered2} paths_changed={paths_changed2!r}")
    if not still_symlink2 or materialized2:
        failures.append("ROW B: precondition violated -- guard did not actually refuse the write (disk-level escape)")
    if wrongly_delivered2:
        failures.append(
            "ROW B: apply_fresh_manifest_backstop() DIRECTORY-entry branch counted a REFUSED write "
            "(.agent/skills/foo.py, dangling leaf symlink) in its printed 'delivered' list"
        )
    if paths_changed2 != "0":
        failures.append(
            f"ROW B: apply_fresh_manifest_backstop() DIRECTORY-entry branch counted a REFUSED write "
            f"in paths_changed -- paths_changed={paths_changed2!r}, expected '0'"
        )

    # ============================================================
    # ROW C: apply_fresh_manifest_backstop() FILE-entry branch --
    # destination is a dangling leaf symlink (a distinct call site
    # from Row B's directory branch: same bug, different code path,
    # must be verified independently).
    # ============================================================
    ws3, up3 = base_ws("fresh_file")
    _write(ws3 / ".agent/update-manifest.yaml", "paths: []\n")
    _write(up3 / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: config.txt\n")
    _write(up3 / "config.txt", "canonical incoming -- must not be counted delivered\n")
    (ws3 / "config.txt").symlink_to(ws3 / "OUTSIDE_fresh_file.txt")

    rc3, out3 = run(ws3, up3)
    still_symlink3 = (ws3 / "config.txt").is_symlink()
    materialized3 = (ws3 / "config.txt").exists() and not still_symlink3
    wrongly_delivered3 = "'config.txt'" in out3 and "delivered:" in out3
    paths_changed3 = summary_field(out3, "paths_changed:")
    print(f"[ROW C: fresh-manifest backstop, FILE branch, dangling leaf symlink] "
          f"still_symlink={still_symlink3} materialized={materialized3} "
          f"wrongly_reported_delivered={wrongly_delivered3} paths_changed={paths_changed3!r}")
    if not still_symlink3 or materialized3:
        failures.append("ROW C: precondition violated -- guard did not actually refuse the write (disk-level escape)")
    if wrongly_delivered3:
        failures.append(
            "ROW C: apply_fresh_manifest_backstop() FILE-entry branch counted a REFUSED write "
            "(config.txt, dangling leaf symlink) in its printed 'delivered' list"
        )
    if paths_changed3 != "0":
        failures.append(
            f"ROW C: apply_fresh_manifest_backstop() FILE-entry branch counted a REFUSED write "
            f"in paths_changed -- paths_changed={paths_changed3!r}, expected '0'"
        )

    shutil.rmtree(SANDBOX, ignore_errors=True)

    if failures:
        print(f"\nFAIL — {len(failures)} violation(s):")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nOK — all three backstop call sites classify off the guard's returned status; "
          "no refused write is counted as delivered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

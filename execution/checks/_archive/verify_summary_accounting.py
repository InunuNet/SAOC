#!/usr/bin/env python3
"""
verify_summary_accounting.py — F9: the claimed-vs-actual defect this
mission opened with, resurfacing one layer down inside its own fix.

CONFIRMED, current HEAD, real CLI subprocess (2026-08-15): a HARNESS
directory entry whose ONLY file-level activity in a run is a guard
(F5's no-baseline-diverged skip) is still counted as `paths_changed`, not
`paths_skipped`, in the printed Summary block.

ROOT CAUSE: main()'s classifier for a directory-entry result
(execution/update_template.py, `if msg.strip().startswith("SKIP"):
paths_skipped.append(path) else: paths_changed.append(path)`) only
recognizes a message starting with the literal string "SKIP" -- the
format copy_harness() returns for a SINGLE-FILE entry that was entirely
guarded ("SKIP (guarded) ..."). A DIRECTORY entry's return value is
always `"  update (dir)  {dst}  [{detail}]"` regardless of what happened
inside it -- `detail` may read "copied 0, unchanged 0, guarded ['foo.py']"
(nothing actually changed, everything guarded) and this STILL does not
start with "SKIP", so it is unconditionally classified as paths_changed.

Confirmed with a minimal fixture: a directory entry containing exactly
one file, which is guarded (no baseline, diverges from incoming, F5
correctly preserves it on disk) and nothing else in the entry changes --
the run's own printed Summary reads `paths_changed: 1, paths_skipped: 0`
even though zero bytes changed on disk for that entry. A user (or an
automated caller) trusting the Summary block's counts alone -- exactly
the kind of top-line, easy-to-trust signal this whole mission argues
against trusting blindly -- would believe an update was delivered when
none was.

Required fix: the directory-branch classifier must inspect the DETAIL,
not just whether the message starts with "SKIP" -- a directory entry
where copied == 0 and forced == 0 (nothing was actually written) must
count toward paths_skipped even though some files inside were merely
"unchanged" or "guarded", not toward paths_changed. copy_harness()
already computes copied/forced/guarded counts internally (see the
`copied`, `forced`, `guarded` lists it builds); the classifier should key
off those counts, not string-parse its own already-lossy summary
message.

Exercised via the real CLI subprocess, no mocking.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_summary_accounting_sandbox")


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def main() -> int:
    ws = SANDBOX / "ws"
    up = SANDBOX / "up"
    shutil.rmtree(ws, ignore_errors=True)
    shutil.rmtree(up, ignore_errors=True)
    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")

    # A directory entry whose ONLY file diverges with no baseline -- F5
    # correctly guards it (nothing actually written), so the entry as a
    # whole delivered ZERO real change.
    _write(up / ".agent/skills/foo.py", "incoming, different from local\n")
    _write(up / ".agent/version", "2.0.0\n")
    _write(ws / ".agent/skills/foo.py", "LOCAL HAND-EDIT -- precious\n")

    r = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--apply", "--source", str(up)],
        cwd=ws, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30,
    )
    out = r.stdout
    print(out)

    preserved = (ws / ".agent/skills/foo.py").read_text() == "LOCAL HAND-EDIT -- precious\n"
    m_changed = re.search(r"paths_changed:\s*(\d+)", out)
    m_skipped = re.search(r"paths_skipped:\s*(\d+)", out)
    changed = int(m_changed.group(1)) if m_changed else -1
    skipped = int(m_skipped.group(1)) if m_skipped else -1

    print(f"file preserved (F5 correctness, unaffected by this bug): {preserved}")
    print(f"reported paths_changed={changed} paths_skipped={skipped}")

    shutil.rmtree(SANDBOX, ignore_errors=True)

    failures = []
    if not preserved:
        failures.append("F5 REGRESSION: file was not preserved -- this is a data-loss failure, not just an accounting one")
    if changed != 0:
        failures.append(
            f"F9: paths_changed={changed} but zero bytes actually changed for this entry "
            "(the only file activity was a guard) -- Summary block misreports a no-op as a change"
        )
    if skipped < 1:
        failures.append(f"F9: paths_skipped={skipped}, expected >=1 -- the guarded entry should count as skipped, not changed")

    if failures:
        print(f"\nFAIL — {len(failures)} violation(s):")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nOK — Summary block correctly counts a guard-only entry as skipped, not changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

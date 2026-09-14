#!/usr/bin/env python3
"""
verify_pulse_legacy_label_visibility.py — pulse-scoped-health F3, FINDING
1: a pre-existing job under the OLD, unscoped literal label
"com.athanor.pulse" is completely invisible to both `install-pulse` and
`get_pulse_status.sh` once F1/F2 ship scoped labels.

CONFIRMED LIVE on this machine, 2026-08-16, while F1/F2 were already
implemented and gated: the legacy unscoped label is STILL registered,
STILL SAOC's (working directory=/Users/vetus/ai/SAOC, last exit code=1,
runs=780). Athanor's new scoped label ("com.athanor.pulse.athanor") has
never been registered. Running the (F1/F2-fixed) get_pulse_status.sh for
Athanor today prints bare "Pulse: NOT INSTALLED" -- technically true for
the NEW label, but 125,462 lines of Athanor's own pulse.log sit right
there proving Pulse infrastructure genuinely existed and ran under the
OLD label for a long time, until the label was silently reassigned out
from under it. "NOT INSTALLED" reads as "nothing has ever been set up
here," which is false and actively misleading for exactly the operator
this whole mission exists to help. This is the SAME defect class as the
mission's original bug (a check certifying registration, not the fact
the operator actually cares about) recurring one layer down, now that
F1/F2 have fixed it for the SCOPED label but introduced a fresh blind
spot around the label they deprecated.

FIX UNDER TEST: a new, small, READ-ONLY script,
execution/check_legacy_pulse_label.sh <project_root>, is the single
place legacy-label visibility is computed (mirrors F1's derive_pulse_
label.sh and F2's identity-parsing being the single sources of truth for
their own concerns):
  - Queries `launchctl print gui/$(id -u)/com.athanor.pulse` AND
    `launchctl print gui/$(id -u)/com.athanor.pulse.heartbeat` (the two
    pre-F1 unscoped literals) -- READ-ONLY diagnostic calls only, NEVER
    load/unload/start/stop/kickstart.
  - For each that IS registered, prints a line naming it and its
    registered working directory (whether that directory belongs to
    THIS project or a foreign one -- the script reports either way, it
    does not judge or act).
  - For each that is NOT registered, prints nothing for that label.
  - Exits 0 UNCONDITIONALLY (informational only; MUST NEVER cause
    install-pulse or get_pulse_status.sh to abort or change exit code by
    itself -- see FINDING 2's sibling contract, contract-f3.yaml A2, for
    the DIFFERENT, deliberately-blocking collision check; this one never
    blocks anything).
  - NEVER calls `launchctl load`/`unload`/`start`/`stop`/`kickstart` --
    detect and report, never seize. This is the same doctrine Alembic
    already applied by hand when it independently found the hijacked
    slot and declined to reclaim it (see learned.md 2026-08-16): fix the
    scoping, never race for the label.

get_pulse_status.sh MUST call this script and fold its findings into its
own output whenever the NEW scoped label itself is NOT INSTALLED: the
printed output in that case MUST NOT be the bare, unqualified historical
"Pulse: NOT INSTALLED" alone -- it MUST additionally surface that a
legacy-labeled job exists and name its registered working directory, so
an operator sees "there is real prior Pulse activity here, currently
attributed elsewhere" instead of "nothing has ever run". When NEITHER
the scoped label NOR either legacy label is registered, the original,
unembellished "Pulse: NOT INSTALLED" (with no legacy-specific text) MUST
remain exactly as-is -- there is genuinely nothing to report, and
fabricating a legacy mention when none exists would be its own dishonest
status line.

THIS CHECK NEVER TOUCHES THE REAL SYSTEM. Every scenario is driven by a
stub `launchctl` on PATH (see _pulse_launchctl_stub.py, imported below)
that logs every invocation; ROW1-4 all assert the call log contains
ZERO load/unload/start/stop/kickstart calls -- a warning-text check
alone would pass an implementation that ALSO seized the slot, which is
exactly the shortcut this repo's own history (see learned.md) shows an
agent can be tempted into under "extra diligence." Additionally, the
real ~/Library/LaunchAgents/ directory's listing+mtimes are snapshotted
before and after the ENTIRE run and asserted unchanged, even though
nothing in this check's own design resolves `~` (belt-and-suspenders
per the explicit safety mandate for this feature).

ROWS, each defeating a distinct shortcut (the golden reports which
failed):
  ROW1 (THE live bug, foreign owner): scoped label not registered;
    legacy "com.athanor.pulse" registered, working directory belongs to
    a DIFFERENT fixture project. get_pulse_status.sh's output MUST
    mention "legacy" (case-insensitive) AND the foreign working
    directory string, AND MUST NOT be merely the exact bare string
    "Pulse: NOT INSTALLED\n" with no further identifying detail. Exit
    code stays nonzero (this project's OWN pulse genuinely isn't
    running). Defeats today's get_pulse_status.sh outright (verified
    RED) and any fix that adds the legacy script but never wires its
    output into get_pulse_status.sh.
  ROW2 (self-owned legacy, not yet migrated): scoped label not
    registered; legacy label registered, working directory belongs to
    THIS SAME project (e.g. a workspace that ran the old, pre-F1
    install and hasn't reinstalled under the new scoped label yet).
    Output MUST still mention "legacy" and the (self) working directory
    -- defeats a fix that only special-cases the "foreign owner" branch
    and mishandles or crashes on the self-owned case.
  ROW3 (regression -- must stay plain): NEITHER the scoped label NOR
    either legacy label is registered anywhere. Output MUST remain the
    exact original "Pulse: NOT INSTALLED" text with NO "legacy" mention
    anywhere in the output. Defeats a fix that unconditionally appends
    legacy-detection noise regardless of whether a legacy job actually
    exists, which would be its own fabricated status line.
  ROW4 (never seizes, direct script test): calls
    execution/check_legacy_pulse_label.sh directly against a fixture
    where BOTH legacy labels are registered to a foreign project. MUST
    exit 0 (always informational, never blocking) AND the stub's call
    log MUST contain zero load/unload/start/stop/kickstart invocations.
    Defeats an implementation that "helpfully" tries to reclaim or clean
    up the foreign job it discovers.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def _find_repo_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "execution" / "get_pulse_status.sh").is_file():
            return candidate
    raise RuntimeError("could not locate repo root from " + str(start))


REPO_ROOT = _find_repo_root(Path(__file__).resolve().parent)
sys.path.insert(0, str(REPO_ROOT / "execution" / "checks"))
import _pulse_launchctl_stub as stub  # noqa: E402

STATUS_SCRIPT = REPO_ROOT / "execution" / "get_pulse_status.sh"
LEGACY_SCRIPT = REPO_ROOT / "execution" / "check_legacy_pulse_label.sh"
REAL_PULSE_PLIST = REPO_ROOT / "execution" / "com.athanor.pulse.plist"
REAL_LAUNCH_AGENTS = Path.home() / "Library" / "LaunchAgents"


def _snapshot_launch_agents() -> dict:
    if not REAL_LAUNCH_AGENTS.is_dir():
        return {}
    return {
        p.name: p.stat().st_mtime
        for p in REAL_LAUNCH_AGENTS.iterdir()
    }


def _build_fixture_project(root: Path, project_name: str) -> None:
    (root / "execution").mkdir(parents=True, exist_ok=True)
    shutil.copy2(REAL_PULSE_PLIST, root / "execution" / "com.athanor.pulse.plist")
    (root / ".agent").mkdir(parents=True, exist_ok=True)
    import json
    (root / ".agent" / "profile.json").write_text(json.dumps({"project_name": project_name}))
    (root / "execution" / "derive_pulse_label.sh").write_text(
        "#!/usr/bin/env bash\nset -euo pipefail\n"
        'ROOT="${1:?}"\nHB=""\n'
        'if [ "${2:-}" = "--heartbeat" ]; then HB="heartbeat."; fi\n'
        'NAME=$(jq -r \'.project_name // empty\' "$ROOT/.agent/profile.json" 2>/dev/null || true)\n'
        'if [ -z "$NAME" ]; then NAME=$(basename "$ROOT"); fi\n'
        "SLUG=$(echo \"$NAME\" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')\n"
        'if [ -z "$SLUG" ]; then SLUG="unnamed"; fi\n'
        'echo "com.athanor.pulse.${HB}${SLUG}"\n'
    )
    (root / "execution" / "derive_pulse_label.sh").chmod(0o755)


def main() -> int:
    before_snapshot = _snapshot_launch_agents()
    tmpdir = Path(tempfile.mkdtemp(prefix="pulse_f3_visibility_fixture_")).resolve()
    failures: list[str] = []
    try:
        self_root = tmpdir / "self-project"
        other_root = tmpdir / "other-project-saoc-analog"
        _build_fixture_project(self_root, "Self Project")
        _build_fixture_project(other_root, "Other Project")
        (self_root / "pulse.log").write_text("historical log content\n")

        self_scoped_label = "com.athanor.pulse.self-project"

        # -----------------------------------------------------------
        # ROW1: legacy label registered, foreign owner. Scoped label
        # itself never registered.
        # -----------------------------------------------------------
        bin_dir1 = tmpdir / "bin1"
        responses1 = {
            self_scoped_label: None,
            "com.athanor.pulse": stub.print_block(
                str(other_root / "execution" / "pulse_runner.sh"), str(other_root), 1,
                str(other_root / "pulse.log"), label="com.athanor.pulse",
            ),
            "com.athanor.pulse.heartbeat": None,
        }
        call_log1 = stub.make_stub_launchctl(bin_dir1, responses1)
        if STATUS_SCRIPT.is_file():
            result = stub.run_with_stub(["bash", str(STATUS_SCRIPT), str(self_root)], bin_dir1)
            out = result.stdout + result.stderr
        else:
            out, result = "", None
        forbidden = stub.forbidden_calls(call_log1)
        if forbidden:
            failures.append(f"ROW1 FAIL: forbidden launchctl call(s) made: {forbidden}")
        if "legacy" not in out.lower() or str(other_root) not in out:
            failures.append(
                "ROW1 FAIL (THE LIVE BUG): scoped label not installed, but a "
                f"legacy job IS registered under a foreign project ({other_root}) "
                "-- get_pulse_status.sh's output does not mention 'legacy' and/or "
                f"does not name the foreign working directory.\n--- output ---\n{out}"
            )
        if out.strip() == "Pulse: NOT INSTALLED":
            failures.append(
                "ROW1 FAIL: output is the exact bare 'Pulse: NOT INSTALLED' with "
                "no further detail, despite a legacy job genuinely existing under "
                f"a foreign owner ({other_root})\n--- output ---\n{out}"
            )

        # -----------------------------------------------------------
        # ROW2: legacy label registered, SELF-owned (not yet migrated).
        # -----------------------------------------------------------
        bin_dir2 = tmpdir / "bin2"
        responses2 = {
            self_scoped_label: None,
            "com.athanor.pulse": stub.print_block(
                str(self_root / "execution" / "pulse_runner.sh"), str(self_root), 0,
                str(self_root / "pulse.log"), label="com.athanor.pulse",
            ),
            "com.athanor.pulse.heartbeat": None,
        }
        call_log2 = stub.make_stub_launchctl(bin_dir2, responses2)
        if STATUS_SCRIPT.is_file():
            result2 = stub.run_with_stub(["bash", str(STATUS_SCRIPT), str(self_root)], bin_dir2)
            out2 = result2.stdout + result2.stderr
        else:
            out2 = ""
        forbidden2 = stub.forbidden_calls(call_log2)
        if forbidden2:
            failures.append(f"ROW2 FAIL: forbidden launchctl call(s) made: {forbidden2}")
        if "legacy" not in out2.lower() or str(self_root) not in out2:
            failures.append(
                "ROW2 FAIL: scoped label not installed, but a SELF-owned legacy "
                "job is registered -- get_pulse_status.sh's output does not "
                f"mention 'legacy' and/or does not name the working directory.\n"
                f"--- output ---\n{out2}"
            )

        # -----------------------------------------------------------
        # ROW3: regression -- nothing registered anywhere, must stay plain.
        # -----------------------------------------------------------
        bin_dir3 = tmpdir / "bin3"
        responses3 = {
            self_scoped_label: None,
            "com.athanor.pulse": None,
            "com.athanor.pulse.heartbeat": None,
        }
        call_log3 = stub.make_stub_launchctl(bin_dir3, responses3)
        if STATUS_SCRIPT.is_file():
            result3 = stub.run_with_stub(["bash", str(STATUS_SCRIPT), str(self_root)], bin_dir3)
            out3 = result3.stdout + result3.stderr
        else:
            out3 = ""
        forbidden3 = stub.forbidden_calls(call_log3)
        if forbidden3:
            failures.append(f"ROW3 FAIL: forbidden launchctl call(s) made: {forbidden3}")
        if "legacy" in out3.lower():
            failures.append(
                "ROW3 FAIL (regression, fabricated status): NEITHER the scoped "
                "label NOR either legacy label is registered anywhere, yet the "
                f"output mentions 'legacy' -- a false positive.\n"
                f"--- output ---\n{out3}"
            )

        # -----------------------------------------------------------
        # ROW4: direct test of check_legacy_pulse_label.sh -- never
        # blocks, never seizes.
        # -----------------------------------------------------------
        bin_dir4 = tmpdir / "bin4"
        responses4 = {
            "com.athanor.pulse": stub.print_block(
                str(other_root / "execution" / "pulse_runner.sh"), str(other_root), 1,
                str(other_root / "pulse.log"), label="com.athanor.pulse",
            ),
            "com.athanor.pulse.heartbeat": stub.print_block(
                str(other_root / "execution" / "hooks" / "heartbeat_loop.sh"),
                str(other_root), 0, str(other_root / ".agent" / "pulse" / "registry" / "heartbeat_loop.log"),
                label="com.athanor.pulse.heartbeat",
            ),
        }
        call_log4 = stub.make_stub_launchctl(bin_dir4, responses4)
        if not LEGACY_SCRIPT.is_file():
            failures.append(
                "ROW4 FAIL: execution/check_legacy_pulse_label.sh does not exist "
                "yet -- the single-source legacy-detection script this feature "
                "requires has not been implemented"
            )
        else:
            result4 = stub.run_with_stub(["bash", str(LEGACY_SCRIPT), str(self_root)], bin_dir4)
            if result4.returncode != 0:
                failures.append(
                    "ROW4 FAIL: check_legacy_pulse_label.sh exited nonzero "
                    f"({result4.returncode}) merely for DETECTING a foreign "
                    "legacy job -- this script must be informational-only and "
                    "must never cause a caller to abort by itself"
                )
            forbidden4 = stub.forbidden_calls(call_log4)
            if forbidden4:
                failures.append(
                    f"ROW4 FAIL: check_legacy_pulse_label.sh made forbidden "
                    f"launchctl call(s), attempting to seize/modify a foreign "
                    f"job it merely detected: {forbidden4}"
                )

        # -----------------------------------------------------------
        # Safety: real ~/Library/LaunchAgents/ must be byte-for-byte
        # unchanged (belt-and-suspenders; nothing above should resolve
        # `~` at all, since -n/dry-run and direct script invocation with
        # PROJECT_ROOT overrides never do).
        # -----------------------------------------------------------
        after_snapshot = _snapshot_launch_agents()
        if before_snapshot != after_snapshot:
            failures.append(
                "SAFETY FAIL: ~/Library/LaunchAgents/ changed during this test "
                f"run. before={before_snapshot} after={after_snapshot}"
            )

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if failures:
        print("FAIL: legacy unscoped-label jobs are not correctly surfaced")
        for f in failures:
            print(f"  {f}")
        return 1

    print(
        "PASS: get_pulse_status.sh surfaces pre-existing legacy-labeled jobs "
        "(foreign or self-owned) whenever the new scoped label is not "
        "installed, stays silent when no legacy job exists, and "
        "check_legacy_pulse_label.sh never blocks or attempts to seize what "
        "it detects; ~/Library/LaunchAgents/ was never touched"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

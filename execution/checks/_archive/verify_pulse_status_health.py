#!/usr/bin/env python3
"""
verify_pulse_status_health.py — FB (pulse-scoped-health F2): `get_pulse_
status.sh` (execution/get_pulse_status.sh) only ever checks whether ITS
LABEL is registered with launchd (`launchctl list "$SERVICE" | grep`).
It never checks WHOSE job that label actually is, whether that job is
succeeding, or whether it has run recently. Consequence, confirmed LIVE
on this machine while writing this contract (2026-08-16):

    $ launchctl print gui/501/com.athanor.pulse
    ...
    program = /bin/bash
    arguments = { /bin/bash /Users/vetus/ai/SAOC/execution/pulse_runner.sh }
    working directory = /Users/vetus/ai/SAOC
    ...
    last exit code = 1
    $ bash execution/get_pulse_status.sh
    Pulse: RUNNING

`get_pulse_status.sh` reported RUNNING for 7 straight weeks while the
label belonged to a DIFFERENT project's crash-looping job and Athanor's
own 15 registry jobs, ingest_pulse.sh, and `pulse_dispatcher.py --once`
never ran once. Any ONE of the three checks below would have caught this
on the very first failing cycle:
  1. the registered job's program/working-directory actually belongs to
     THIS project (catches exactly the hijack above),
  2. its last exit status is 0 (catches a crash loop even when the
     label IS this project's own -- e.g. a bug in pulse_runner.sh itself),
  3. pulse.log's mtime is within ~3x StartInterval of now (catches a
     silently stalled/unloaded job that never crashes because it never
     runs at all).

FIX UNDER TEST: rewrite get_pulse_status.sh to call `launchctl print
gui/$(id -u)/$SERVICE` (NOT `launchctl list | grep`, which only reports
registration, never identity/exit status) and evaluate all three checks
above, in this priority order (a job can be simultaneously hijacked AND
have a stale log; hijacked is reported first since it's the more
actionable, specific diagnosis):
  - job not registered at all -> "Pulse: NOT INSTALLED" (UNCHANGED,
    existing behavior, exit 1)
  - registered program (the real invoked script -- launchctl print's
    "program" field is often just an interpreter like /bin/bash; the
    actual script path is the LAST entry of the "arguments" block,
    confirmed empirically above) does not exactly match
    "$PROJECT_ROOT/execution/pulse_runner.sh", OR registered "working
    directory" does not exactly match $PROJECT_ROOT -> "Pulse: UNHEALTHY
    (hijacked)", exit 1
  - "last exit code" != 0 -> "Pulse: UNHEALTHY (crash-looping)", exit 1
  - pulse.log missing, or its mtime is older than 3x the plist's own
    StartInterval (read from $PROJECT_ROOT/execution/com.athanor.pulse.plist,
    NOT hardcoded, so the threshold tracks the real interval) ->
    "Pulse: UNHEALTHY (stale)", exit 1
  - otherwise -> "Pulse: HEALTHY", exit 0

Also depends on pulse-scoped-health F1 (execution/derive_pulse_label.sh,
contract-f1.yaml in this same slug): SERVICE must be computed by calling
that script for $PROJECT_ROOT, not left as the literal "com.athanor.pulse"
-- otherwise, once F1 ships, a downstream project's status check would
keep querying the WRONG (old global, or another project's) label
forever, silently reporting nothing useful. This IS tested below (ROW6).

TESTABILITY: get_pulse_status.sh MUST accept an optional first positional
argument, PROJECT_ROOT_OVERRIDE; when given, use it instead of deriving
PROJECT_ROOT from the script's own on-disk location. Zero-argument
behavior (today's only calling convention, `make pulse-status` -> `bash
execution/get_pulse_status.sh`) is completely unchanged. This is the
ONLY way to point the script at a fixture project root without relocating
real repo files, and is a minimal, low-risk testability affordance.

THIS CHECK NEVER TOUCHES THE REAL SYSTEM. It never runs `launchctl load`,
`unload`, `kickstart`, `start`, or `stop`, and never writes to
~/Library/LaunchAgents/. Every scenario is driven by a STUB `launchctl`
executable placed first on PATH (see _make_stub_launchctl below), fed
canned `print` output modelled EXACTLY on the real empirical output
captured above and on this same machine's actual "not found" behavior
(`launchctl print gui/<uid>/<bogus-label>` -> stderr "Bad request.\n
Could not find service ... in domain for user gui: <uid>", exit 113,
confirmed empirically during contract authoring).

ROWS, each defeating a distinct shortcut (the golden reports which
failed):
  ROW1 (hijacked, THE actual live bug): registered program/workdir point
    at a DIFFERENT fixture project entirely, exit code 0 (a job that is
    itself perfectly healthy -- for someone else). MUST report "UNHEALTHY
    (hijacked)" and exit nonzero. Defeats today's script outright
    (verified RED: today reports RUNNING regardless of whose job it is)
    and any fix that only checks exit-code/log-freshness without ever
    checking identity.
  ROW2 (crash-looping): program/workdir correctly match THIS project,
    last exit code = 1, log otherwise fresh. MUST report "UNHEALTHY
    (crash-looping)", not silently pass because the label happens to be
    the right one. Defeats a fix that only implements the identity check
    (ROW1) and stops there.
  ROW3 (stale): program/workdir/exit code all correct, but pulse.log's
    mtime is set to 4x StartInterval in the past (job registered
    correctly, ran successfully once long ago, then silently stopped
    firing -- e.g. unloaded, machine asleep for weeks, launchd quietly
    dropped it). MUST report "UNHEALTHY (stale)". Defeats a fix that only
    checks identity + exit code and never looks at the log at all --
    the exact blind spot that let THIS incident run 7 weeks even before
    the hijack (`pulse.log untouched since Jun 28` per the P1 backlog
    entry filed the same day as this contract).
  ROW4 (healthy): program/workdir/exit code all correct, log mtime
    fresh (well under threshold). MUST report "HEALTHY" and exit 0.
    Defeats a fix that is unconditionally pessimistic (e.g. always
    reports unhealthy) -- a check that only ever tests failure states
    proves nothing about whether the healthy path still works.
  ROW5 (not installed, regression): label never registered at all
    (stub `print` returns "Could not find service", rc=113, the real
    empirically-confirmed behavior). MUST still report "NOT INSTALLED"
    and exit nonzero -- unchanged from today. Defeats a rewrite that
    accidentally breaks the pre-existing not-installed path while adding
    the new health checks.
  ROW6 (SERVICE must be derived, not hardcoded): runs the SAME hijacked
    scenario as ROW1 but additionally asserts the label the script
    actually queried (captured via the stub launchctl's call log) is the
    project-specific label produced by execution/derive_pulse_label.sh
    for the fixture root, NOT the literal "com.athanor.pulse". Defeats a
    fix that adds all three health checks correctly but leaves SERVICE
    hardcoded, which would silently keep querying the wrong label for
    every project once F1 ships labels scoped per-project.

RED VERIFIED against TODAY's get_pulse_status.sh (2026-08-16, quoted
below) -- see main() output for the exact captured text.
"""
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def _find_repo_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "execution" / "get_pulse_status.sh").is_file():
            return candidate
    raise RuntimeError("could not locate repo root from " + str(start))


REPO_ROOT = _find_repo_root(Path(__file__).resolve().parent)
STATUS_SCRIPT = REPO_ROOT / "execution" / "get_pulse_status.sh"
REAL_PULSE_PLIST = REPO_ROOT / "execution" / "com.athanor.pulse.plist"

STUB_LAUNCHCTL_TEMPLATE = """#!/usr/bin/env bash
# Stub launchctl for verify_pulse_status_health.py -- never touches the
# real launchd. Logs every invocation (for ROW6's "which label did the
# script actually query" assertion) then returns canned output.
echo "$@" >> "{call_log}"
if [ "$1" = "print" ]; then
  if [ "{not_found}" = "1" ]; then
    echo "Bad request." 1>&2
    echo "Could not find service \\"{service}\\" in domain for user gui: {uid}" 1>&2
    exit 113
  fi
  cat <<'PRINTOUT'
{print_output}
PRINTOUT
  exit 0
fi
if [ "$1" = "list" ]; then
  # Mirrors TODAY's script, which only ever calls `launchctl list
  # [label]` -- a matching label is "registered" regardless of program/
  # exit-code/log-freshness, exactly the blind spot this contract exists
  # to close. Real launchctl's registered-job line format is a tab-
  # separated PID/status/label row; exact columns don't matter here,
  # only that the label substring appears (today's script greps for it).
  if [ "{not_found}" = "1" ]; then
    exit 0  # real launchctl: empty stdout, exit 0, when nothing matches
  fi
  echo "-	0	{service}"
  exit 0
fi
# Anything else (load/unload/start/stop/kickstart) is a TEST BUG -- this
# check must never need real job control.
echo "STUB LAUNCHCTL: unexpected subcommand invoked: $*" 1>&2
exit 99
"""

REAL_UID = str(os.getuid())


def _print_output(program_last_arg: str, workdir: str, last_exit: int, log_path: str) -> str:
    """Models launchctl's real `print` dictionary text, exactly as
    empirically captured against a live job on this machine (see module
    docstring) -- program is the interpreter (/bin/bash), the actual
    invoked script is the LAST entry of the arguments array."""
    return (
        "gui/{uid}/some.label = {{\n"
        "\tactive count = 0\n"
        "\tpath = /Users/x/Library/LaunchAgents/some.label.plist\n"
        "\ttype = LaunchAgent\n"
        "\tstate = not running\n\n"
        "\tprogram = /bin/bash\n"
        "\targuments = {{\n"
        "\t\t/bin/bash\n"
        "\t\t{program}\n"
        "\t}}\n\n"
        "\tworking directory = {workdir}\n\n"
        "\tstdout path = {log}\n"
        "\tstderr path = {log}\n"
        "\trun interval = 300 seconds\n"
        "\tlast exit code = {exit}\n"
        "}}"
    ).format(uid=REAL_UID, program=program_last_arg, workdir=workdir, log=log_path, exit=last_exit)


def _make_stub_bin(tmpdir: Path, not_found: bool, print_output: str, service: str) -> tuple[Path, Path]:
    bin_dir = tmpdir / f"stubbin_{os.urandom(4).hex()}"
    bin_dir.mkdir()
    call_log = bin_dir / "calls.log"
    call_log.write_text("")
    script = bin_dir / "launchctl"
    script.write_text(
        STUB_LAUNCHCTL_TEMPLATE.format(
            call_log=call_log, not_found="1" if not_found else "0",
            service=service, uid=REAL_UID, print_output=print_output,
        )
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return bin_dir, call_log


def _build_fixture_project(root: Path, project_name: str) -> None:
    (root / "execution").mkdir(parents=True, exist_ok=True)
    shutil.copy2(REAL_PULSE_PLIST, root / "execution" / "com.athanor.pulse.plist")
    (root / ".agent").mkdir(parents=True, exist_ok=True)
    (root / ".agent" / "profile.json").write_text(json.dumps({"project_name": project_name}))
    # Minimal correct-per-F1-contract label deriver, scoped to THIS fixture
    # only, so FB's tests are self-contained even before F1 is implemented
    # in the real repo. Mirrors contract-f1.yaml's required behavior
    # exactly (lowercase project_name, non-alnum runs -> '-', trimmed).
    (root / "execution" / "derive_pulse_label.sh").write_text(
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        'ROOT="${1:?}"\n'
        'HB=""\n'
        'if [ "${2:-}" = "--heartbeat" ]; then HB="heartbeat."; fi\n'
        'NAME=$(jq -r \'.project_name // empty\' "$ROOT/.agent/profile.json" 2>/dev/null || true)\n'
        'if [ -z "$NAME" ]; then NAME=$(basename "$ROOT"); fi\n'
        "SLUG=$(echo \"$NAME\" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')\n"
        'if [ -z "$SLUG" ]; then SLUG="unnamed"; fi\n'
        'echo "com.athanor.pulse.${HB}${SLUG}"\n'
    )
    (root / "execution" / "derive_pulse_label.sh").chmod(0o755)


def _run_status(
    tmpdir: Path, project_root: Path, *, not_found: bool = False,
    program: str = "", workdir: str = "", last_exit: int = 0,
    log_mtime_offset_s: float | None = 0, log_missing: bool = False,
    service_for_stub: str = "com.athanor.pulse",
) -> tuple[int, str, list[str]]:
    """Runs the REAL get_pulse_status.sh as a subprocess with a stubbed
    launchctl on PATH and a fixture PROJECT_ROOT. Returns (exit_code,
    combined_output, list_of_stub_launchctl_call_lines)."""
    if not log_missing:
        log_path = project_root / "pulse.log"
        log_path.write_text("some log content\n")
        if log_mtime_offset_s is not None:
            target_mtime = time.time() - log_mtime_offset_s
            os.utime(log_path, (target_mtime, target_mtime))

    print_output = _print_output(program, workdir, last_exit, str(project_root / "pulse.log"))
    bin_dir, call_log = _make_stub_bin(tmpdir, not_found, print_output, service_for_stub)

    env = dict(os.environ)
    env["PATH"] = f"{bin_dir}:{env.get('PATH', '')}"

    result = subprocess.run(
        ["bash", str(STATUS_SCRIPT), str(project_root)],
        capture_output=True, text=True, timeout=15, env=env,
    )
    calls = [ln for ln in call_log.read_text().splitlines() if ln.strip()]
    return result.returncode, result.stdout + result.stderr, calls


def main() -> int:
    tmpdir = Path(tempfile.mkdtemp(prefix="pulse_status_health_fixture_")).resolve()
    failures: list[str] = []
    try:
        self_root = tmpdir / "self-project"
        other_root = tmpdir / "other-project"
        _build_fixture_project(self_root, "Self Project")
        _build_fixture_project(other_root, "Other Project")
        self_program = str(self_root / "execution" / "pulse_runner.sh")
        self_workdir = str(self_root)
        other_program = str(other_root / "execution" / "pulse_runner.sh")
        other_workdir = str(other_root)

        # -----------------------------------------------------------
        # ROW1: hijacked (the actual live bug) -- program/workdir belong
        # to a DIFFERENT project, exit code 0.
        # -----------------------------------------------------------
        rc, out, _ = _run_status(
            tmpdir, self_root, program=other_program, workdir=other_workdir, last_exit=0,
        )
        if "UNHEALTHY (hijacked)" not in out or rc == 0:
            failures.append(
                "ROW1 FAIL (THE LIVE BUG): a job registered under this project's "
                "label but running a DIFFERENT project's program/working directory "
                f"was not reported as hijacked. rc={rc}\n--- output ---\n{out}"
            )

        # -----------------------------------------------------------
        # ROW2: crash-looping -- correct identity, last exit code != 0.
        # -----------------------------------------------------------
        rc, out, _ = _run_status(
            tmpdir, self_root, program=self_program, workdir=self_workdir, last_exit=1,
        )
        if "UNHEALTHY (crash-looping)" not in out or rc == 0:
            failures.append(
                "ROW2 FAIL: correct program/working-directory but last exit "
                f"code=1 was not reported as crash-looping. rc={rc}\n"
                f"--- output ---\n{out}"
            )

        # -----------------------------------------------------------
        # ROW3: stale -- correct identity+exit, log mtime 4x StartInterval
        # (1200s) in the past. StartInterval in the real plist is 300s.
        # -----------------------------------------------------------
        rc, out, _ = _run_status(
            tmpdir, self_root, program=self_program, workdir=self_workdir, last_exit=0,
            log_mtime_offset_s=1200,
        )
        if "UNHEALTHY (stale)" not in out or rc == 0:
            failures.append(
                "ROW3 FAIL: correct identity and exit code=0, but pulse.log "
                "last modified 1200s ago (threshold is 3x300s=900s) was not "
                f"reported as stale. rc={rc}\n--- output ---\n{out}"
            )

        # -----------------------------------------------------------
        # ROW4: healthy -- correct identity+exit, log mtime fresh.
        # -----------------------------------------------------------
        rc, out, _ = _run_status(
            tmpdir, self_root, program=self_program, workdir=self_workdir, last_exit=0,
            log_mtime_offset_s=5,
        )
        if "HEALTHY" not in out or "UNHEALTHY" in out or rc != 0:
            failures.append(
                "ROW4 FAIL: a genuinely healthy job (correct identity, exit "
                f"code=0, fresh log) was not reported as healthy. rc={rc}\n"
                f"--- output ---\n{out}"
            )

        # -----------------------------------------------------------
        # ROW5: not installed (regression) -- label never registered.
        # -----------------------------------------------------------
        rc, out, _ = _run_status(tmpdir, self_root, not_found=True)
        if "NOT INSTALLED" not in out or rc == 0:
            failures.append(
                "ROW5 FAIL (regression): an unregistered label was not "
                f"reported as NOT INSTALLED. rc={rc}\n--- output ---\n{out}"
            )

        # -----------------------------------------------------------
        # ROW6: SERVICE must be the derived per-project label, not the
        # bare literal -- same hijacked scenario, but this time inspect
        # WHICH label the script actually asked launchctl about.
        # -----------------------------------------------------------
        rc, out, calls = _run_status(
            tmpdir, self_root, program=other_program, workdir=other_workdir, last_exit=0,
        )
        print_calls = [c for c in calls if c.startswith("print ")]
        if not print_calls:
            failures.append(
                f"ROW6 FAIL: script never called `launchctl print ...` at all "
                f"-- call log: {calls}"
            )
        else:
            queried_label = print_calls[0].split("/")[-1]
            if queried_label == "com.athanor.pulse":
                failures.append(
                    "ROW6 FAIL: script queried the bare literal label "
                    "'com.athanor.pulse' instead of a project-derived label "
                    "(expected something like 'com.athanor.pulse.self-project') "
                    "-- SERVICE is still hardcoded, not computed via "
                    "execution/derive_pulse_label.sh"
                )
            elif "self-project" not in queried_label and "selfproject" not in queried_label:
                failures.append(
                    f"ROW6 FAIL: script queried label {queried_label!r}, which "
                    "does not look derived from this fixture's own project_name "
                    "('Self Project') -- check SERVICE derivation"
                )

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if failures:
        print("FAIL: get_pulse_status.sh does not honestly report pulse health")
        for f in failures:
            print(f"  {f}")
        return 1

    print(
        "PASS: get_pulse_status.sh correctly distinguishes hijacked / "
        "crash-looping / stale / healthy / not-installed states, and "
        "queries the project-derived label rather than a hardcoded literal"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

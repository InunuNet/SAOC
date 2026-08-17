"""
_pulse_launchctl_stub.py — shared, importable test infrastructure for
pulse-scoped-health F3's goldens (verify_pulse_legacy_label_visibility.py
and verify_pulse_label_collision_refusal.py). NOT itself a contract
assertion script (contract.py's phase-4 gate never invokes this file
directly).

Builds a STUB `launchctl` executable, placed first on PATH, that answers
`launchctl print gui/<uid>/<label>` per-label from a caller-supplied
dict, and answers `launchctl list [label]` consistently with whichever
labels are marked registered -- modelled on this machine's real,
empirically-captured launchctl output (see contract-f2.yaml /
contract-f3.yaml for the live samples). NEVER touches the real launchd:
`load`/`unload`/`start`/`stop`/`kickstart` all hit the same "unexpected
subcommand" trap and exit 99, which every golden using this helper
treats as a hard failure -- if any code under test ever tries one of
those, the test itself fails loudly rather than silently succeeding
while a real daemon call happened to be intercepted.

Every invocation is appended to a call-log file the caller can inspect
afterward, specifically so a golden can assert "the code under test
never attempted to unload/load/modify anything" -- a claim a stub alone
cannot prove; the call log is what makes it checkable.
"""
import os
import stat
import subprocess
from pathlib import Path

REAL_UID = str(os.getuid())


def print_block(program_last_arg: str, workdir: str, last_exit: int, log_path: str, label: str = "some.label") -> str:
    """Models launchctl's real `print` dictionary text, exactly as
    empirically captured against a live job on this machine -- program is
    the interpreter (/bin/bash), the actual invoked script is the LAST
    entry of the arguments array."""
    return (
        "gui/{uid}/{label} = {{\n"
        "\tactive count = 0\n"
        "\tpath = /Users/x/Library/LaunchAgents/{label}.plist\n"
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
    ).format(uid=REAL_UID, program=program_last_arg, workdir=workdir, log=log_path, exit=last_exit, label=label)


def make_stub_launchctl(bin_dir: Path, responses: dict[str, str | None]) -> Path:
    """responses: {label: print_output_text_or_None}. None means "not
    registered" (the real, empirically-confirmed 'Could not find service
    ...', exit 113). Any label not present in the dict is ALSO treated
    as not-registered -- there is no implicit wildcard match, so a test
    that forgets to register a label it expects to find fails loudly.

    Returns the path to the call-log file (bin_dir/calls.log), one line
    per invocation, e.g. "print gui/501/com.athanor.pulse".
    """
    bin_dir.mkdir(parents=True, exist_ok=True)
    call_log = bin_dir / "calls.log"
    call_log.write_text("")

    case_arms = []
    for label, output in responses.items():
        if output is None:
            body = (
                'echo "Bad request." 1>&2\n'
                f'    echo "Could not find service \\"{label}\\" in domain for user gui: {REAL_UID}" 1>&2\n'
                "    exit 113"
            )
        else:
            marker = f"EOF_{abs(hash(label)) % 100000}"
            body = f"cat <<'{marker}'\n{output}\n{marker}\n    exit 0"
        case_arms.append(f'  "{label}")\n    {body}\n    ;;')

    default_arm = (
        '  *)\n'
        '    echo "Bad request." 1>&2\n'
        f'    echo "Could not find service \\"$LABEL\\" in domain for user gui: {REAL_UID}" 1>&2\n'
        "    exit 113\n"
        "    ;;"
    )

    list_arms = []
    for label, output in responses.items():
        if output is not None:
            list_arms.append(f'  "{label}") echo "-\\t0\\t{label}"; exit 0 ;;')
    list_script = "\n".join(list_arms) if list_arms else ""

    script = f"""#!/usr/bin/env bash
# STUB launchctl (verify_pulse_*.py test infrastructure) -- never touches
# the real launchd. Every call is logged first, unconditionally.
echo "$@" >> "{call_log}"

if [ "$1" = "print" ]; then
  LABEL="${{2##*/}}"
  case "$LABEL" in
{chr(10).join(case_arms)}
{default_arm}
  esac
fi

if [ "$1" = "list" ]; then
  if [ -z "${{2:-}}" ]; then
    exit 0
  fi
  LABEL="$2"
  case "$LABEL" in
{list_script if list_script else '  *) exit 1 ;;'}
  *) exit 1 ;;
  esac
fi

# load/unload/start/stop/kickstart -- or anything else -- is a HARD
# FAILURE. This stub exists specifically so code under test CANNOT touch
# the real daemon; if it tries, that is exactly what these goldens exist
# to catch.
echo "STUB LAUNCHCTL: FORBIDDEN OR UNEXPECTED SUBCOMMAND INVOKED: $*" 1>&2
exit 99
"""
    script_path = bin_dir / "launchctl"
    script_path.write_text(script)
    script_path.chmod(script_path.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return call_log


def run_with_stub(
    argv: list[str], bin_dir: Path, extra_env: dict | None = None, timeout: int = 15,
) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["PATH"] = f"{bin_dir}:{env.get('PATH', '')}"
    if extra_env:
        env.update(extra_env)
    return subprocess.run(argv, capture_output=True, text=True, timeout=timeout, env=env)


FORBIDDEN_SUBCOMMANDS = ("load", "unload", "start", "stop", "kickstart")


def forbidden_calls(call_log: Path) -> list[str]:
    """Returns any logged launchctl invocation whose first argument is a
    mutating/job-control subcommand -- used to assert code under test
    NEVER attempts to touch a foreign or legacy job, only ever queries it
    via read-only `print`/`list`."""
    if not call_log.exists():
        return []
    hits = []
    for line in call_log.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        first = line.split()[0]
        if first in FORBIDDEN_SUBCOMMANDS:
            hits.append(line)
    return hits

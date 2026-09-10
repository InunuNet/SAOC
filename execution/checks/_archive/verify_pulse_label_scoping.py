#!/usr/bin/env python3
"""
verify_pulse_label_scoping.py — FA (pulse-scoped-health F1): `make
pulse-register` / `make install-pulse` installs a launchd job under the
GLOBAL, unscoped label "com.athanor.pulse" — identical regardless of
which project's Makefile copy runs it. Root-caused 2026-08-16 after a
7-WEEK SILENT OUTAGE: Athanor's own template-derived Makefile is copied
into every sibling project (see AGENTS.md's harness distribution model),
each carrying this exact target. Running `make pulse-register` from
sibling project SAOC silently hijacked Athanor's job slot -- confirmed
LIVE on this machine while writing this contract:

    $ launchctl print gui/501/com.athanor.pulse
    ...
    program = /bin/bash
    arguments = {
        /bin/bash
        /Users/vetus/ai/SAOC/execution/pulse_runner.sh
    }
    working directory = /Users/vetus/ai/SAOC
    ...
    last exit code = 1

Athanor's own plist has NEVER been loaded under this label. All 15 jobs
in .agent/pulse/registry/ plus ingest_pulse.sh and
`pulse_dispatcher.py --once` have been silently dead for Athanor since
whenever SAOC last ran the shared target.

`fleet-install-pulse` (Makefile:341-359, contract:
.agent/memory/project/specs/fleet-pulse/contract-f1.yaml) ALREADY scopes
correctly, with per-project labels "com.athanor.pulse.$SLUG" driven off a
small hardcoded slug:path table -- but that target is Athanor-repo-only
tooling for remote-installing INTO sibling projects; every downstream
project's OWN copy of the Makefile still carries the plain
`install-pulse`/`pulse-register` target with the literal unscoped label,
and that is the one every project actually runs on itself. Retiring the
plain target was considered and rejected: fleet-install-pulse's hardcoded
4-project table is Athanor-specific infrastructure knowledge that a
downstream project's own Makefile copy has no way to reproduce (it would
need to know about its OWN existence in a table that lives in a
different repo). The fix instead makes the plain target self-scoping,
exactly the way fleet-install-pulse already scopes each fleet entry, but
driven from the project's OWN identity instead of a remote table.

FIX UNDER TEST: a new, small, pure, side-effect-free script,
execution/derive_pulse_label.sh <project_root> [--heartbeat], is the
SINGLE place a pulse label is computed from a project's identity:
  1. project_name = jq -r '.project_name // empty' from
     <project_root>/.agent/profile.json (empty on missing file/key/null).
  2. Falls back to basename(<project_root>) when project_name is empty.
  3. Slugifies: lowercase; every run of characters outside [a-z0-9]
     collapses to a single '-'; strips leading/trailing '-'; if the
     result is empty (name was pure symbols), falls back to "unnamed".
  4. Prints "com.athanor.pulse.<slug>", or
     "com.athanor.pulse.heartbeat.<slug>" with --heartbeat.
`install-pulse`'s recipe must call this script for $(CURDIR) to get both
labels, sed them into the plist content (replacing the literal
"com.athanor.pulse"/"com.athanor.pulse.heartbeat" strings, same pattern
fleet-install-pulse already uses), AND write the destination plist FILE
under a label-scoped filename (~/Library/LaunchAgents/<label>.plist), not
the old fixed "com.athanor.pulse.plist" filename -- a fixed destination
FILENAME is a second, independent collision even once the LABEL inside
differs (project B's install would overwrite project A's plist file on
disk, though A's already-loaded launchd job would survive until an
explicit unload since launchd's registry keys off the Label it read at
load time, not the file). get_pulse_status.sh (FB, contract-f2.yaml in
this same slug) depends on this exact script too, to know which label to
query for the project it is run from -- this script is the single source
of truth for "which label belongs to this project", used by installer
and status checker alike, precisely to avoid a second, independently
maintained guess (the same divergence-of-two-decision-paths root cause
class as template-update-actually-updates F10).

THIS CHECK DRIVES THE REAL MECHANISMS -- NOT A GREP OVER MAKEFILE TEXT:
  - ROW1 runs the REAL, unmodified repo Makefile via `make -n
    install-pulse` (dry-run: -n means make ONLY PRINTS what it would
    run, it never executes a single recipe line -- no launchctl call, no
    file write, verified safe) against TWO REAL fixture project roots via
    `-C <fixture_root> -f <repo>/Makefile`, letting make's own $(CURDIR)
    variable expansion do the work, and compares the resulting recipe
    text. This is the same mechanism that produced the live hijack above,
    exercised safely.
  - ROW2-6 call the real derive_pulse_label.sh script as a subprocess
    against real fixture .agent/profile.json files and inspect its real
    stdout.

Rows, in order, each defeating a distinct shortcut (the golden reports
which failed):
  ROW1: TODAY's real Makefile install-pulse recipe, dry-run from two
    distinct fixture roots -- MUST currently produce IDENTICAL destination
    plist paths (this is the live bug, reproduced safely). This row is
    expected to flip from "identical" to "distinct" once install-pulse is
    fixed; the golden checks whichever direction is CURRENTLY true and
    reports it, so this same script also re-verifies the fix once shipped
    (see mission checkpoint notes).
  ROW2: derive_pulse_label.sh on two fixture roots with distinct
    project_name values in their profile.json -- must print two DISTINCT
    labels. Defeats a fix that adds the script but has it return a
    constant.
  ROW3: same root, called twice -- must print the IDENTICAL label both
    times (idempotent, not e.g. time- or pid-seeded, which would make
    reinstalling generate a different label every run and orphan the
    previous one).
  ROW4: project_name containing spaces, mixed case, and symbols (e.g.
    "Mumbl AI!", "Codex_Harness #1") -- resulting slug must match
    ^[a-z0-9]+(-[a-z0-9]+)*$ (launchd-label-safe, XML/plist-safe, sed-
    delimiter-safe: no '|', no whitespace, no uppercase). Defeats a fix
    that passes project_name through unsanitized (which would silently
    reintroduce a class of "looks scoped, is not shell/plist safe" bugs,
    or produce two DIFFERENT-looking-but-launchd-illegal labels that
    still collide once launchd or plist parsing normalizes/rejects them).
  ROW5: project root with NO .agent/profile.json at all -- must fall
    back to a slug derived from the directory basename, and that slug
    must NOT equal "com.athanor.pulse" verbatim with no suffix (i.e. must
    not silently collapse back to the original unscoped literal). Defeats
    a fix that only handles the happy path (project_name present) and
    lets the exact original bug reappear for any project missing that
    field -- which describes several real fleet members' current state
    and is not a hypothetical.
  ROW6: --heartbeat produces a label containing "heartbeat" that (a)
    differs from the non-heartbeat label for the SAME root and (b)
    differs from the heartbeat label of a DIFFERENT root. Defeats a fix
    that only scopes the primary pulse label and leaves the heartbeat
    label (a second, independently loaded launchd job, contract:
    fleet-pulse F1's ".heartbeat." anchor precedent) globally shared.
"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def _find_repo_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "Makefile").is_file() and (candidate / "execution").is_dir():
            return candidate
    raise RuntimeError("could not locate repo root from " + str(start))


REPO_ROOT = _find_repo_root(Path(__file__).resolve().parent)
MAKEFILE = REPO_ROOT / "Makefile"
LABEL_SCRIPT = REPO_ROOT / "execution" / "derive_pulse_label.sh"
PULSE_PLIST_SRC = REPO_ROOT / "execution" / "com.athanor.pulse.plist"
HEARTBEAT_PLIST_SRC = REPO_ROOT / ".agent" / "pulse" / "registry" / "com.athanor.pulse.heartbeat.plist"

LABEL_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def _build_project_fixture(root: Path, project_name: str | None) -> None:
    """Lay out a minimal project root that looks enough like a real
    Athanor-derived project for `make -n install-pulse -C root -f
    <real Makefile>` and derive_pulse_label.sh to both run against it:
    its own copy of the plist templates (the REAL ones, byte-for-byte,
    since ROW1 must exercise the real sed/launchctl recipe lines
    unmodified) and its own .agent/profile.json.
    """
    (root / "execution").mkdir(parents=True, exist_ok=True)
    (root / ".agent" / "pulse" / "registry").mkdir(parents=True, exist_ok=True)
    shutil.copy2(PULSE_PLIST_SRC, root / "execution" / "com.athanor.pulse.plist")
    shutil.copy2(
        HEARTBEAT_PLIST_SRC,
        root / ".agent" / "pulse" / "registry" / "com.athanor.pulse.heartbeat.plist",
    )
    if project_name is not None:
        import json
        (root / ".agent" / "profile.json").write_text(json.dumps({"project_name": project_name}))


def _dry_run_install_pulse(fixture_root: Path) -> str:
    """Runs the REAL repo Makefile's install-pulse target in dry-run mode
    (-n: make only PRINTS recipe lines, executes nothing -- no launchctl
    call, no file write) with $(CURDIR) pinned to fixture_root via -C.
    Returns the captured stdout+stderr text."""
    result = subprocess.run(
        ["make", "-C", str(fixture_root), "-f", str(MAKEFILE), "-n", "install-pulse"],
        capture_output=True, text=True, timeout=30,
    )
    return result.stdout + result.stderr


def _derive_label(project_root: Path, heartbeat: bool = False) -> tuple[int, str, str]:
    args = ["bash", str(LABEL_SCRIPT), str(project_root)]
    if heartbeat:
        args.append("--heartbeat")
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except FileNotFoundError as exc:
        return 127, "", str(exc)


def main() -> int:
    tmpdir = Path(tempfile.mkdtemp(prefix="pulse_label_scoping_fixture_")).resolve()
    failures: list[str] = []
    try:
        root_a = tmpdir / "project-alpha"
        root_b = tmpdir / "project-beta"
        _build_project_fixture(root_a, "Alpha Project")
        _build_project_fixture(root_b, "Beta Project")

        # -----------------------------------------------------------
        # ROW1: real Makefile, dry-run, two real fixture roots.
        # -----------------------------------------------------------
        if not MAKEFILE.is_file():
            failures.append("ROW1 FAIL: repo Makefile not found -- fixture bug")
        else:
            out_a = _dry_run_install_pulse(root_a)
            out_b = _dry_run_install_pulse(root_b)

            def _plist_dest_lines(text: str) -> list[str]:
                # Extract ONLY the redirect DESTINATION token (after "> "),
                # not the whole line -- the whole line also contains the
                # fixture-specific SOURCE path (via $(CURDIR)), which
                # legitimately differs between fixtures today and would
                # mask the real collision (identical destination) inside a
                # spuriously "different" full line.
                dests = []
                for ln in text.splitlines():
                    if "LaunchAgents" in ln and ".plist" in ln and "> " in ln:
                        dests.append(ln.rsplit("> ", 1)[-1].strip())
                return dests

            dest_a = _plist_dest_lines(out_a)
            dest_b = _plist_dest_lines(out_b)
            if not dest_a or not dest_b:
                failures.append(
                    "ROW1 FAIL: could not locate any ~/Library/LaunchAgents/*.plist "
                    f"destination lines in dry-run output -- fixture/parsing bug.\n"
                    f"    out_a={out_a!r}\n    out_b={out_b!r}"
                )
            elif dest_a == dest_b:
                failures.append(
                    "ROW1 FAIL (THE LIVE BUG, REPRODUCED SAFELY VIA `make -n`): "
                    "install-pulse's real recipe produces IDENTICAL "
                    "~/Library/LaunchAgents destination line(s) for two distinct "
                    f"project roots:\n    {dest_a}\n"
                    "  Two different projects running this target install to the "
                    "SAME launchd label/file, and the second install silently "
                    "hijacks the first project's slot -- this is exactly what "
                    "happened to Athanor when SAOC last ran `make pulse-register`."
                )

        # -----------------------------------------------------------
        # ROW2: derive_pulse_label.sh distinctness across two projects.
        # -----------------------------------------------------------
        rc_a, label_a, err_a = _derive_label(root_a)
        rc_b, label_b, err_b = _derive_label(root_b)
        if rc_a != 0 or not label_a:
            failures.append(
                f"ROW2 FAIL: derive_pulse_label.sh missing or failed for project A "
                f"(rc={rc_a}, stdout={label_a!r}, stderr={err_a!r}) -- "
                "execution/derive_pulse_label.sh does not exist yet or is broken"
            )
        if rc_b != 0 or not label_b:
            failures.append(
                f"ROW2 FAIL: derive_pulse_label.sh missing or failed for project B "
                f"(rc={rc_b}, stdout={label_b!r}, stderr={err_b!r})"
            )
        if rc_a == 0 and rc_b == 0 and label_a and label_b and label_a == label_b:
            failures.append(
                f"ROW2 FAIL: derive_pulse_label.sh returned the SAME label "
                f"({label_a!r}) for two projects with different project_name "
                "values -- the script is not actually deriving from identity"
            )

        # -----------------------------------------------------------
        # ROW3: idempotency for the same root.
        # -----------------------------------------------------------
        rc_a2, label_a2, _ = _derive_label(root_a)
        if rc_a == 0 and rc_a2 == 0 and label_a and label_a2 and label_a != label_a2:
            failures.append(
                f"ROW3 FAIL: derive_pulse_label.sh returned DIFFERENT labels for "
                f"the SAME project root on two calls ({label_a!r} vs {label_a2!r}) "
                "-- must be deterministic, not seeded by time/pid/randomness, or "
                "every reinstall orphans the previous launchd job"
            )

        # -----------------------------------------------------------
        # ROW4: unsafe-character slugification.
        # -----------------------------------------------------------
        root_c = tmpdir / "project-gamma"
        _build_project_fixture(root_c, "Mumbl AI! (v2)")
        rc_c, label_c, err_c = _derive_label(root_c)
        if rc_c == 0 and label_c:
            slug = label_c.removeprefix("com.athanor.pulse.")
            if not LABEL_RE.match(slug):
                failures.append(
                    f"ROW4 FAIL: project_name 'Mumbl AI! (v2)' produced label "
                    f"{label_c!r} whose slug {slug!r} does not match the required "
                    f"launchd/plist/sed-safe pattern {LABEL_RE.pattern!r} -- "
                    "unsanitized characters (spaces, uppercase, punctuation) leaked "
                    "into the label"
                )
        elif rc_c != 0:
            failures.append(
                f"ROW4 FAIL: derive_pulse_label.sh failed on a project_name "
                f"containing spaces/symbols (rc={rc_c}, stderr={err_c!r})"
            )

        # -----------------------------------------------------------
        # ROW5: no profile.json at all -- must not collapse to the bug.
        # -----------------------------------------------------------
        root_d = tmpdir / "project-delta-no-profile"
        _build_project_fixture(root_d, project_name=None)  # no .agent/profile.json written
        rc_d, label_d, err_d = _derive_label(root_d)
        if rc_d != 0 or not label_d:
            failures.append(
                f"ROW5 FAIL: derive_pulse_label.sh failed with no profile.json "
                f"present (rc={rc_d}, stderr={err_d!r}) -- must degrade gracefully "
                "to a basename-derived fallback, never error out and block install"
            )
        elif label_d == "com.athanor.pulse":
            failures.append(
                "ROW5 FAIL (REINTRODUCES THE ORIGINAL BUG): a project with no "
                "recorded project_name got back the bare unscoped literal "
                "'com.athanor.pulse' with no distinguishing suffix -- any fleet "
                "project missing this field would still collide exactly as today"
            )
        elif not label_d.startswith("com.athanor.pulse.") or not LABEL_RE.match(
            label_d.removeprefix("com.athanor.pulse.")
        ):
            failures.append(
                f"ROW5 FAIL: no-profile.json fallback label {label_d!r} is not a "
                "validly-scoped, validly-slugified label"
            )

        # -----------------------------------------------------------
        # ROW6: heartbeat label scoping.
        # -----------------------------------------------------------
        rc_a_hb, label_a_hb, err_a_hb = _derive_label(root_a, heartbeat=True)
        rc_b_hb, label_b_hb, _ = _derive_label(root_b, heartbeat=True)
        if rc_a_hb != 0 or not label_a_hb:
            failures.append(
                f"ROW6 FAIL: derive_pulse_label.sh --heartbeat failed for project A "
                f"(rc={rc_a_hb}, stderr={err_a_hb!r})"
            )
        else:
            if "heartbeat" not in label_a_hb:
                failures.append(
                    f"ROW6 FAIL: --heartbeat label {label_a_hb!r} does not contain "
                    "'heartbeat'"
                )
            if label_a_hb == label_a:
                failures.append(
                    f"ROW6 FAIL: --heartbeat label is identical to the primary "
                    f"pulse label ({label_a_hb!r}) for the same root -- the two "
                    "launchd jobs would collide with EACH OTHER"
                )
            if rc_b_hb == 0 and label_b_hb and label_a_hb == label_b_hb:
                failures.append(
                    f"ROW6 FAIL: --heartbeat produced the SAME label "
                    f"({label_a_hb!r}) for two different projects -- the "
                    "heartbeat job is still globally shared even though the "
                    "primary pulse label was scoped"
                )

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if failures:
        print("FAIL: pulse label is not correctly scoped per-project")
        for f in failures:
            print(f"  {f}")
        return 1

    print(
        "PASS: install-pulse's real Makefile recipe produces distinct per-project "
        "launchd destinations, derive_pulse_label.sh derives distinct, "
        "deterministic, sanitized, never-bare-literal labels (including the "
        "heartbeat variant) for every project identity tested"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

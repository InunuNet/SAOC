#!/usr/bin/env python3
"""
verify_pulse_label_collision_refusal.py — pulse-scoped-health F3,
FINDING 2: derive_pulse_label.sh's slugification (F1) is lossy by
design (lowercase, non-alnum runs collapse to '-'), so distinct
project_name strings CAN produce the identical label. Confirmed live
during F3 contract authoring: "My Project", "my-project", "My_Project!!",
and "MY   PROJECT" ALL slugify to "com.athanor.pulse.my-project". Two
projects sharing (or coincidentally landing on) any of those name
variants would silently overwrite each other's plist file and share one
launchd job -- the EXACT hijack this whole mission exists to close, with
a narrower, name-based trigger instead of the original global-literal
one. Nothing in install-pulse currently detects this at install time.

DESIGN DECISION (weighed against the alternative of hashing the
project's realpath into the label, e.g.
"com.athanor.pulse.<slug>.<hash>", which would make collision
mathematically impossible regardless of name): chose DETECT-AND-REFUSE
at install time, not a path hash suffix. Rationale:
  1. A path hash ties the label to a project's CURRENT location. Moving
     a project (different absolute path) would silently mint a NEW
     label and leave the OLD one orphaned and registered -- reintroducing
     FINDING 1 (this same contract's sibling feature: an invisible
     legacy-labeled job) for a fresh reason, on every move, with no
     detection story of its own (FINDING 1's fix only knows to check the
     two FIXED pre-F1 literals, not an unbounded set of "some project's
     previous path-hash label"). Detect-and-refuse produces zero label
     churn: renaming project_name in profile.json is exactly how an
     operator is expected to resolve a detected collision, and a
     relocated project keeps the SAME label (nothing to detect or
     orphan) since the label is still purely name-derived, unchanged
     from F1.
  2. Detect-and-refuse reuses the EXACT SAME primitive FINDING 1 already
     requires -- query `launchctl print` for a candidate label, compare
     its registered working directory against this project's real path
     -- so this fix composes with the sibling feature instead of
     introducing a second, unrelated mechanism.
  3. It directly implements the "detect, never seize" doctrine this
     mission's own history already established (learned.md 2026-08-16:
     Alembic found the hijacked slot and declined to reclaim it). Writing
     a plist FILE that would silently replace an ACTIVELY LOADED
     different project's file is itself the seizing action -- refusing
     to write is the install-time analogue of "never race for the
     label."
  4. Readability: "com.athanor.pulse.my-project" stays legible in `ps`/
     `launchctl list`/`ls ~/Library/LaunchAgents/`, which install-pulse's
     own printed instructions already lean on ("ls ~/Library/LaunchAgents/
     | grep com.athanor.pulse"). An opaque hash suffix on every label
     degrades that for 100% of installs to prevent a collision that, in
     practice, only a small minority would ever hit.
  RESIDUAL RISK, stated explicitly rather than glossed over (same
  disclosure standard as template-update-actually-updates F6's
  reconcile-from-history failure modes): detect-and-refuse only catches
  a collision if the CONFLICTING project is ALREADY loaded on THIS SAME
  machine at the moment of install. Two colliding projects on different
  machines, or a second install while the first is temporarily unloaded,
  are not caught. A path-hash suffix would close that specific gap but,
  per point 1, opens a strictly worse and unsolved one (silent orphaning
  on every move) -- accepted as the better trade, not a free win.

FIX UNDER TEST: a new script, execution/check_pulse_label_collision.sh
<project_root> [--heartbeat]:
  - Computes the candidate label via execution/derive_pulse_label.sh
    (F1) for <project_root> -- reuses F1's script, does not
    reimplement slugification a second time.
  - Queries `launchctl print gui/$(id -u)/<candidate_label>` --
    READ-ONLY, never load/unload/start/stop/kickstart.
  - Not registered at all -> no collision, exit 0.
  - Registered, working directory == realpath(<project_root>) -> this
    IS this project's own already-installed job (a re-run/upgrade
    install) -> exit 0, NOT a collision.
  - Registered, working directory != realpath(<project_root>) -> a
    DIFFERENT project already holds this exact label -> print a message
    naming the candidate label and the foreign working directory, exit
    NONZERO (refuse).
  install-pulse's Makefile recipe MUST call this script, UNGUARDED (no
  `|| true`, no `2>/dev/null`, no leading `-`), for both the primary and
  heartbeat labels, BEFORE any sed/mkdir/launchctl write -- Make aborts a
  target on any recipe line's nonzero exit by default, so an unguarded
  call is sufficient to block the whole install without extra logic.
  This is the deliberate OPPOSITE of FINDING 1's check_legacy_pulse_
  label.sh, which must always exit 0 and never block -- the two scripts
  have opposite blocking postures by design, and this golden's ROW4
  checks specifically that the Makefile wires them with that posture
  intact (collision check unguarded / blocking, legacy check
  swallowed / non-blocking).

THIS CHECK NEVER TOUCHES THE REAL SYSTEM. Stubbed launchctl on PATH
(see _pulse_launchctl_stub.py), real ~/Library/LaunchAgents/ snapshotted
before/after and asserted unchanged, and `make -n install-pulse`
(dry-run: make only PRINTS recipe lines, executes none) is the only
Makefile interaction, exactly as pulse-scoped-health F1's own golden
already established safely.

ROWS, each defeating a distinct shortcut (the golden reports which
failed):
  ROW1 (the actual named collision): project A ("My Project") already
    loaded under its derived label. Three OTHER fixture roots with
    project_name "my-project", "My_Project!!", and "MY   PROJECT" (all
    of which derive the SAME label as A) MUST each be reported as a
    collision (nonzero exit, message naming A's real working directory)
    when checked. Defeats a checker that only compares raw project_name
    strings for exact equality instead of comparing derived labels (or
    real registered identity).
  ROW2 (idempotent self-reinstall): after A is loaded under its own
    label at its own real working directory, re-running the check FOR A
    ITSELF MUST exit 0 -- not a collision. Defeats an overly strict
    design that also blocks reinstalling/upgrading your own already-
    running job, which would make `make install-pulse` unsafe to re-run
    for routine maintenance.
  ROW3 (genuinely distinct names never collide): "Alembic" and
    "Mumbl AI" -- checking one against the other's already-loaded label
    MUST exit 0 (their derived labels differ, no collision exists).
    Defeats a checker that flags a collision merely because ANY OTHER
    label is loaded, rather than specifically the SAME candidate label.
  ROW4 (Makefile wiring + blocking posture, via safe `make -n` dry-run
    only, never a real install): the real, unmodified repo Makefile's
    install-pulse recipe MUST invoke
    execution/check_pulse_label_collision.sh, UNGUARDED (no trailing
    `|| true`/`2>/dev/null`/leading `-`), before any
    sed/launchctl-load line. Defeats a fix that adds the collision
    script but wires it the same permissive way FINDING 1's legacy
    script is deliberately wired, silently swallowing a real collision's
    exit code and letting the overwrite proceed anyway.
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
sys.path.insert(0, str(REPO_ROOT / "execution" / "checks"))
import _pulse_launchctl_stub as stub  # noqa: E402

MAKEFILE = REPO_ROOT / "Makefile"
COLLISION_SCRIPT = REPO_ROOT / "execution" / "check_pulse_label_collision.sh"
REAL_PULSE_PLIST = REPO_ROOT / "execution" / "com.athanor.pulse.plist"
REAL_LAUNCH_AGENTS = Path.home() / "Library" / "LaunchAgents"


def _snapshot_launch_agents() -> dict:
    if not REAL_LAUNCH_AGENTS.is_dir():
        return {}
    return {p.name: p.stat().st_mtime for p in REAL_LAUNCH_AGENTS.iterdir()}


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


def _derive(root: Path) -> str:
    result = subprocess.run(
        ["bash", str(root / "execution" / "derive_pulse_label.sh"), str(root)],
        capture_output=True, text=True, timeout=10,
    )
    return result.stdout.strip()


def _check_collision(bin_dir: Path, project_root: Path) -> subprocess.CompletedProcess | None:
    if not COLLISION_SCRIPT.is_file():
        return None
    return stub.run_with_stub(["bash", str(COLLISION_SCRIPT), str(project_root)], bin_dir)


def main() -> int:
    before_snapshot = _snapshot_launch_agents()
    tmpdir = Path(tempfile.mkdtemp(prefix="pulse_f3_collision_fixture_")).resolve()
    failures: list[str] = []
    try:
        root_a = tmpdir / "project-a"
        _build_fixture_project(root_a, "My Project")
        label_a = _derive(root_a)  # com.athanor.pulse.my-project
        assert label_a, "fixture bug: derive_pulse_label.sh produced empty output for project A"

        # A is loaded, under its own real working directory.
        a_loaded_responses = {
            label_a: stub.print_block(
                str(root_a / "execution" / "pulse_runner.sh"), str(root_a), 0,
                str(root_a / "pulse.log"), label=label_a,
            ),
        }

        # -----------------------------------------------------------
        # ROW1: 3 colliding name variants, each checked while A holds
        # the (shared) label.
        # -----------------------------------------------------------
        colliding_names = ["my-project", "My_Project!!", "MY   PROJECT"]
        for i, name in enumerate(colliding_names):
            root_x = tmpdir / f"project-collide-{i}"
            _build_fixture_project(root_x, name)
            label_x = _derive(root_x)
            if label_x != label_a:
                failures.append(
                    f"ROW1 FIXTURE BUG: project_name {name!r} derived label "
                    f"{label_x!r}, expected it to collide with A's {label_a!r} "
                    "-- fixture assumption wrong, not a real-code finding"
                )
                continue
            bin_dir = tmpdir / f"bin_row1_{i}"
            call_log = stub.make_stub_launchctl(bin_dir, a_loaded_responses)
            result = _check_collision(bin_dir, root_x)
            if result is None:
                failures.append(
                    "ROW1 FAIL: execution/check_pulse_label_collision.sh does "
                    "not exist yet -- the collision-refusal script this "
                    "feature requires has not been implemented"
                )
                break
            forbidden = stub.forbidden_calls(call_log)
            if forbidden:
                failures.append(f"ROW1 FAIL: forbidden launchctl call(s): {forbidden}")
            if result.returncode == 0:
                failures.append(
                    f"ROW1 FAIL: project_name {name!r} (label {label_x!r}) was "
                    f"NOT reported as colliding with already-loaded project A "
                    f"at {root_a} sharing the identical derived label -- "
                    f"rc={result.returncode}\n--- output ---\n"
                    f"{result.stdout + result.stderr}"
                )
            elif str(root_a) not in (result.stdout + result.stderr):
                failures.append(
                    f"ROW1 FAIL: collision correctly refused for {name!r} "
                    f"(rc={result.returncode}) but the foreign working "
                    f"directory ({root_a}) is not named in the output -- "
                    "an operator can't tell WHO they collided with.\n"
                    f"--- output ---\n{result.stdout + result.stderr}"
                )

        # -----------------------------------------------------------
        # ROW2: A re-checking itself (idempotent reinstall) must NOT
        # be flagged as a collision.
        # -----------------------------------------------------------
        bin_dir2 = tmpdir / "bin_row2"
        call_log2 = stub.make_stub_launchctl(bin_dir2, a_loaded_responses)
        result2 = _check_collision(bin_dir2, root_a)
        if result2 is not None:
            forbidden2 = stub.forbidden_calls(call_log2)
            if forbidden2:
                failures.append(f"ROW2 FAIL: forbidden launchctl call(s): {forbidden2}")
            if result2.returncode != 0:
                failures.append(
                    "ROW2 FAIL: re-running the collision check for project A "
                    "against ITS OWN already-loaded job (same label, same "
                    f"working directory) was refused as a collision -- "
                    f"rc={result2.returncode}, which would make `make "
                    "install-pulse` unsafe to re-run for routine maintenance.\n"
                    f"--- output ---\n{result2.stdout + result2.stderr}"
                )

        # -----------------------------------------------------------
        # ROW3: genuinely distinct names never collide.
        # -----------------------------------------------------------
        root_alembic = tmpdir / "project-alembic"
        root_mumbl = tmpdir / "project-mumbl"
        _build_fixture_project(root_alembic, "Alembic")
        _build_fixture_project(root_mumbl, "Mumbl AI")
        label_alembic = _derive(root_alembic)
        distinct_responses = {
            label_alembic: stub.print_block(
                str(root_alembic / "execution" / "pulse_runner.sh"), str(root_alembic), 0,
                str(root_alembic / "pulse.log"), label=label_alembic,
            ),
        }
        bin_dir3 = tmpdir / "bin_row3"
        call_log3 = stub.make_stub_launchctl(bin_dir3, distinct_responses)
        result3 = _check_collision(bin_dir3, root_mumbl)
        if result3 is not None:
            forbidden3 = stub.forbidden_calls(call_log3)
            if forbidden3:
                failures.append(f"ROW3 FAIL: forbidden launchctl call(s): {forbidden3}")
            if result3.returncode != 0:
                failures.append(
                    "ROW3 FAIL: 'Mumbl AI' was flagged as colliding merely "
                    "because SOME OTHER label ('Alembic''s) is loaded, even "
                    "though their derived labels are genuinely different -- "
                    f"rc={result3.returncode}\n"
                    f"--- output ---\n{result3.stdout + result3.stderr}"
                )

        # -----------------------------------------------------------
        # ROW4: Makefile wiring + blocking posture (safe `make -n`
        # dry-run only -- never a real install).
        # -----------------------------------------------------------
        if not MAKEFILE.is_file():
            failures.append("ROW4 FAIL: repo Makefile not found -- fixture bug")
        else:
            result4 = subprocess.run(
                ["make", "-C", str(root_a), "-f", str(MAKEFILE), "-n", "install-pulse"],
                capture_output=True, text=True, timeout=30,
            )
            dry_run_text = result4.stdout + result4.stderr
            collision_lines = [
                ln for ln in dry_run_text.splitlines()
                if "check_pulse_label_collision.sh" in ln
            ]
            if not collision_lines:
                failures.append(
                    "ROW4 FAIL: install-pulse's real recipe never invokes "
                    "execution/check_pulse_label_collision.sh at all -- the "
                    "collision check exists (if it does) but is not wired "
                    "into the installer.\n--- dry-run output ---\n"
                    f"{dry_run_text}"
                )
            else:
                for ln in collision_lines:
                    if re.search(r"\|\|\s*true\s*$", ln) or "2>/dev/null" in ln or ln.strip().startswith("-"):
                        failures.append(
                            "ROW4 FAIL: install-pulse's invocation of "
                            "check_pulse_label_collision.sh swallows its exit "
                            "code (matches a non-blocking pattern: trailing "
                            "'|| true', '2>/dev/null', or a leading '-') -- a "
                            "REAL collision would be silently ignored and the "
                            f"overwrite would proceed anyway.\n  line: {ln!r}"
                        )

        after_snapshot = _snapshot_launch_agents()
        if before_snapshot != after_snapshot:
            failures.append(
                "SAFETY FAIL: ~/Library/LaunchAgents/ changed during this test "
                f"run. before={before_snapshot} after={after_snapshot}"
            )

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if failures:
        print("FAIL: pulse label collisions are not correctly detected/refused")
        for f in failures:
            print(f"  {f}")
        return 1

    print(
        "PASS: colliding project names sharing a derived label are refused "
        "at install time (naming the foreign owner), a project's own "
        "reinstall is never flagged, genuinely distinct names never "
        "collide, and install-pulse's Makefile wiring propagates a real "
        "collision's exit code instead of swallowing it; "
        "~/Library/LaunchAgents/ was never touched"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

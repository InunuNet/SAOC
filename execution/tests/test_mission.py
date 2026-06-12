#!/usr/bin/env python3
"""
test_mission.py — 8 tests for execution/mission.py
Run from project root: python3 execution/tests/test_mission.py
"""
import json
import os
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path

MISSION_CLI = ["python3", "execution/mission.py"]
MISSIONS_DIR = Path(".agent/memory/project/missions")

PASS = 0
FAIL = 0


def run(cmd: list[str], cwd: str | None = None, input_text: str | None = None):
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd or os.getcwd(),
        input=input_text,
    )


def ok(label: str, passed: bool, detail: str = ""):
    global PASS, FAIL
    if passed:
        PASS += 1
        print(f"  PASS  {label}")
    else:
        FAIL += 1
        print(f"  FAIL  {label}" + (f" — {detail}" if detail else ""))


def assert_exit(label: str, result, expected: int):
    ok(label, result.returncode == expected,
       f"exit={result.returncode} expected={expected}\nstdout: {result.stdout[:300]}\nstderr: {result.stderr[:300]}")


def main():
    print("=== test_mission.py ===")
    print()

    # Create a temp missions dir for tests (override MISSIONS_DIR in subprocess via env isn't easy,
    # so we test in the actual dir and clean up afterwards)
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    created_files = []

    # ── Test 1: new command creates .md file ──────────────────────────────────
    print("Test 1: mission.py new creates .md file and exits 0")
    r = run(MISSION_CLI + ["new", "test goal for automated tests", "--slug", "test-goal-auto"])
    assert_exit("new exits 0", r, 0)
    # Find the created file
    created = sorted(MISSIONS_DIR.glob("*test-goal-auto*.md"))
    ok("new creates .md file", len(created) >= 1, f"found: {[str(c) for c in created]}")
    test_mission_path = str(created[-1]) if created else None
    if test_mission_path:
        created_files.append(test_mission_path)
    print()

    # ── Test 2: validate on fresh file exits 0 (schema valid, empty features OK for new) ──
    # The new file has empty features/milestones, which IS valid per validate rules
    # (validate checks ids/refs only for non-empty lists)
    print("Test 2: mission.py validate on fresh file exits 0")
    if test_mission_path:
        r = run(MISSION_CLI + ["validate", test_mission_path])
        assert_exit("validate exits 0", r, 0)
        ok("validate output mentions 'Valid'", "Valid" in r.stdout or "valid" in r.stdout.lower(),
           f"stdout: {r.stdout[:200]}")
    else:
        ok("validate exits 0", False, "no mission file created in test 1")
        ok("validate output mentions 'Valid'", False, "no mission file")
    print()

    # ── Test 3: status prints feature/milestone counts ────────────────────────
    print("Test 3: mission.py status exits 0 and prints feature/milestone counts")
    if test_mission_path:
        r = run(MISSION_CLI + ["status", test_mission_path])
        assert_exit("status exits 0", r, 0)
        ok("status output contains 'Features'", "Features" in r.stdout or "features" in r.stdout.lower(),
           f"stdout: {r.stdout[:300]}")
    else:
        ok("status exits 0", False, "no mission file")
        ok("status output contains 'Features'", False, "no mission file")
    print()

    # ── Test 4: cost prints total estimate ────────────────────────────────────
    print("Test 4: mission.py cost exits 0 and prints total≈N calls")
    if test_mission_path:
        r = run(MISSION_CLI + ["cost", test_mission_path])
        assert_exit("cost exits 0", r, 0)
        ok("cost output contains 'total≈'", "total≈" in r.stdout,
           f"stdout: {r.stdout[:300]}")
    else:
        ok("cost exits 0", False, "no mission file")
        ok("cost output contains 'total≈'", False, "no mission file")
    print()

    # ── Test 5: checkpoint updates feature status ─────────────────────────────
    print("Test 5: mission.py checkpoint updates feature status and exits 0")
    # Create a mission with a feature for checkpoint testing
    import yaml
    import datetime

    checkpoint_mission = MISSIONS_DIR / "test-checkpoint-mission.md"
    created_files.append(str(checkpoint_mission))
    fm = {
        "schema": "athanor.mission/v1",
        "slug": "test-checkpoint",
        "goal": "Checkpoint test mission",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "started_at": None,
        "last_active_at": None,
        "status": "in_progress",
        "cost_estimate": {"features": 1, "milestones": 1, "total_calls": 3},
        "last_checkpoint": {"milestone": None, "feature": None, "ts": None},
        "features": [
            {
                "id": "F1",
                "title": "Test feature",
                "status": "pending",
                "agent": "dev",
                "spec": None,
                "inline_brief": "A test feature for checkpoint testing",
                "contract": None,
                "started_at": None,
                "completed_at": None,
                "handoff": None,
                "notes": "",
            }
        ],
        "milestones": [
            {
                "id": "M1",
                "name": "Test milestone",
                "features": ["F1"],
                "status": "pending",
                "gate_ran_at": None,
                "gate_result": None,
                "rationale": "Test",
            }
        ],
    }
    content = "---\n" + yaml.dump(fm, default_flow_style=False, sort_keys=False) + "---\n\n# Test Mission\n"
    checkpoint_mission.write_text(content)

    r = run(MISSION_CLI + ["checkpoint", str(checkpoint_mission), "--feature", "F1", "--status", "done"])
    assert_exit("checkpoint exits 0", r, 0)

    # Verify the file was updated
    updated_content = checkpoint_mission.read_text()
    ok("checkpoint updates status in file", "done" in updated_content,
       f"file content snippet: {updated_content[:400]}")
    print()

    # ── Test 6: gate with all features done exits 0 ───────────────────────────
    print("Test 6: mission.py gate exits 0 when all features done (no contracts)")
    # Reuse the checkpoint mission file — F1 is now done
    r = run(MISSION_CLI + ["gate", str(checkpoint_mission), "--milestone", "M1"])
    assert_exit("gate exits 0", r, 0)
    ok("gate output contains 'PASS'", "PASS" in r.stdout,
       f"stdout: {r.stdout[:300]}")
    print()

    # ── Test 7: validate on invalid file exits 1 ──────────────────────────────
    print("Test 7: mission.py validate on invalid file exits 1")
    invalid_mission = MISSIONS_DIR / "test-invalid-mission.md"
    created_files.append(str(invalid_mission))
    # Missing inline_brief/spec AND bad schema
    bad_fm = {
        "schema": "wrong.schema/v99",
        "slug": "bad",
        "goal": "Bad mission",
        "created_at": "2026-01-01T00:00:00+00:00",
        "status": "pending",
        "features": [
            {
                "id": "F1",
                "title": "Feature with no brief or spec",
                "status": "pending",
                "agent": "dev",
                "spec": None,
                "inline_brief": None,  # INVALID: neither spec nor brief
                "contract": None,
                "started_at": None,
                "completed_at": None,
                "handoff": None,
                "notes": "",
            }
        ],
        "milestones": [
            {
                "id": "M1",
                "name": "m",
                "features": ["F1"],
                "status": "pending",
                "gate_ran_at": None,
                "gate_result": None,
                "rationale": "test",
            }
        ],
    }
    bad_content = "---\n" + yaml.dump(bad_fm, default_flow_style=False, sort_keys=False) + "---\n\n# Bad\n"
    invalid_mission.write_text(bad_content)

    r = run(MISSION_CLI + ["validate", str(invalid_mission)])
    assert_exit("validate invalid exits 1", r, 1)
    ok("validate outputs error for bad schema", "schema" in r.stdout.lower() or "schema" in r.stderr.lower(),
       f"stdout: {r.stdout[:300]}")
    print()

    # ── Test 8: resume with active.json prints RESUME instruction ─────────────
    print("Test 8: mission.py resume with active.json exits 0 and prints RESUME")
    # Activate the checkpoint mission (F1 done, gate passed → all done)
    r_activate = run(MISSION_CLI + ["activate", str(checkpoint_mission)])
    assert_exit("activate exits 0", r_activate, 0)

    r = run(MISSION_CLI + ["resume"])
    assert_exit("resume exits 0", r, 0)
    ok("resume prints RESUME or completion message",
       "RESUME" in r.stdout or "complete" in r.stdout.lower() or "no active" in r.stdout.lower(),
       f"stdout: {r.stdout[:300]}")
    print()

    # ── Test 9: done-slug collision continues (regression for sys.exit(0) fix) ──
    print("Test 9: mission.py new with done-slug collision exits 0 and creates file")
    import datetime

    collision_slug = "slug-collision-done-test"
    today_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    collision_seed = MISSIONS_DIR / f"2026-01-01-{collision_slug}.md"
    collision_expected = MISSIONS_DIR / f"{today_str}-{collision_slug}.md"
    created_files.append(str(collision_seed))
    created_files.append(str(collision_expected))

    seed_fm = {
        "schema": "athanor.mission/v1",
        "slug": collision_slug,
        "goal": "A previously completed collision test mission",
        "created_at": "2026-01-01T00:00:00+00:00",
        "started_at": "2026-01-01T00:00:00+00:00",
        "last_active_at": "2026-01-02T00:00:00+00:00",
        "status": "done",
        "cost_estimate": {"features": 0, "milestones": 0, "total_calls": 0},
        "last_checkpoint": {"milestone": None, "feature": None, "ts": None},
        "features": [],
        "milestones": [],
    }
    seed_content = "---\n" + yaml.dump(seed_fm, default_flow_style=False, sort_keys=False) + "---\n\n# Seed\n"
    collision_seed.write_text(seed_content)

    r = run(MISSION_CLI + ["new", "slug collision done test", "--slug", collision_slug])
    assert_exit("slug_collision_done: exits 0", r, 0)
    ok("slug_collision_done: new mission file created",
       collision_expected.exists() and collision_expected != collision_seed,
       f"expected: {collision_expected}, stdout: {r.stdout[:200]}, stderr: {r.stderr[:200]}")
    print()

    # ── Cleanup ───────────────────────────────────────────────────────────────
    for f in created_files:
        try:
            Path(f).unlink(missing_ok=True)
        except Exception:
            pass
    # Clean up active.json if it was set to our test mission
    active_json = MISSIONS_DIR / "active.json"
    if active_json.exists():
        try:
            data = json.loads(active_json.read_text())
            if any(Path(data.get("mission", "")).name == Path(f).name for f in created_files):
                active_json.unlink()
        except Exception:
            pass

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print(f"{'='*40}")
    total = PASS + FAIL
    print(f"Results: {PASS}/{total} passed")
    if FAIL > 0:
        print(f"FAIL: {FAIL} test(s) failed")
        sys.exit(1)
    else:
        print("All tests passed.")
        sys.exit(0)


if __name__ == "__main__":
    main()

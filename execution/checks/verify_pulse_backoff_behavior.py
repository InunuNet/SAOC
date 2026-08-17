#!/usr/bin/env python3
"""verify_pulse_backoff_behavior.py -- assertion-shape-sweep F2 repair.

Replaces pulse-dispatch-budget-gate/contract-5fixes.yaml's original F2,
which only grepped execution/pulse_dispatcher.py (and its template/ twin)
for the identifier substrings check_provider_backoff/provider_backoff/
CONSECUTIVE_FAILURE_THRESHOLD/provider_failures. Presence-only: a
`check_provider_backoff` forced to unconditionally `return None` (abort
silenced) still contains every one of those identifiers untouched, so the
old grep chain would pass while the mechanism is dead.

This replacement OBSERVES the mechanism directly (Recipe 1 -- these are
plain functions over a Paths object, no daemon/subprocess needed): it
imports execution/pulse_dispatcher.py and drives check_provider_backoff /
record_failure / record_success through the full 7-step truth table in
goldens/f2_backoff_truth_table.md, against a fixture Paths rooted at a
tempfile.TemporaryDirectory() -- never ~/Library/LaunchAgents, never a
daemon, never a real pulse state file. Each step re-reads budget.json
directly off disk rather than trusting return values alone.

Override PULSE_DISPATCHER_UNDER_TEST (absolute path, default = the real
execution/pulse_dispatcher.py) exists only for negative verification
against a deliberately broken temp copy -- never set in the production
assertion.
"""
import importlib.util
import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DISPATCHER_PATH = Path(os.environ.get(
    "PULSE_DISPATCHER_UNDER_TEST",
    str(REPO_ROOT / "execution" / "pulse_dispatcher.py"),
))

FAILURES = []


def fail(name, msg):
    FAILURES.append(f"{name}: {msg}")
    print(f"FAIL [{name}]: {msg}", file=sys.stderr)


def ok(name, msg):
    print(f"OK [{name}]: {msg}")


def _load_dispatcher():
    # pulse_dispatcher.py imports `from execution.provider_manifest import
    # ...` (falling back to a bare `provider_manifest` import) -- both
    # REPO_ROOT (for the `execution.` package form) and REPO_ROOT/execution
    # (for the bare-module fallback) must be importable regardless of the
    # scratch DISPATCHER_PATH's own location, since the fallback always
    # resolves against the real repo's execution/ package.
    for extra in (str(REPO_ROOT), str(REPO_ROOT / "execution")):
        if extra not in sys.path:
            sys.path.insert(0, extra)
    spec = importlib.util.spec_from_file_location("pulse_dispatcher_under_test", DISPATCHER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _read_budget(state_dir: Path) -> dict:
    return json.loads((state_dir / "budget.json").read_text())


def run_truth_table():
    name = "backoff_truth_table"
    mod = _load_dispatcher()

    with tempfile.TemporaryDirectory() as td:
        paths = mod.Paths.from_root(Path(td))
        provider = "fixture-provider"
        project_path = "/fixture/project"
        key = mod._backoff_key(provider, project_path)

        # Step 1: fresh state, nothing recorded -> not backing off.
        reason = mod.check_provider_backoff(paths, provider, project_path)
        if reason is not None:
            return fail(name, f"step 1: expected None on fresh state, got {reason!r}")

        # Step 2: first failure -> counter=1, still not backing off.
        mod.record_failure(paths, provider, project_path)
        budget = _read_budget(paths.state)
        if budget.get("provider_failures", {}).get(key) != 1:
            return fail(name, f"step 2: expected provider_failures[{key}]==1, got {budget.get('provider_failures')}")
        if mod.check_provider_backoff(paths, provider, project_path) is not None:
            return fail(name, "step 2: expected still not backing off after 1 failure")

        # Step 3: second consecutive failure -> counter=2, still below threshold.
        mod.record_failure(paths, provider, project_path)
        budget = _read_budget(paths.state)
        if budget.get("provider_failures", {}).get(key) != 2:
            return fail(name, f"step 3: expected provider_failures[{key}]==2, got {budget.get('provider_failures')}")
        if mod.check_provider_backoff(paths, provider, project_path) is not None:
            return fail(name, "step 3: expected still not backing off after 2 failures (threshold is 3)")

        # Step 4: third consecutive failure -> reaches threshold, backs off.
        mod.record_failure(paths, provider, project_path)
        reason = mod.check_provider_backoff(paths, provider, project_path)
        if reason is None:
            return fail(name, "step 4: expected a non-None block reason after 3rd consecutive failure")
        budget = _read_budget(paths.state)
        backoff_until = budget.get("provider_backoff", {}).get(key)
        if not backoff_until:
            return fail(name, "step 4: expected provider_backoff[key] persisted in budget.json")
        until_ts = datetime.fromisoformat(str(backoff_until).replace("Z", "+00:00")).timestamp()
        if until_ts <= datetime.now(timezone.utc).timestamp():
            return fail(name, f"step 4: expected provider_backoff[key] in the future, got {backoff_until}")

        # Step 5: simulate expiry by rewriting the persisted timestamp into
        # the past -- mutates only on-disk state the real functions
        # themselves read/write, never the code under test.
        budget_path = paths.state / "budget.json"
        budget = _read_budget(paths.state)
        past = (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat()
        budget["provider_backoff"][key] = past
        budget_path.write_text(json.dumps(budget))

        # Step 6: expired backoff clears both maps, returns None again.
        reason = mod.check_provider_backoff(paths, provider, project_path)
        if reason is not None:
            return fail(name, f"step 6: expected None after backoff expiry, got {reason!r}")
        budget = _read_budget(paths.state)
        if key in budget.get("provider_backoff", {}):
            return fail(name, "step 6: expected provider_backoff[key] removed after expiry")
        if key in budget.get("provider_failures", {}):
            return fail(name, "step 6: expected provider_failures[key] removed after expiry")

        # Step 7: fresh key, below-threshold failures then a success clears counters.
        provider2 = "fixture-provider-2"
        project_path2 = "/fixture/project-2"
        key2 = mod._backoff_key(provider2, project_path2)
        mod.record_failure(paths, provider2, project_path2)
        mod.record_failure(paths, provider2, project_path2)
        mod.record_success(paths, provider2, project_path2)
        budget = _read_budget(paths.state)
        if key2 in budget.get("provider_failures", {}):
            return fail(name, "step 7: expected provider_failures[key2] removed after record_success")
        if mod.check_provider_backoff(paths, provider2, project_path2) is not None:
            return fail(name, "step 7: expected None after record_success clears failures")

        ok(name, "all 7 truth-table steps observed against real on-disk budget.json state")


def run_template_twin_check():
    """Only meaningful for the production run (no override) -- when a
    scratch DISPATCHER_PATH is under test, this equivalence check is not
    applicable and is skipped."""
    name = "template_twin_equivalence"
    if os.environ.get("PULSE_DISPATCHER_UNDER_TEST"):
        print(f"SKIP [{name}]: DISPATCHER_PATH overridden for negative verification, not applicable")
        return
    live = REPO_ROOT / "execution" / "pulse_dispatcher.py"
    twin = REPO_ROOT / "template" / "execution" / "pulse_dispatcher.py"
    if live.read_bytes() != twin.read_bytes():
        return fail(name, f"{live} and {twin} are not byte-identical")
    ok(name, f"{live} and {twin} are byte-identical")


def main():
    run_truth_table()
    run_template_twin_check()

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s).", file=sys.stderr)
        sys.exit(1)
    print("\nPASS: pulse_dispatcher.py's consecutive-failure backoff behaves per the truth table.")
    sys.exit(0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Smoke tests for cascade routing in pulse_dispatcher.

Usage:
  smoke_cascade.py --check-cascade
  smoke_cascade.py --check-explicit-no-cascade
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

# Locate dispatcher relative to this file's repo root.
_REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_REPO_ROOT))

import execution.pulse_dispatcher as dispatcher
from execution.pulse_dispatcher import Paths


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_paths(tmp: Path) -> Paths:
    return Paths.from_root(tmp)


def _make_ticket(provider: str = "auto") -> dict:
    return {
        "schema": dispatcher.TICKET_SCHEMA,
        "id": "test-ticket-001",
        "source": "test",
        "kind": "task",
        "project_path": "/tmp/fake-project",
        "provider": provider,
        "requires_model": True,
        "prompt": "do something",
        "dedupe_key": "unique-key-001",
        "max_turns": 1,
        "max_tokens": 1000,
        "created_at": "2026-06-16T00:00:00Z",
        "updated_at": "2026-06-16T00:00:00Z",
    }


def _write_ticket(paths: Paths, ticket: dict) -> Path:
    paths.queue.mkdir(parents=True, exist_ok=True)
    ticket_path = paths.queue / f"{ticket['id']}.json"
    ticket_path.write_text(json.dumps(ticket, indent=2), encoding="utf-8")
    return ticket_path


# ---------------------------------------------------------------------------
# Test: cascade fires on auto-routed launch failure
# ---------------------------------------------------------------------------

def check_cascade() -> bool:
    """Confirm cascade_provider is called and cascade launch succeeds."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        paths = _make_paths(tmp)

        ticket = _make_ticket(provider="auto")
        ticket_path = _write_ticket(paths, ticket)

        # Manifest for the original resolved provider has escalation_order: ["opencode"]
        resolved_manifest = {
            "routing_policy": {
                "auto_route": True,
                "complexity": ["standard"],
                "priority": 10,
                "escalation_order": ["opencode"],
            }
        }
        opencode_manifest = {
            "routing_policy": {
                "auto_route": False,
            },
            "headless_command": ["opencode", "{prompt}"],
        }

        call_count = {"launch": 0}

        def fake_load_manifest(provider_id: str, root: Path) -> dict:
            if provider_id == "claude-code":
                return resolved_manifest
            if provider_id == "opencode":
                return opencode_manifest
            return {}

        def fake_check_provider_backoff(paths_arg, provider_id: str, project_path: str):
            # No backoff for any provider.
            return None

        def fake_launch_provider(ticket_arg, cmd):
            call_count["launch"] += 1
            if call_count["launch"] == 1:
                # First launch (original provider) fails.
                return False, "provider exited 1"
            # Second launch (cascade provider) succeeds.
            return True, "launched"

        def fake_select_provider(ticket_arg, paths_arg):
            # Auto-route resolves to "claude-code".
            return "claude-code", False

        def fake_provider_ready(ticket_arg, paths_arg):
            # Always return a dummy command.
            return ["fake-bin", "arg"], None

        def fake_acquire_lease(path, ttl):
            lease = MagicMock()
            lease.held = True
            lease.release = MagicMock()
            return lease

        def fake_reserve_dedupe(paths_arg, ticket_arg):
            return True

        def fake_budget_block_reason(paths_arg, ticket_arg):
            return None

        def fake_archive_ticket(paths_arg, ticket_path_arg, ticket_arg, status, reason):
            return tmp / "archive" / f"{ticket_arg['id']}.json"

        def fake_record_failure(paths_arg, provider, project_path):
            pass

        def fake_record_success(paths_arg, provider, project_path):
            pass

        def fake_record_launch(paths_arg, ticket_arg):
            pass

        with (
            patch.object(dispatcher, "load_manifest", side_effect=fake_load_manifest),
            patch.object(dispatcher, "check_provider_backoff", side_effect=fake_check_provider_backoff),
            patch.object(dispatcher, "launch_provider", side_effect=fake_launch_provider),
            patch.object(dispatcher, "select_provider", side_effect=fake_select_provider),
            patch.object(dispatcher, "provider_ready", side_effect=fake_provider_ready),
            patch.object(dispatcher, "acquire_lease", side_effect=fake_acquire_lease),
            patch.object(dispatcher, "reserve_dedupe", side_effect=fake_reserve_dedupe),
            patch.object(dispatcher, "budget_block_reason", side_effect=fake_budget_block_reason),
            patch.object(dispatcher, "archive_ticket", side_effect=fake_archive_ticket),
            patch.object(dispatcher, "record_failure", side_effect=fake_record_failure),
            patch.object(dispatcher, "record_success", side_effect=fake_record_success),
            patch.object(dispatcher, "record_launch", side_effect=fake_record_launch),
        ):
            launches, progressed = dispatcher.dispatch_ticket(paths, ticket_path, max_launches=5, launches=0)

        if launches != 1:
            print(f"FAIL check-cascade: expected launches=1, got {launches}")
            return False
        if not progressed:
            print(f"FAIL check-cascade: expected progressed=True, got {progressed}")
            return False
        if call_count["launch"] != 2:
            print(f"FAIL check-cascade: expected 2 launch_provider calls, got {call_count['launch']}")
            return False

        print("PASS check-cascade")
        return True


# ---------------------------------------------------------------------------
# Test: explicit-provider ticket does NOT trigger cascade
# ---------------------------------------------------------------------------

def check_explicit_no_cascade() -> bool:
    """Confirm that a non-auto ticket never triggers cascade."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        paths = _make_paths(tmp)

        ticket = _make_ticket(provider="claude-code")
        ticket_path = _write_ticket(paths, ticket)

        cascade_called = {"flag": False}

        def raise_if_cascade(*args, **kwargs):
            cascade_called["flag"] = True
            raise AssertionError("cascade_provider must not be called for explicit-provider tickets")

        def fake_launch_provider(ticket_arg, cmd):
            return False, "provider exited 1"

        def fake_provider_ready(ticket_arg, paths_arg):
            return ["fake-bin", "arg"], None

        def fake_acquire_lease(path, ttl):
            lease = MagicMock()
            lease.held = True
            lease.release = MagicMock()
            return lease

        def fake_reserve_dedupe(paths_arg, ticket_arg):
            return True

        def fake_budget_block_reason(paths_arg, ticket_arg):
            return None

        def fake_archive_ticket(paths_arg, ticket_path_arg, ticket_arg, status, reason):
            return tmp / "archive" / f"{ticket_arg['id']}.json"

        def fake_record_failure(paths_arg, provider, project_path):
            pass

        with (
            patch.object(dispatcher, "cascade_provider", side_effect=raise_if_cascade),
            patch.object(dispatcher, "launch_provider", side_effect=fake_launch_provider),
            patch.object(dispatcher, "provider_ready", side_effect=fake_provider_ready),
            patch.object(dispatcher, "acquire_lease", side_effect=fake_acquire_lease),
            patch.object(dispatcher, "reserve_dedupe", side_effect=fake_reserve_dedupe),
            patch.object(dispatcher, "budget_block_reason", side_effect=fake_budget_block_reason),
            patch.object(dispatcher, "archive_ticket", side_effect=fake_archive_ticket),
            patch.object(dispatcher, "record_failure", side_effect=fake_record_failure),
        ):
            launches, progressed = dispatcher.dispatch_ticket(paths, ticket_path, max_launches=5, launches=0)

        if cascade_called["flag"]:
            print("FAIL check-explicit-no-cascade: cascade_provider was called for explicit ticket")
            return False
        if launches != 0:
            print(f"FAIL check-explicit-no-cascade: expected launches=0, got {launches}")
            return False
        if progressed:
            print(f"FAIL check-explicit-no-cascade: expected progressed=False, got {progressed}")
            return False

        print("PASS check-explicit-no-cascade")
        return True


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-cascade", action="store_true")
    parser.add_argument("--check-explicit-no-cascade", action="store_true")
    args = parser.parse_args()

    if not args.check_cascade and not args.check_explicit_no_cascade:
        parser.print_help()
        return 1

    ok = True
    if args.check_cascade:
        ok = check_cascade() and ok
    if args.check_explicit_no_cascade:
        ok = check_explicit_no_cascade() and ok

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

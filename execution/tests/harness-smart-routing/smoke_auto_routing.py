#!/usr/bin/env python3
"""Smoke test: select_provider auto-routes a trivial ticket to the cheapest
eligible, auto_route-enabled provider.

harness-smart-routing slice 2 / assertion A5.

The expected winner is computed empirically from the live provider manifests
so this test stays correct if priorities/manifests change. It asserts that
select_provider agrees with that independent computation.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from execution import pulse_dispatcher as pd  # noqa: E402


def expected_winner(complexity: str, root: Path) -> str | None:
    """Independent reference implementation of the routing rule."""
    candidates = []
    for provider in pd.VALID_PROVIDERS:
        if provider == "auto":
            continue
        manifest = pd.load_manifest(provider, root)
        policy = manifest.get("routing_policy") or {}
        if policy.get("auto_route") is not True:
            continue
        if complexity not in (policy.get("complexity") or []):
            continue
        candidates.append((policy.get("priority"), provider))
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1] if candidates else None


def main() -> int:
    root = ROOT
    paths = pd.Paths.from_root(root)

    # "auto" must be a recognized provider value.
    assert "auto" in pd.VALID_PROVIDERS, "'auto' missing from VALID_PROVIDERS"

    # validate_ticket must accept provider == "auto".
    ticket = {
        "schema": pd.TICKET_SCHEMA,
        "id": "smoke-auto-1",
        "source": "smoke",
        "kind": "test",
        "project_path": ".",
        "provider": "auto",
        "complexity": "trivial",
        "requires_model": True,
        "prompt": "noop",
        "dedupe_key": "smoke-auto-1",
        "max_turns": 1,
        "max_tokens": 0,
        "created_at": pd.utc_now(),
        "updated_at": pd.utc_now(),
    }
    assert pd.validate_ticket(ticket) is None, "validate_ticket rejected provider=auto"

    expected = expected_winner("trivial", root)
    assert expected is not None, "no eligible provider found for trivial in manifests"

    got, backoff_blocked = pd.select_provider(ticket, paths)
    assert got == expected, f"select_provider returned {got!r}, expected {expected!r}"
    assert not backoff_blocked, "select_provider unexpectedly reported backoff_blocked=True"

    print(f"OK select_provider(trivial) -> {got}")

    # --- Test: all-providers-in-backoff returns (None, True) -----------------
    # Patch check_provider_backoff to always report a backoff reason.
    original_check = pd.check_provider_backoff

    def _always_blocked(p: pd.Paths, provider: str, project_path: str) -> str | None:
        return f"mocked backoff for {provider}"

    pd.check_provider_backoff = _always_blocked  # type: ignore[assignment]
    try:
        no_provider, is_backoff = pd.select_provider(ticket, paths)
        assert no_provider is None, f"expected None provider, got {no_provider!r}"
        assert is_backoff is True, f"expected backoff_blocked=True, got {is_backoff!r}"
        print("OK select_provider(all-backoff) -> (None, True)")
    finally:
        pd.check_provider_backoff = original_check  # type: ignore[assignment]

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

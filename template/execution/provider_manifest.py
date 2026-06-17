#!/usr/bin/env python3
"""Load project-local provider capability manifests."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


PROVIDERS_DIR = Path(".agent") / "providers"
KNOWN_PROVIDERS = ("claude-code", "codex", "gemini-cli", "antigravity", "opencode")
REQUIRED_KEYS = {
    "provider",
    "display_name",
    "supports_headless",
    "supports_hooks",
    "supports_subagents",
    "supports_max_turns",
    "supports_max_tokens",
    "token_accounting",
    "routing_policy",
    "role_capabilities",
}

VALID_COMPLEXITY = {"trivial", "standard", "complex"}
CANONICAL_ROLES = ("lead", "analyst", "architect", "dev", "qa", "docs", "maintainer", "designer")
VALID_ROLE_MODES = {"native", "prompt-file", "llm-tool", "unsupported", "mixed"}
VALID_ROLE_DISPATCH = {"native", "prompt-file", "llm-tool", "primary-only", "unsupported"}
REQUIRED_ROUTING_KEYS = {
    "auto_route",
    "cost_tier",
    "complexity",
    "domains",
    "priority",
    "escalation_order",
}


def root_path(value: str | None = None) -> Path:
    return Path(value or os.getcwd()).expanduser().resolve()


def manifest_path(root: Path, provider: str) -> Path:
    return root / PROVIDERS_DIR / f"{provider}.json"


def load_manifest(root: Path, provider: str) -> dict[str, Any]:
    path = manifest_path(root, provider)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"provider manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"provider manifest invalid JSON: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise SystemExit(f"provider manifest must be an object: {path}")
    missing = sorted(REQUIRED_KEYS - set(data))
    if missing:
        raise SystemExit(f"provider manifest missing keys for {provider}: {', '.join(missing)}")
    if data.get("provider") != provider:
        raise SystemExit(f"provider manifest name mismatch: expected {provider}, got {data.get('provider')}")
    validate_routing_policy(provider, data.get("routing_policy"))
    validate_role_capabilities(provider, data.get("role_capabilities"))
    return data


def validate_routing_policy(provider: str, policy: Any) -> None:
    if not isinstance(policy, dict):
        raise SystemExit(f"provider routing_policy must be an object for {provider}")
    missing = sorted(REQUIRED_ROUTING_KEYS - set(policy))
    if missing:
        raise SystemExit(f"provider routing_policy missing keys for {provider}: {', '.join(missing)}")
    if not isinstance(policy["auto_route"], bool):
        raise SystemExit(f"provider routing_policy.auto_route must be boolean for {provider}")
    if not isinstance(policy["cost_tier"], str) or not policy["cost_tier"]:
        raise SystemExit(f"provider routing_policy.cost_tier must be non-empty string for {provider}")
    if not isinstance(policy["priority"], int):
        raise SystemExit(f"provider routing_policy.priority must be integer for {provider}")
    complexities = policy["complexity"]
    if not isinstance(complexities, list) or not complexities:
        raise SystemExit(f"provider routing_policy.complexity must be a non-empty list for {provider}")
    invalid_complexity = sorted(set(complexities) - VALID_COMPLEXITY)
    if invalid_complexity:
        raise SystemExit(
            f"provider routing_policy.complexity invalid for {provider}: {', '.join(invalid_complexity)}"
        )
    for key in ("domains", "escalation_order"):
        values = policy[key]
        if not isinstance(values, list) or any(not isinstance(item, str) or not item for item in values):
            raise SystemExit(f"provider routing_policy.{key} must be a list of strings for {provider}")


def validate_role_capabilities(provider: str, capabilities: Any) -> None:
    if not isinstance(capabilities, dict):
        raise SystemExit(f"provider role_capabilities must be an object for {provider}")
    mode = capabilities.get("mode")
    if mode not in VALID_ROLE_MODES:
        raise SystemExit(
            f"provider role_capabilities.mode invalid for {provider}: expected {', '.join(sorted(VALID_ROLE_MODES))}"
        )
    roles = capabilities.get("roles")
    if not isinstance(roles, dict):
        raise SystemExit(f"provider role_capabilities.roles must be an object for {provider}")
    missing = [role for role in CANONICAL_ROLES if role not in roles]
    if missing:
        raise SystemExit(f"provider role_capabilities missing roles for {provider}: {', '.join(missing)}")
    unknown = sorted(set(roles) - set(CANONICAL_ROLES))
    if unknown:
        raise SystemExit(f"provider role_capabilities unknown roles for {provider}: {', '.join(unknown)}")
    for role in CANONICAL_ROLES:
        item = roles[role]
        if not isinstance(item, dict):
            raise SystemExit(f"provider role_capabilities.{role} must be an object for {provider}")
        if not isinstance(item.get("supported"), bool):
            raise SystemExit(f"provider role_capabilities.{role}.supported must be boolean for {provider}")
        dispatch = item.get("dispatch")
        if dispatch not in VALID_ROLE_DISPATCH:
            raise SystemExit(
                f"provider role_capabilities.{role}.dispatch invalid for {provider}: "
                f"expected {', '.join(sorted(VALID_ROLE_DISPATCH))}"
            )
        reason = item.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            raise SystemExit(f"provider role_capabilities.{role}.reason must be non-empty string for {provider}")
        if item["supported"] and dispatch == "unsupported":
            raise SystemExit(f"provider role_capabilities.{role} supported=true cannot use unsupported dispatch")
        if not item["supported"] and dispatch != "unsupported":
            raise SystemExit(f"provider role_capabilities.{role} supported=false must use unsupported dispatch")


def list_manifests(root: Path) -> list[dict[str, Any]]:
    return [load_manifest(root, provider) for provider in KNOWN_PROVIDERS]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", default=os.getcwd())
    sub = parser.add_subparsers(dest="command", required=True)

    p_get = sub.add_parser("get", help="print one provider manifest")
    p_get.add_argument("provider")

    sub.add_parser("list", help="print all provider manifests")
    sub.add_parser("validate", help="validate all provider manifests")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = root_path(args.project_root)
    if args.command == "get":
        print(json.dumps(load_manifest(root, args.provider), indent=2, sort_keys=True))
        return 0
    if args.command == "list":
        print(json.dumps(list_manifests(root), indent=2, sort_keys=True))
        return 0
    if args.command == "validate":
        manifests = list_manifests(root)
        for manifest in manifests:
            print(manifest["provider"])
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

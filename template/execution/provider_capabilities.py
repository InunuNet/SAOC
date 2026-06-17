#!/usr/bin/env python3
"""Check provider role-dispatch capabilities before launching a model."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    from execution.provider_manifest import CANONICAL_ROLES, KNOWN_PROVIDERS, load_manifest, root_path
except ModuleNotFoundError:
    from provider_manifest import CANONICAL_ROLES, KNOWN_PROVIDERS, load_manifest, root_path


def role_entry(root: Path, provider: str, role: str) -> dict[str, Any]:
    if role not in CANONICAL_ROLES:
        raise SystemExit(f"unknown role {role!r}; expected one of {', '.join(CANONICAL_ROLES)}")
    manifest = load_manifest(root, provider)
    roles = manifest["role_capabilities"]["roles"]
    entry = roles.get(role)
    if not isinstance(entry, dict):
        raise SystemExit(f"provider {provider} has no role capability for {role}")
    return entry


def check_role(root: Path, provider: str, role: str) -> tuple[bool, str]:
    entry = role_entry(root, provider, role)
    reason = str(entry.get("reason") or "no reason recorded")
    dispatch = str(entry.get("dispatch") or "unknown")
    if entry.get("supported") is True:
        return True, f"PASS {provider} role={role} dispatch={dispatch}: {reason}"
    return False, f"FAIL {provider} role={role} dispatch={dispatch}: {reason}"


def unsupported_roles(root: Path, provider: str, roles: list[str]) -> list[str]:
    unsupported: list[str] = []
    for role in roles:
        ok, _ = check_role(root, provider, role)
        if not ok:
            unsupported.append(role)
    return unsupported


def parse_roles(value: str | None) -> list[str]:
    if not value:
        return []
    roles = [item.strip() for item in value.split(",") if item.strip()]
    invalid = [role for role in roles if role not in CANONICAL_ROLES]
    if invalid:
        raise SystemExit(f"unknown role(s): {', '.join(invalid)}")
    return roles


def cmd_check(args: argparse.Namespace) -> int:
    root = root_path(args.project_root)
    ok, message = check_role(root, args.provider, args.role)
    print(message)
    return 0 if ok else 1


def cmd_list(args: argparse.Namespace) -> int:
    root = root_path(args.project_root)
    providers = [args.provider] if args.provider else list(KNOWN_PROVIDERS)
    out: dict[str, Any] = {}
    for provider in providers:
        manifest = load_manifest(root, provider)
        out[provider] = manifest["role_capabilities"]
    print(json.dumps(out, indent=2, sort_keys=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", default=os.getcwd())
    sub = parser.add_subparsers(dest="command", required=True)

    check = sub.add_parser("check", help="check whether a provider supports a role")
    check.add_argument("--provider", required=True, choices=KNOWN_PROVIDERS)
    check.add_argument("--role", required=True, choices=CANONICAL_ROLES)
    check.set_defaults(func=cmd_check)

    list_cmd = sub.add_parser("list", help="list role capabilities")
    list_cmd.add_argument("--provider", choices=KNOWN_PROVIDERS)
    list_cmd.set_defaults(func=cmd_list)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Create provider-neutral Pulse dispatch tickets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA = "athanor.pulse.ticket/v1"
VALID_PROVIDERS = ("claude-code", "codex", "gemini-cli", "antigravity", "opencode")
VALID_COMPLEXITY = ("trivial", "standard", "complex")
CANONICAL_ROLES = ("lead", "analyst", "architect", "dev", "qa", "docs", "maintainer", "designer")


def parse_bool(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise argparse.ArgumentTypeError(f"expected boolean value, got {value!r}")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def project_root(path: str | None) -> Path:
    return Path(path or os.getcwd()).expanduser().resolve()


def default_queue_dir(root: Path) -> Path:
    return root / ".agent" / "pulse" / "queue"


def read_prompt(args: argparse.Namespace) -> str:
    if args.prompt_file:
        return Path(args.prompt_file).read_text(encoding="utf-8")
    if args.prompt is not None:
        return args.prompt
    if not sys.stdin.isatty():
        return sys.stdin.read()
    return ""


def make_dedupe_key(source: str, kind: str, project_path: str, prompt: str) -> str:
    digest = hashlib.sha256(f"{source}\0{kind}\0{project_path}\0{prompt}".encode("utf-8")).hexdigest()
    return f"{source}:{kind}:{digest[:24]}"


def make_ticket(args: argparse.Namespace) -> dict[str, Any]:
    root = project_root(args.project_path)
    prompt = read_prompt(args)
    goal = args.goal or prompt
    now = utc_now()
    dedupe_basis = goal or prompt
    dedupe_key = args.dedupe_key or make_dedupe_key(args.source, args.kind, str(root), dedupe_basis)
    ticket_id = args.id or f"pt-{uuid.uuid4().hex}"
    return {
        "schema": SCHEMA,
        "id": ticket_id,
        "source": args.source,
        "kind": args.kind,
        "project_path": str(root),
        "provider": args.provider,
        "requires_model": bool(args.requires_model),
        "goal": goal,
        "acceptance": list(args.acceptance or []),
        "complexity": args.complexity,
        "routing_policy": args.routing_policy,
        "evidence_gate": args.evidence_gate,
        "human_blocker_policy": args.human_blocker_policy,
        "required_roles": list(args.required_roles or []),
        "prompt": prompt,
        "dedupe_key": dedupe_key,
        "max_turns": int(args.max_turns),
        "max_tokens": int(args.max_tokens),
        "created_at": now,
        "updated_at": now,
        "not_before": args.not_before,
        "metadata": dict(args.metadata or {}),
    }


def write_ticket(ticket: dict[str, Any], queue_dir: Path) -> Path:
    queue_dir.mkdir(parents=True, exist_ok=True)
    safe_id = "".join(ch if ch.isalnum() or ch in "._-" else "-" for ch in str(ticket["id"]))
    path = queue_dir / f"{safe_id}.json"
    tmp = queue_dir / f".{safe_id}.{os.getpid()}.tmp"
    tmp.write_text(json.dumps(ticket, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    return path


def parse_metadata(items: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in items:
        if "=" not in item:
            raise SystemExit(f"metadata must be KEY=VALUE: {item}")
        key, value = item.split("=", 1)
        out[key] = value
    return out


def cmd_enqueue(args: argparse.Namespace) -> int:
    if args.provider not in VALID_PROVIDERS:
        raise SystemExit(f"unsupported provider {args.provider!r}; expected one of {', '.join(VALID_PROVIDERS)}")
    invalid_roles = [role for role in args.required_roles if role not in CANONICAL_ROLES]
    if invalid_roles:
        raise SystemExit(f"unsupported required role(s): {', '.join(invalid_roles)}")
    args.metadata = parse_metadata(args.metadata)
    ticket = make_ticket(args)
    root = project_root(args.project_path)
    queue_dir = Path(args.queue_dir).expanduser().resolve() if args.queue_dir else default_queue_dir(root)
    path = write_ticket(ticket, queue_dir)
    print(path)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    enqueue = sub.add_parser("enqueue", help="enqueue a provider-neutral Pulse ticket")
    enqueue.add_argument("--id", help="explicit ticket id; defaults to a generated id")
    enqueue.add_argument("--source", required=True, help="scheduler or watcher emitting the ticket")
    enqueue.add_argument("--kind", required=True, help="ticket kind, for example mission-resume")
    enqueue.add_argument("--project-path", default=os.getcwd(), help="workspace root; defaults to cwd")
    enqueue.add_argument("--provider", default="claude-code", choices=VALID_PROVIDERS)
    enqueue.add_argument("--requires-model", dest="requires_model", nargs="?", const=True, default=False, type=parse_bool)
    enqueue.add_argument("--no-requires-model", dest="requires_model", action="store_false")
    enqueue.add_argument("--goal", help="user-facing desired outcome; defaults to prompt text")
    enqueue.add_argument("--acceptance", action="append", default=[], help="repeatable observable completion criterion")
    enqueue.add_argument("--complexity", default="standard", choices=VALID_COMPLEXITY)
    enqueue.add_argument("--routing-policy", default="manual", help="routing hint; dispatcher auto-routing is a later slice")
    enqueue.add_argument("--evidence-gate", default="contract", help="required evidence gate, for example contract or tests")
    enqueue.add_argument("--human-blocker-policy", default="external-only", help="when to stop for a human")
    enqueue.add_argument("--required-role", dest="required_roles", action="append", default=[], choices=CANONICAL_ROLES,
                         help="repeatable canonical role the selected provider must be able to run")
    enqueue.add_argument("--prompt", help="prompt text; if omitted, stdin is used when piped")
    enqueue.add_argument("--prompt-file", help="read prompt text from a file")
    enqueue.add_argument("--dedupe-key", help="idempotency key; defaults to a hash of source/kind/project/prompt")
    enqueue.add_argument("--max-turns", type=int, default=1)
    enqueue.add_argument("--max-tokens", type=int, default=20000)
    enqueue.add_argument("--not-before", help="UTC timestamp before which the dispatcher should skip the ticket")
    enqueue.add_argument("--metadata", action="append", default=[], help="repeatable KEY=VALUE metadata")
    enqueue.add_argument("--queue-dir", help="override queue directory; defaults to .agent/pulse/queue")
    enqueue.set_defaults(func=cmd_enqueue)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

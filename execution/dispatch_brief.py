#!/usr/bin/env python3
"""Render a task-only dispatch brief for one agent on one mission feature.

The brief carries the task, the files to read, the acceptance commands, the scratch path for the
full result and the reply limit. It never includes mission goals, memory or history, and is
trimmed to MAX_TOKENS so every spawned agent starts lean.

Usage: dispatch_brief.py --role dev --feature F3 [--mission <mission.md>]
Exit 0 on success, 2 on an unknown role, feature or unreadable input.
"""

import argparse
import re
import sys
from pathlib import Path

import yaml

MAX_TOKENS = 1500
MAX_COMMAND_CHARS = 240
REPLY_LINES = 10
ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = ROOT / ".agent" / "agents"
ACTIVE_JSON = ROOT / ".agent" / "memory" / "project" / "missions" / "active.json"
MISSIONS_DIR = ROOT / ".agent" / "memory" / "project" / "missions"
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---", re.S)
ID_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,32}$")


def estimate_tokens(text: str) -> int:
    return (len(text.encode("utf-8")) + 3) // 4


def die(message: str) -> "None":
    print(f"dispatch_brief: {message}", file=sys.stderr)
    sys.exit(2)


def load_yaml(path: Path) -> dict:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        die(f"cannot read {path}: {type(exc).__name__}")
    if not isinstance(data, dict):
        die(f"{path} is not a mapping")
    return data


def load_mission(path: Path) -> dict:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        die(f"cannot read mission {path}: {type(exc).__name__}")
    match = FRONTMATTER.match(text)
    if not match:
        die(f"mission {path} has no frontmatter")
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError as exc:
        die(f"bad mission frontmatter in {path}: {type(exc).__name__}")
    if not isinstance(data, dict):
        die(f"mission {path} frontmatter is not a mapping")
    return data


def default_mission_path() -> Path:
    import json

    try:
        slug = json.loads(ACTIVE_JSON.read_text(encoding="utf-8")).get("slug", "")
    except (OSError, ValueError) as exc:
        die(f"no --mission given and active mission unreadable: {type(exc).__name__}")
    path = MISSIONS_DIR / f"{slug}.md"
    if not slug or not path.is_file():
        die("no --mission given and no active mission file found")
    return path


def find_feature(mission: dict, feature_id: str) -> dict:
    for feature in mission.get("features") or []:
        if isinstance(feature, dict) and str(feature.get("id")) == feature_id:
            return feature
    die(f"feature {feature_id} not found in mission")


def contract_parts(feature: dict) -> tuple[str, list[str], list[str]]:
    rel = str(feature.get("contract") or "")
    if not rel:
        return "", [], []
    contract = load_yaml(ROOT / rel)
    goldens = [str(g) for g in contract.get("goldens") or []]
    checks = ((contract.get("assertions") or {}).get("checks")) or []
    commands = []
    for check in checks:
        if isinstance(check, dict) and check.get("command"):
            cmd = " ".join(str(check["command"]).split())
            commands.append(f"{check.get('id', '-')}: {cmd[:MAX_COMMAND_CHARS]}")
    return rel, goldens, commands


def render(role: str, feature_id: str, task: str, contract: str, goldens: list[str],
           commands: list[str], dropped: int) -> str:
    lines = [f"# Brief: {role} on {feature_id}", "", "## Task", task, "", "## Files to read"]
    lines += [f"- {contract}"] if contract else []
    lines += [f"- {g}" for g in goldens] or ([] if contract else ["- (none listed)"])
    lines += ["", "## Acceptance (all must exit 0)"]
    lines += [f"- {c}" for c in commands] or ["- (none listed)"]
    if dropped:
        lines.append(f"- ... {dropped} more in the contract")
    lines += [
        "", "## Result",
        f"Write your full result to .agent/memory/scratch/{role}-{feature_id}-result.md.",
        "", "## Reply",
        f"Reply in at most {REPLY_LINES} lines: what changed, verdict, result path. No transcripts.",
    ]
    return "\n".join(lines) + "\n"


def fit(role: str, feature_id: str, task: str, contract: str, goldens: list[str],
        commands: list[str]) -> str:
    """Drop trailing acceptance commands, then goldens, until the brief fits MAX_TOKENS."""
    kept_cmds, kept_golds = list(commands), list(goldens)
    while True:
        brief = render(role, feature_id, task, contract, kept_golds, kept_cmds,
                       len(commands) - len(kept_cmds))
        if estimate_tokens(brief) <= MAX_TOKENS:
            return brief
        if len(kept_cmds) > 1:
            kept_cmds.pop()
        elif kept_golds:
            kept_golds.pop()
        else:
            return brief[: MAX_TOKENS * 4]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--role", required=True)
    parser.add_argument("--feature", required=True)
    parser.add_argument("--mission", help="mission .md path (default: active mission)")
    args = parser.parse_args()

    if not ID_PATTERN.match(args.role) or not (AGENTS_DIR / f"{args.role}.md").is_file():
        die(f"unknown role '{args.role}'")
    if not ID_PATTERN.match(args.feature):
        die(f"invalid feature id '{args.feature}'")
    mission_path = Path(args.mission) if args.mission else default_mission_path()
    if not mission_path.is_absolute():
        mission_path = ROOT / mission_path
    feature = find_feature(load_mission(mission_path), args.feature)
    task = " ".join(str(feature.get("inline_brief") or feature.get("name") or "").split())
    if not task:
        die(f"feature {args.feature} has no inline_brief or name")
    contract, goldens, commands = contract_parts(feature)
    sys.stdout.write(fit(args.role, args.feature, task, contract, goldens, commands))
    return 0


if __name__ == "__main__":
    sys.exit(main())

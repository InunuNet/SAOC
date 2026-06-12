#!/usr/bin/env python3
"""Headless onboarding CLI — configures Athanor project without interactive prompts."""

import argparse
import json
import os
import re
import subprocess
import sys


def build_soul_content(agent_name: str, role: str, soul_persona: str) -> str:
    if soul_persona:
        return soul_persona
    return (
        f"# Soul: {agent_name}\n"
        f"\n"
        f"**Name**: {agent_name}\n"
        f"**Role**: {role}\n"
        f"\n"
        f"You are {agent_name}, the {role} and primary agent for this project. "
        f"You are direct, technically competent, and bias toward action. "
        f"You follow the Athanor workflow chain strictly: "
        f"architect -> dev -> qa -> docs -> gate -> maintainer.\n"
        f"\n"
        f"This template establishes the minimum viable identity for headless onboarding; "
        f"the user may refine it later.\n"
    )


def build_user_content(user_context: str) -> str:
    if user_context:
        return user_context
    return (
        "# User Profile\n"
        "\n"
        "**Name**: User\n"
        "**Role**: Project owner\n"
        "\n"
        "Communication preferences:\n"
        "- Concise, technical, BLUF-style responses\n"
        "- Bullets over prose\n"
        "- No unsolicited apologies or filler\n"
        "\n"
        "This file was populated by the headless onboarder. "
        "Refine it once the user's actual identity and preferences are known.\n"
    )


def patch_profile(profile_path: str, project_name: str, agent_name: str, role: str) -> None:
    if os.path.exists(profile_path):
        with open(profile_path, "r") as fh:
            data = json.load(fh)
    else:
        data = {}

    data["project_name"] = project_name
    data["onboarding_complete"] = True

    if "identity" not in data or not isinstance(data["identity"], dict):
        data["identity"] = {}
    data["identity"]["agent_name"] = agent_name
    data["identity"]["project_role"] = role

    with open(profile_path, "w") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
        fh.write("\n")


def patch_goals(goals_path: str, mission_text: str) -> None:
    if os.path.exists(goals_path):
        with open(goals_path, "r") as fh:
            content = fh.read()
    else:
        content = "# Goals\n\n## Mission\n\n"

    # Replace only the first ## Mission section body up to next ## heading or EOF.
    # The canonical form is exactly: "## Mission\n\n<mission_text>\n"
    # We match the heading line plus any content following it (until next ## section or EOF).
    pattern = re.compile(
        r"## Mission[^\n]*\n.*?(?=\n## |\Z)",
        re.DOTALL,
    )
    replacement = "## Mission\n\n" + mission_text
    new_content, count = pattern.subn(replacement, content, count=1)
    if count == 0:
        # No existing Mission section — append one.
        new_content = content.rstrip("\n") + "\n\n## Mission\n\n" + mission_text + "\n"
    else:
        # Ensure file ends with a single newline.
        if not new_content.endswith("\n"):
            new_content += "\n"

    with open(goals_path, "w") as fh:
        fh.write(new_content)


def run_onboard_fill() -> None:
    """Call onboard_fill.py as a subprocess; ignore errors if AGENTS.md is absent."""
    try:
        subprocess.run(
            [sys.executable, "execution/onboard_fill.py"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Headless Athanor onboarding — no interactive prompts.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Required flags
    parser.add_argument("--project-name", required=True, help="Project name")
    parser.add_argument("--agent-name", required=True, help="Agent name (identity)")
    parser.add_argument("--role", required=True, help="Agent project role")
    parser.add_argument("--mission", required=True, help="Mission statement for goals.md")

    # Optional override flags
    parser.add_argument(
        "--soul-persona",
        default="",
        help="Full soul.md content (default: generated from agent-name + role)",
    )
    parser.add_argument(
        "--user-context",
        default="",
        help="Full user.md content (default: generic placeholder)",
    )
    parser.add_argument(
        "--profile-path",
        default=".agent/profile.json",
        help="Path to profile.json (default: .agent/profile.json)",
    )
    parser.add_argument(
        "--soul-path",
        default=".agent/identity/soul.md",
        help="Path to soul.md (default: .agent/identity/soul.md)",
    )
    parser.add_argument(
        "--user-path",
        default=".agent/identity/user.md",
        help="Path to user.md (default: .agent/identity/user.md)",
    )
    parser.add_argument(
        "--goals-path",
        default=".agent/memory/project/goals.md",
        help="Path to goals.md (default: .agent/memory/project/goals.md)",
    )
    parser.add_argument(
        "--workspace-path",
        default="WORKSPACE",
        help="Path to WORKSPACE file (default: WORKSPACE)",
    )

    args = parser.parse_args()

    # Ensure parent directories exist for override paths.
    for path in (args.profile_path, args.soul_path, args.user_path, args.goals_path):
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)

    # 1. Patch profile.json — preserve all existing keys.
    patch_profile(args.profile_path, args.project_name, args.agent_name, args.role)

    # 2. Write soul.md.
    soul_content = build_soul_content(args.agent_name, args.role, args.soul_persona)
    with open(args.soul_path, "w") as fh:
        fh.write(soul_content)

    # 3. Write user.md.
    user_content = build_user_content(args.user_context)
    with open(args.user_path, "w") as fh:
        fh.write(user_content)

    # 4. Patch goals.md Mission section.
    patch_goals(args.goals_path, args.mission)

    # 5. Write WORKSPACE file.
    with open(args.workspace_path, "w") as fh:
        fh.write(args.project_name + "\n")

    # 6. Run onboard_fill.py (best-effort; errors ignored if AGENTS.md absent).
    run_onboard_fill()

    # 7. Confirm success.
    print(f"Onboarding complete: {args.project_name}")
    sys.exit(0)


if __name__ == "__main__":
    main()

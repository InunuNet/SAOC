#!/usr/bin/env python3
"""
post_update.py — Post-update fix logic for Athanor template updates.

This script is copied to downstream projects by `make update-template` and is
called by the Makefile after all rsync steps complete. By distributing this
script, improvements to the post-update logic propagate on the same run that
copies it.

Usage:
    python3 execution/post_update.py <target_dir> <version>
"""

import json
import os
import sys


def fix_gitignore(target_dir: str) -> None:
    """Ensure required .gitignore entries exist."""
    gitignore_path = os.path.join(target_dir, ".gitignore")
    required_entries = [
        "pulse.log",
        ".agent/memory/brain/",
        ".agent/memory/project/inbox/archive/",
        ".agent/memory/project/inbox/*.txt",
        ".claude/scheduled_tasks.lock",
    ]
    for entry in required_entries:
        present = False
        if os.path.exists(gitignore_path):
            with open(gitignore_path) as f:
                lines = f.read().splitlines()
            present = entry in lines
        if not present:
            with open(gitignore_path, "a") as f:
                f.write(f"\n{entry}\n")
            print(f"  Added .gitignore: {entry}")


def wire_autonomy_hook(target_dir: str) -> None:
    """Wire check_autonomy.sh into settings.json PreToolUse hooks (idempotent)."""
    hook_file = os.path.join(target_dir, "execution", "hooks", "check_autonomy.sh")
    if not os.path.exists(hook_file):
        print(
            "  warn check_autonomy.sh not found — hook wiring skipped"
            " (run init.sh to provision)"
        )
        return

    settings_path = os.path.join(target_dir, ".claude", "settings.json")
    hook_command = "bash execution/hooks/check_autonomy.sh"

    if not os.path.exists(settings_path):
        print(
            f"  warn {settings_path} not found — hook wiring skipped"
            " (run make sync to create it)"
        )
        return

    try:
        with open(settings_path) as f:
            settings = json.load(f)
    except Exception as e:
        print(f"  warn settings.json parse error, hook wiring skipped: {e}")
        return

    hooks = settings.setdefault("hooks", {})
    pretool = hooks.setdefault("PreToolUse", [])

    changed = False
    for matcher in ["Write", "Edit", "Bash"]:
        entry = next((e for e in pretool if e.get("matcher") == matcher), None)
        if entry is None:
            entry = {"matcher": matcher, "hooks": []}
            pretool.append(entry)

        existing_cmds = [h.get("command", "") for h in entry.get("hooks", [])]
        if not any("check_autonomy.sh" in cmd for cmd in existing_cmds):
            entry["hooks"].append({"type": "command", "command": hook_command})
            changed = True

    if changed:
        with open(settings_path, "w") as f:
            json.dump(settings, f, indent=2)
        print("  ok wired check_autonomy.sh into PreToolUse hooks")
    else:
        print("  ok check_autonomy.sh already wired")


def update_profile(target_dir: str, version: str) -> None:
    """Update template_version in profile.json and add autonomy key if missing."""
    profile_path = os.path.join(target_dir, ".agent", "profile.json")
    if not os.path.exists(profile_path):
        print("  warn profile.json not found — skipping template_version update")
        return

    try:
        with open(profile_path) as f:
            profile = json.load(f)
        profile["template_version"] = version
        if "autonomy" not in profile:
            profile["autonomy"] = {"level": "medium"}
        with open(profile_path, "w") as f:
            json.dump(profile, f, indent=2)
        print(f"  ok Updated profile.json template_version to {version}")
    except Exception as e:
        print(f"  warn profile.json update skipped: {e}")


def remove_pulse_scripts(target_dir: str) -> None:
    """Remove obsolete Pulse scripts from the registry."""
    registry_dir = os.path.join(target_dir, ".agent", "pulse", "registry")
    obsolete = ["auto_update.sh", "auto_fix_issues.sh"]
    for fname in obsolete:
        fpath = os.path.join(registry_dir, fname)
        if os.path.exists(fpath):
            os.remove(fpath)
            print(f"  Removed obsolete Pulse script: {fname}")


def check_agents_md_placeholders(target_dir: str) -> None:
    """Warn if AGENTS.md still contains unfilled {{PLACEHOLDER}} tokens."""
    agents_md = os.path.join(target_dir, "AGENTS.md")
    if not os.path.exists(agents_md):
        return
    with open(agents_md) as f:
        content = f.read()
    # Case-insensitive check for {{...}} pattern
    import re
    if re.search(r"\{\{[A-Za-z_]+\}\}", content, re.IGNORECASE):
        print("")
        print(
            "  warn AGENTS.md still contains unfilled placeholders"
            " ({{AGENT_NAME}}, {{PROJECT_ROLE}})."
        )
        print("       Run /onboard or manually set the identity line.")


def main(target_dir: str, version: str) -> None:
    """Run all post-update fixes in order."""
    print("[Gap 1] Ensuring .gitignore entries...")
    fix_gitignore(target_dir)

    print("[Gap 3] Updating profile.json template_version...")
    update_profile(target_dir, version)

    print("[Gap 4] Wiring check_autonomy.sh into PreToolUse hooks...")
    wire_autonomy_hook(target_dir)

    print("[Gap 6] Removing obsolete Pulse scripts...")
    remove_pulse_scripts(target_dir)

    print("[Gap 5] Checking AGENTS.md for unfilled placeholders...")
    check_agents_md_placeholders(target_dir)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <target_dir> <version>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])

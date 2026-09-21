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


AUTOCOMPACT_WINDOW_DEFAULT = 300000


def seed_autocompact_window(target_dir: str, settings_path: str | None = None) -> None:
    """Seed the auto-compact window as a SETTINGS KEY, not an env var (#1430).

    The env var CLAUDE_CODE_AUTO_COMPACT_WINDOW sits at the top of the
    auto-compact precedence chain (env var -> --autocompact flag ->
    autoCompactWindow settings key -> model default), so setting it there
    makes the /autocompact command inert: the CLI answers "is set and takes
    precedence. Unset it to change this setting here." Those env keys are
    stripped by the manifest retractions; this restores the same default
    through the settings key, which holds a default while leaving
    /autocompact free to override it interactively.

    Documented as an INTEGER token count from 100000 to 1000000 -- a string
    like "300k" is not the documented type ("500k" reads as 500 and clamps to
    the minimum), so the value is written as a number.

    Idempotent, and deliberately NON-clobbering: an operator who has already
    chosen a window keeps it. Only a missing key is seeded.

    settings_path exists for testability and defaults to the real location.
    The autonomy floor denies writing ANY path matching */.claude/settings.json
    -- throwaway sandbox fixtures included -- so without an injectable path
    this function could not be exercised by a golden at all, and a settings
    writer that cannot be tested is one that gets verified by reading it.
    """
    if settings_path is None:
        settings_path = os.path.join(target_dir, ".claude", "settings.json")
    if not os.path.exists(settings_path):
        print("  warn settings.json not found — autoCompactWindow seed skipped")
        return

    try:
        with open(settings_path) as f:
            settings = json.load(f)
    except Exception as e:
        print(f"  warn settings.json parse error, autoCompactWindow seed skipped: {e}")
        return

    if "autoCompactWindow" in settings:
        print(f"  ok autoCompactWindow already set ({settings['autoCompactWindow']!r}) — left alone")
        return

    settings["autoCompactWindow"] = AUTOCOMPACT_WINDOW_DEFAULT
    try:
        with open(settings_path, "w") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        print(f"  warn autoCompactWindow seed write failed: {e}")
        return
    print(f"  ok seeded autoCompactWindow={AUTOCOMPACT_WINDOW_DEFAULT} (/autocompact can still override)")


STATUSLINE_COMMAND = "python3 execution/statusline.py"


def wire_statusline(target_dir: str, settings_path: str | None = None) -> None:
    """Point the project's own settings.json at the harness statusline.

    Statusline config is deliberately PROJECT-scoped: each workspace renders
    its own project name, its own backlog, its own mission and its own quota
    mirror, so a single global entry would show one project's state inside
    every other one.

    Replaces the retired execution/hooks/statusline.sh, which shipped a
    hardcoded debug write into a SIBLING project's directory and read quota
    from a LifeOS/PAI-only path under $HOME, rendering "?" everywhere else.

    Idempotent and non-clobbering: a project that has chosen its own
    statusline keeps it. Only a missing or superseded entry is written.
    """
    if settings_path is None:
        settings_path = os.path.join(target_dir, ".claude", "settings.json")
    script = os.path.join(target_dir, "execution", "statusline.py")
    if not os.path.exists(script):
        print("  warn execution/statusline.py not found — statusline wiring skipped")
        return
    if not os.path.exists(settings_path):
        print("  warn settings.json not found — statusline wiring skipped")
        return

    try:
        with open(settings_path) as f:
            settings = json.load(f)
    except Exception as e:
        print(f"  warn settings.json parse error, statusline wiring skipped: {e}")
        return

    current = settings.get("statusLine")
    current_cmd = current.get("command", "") if isinstance(current, dict) else ""
    # Supersede only the retired shell hook; anything else is the operator's.
    if current_cmd and "statusline.sh" not in current_cmd:
        print(f"  ok statusLine already set ({current_cmd!r}) — left alone")
        return

    settings["statusLine"] = {"type": "command", "command": STATUSLINE_COMMAND}
    try:
        with open(settings_path, "w") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        print(f"  warn statusline wiring write failed: {e}")
        return
    verb = "replaced retired statusline.sh with" if current_cmd else "wired"
    print(f"  ok {verb} {STATUSLINE_COMMAND}")


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

    print("[Gap 7] Seeding autoCompactWindow settings key (#1430)...")
    seed_autocompact_window(target_dir)

    print("[Gap 8] Wiring project-scoped statusline...")
    wire_statusline(target_dir)

    print("[Gap 6] Removing obsolete Pulse scripts...")
    remove_pulse_scripts(target_dir)

    print("[Gap 5] Checking AGENTS.md for unfilled placeholders...")
    check_agents_md_placeholders(target_dir)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <target_dir> <version>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])

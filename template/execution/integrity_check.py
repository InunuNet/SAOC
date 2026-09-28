#!/usr/bin/env python3
"""integrity_check.py — absolute state check, for providers no hook can bind.

TWO FAILURES, ONE FIX.

1. The autonomy floor is a Claude Code PreToolUse hook. `codex.json`,
   `opencode.json` and `antigravity.json` all declare `supports_hooks: false`,
   and `.grok/hooks/` has no PreToolUse entry -- so of six providers exactly
   two can be bound, and only one is. Prevention cannot be made
   provider-neutral: a provider with no interception point cannot be
   intercepted, and a floor that binds only the honest agent is a crutch, not
   a wall (Brad, 2026-09-21).

2. Delta checks cannot see a baseline that is already wrong. mumbl-ai-f0 spent
   an evening verifying "hooks: 17 -> 17" across three update runs and reported
   the file intact; 17 was already the damaged state, fifteen registrations
   having been deleted before the run being measured. Preserving what remains
   is not the same as losing nothing, and no before/after comparison can tell
   those two apart.

What both leave standing is DETECTION, stated in absolute terms. This does not
ask what changed since last time; it asks what should be here, counts what is,
and names the difference. It runs from `make audit` and from the boot path, so
it reaches a Codex or Antigravity session exactly as it reaches this one --
they cannot be stopped, but they can be told, and so can Brad.

It never blocks and never repairs. Detection that also mutates is how a
delta-checker becomes a second source of damage; `repair_hooks.py` does the
fixing, deliberately, when a human decides to run it.

Exit 0 when whole, 1 when something is missing (so a caller can branch).
"""
import argparse
import json
import sys
from pathlib import Path

SETTINGS_REL = Path(".claude/settings.json")
TEMPLATE_SETTINGS = Path("template/.claude/settings.json")
HOOK_DIR = Path("execution/hooks")
# High-water mark of every registration this workspace has ever held. See
# high_water() for why it only ever grows.
WATERMARK_REL = Path(".agent/memory/project/hook_watermark.json")


def high_water(root: Path, actual: dict[str, set[str]]) -> list[str]:
    """Names registrations this workspace once had and no longer has.

    The template inventory is not the whole answer, and mumbl-ai-f0 proved it
    on 2026-09-22: an update deleted their project-owned `block_cd.sh`
    registration, 32 -> 31, and the template check printed `ok` before AND
    after, because the 8 hooks the template expects were all still there. The
    checker built to catch "a delta cannot see an already-wrong baseline"
    shipped with "a template-scoped check cannot see the loss of a non-template
    hook" -- the same blind spot one level out. Most registrations in a mature
    project are project-owned, so most of what can be lost was invisible.

    The fix is a per-project expectation. This file is that: the union of every
    registration ever observed here. It GROWS on every run and never shrinks on
    its own, which is the whole design -- an auto-lowering watermark would
    ratify the damage on the very next run and reintroduce the original bug.
    A registration removed deliberately stays reported until someone edits it
    out of this file by hand, and that edit is the record of the decision.
    """
    path = root / WATERMARK_REL
    try:
        known = {e: set(v) for e, v in json.loads(path.read_text()).items()}
    except Exception:
        known = {}

    lost = [f"{event}: {script}"
            for event, scripts in sorted(known.items())
            for script in sorted(scripts)
            if script not in actual.get(event, set())]

    merged = {e: sorted(set(v) | known.get(e, set())) for e, v in actual.items()}
    for event, scripts in known.items():
        merged.setdefault(event, sorted(scripts))
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(merged, indent=2, sort_keys=True) + "\n")
    except Exception:
        pass  # reporting is the job; a read-only tree must not fail the check
    return lost


def scripts_named(command: str) -> set[str]:
    return {Path(tok).name for tok in
            command.replace("'", " ").replace('"', " ").split()
            if tok.endswith((".sh", ".py"))}


def registered(settings_path: Path) -> dict[str, set[str]]:
    """{event: {script name, ...}} — what this file actually registers."""
    try:
        doc = json.loads(settings_path.read_text())
    except Exception:
        return {}
    out: dict[str, set[str]] = {}
    for event, groups in (doc.get("hooks") or {}).items():
        if not isinstance(groups, list):
            continue
        for group in groups:
            if not isinstance(group, dict):
                continue
            for entry in group.get("hooks") or []:
                cmd = entry.get("command", "") if isinstance(entry, dict) else ""
                out.setdefault(event, set()).update(scripts_named(cmd))
    return out


def check(root: Path, expected_source: Path) -> int:
    settings = root / SETTINGS_REL
    if not settings.is_file():
        print(f"  ABSENT  {SETTINGS_REL} — this workspace registers no hooks")
        return 1

    expected = registered(expected_source)
    actual = registered(settings)
    if not expected:
        print(f"  no expected inventory at {expected_source} — cannot check "
              f"absolutely, so reporting nothing rather than a false all-clear")
        return 0

    missing: list[str] = []
    for event, scripts in sorted(expected.items()):
        for script in sorted(scripts):
            if script in actual.get(event, set()):
                continue
            if not (root / HOOK_DIR / script).is_file():
                continue  # the harness no longer ships it; not a gap
            missing.append(f"{event}: {script}")

    lost = high_water(root, actual)

    exp_total = sum(len(v) for v in expected.values())
    act_total = sum(len(v) for v in actual.values())
    print(f"  hooks: {act_total} registered, {exp_total} expected by the "
          f"template")

    if not missing and not lost:
        print("  ok every template hook is registered, and nothing this "
              "workspace once had is gone")
        return 0

    if missing:
        print(f"  MISSING {len(missing)} registration(s) the template expects:")
        for line in missing:
            print(f"    - {line}")
    if lost:
        print(f"  LOST {len(lost)} registration(s) this workspace used to have:")
        for line in lost:
            print(f"    - {line}")
        print(f"  Recorded in {WATERMARK_REL}, which only ever grows. If one of")
        print("  these was removed on purpose, delete it from that file — by")
        print("  hand, so the removal is a decision someone made and not a")
        print("  number that quietly moved.")
    print("  This is an ABSOLUTE count, not a delta: a workspace sitting at a")
    print("  silently reduced number passes every before/after check forever.")
    print("  Repair with: python3 execution/repair_hooks.py --apply")
    return 1


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".", help="workspace to check")
    ap.add_argument("--expected", default=None,
                    help="settings file holding the expected inventory "
                         "(default: template/.claude/settings.json under root, "
                         "else the harness copy beside this script)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if args.expected:
        expected_source = Path(args.expected)
    else:
        local = root / TEMPLATE_SETTINGS
        expected_source = local if local.is_file() else (
            Path(__file__).resolve().parent.parent / TEMPLATE_SETTINGS)

    print(f"INTEGRITY {root.name}")
    sys.exit(check(root, expected_source))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""repair_hooks.py — put back the hook registrations the 3.8.3 overlay ate.

WHAT HAPPENED. update_template.py's settings merge replaced the whole hooks
block instead of merging it, so applying 3.8.3 deleted every registration the
template did not itself ship. Measured shape: 77 deletions against 5
insertions, 16 registrations down to 8, with SessionEnd removed entirely --
which is the one that matters, because a session then ends without persisting
memory and nobody notices for days. The overlay was fixed in 6afb6870 and the
ownership rule corrected in 099ac075, so taking the update again is safe. The
damage already done to each workspace is not undone by any of that: it has to
be repaired per project, from that project's own history.

HOW THIS REPAIRS. Git is the only trustworthy record of what a workspace had
before the overlay ran, so this reads the project's own history of
.claude/settings.json, finds the revision with the most registrations, and
restores the ones that went missing.

It is strictly ADDITIVE. Nothing currently registered is removed, reordered,
or rewritten, and a registration is only restored when the script it names
still exists on disk -- a dangling registration errors on every tool call and
is worse than the gap it fills. If a hook was deliberately retired since, it
stays retired: its script is gone, so it is not restored.

Additive is the whole safety argument. The failure being repaired was a merge
that felt entitled to delete, and a repair that can also delete would be the
same bug wearing a rescue jacket.

Usage:
    python3 execution/repair_hooks.py                    # report on ~/ai/*
    python3 execution/repair_hooks.py --apply            # repair them
    python3 execution/repair_hooks.py --root <path> ...  # specific projects
"""
import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

SETTINGS_REL = Path(".claude/settings.json")
DEFAULT_SCAN = Path.home() / "ai"
# Ten revisions reaches comfortably past the 3.8.x updates that caused this
# without reaching back into harness eras whose conventions are gone. Deeper
# history holds hooks that were retired on purpose, and a repair that drags
# those back is not a repair.
HISTORY_DEPTH = 10


def git(root: Path, *args: str) -> str:
    proc = subprocess.run(["git", *args], cwd=root, capture_output=True,
                          text=True, timeout=60)
    return proc.stdout if proc.returncode == 0 else ""


def registrations(settings: dict) -> dict:
    """{event: [entry, ...]} flattened one level, for counting and diffing."""
    out = {}
    for event, groups in (settings.get("hooks") or {}).items():
        if not isinstance(groups, list):
            continue
        for group in groups:
            if isinstance(group, dict):
                out.setdefault(event, []).extend(group.get("hooks") or [])
    return out


def total(regs: dict) -> int:
    return sum(len(v) for v in regs.values())


def entry_key(entry: dict) -> str:
    """The command text, for display."""
    return (entry or {}).get("command", "") if isinstance(entry, dict) else str(entry)


def identity(command: str) -> str:
    """What a registration IS, for deciding whether it is already present.

    Deliberately NOT the command string. The same hook has been registered in
    two spellings over the harness's life -- `[ -f X ] && bash X` and the
    later `[ -f X ] || exit 0; bash X` -- and history holds both. Keyed on the
    exact text, a repair restores the old spelling alongside the live one and
    the hook fires twice: a wrap-up that writes memory twice, a token log that
    double-counts. Keyed on the SCRIPT, the variants collapse to one thing
    that either is or is not registered, which is the actual question.
    """
    named = scripts_in(command)
    if named:
        # set(), not list: the guarded spelling names the same script twice
        # ("[ -f X ] || exit 0; bash X") and the bare one names it once, so a
        # list here makes two spellings of one hook look like two hooks --
        # which is the exact double-registration this function exists to stop.
        return "|".join(sorted({Path(tok).name for tok in named}))
    return " ".join(command.split())[:120]


def scripts_in(command: str) -> list[str]:
    return [tok for tok in command.replace("'", " ").replace('"', " ").split()
            if tok.endswith((".sh", ".py"))]


def script_present(command: str, root: Path) -> bool:
    """True when every script the command names still exists in the project.

    A registration whose script is gone fires an error on every tool call, so
    restoring one trades a silent gap for a loud break. Commands that name no
    script at all (an inline shell one-liner) are taken at face value.
    """
    named = scripts_in(command)
    if not named:
        return True
    for tok in named:
        candidate = Path(tok)
        if candidate.is_absolute():
            if not candidate.is_file():
                return False
        elif not (root / tok).is_file():
            return False
    return True


def best_historical(root: Path) -> tuple[str, dict] | None:
    """Every hook this project has registered, newest spelling of each.

    Walks history newest-first and keeps the FIRST spelling it sees of each
    hook, so a restored registration gets the project's most recent form of
    that command rather than a form retired two updates ago. Scanning the
    whole window instead of one snapshot also catches a project that lost
    hooks across two separate bad updates -- no single revision holds them
    all in that case.

    Resurrecting a deliberately-retired hook is the risk this shape carries.
    script_present() is what holds it: retiring a hook removes its script, and
    a hook whose script is gone is never restored.
    """
    log = git(root, "log", "--format=%H", f"-{HISTORY_DEPTH}", "--",
              str(SETTINGS_REL))
    shas = log.split()
    if not shas:
        return None
    seen: set[str] = set()
    union: dict[str, list] = {}
    for sha in shas:
        blob = git(root, "show", f"{sha}:{SETTINGS_REL}")
        if not blob:
            continue
        try:
            data = json.loads(blob)
        except Exception:
            continue
        for event, entries in registrations(data).items():
            for entry in entries:
                if not entry_key(entry).strip():
                    continue  # a registration with no command is junk
                ident = f"{event}::{identity(entry_key(entry))}"
                if ident in seen:
                    continue
                seen.add(ident)
                union.setdefault(event, []).append(entry)
    return (shas[0], union) if union else None


def repair(root: Path, apply: bool) -> bool:
    """Report, and optionally restore. True when the project needed work."""
    path = root / SETTINGS_REL
    if not path.is_file() or not (root / ".git").is_dir():
        return False
    try:
        current_doc = json.loads(path.read_text())
    except Exception as exc:
        print(f"  {root.name}: settings.json will not parse ({exc}) — skipped")
        return False

    current = registrations(current_doc)
    hist = best_historical(root)
    if hist is None:
        return False
    sha, historical = hist
    if total(historical) <= total(current):
        return False

    have = {ev: {identity(entry_key(e)) for e in entries}
            for ev, entries in current.items()}
    missing, dangling, inline = {}, [], []
    for event, entries in historical.items():
        for entry in entries:
            cmd = entry_key(entry)
            ident = identity(cmd)
            if ident in have.get(event, set()):
                continue
            if not scripts_in(cmd):
                # An inline one-liner names no script, so nothing on disk can
                # confirm it is still wanted -- and several in history encode
                # conventions that have since changed (old MEMORY paths, a
                # brain call the boot hook now makes itself). Reinstating one
                # silently re-imposes a dead convention, so these are
                # reported and left for a person to judge.
                inline.append(f"{event}: {cmd[:66]}")
                continue
            if not script_present(cmd, root):
                dangling.append(f"{event}: {cmd[:70]}")
                continue
            # Claim it now, so two historical spellings of the same hook
            # cannot both be restored in this pass either.
            have.setdefault(event, set()).add(ident)
            missing.setdefault(event, []).append(entry)

    if not missing:
        return False

    print(f"\n{root.name}: {total(current)} registrations on disk, "
          f"{total(historical)} distinct hooks across history (tip {sha[:8]})")
    for event, entries in sorted(missing.items()):
        for entry in entries:
            print(f"  + {event:18} {entry_key(entry)[:78]}")
    for line in dangling:
        print(f"  . skipped, script gone: {line}")
    for line in inline:
        print(f"  . skipped, inline hook, judge by hand: {line}")

    if not apply:
        return True

    doc = json.loads(json.dumps(current_doc))
    hooks = doc.setdefault("hooks", {})
    for event, entries in missing.items():
        groups = hooks.setdefault(event, [])
        if groups and isinstance(groups[0], dict):
            groups[0].setdefault("hooks", []).extend(entries)
        else:
            groups.append({"matcher": "*", "hooks": list(entries)})

    rendered = json.dumps(doc, indent=2) + "\n"
    json.loads(rendered)  # never write something that will not parse back

    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup = path.with_suffix(f".json.pre-repair-{stamp}")
    shutil.copy2(path, backup)
    path.write_text(rendered)
    print(f"  -> restored {total(missing)}; backup {backup.name}")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="write the repair (default: report only)")
    ap.add_argument("--root", action="append", default=[],
                    help="a project to check; repeatable (default: ~/ai/*)")
    args = ap.parse_args()

    roots = [Path(r).expanduser() for r in args.root]
    if not roots:
        if not DEFAULT_SCAN.is_dir():
            print(f"{DEFAULT_SCAN} not found — pass --root", file=sys.stderr)
            sys.exit(2)
        roots = sorted(p for p in DEFAULT_SCAN.iterdir() if p.is_dir())

    touched = sum(1 for r in roots if repair(r, args.apply))
    if not touched:
        print("No project is missing registrations its history recorded.")
    elif not args.apply:
        print(f"\n{touched} project(s) need repair. Re-run with --apply.")
    else:
        print(f"\nRepaired {touched} project(s). Restart affected sessions.")


if __name__ == "__main__":
    main()

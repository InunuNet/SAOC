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

INLINE HOOKS. A one-liner names no script, so nothing on disk proves it is
still wanted. It is restored only when the LAST GOOD revision -- the newest
one holding more registrations than the file does now, i.e. the state just
before the damage -- still carried it. Inline hooks known only to older
history are reported for a person to judge.

update_template.py runs this after every --apply: the FIRST pass of an update
runs the OLD updater already loaded in memory, and pre-6afb6870 code replaces
the hooks block wholesale before the new updater can intervene. The repair is
what the new code can still do about it.

Usage:
    python3 execution/repair_hooks.py                    # report on this project
    python3 execution/repair_hooks.py --apply            # repair it
    python3 execution/repair_hooks.py --root <path> ...  # other projects, by name
"""
import argparse
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

SETTINGS_REL = Path(".claude/settings.json")
BACKUP_DIR = Path(".agent/memory/scratch")
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
    """{event: [(matcher, entry), ...]} flattened one level.

    The matcher travels with the entry: restoring a `Write`-only guard into a
    `Bash` group would make it fire on the wrong tool and never on its own.
    """
    out = {}
    for event, groups in (settings.get("hooks") or {}).items():
        if not isinstance(groups, list):
            continue
        for group in groups:
            if isinstance(group, dict):
                matcher = group.get("matcher", "")
                out.setdefault(event, []).extend(
                    (matcher, e) for e in (group.get("hooks") or []))
    return out


def total(regs: dict) -> int:
    return sum(len(v) for v in regs.values())


def entry_key(entry: dict) -> str:
    """The command text, for display."""
    return (entry or {}).get("command", "") if isinstance(entry, dict) else str(entry)


def identity(event: str, matcher: str, command: str, shipped: dict) -> str:
    """What a registration IS, for deciding whether it is already present.

    Deliberately NOT the command string. The same hook has been registered in
    two spellings over the harness's life -- `[ -f X ] && bash X` and the
    later `[ -f X ] || exit 0; bash X` -- and history holds both. Keyed on the
    exact text, a repair restores the old spelling alongside the live one and
    the hook fires twice: a wrap-up that writes memory twice, a token log that
    double-counts. Keyed on the SCRIPT, the variants collapse to one thing
    that either is or is not registered, which is the actual question.

    Two keys, because ownership differs (Codex QA, 2026-09-29):
    - a script the TEMPLATE ships is keyed on event + basename, matcher
      ignored: the template consolidates its own matchers between versions
      (check_autonomy's Bash, Write, Edit became `Bash|Edit|Write`), so an
      old matcher is a respelling, not a second hook;
    - a project's own script is keyed on event + matcher + normalised path,
      so scripts/hooks/guard.sh and execution/hooks/guard.sh stay distinct,
      and one script deliberately registered under two matchers is two hooks.
    """
    named = scripts_in(command)
    if named:
        # set(): the guarded spelling names the same script twice
        # ("[ -f X ] || exit 0; bash X") and the bare one names it once.
        paths = sorted({script_path(tok) for tok in named})
        if any(Path(p).name in shipped for p in paths):
            return f"{event}::" + "|".join(sorted({Path(p).name for p in paths}))
        return f"{event}::{matcher}::" + "|".join(paths)
    return f"{event}::{matcher}::" + " ".join(command.split())[:120]


def script_path(tok: str) -> str:
    """A script token as a project-relative path, whatever its spelling."""
    for prefix in ("$CLAUDE_PROJECT_DIR/", "${CLAUDE_PROJECT_DIR}/", "./"):
        if tok.startswith(prefix):
            tok = tok[len(prefix):]
    return tok


def template_hooks(root: Path) -> dict:
    """{script basename: {event, ...}} for every hook the template registers.

    Read from the project's delivered template/ copy. Empty when absent, which
    degrades to treating every script as the project's own.
    """
    try:
        doc = json.loads((root / "template" / SETTINGS_REL).read_text())
    except (OSError, ValueError):
        return {}
    shipped: dict = {}
    for event, pairs in registrations(doc).items():
        for _, entry in pairs:
            for tok in scripts_in(entry_key(entry)):
                shipped.setdefault(Path(tok).name, set()).add(event)
    return shipped


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


def best_historical(root: Path, current_total: int = 0, depth: int = HISTORY_DEPTH,
                    shipped: dict | None = None):
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
    log = git(root, "log", "--format=%H", f"-{depth}", "--",
              str(SETTINGS_REL))
    shas = log.split()
    if not shas:
        return None
    seen: set[str] = set()
    union: dict[str, list] = {}
    last_good: set[str] | None = None
    for sha in shas:
        blob = git(root, "show", f"{sha}:{SETTINGS_REL}")
        if not blob:
            continue
        try:
            data = json.loads(blob)
        except Exception:
            continue
        regs = registrations(data)
        idents = {identity(ev, m, entry_key(e), shipped or {})
                  for ev, pairs in regs.items() for m, e in pairs}
        if last_good is None and total(regs) > current_total:
            last_good = idents
        for event, pairs in regs.items():
            for matcher, entry in pairs:
                if not entry_key(entry).strip():
                    continue  # a registration with no command is junk
                ident = identity(event, matcher, entry_key(entry), shipped or {})
                if ident in seen:
                    continue
                seen.add(ident)
                union.setdefault(event, []).append((matcher, entry))
    return (shas[0], union, last_good or set()) if union else None


def repair(root: Path, apply: bool, depth: int = HISTORY_DEPTH) -> bool:
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
    shipped = template_hooks(root)
    hist = best_historical(root, total(current), depth, shipped)
    if hist is None:
        return False
    sha, historical, last_good = hist

    have = {identity(ev, m, entry_key(e), shipped)
            for ev, pairs in current.items() for m, e in pairs}
    missing, dangling, inline, moved = {}, [], [], []
    for event, pairs in historical.items():
        for matcher, entry in pairs:
            cmd = entry_key(entry)
            ident = identity(event, matcher, cmd, shipped)
            if ident in have:
                continue
            names = {Path(t).name for t in scripts_in(cmd)}
            if any(n in shipped and event not in shipped[n] for n in names):
                # The template ships this script under a different event now:
                # it MOVED the hook. Restoring the old event would run it twice.
                moved.append(f"{event}: {cmd[:70]}")
                continue
            if not scripts_in(cmd) and ident not in last_good:
                # An inline one-liner names no script, so nothing on disk can
                # confirm it is still wanted -- and several in older history
                # encode conventions that have since changed (old MEMORY
                # paths, a brain call the boot hook now makes itself). Only
                # the last good revision vouches for one; older ones are
                # reported and left for a person to judge.
                inline.append(f"{event}: {cmd[:66]}")
                continue
            if not script_present(cmd, root):
                dangling.append(f"{event}: {cmd[:70]}")
                continue
            # Claim it now, so two historical spellings of the same hook
            # cannot both be restored in this pass either.
            have.add(ident)
            missing.setdefault(event, []).append((matcher, entry))

    if not missing:
        return False

    print(f"\n{root.name}: {total(current)} registrations on disk, "
          f"{total(historical)} distinct hooks across history (tip {sha[:8]})")
    for event, pairs in sorted(missing.items()):
        for matcher, entry in pairs:
            print(f"  + {event:18} [{matcher}] {entry_key(entry)[:70]}")
    for line in dangling:
        print(f"  . skipped, script gone: {line}")
    for line in inline:
        print(f"  . skipped, inline hook, judge by hand: {line}")
    for line in moved:
        print(f"  . skipped, template moved it to another event: {line}")

    if not apply:
        return True

    doc = json.loads(json.dumps(current_doc))
    hooks = doc.setdefault("hooks", {})
    for event, pairs in missing.items():
        groups = hooks.setdefault(event, [])
        for matcher, entry in pairs:
            home = next((g for g in groups if isinstance(g, dict)
                         and g.get("matcher", "") == matcher), None)
            if home is None:
                home = {"matcher": matcher, "hooks": []}
                groups.append(home)
            home.setdefault("hooks", []).append(entry)

    rendered = json.dumps(doc, indent=2) + "\n"
    json.loads(rendered)  # never write something that will not parse back

    # The backup goes to gitignored scratch, not beside settings.json: the
    # updater runs this unattended, and a stray file in .claude/ is swept into
    # the operator's next `git add -A` (Codex QA, 2026-09-29).
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup = root / BACKUP_DIR / f"settings.json.pre-repair-{stamp}"
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup)
    path.write_text(rendered)
    print(f"  -> restored {total(missing)}; backup {backup.relative_to(root)}")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true",
                    help="write the repair (default: report only)")
    # Default is THIS project only. It used to scan every sibling workspace,
    # so a bare `--apply` wrote into all of them (reported by WOSA and SAOC
    # NOS Site, 2026-09-28) -- scope.md forbids exactly that.
    ap.add_argument("--root", action="append", default=[],
                    help="a project to check; repeatable (default: this one)")
    # update_template.py passes this. Only the last COMMITTED settings.json
    # is trusted -- the state before this update ran -- so a hook the operator
    # removed and committed earlier is never resurrected by an update.
    ap.add_argument("--last-commit", action="store_true",
                    help="restore only what the last committed settings.json held")
    args = ap.parse_args()

    roots = [Path(r).expanduser() for r in args.root] or [Path.cwd()]

    touched = sum(1 for r in roots if repair(r, args.apply, 1 if args.last_commit else HISTORY_DEPTH))
    if not touched:
        print("No project is missing registrations its history recorded.")
    elif not args.apply:
        print(f"\n{touched} project(s) need repair. Re-run with --apply.")
    else:
        print(f"\nRepaired {touched} project(s). Restart affected sessions.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""live_state.py — fail any test that writes the project's live memory.

    live_state.py snapshot <store>   record the guarded files into <store>
    live_state.py check <store>      exit 1 naming each changed file, and put
                                     the recorded content back
    live_state.py reset <store>      start a run with an empty restore ledger
    live_state.py report <store>     end of run: a banner naming every restore

The suite runs in the host checkout, so a test that forgets to sandbox itself
writes into that project's real mission and backlog. Alembic reported exactly
that on 2026-09-29: `make test` set a live milestone's gate_result to fail and
re-flowed its notes. A per-test guard names the offender and undoes the damage,
whichever test it is and however it got there.

A restore also undoes a REAL edit made by a session working in parallel
(JordanPumps 2026-10-20: a mission edit vanished mid-suite, and the one FAIL
line had scrolled away). Every restore therefore goes to a ledger, and
run_all.sh ends with a banner that names the file and where its replaced
content was kept.
"""
import json
import sys
import time
from pathlib import Path

GUARDED = (
    Path(".agent/memory/project/backlog.md"),
    Path(".agent/memory/project/missions"),
)


def guarded_files():
    for path in GUARDED:
        if path.is_dir():
            yield from sorted(p for p in path.iterdir() if p.is_file())
        elif path.is_file():
            yield path


def snapshot(store: Path) -> int:
    store.parent.mkdir(parents=True, exist_ok=True)
    state = {str(p): p.read_text(errors="surrogateescape") for p in guarded_files()}
    store.write_text(json.dumps(state))
    return 0


BANNER = "!" * 72


def ledger(store: Path) -> Path:
    return store.parent / "live_state_restored.log"


def note(store: Path, line: str) -> None:
    with open(ledger(store), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def reset(store: Path) -> int:
    ledger(store).unlink(missing_ok=True)
    return 0


def report(store: Path) -> int:
    try:
        lines = [ln for ln in ledger(store).read_text(encoding="utf-8").splitlines() if ln]
    except OSError:
        return 0
    if lines:
        print("")
        print(BANNER)
        print(f"!! LIVE PROJECT STATE WAS RESTORED {len(lines)} time(s) during this run.")
        print("!! If a session was editing these files while the suite ran, its")
        print("!! edit was undone. Copy the kept version back if it was real work:")
        for ln in lines:
            print(f"!!   {ln}")
        print(BANNER)
    return 0


def check(store: Path) -> int:
    before = json.loads(store.read_text())
    now = {str(p) for p in guarded_files()}
    # Nothing is ever lost: the content a restore replaces is kept first, and a
    # file that appeared is reported, never deleted. A live session writing its
    # own mission while the suite runs must not have that write destroyed by
    # the guard that exists to protect it (Codex QA, 2026-09-29).
    displaced = store.parent / "live_state_displaced"
    changed = []
    for name, text in before.items():
        path = Path(name)
        if path.is_file() and path.read_text(errors="surrogateescape") == text:
            continue
        if path.is_file():
            displaced.mkdir(parents=True, exist_ok=True)
            keep = displaced / f"{path.name}.{int(time.time())}"
            keep.write_bytes(path.read_bytes())
            print(f"  FAIL test wrote live project state: {name} "
                  f"(restored; the replaced content is kept at {keep})")
            note(store, f"{name} was restored; the version it replaced is at {keep}")
        else:
            print(f"  FAIL test deleted live project state: {name} (restored)")
            note(store, f"{name} was deleted during the run and restored")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, errors="surrogateescape")
        changed.append(name)
    for name in sorted(now - set(before)):
        print(f"  FAIL test created live project state: {name} (left in place)")
        changed.append(name)
    return 1 if changed else 0


def main(argv) -> int:
    commands = {"snapshot": snapshot, "check": check, "reset": reset, "report": report}
    if len(argv) != 3 or argv[1] not in commands:
        print(__doc__, file=sys.stderr)
        return 2
    return commands[argv[1]](Path(argv[2]))


if __name__ == "__main__":
    sys.exit(main(sys.argv))

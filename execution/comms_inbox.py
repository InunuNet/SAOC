#!/usr/bin/env python3
"""comms_inbox.py — the messages on this project's root comms.md addressed to it.

The board is the project ROOT comms.md (see .agent/rules/_core/comms.md). Boot
used to read .agent/memory/project/comms.md, retired on 2026-09-21, so a
peer's or the fleet's message was seen only if the agent went looking.

  boot    a short unread list for full_boot.sh (nothing when nothing is unread)
  show    the unread messages in full
  ack     mark read what `show` displayed (everything, when show was not run)

A message is a block headed `## [FROM -> TO] <date> — <subject>` ("->" or
"→"). It is addressed here when TO names this project (whole word, any case)
or FLEET, and it is not FROM this project. Read state lives in
.agent/memory/project/comms_seen.json; comms.md itself is never edited.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

BOARD = Path("comms.md")
SEEN = Path(".agent/memory/project/comms_seen.json")
SHOWN = Path(".agent/memory/project/comms_shown.json")
HEADER_MAX = 200
PROFILE = Path(".agent/profile.json")
BOOT_HEADERS = 5
HEADER = re.compile(r"^## \[(?P<frm>[^\]]*?)\s*(?:->|→)\s*(?P<to>[^\]]*)\]")


def project_name() -> str:
    try:
        name = json.loads(PROFILE.read_text(encoding="utf-8-sig")).get("project_name")
    except (OSError, ValueError, AttributeError):
        name = None
    return name if isinstance(name, str) and name.strip() else Path.cwd().name


def recipients(to: str) -> set:
    """TO split into whole recipients: "FLEET via Athanor, SAOC" -> fleet, athanor, saoc."""
    parts = re.split(r",|&|\+|/|\band\b|\bvia\b", to, flags=re.I)
    return {" ".join(p.split()).casefold() for p in parts if p.strip()}


def messages() -> list[dict]:
    """Every message on the board addressed to this project, oldest first."""
    try:
        lines = BOARD.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    except OSError:
        return []
    me = project_name()
    blocks, cur = [], None
    for ln in lines:
        if ln.startswith("## ["):
            m = HEADER.match(ln)
            cur = {"header": ln, "frm": m["frm"], "to": m["to"], "body": []} if m else None
            if cur:
                blocks.append(cur)
        elif cur is not None:
            cur["body"].append(ln)
    me_key = " ".join(me.split()).casefold()
    out, occurrences = [], {}
    for b in blocks:
        if " ".join(b["frm"].split()).casefold() == me_key:
            continue
        if not recipients(b["to"]) & {me_key, "fleet"}:
            continue
        text = "\n".join([b["header"], *b["body"]]).strip()
        # the Nth identical block is its own message: a repeat is news too
        n = occurrences[text] = occurrences.get(text, 0) + 1
        out.append({"header": b["header"], "text": text,
                    "id": hashlib.sha256(f"{n}\0{text}".encode()).hexdigest()})
    return out


def read_ids(path: Path, key: str):
    try:
        ids = json.loads(path.read_text(encoding="utf-8")).get(key, [])
    except (OSError, ValueError, AttributeError):
        return None
    return set(ids) if isinstance(ids, list) else None


def seen() -> set:
    return read_ids(SEEN, "seen") or set()


def unread() -> list[dict]:
    done = seen()
    return [m for m in messages() if m["id"] not in done]


def cmd_boot() -> int:
    new = unread()
    if new:
        print(f"--- COMMS: {len(new)} unread on comms.md ---")
        if len(new) > BOOT_HEADERS:
            print(f"  ... {len(new) - BOOT_HEADERS} older not listed")
        for m in new[-BOOT_HEADERS:]:
            h = m["header"]
            print(f"  {h if len(h) <= HEADER_MAX else h[:HEADER_MAX] + '…'}")
        print("Read them: python3 execution/comms_inbox.py show  "
              "then mark read: python3 execution/comms_inbox.py ack")
        print("---")
        print("")
    return 0


def cmd_show() -> int:
    new = unread()
    for m in new:
        print(m["text"])
        print("")
    # ack marks what was shown, not whatever arrived since
    SHOWN.parent.mkdir(parents=True, exist_ok=True)
    SHOWN.write_text(json.dumps({"shown": [m["id"] for m in new]}) + "\n", encoding="utf-8")
    return 0


def cmd_ack() -> int:
    """Mark read what `show` displayed; with no show since the last ack, everything."""
    shown = read_ids(SHOWN, "shown")
    ids = seen() | (shown if shown is not None else {m["id"] for m in messages()})
    SHOWN.unlink(missing_ok=True)
    SEEN.parent.mkdir(parents=True, exist_ok=True)
    SEEN.write_text(json.dumps({"seen": sorted(ids)}, indent=2) + "\n", encoding="utf-8")
    return 0


def main(argv) -> int:
    commands = {"boot": cmd_boot, "show": cmd_show, "ack": cmd_ack}
    if len(argv) != 2 or argv[1] not in commands:
        print(__doc__, file=sys.stderr)
        return 2
    if argv[1] == "boot":
        # boot output is folded into the session context: it never fails boot
        try:
            return cmd_boot()
        except Exception as e:  # noqa: BLE001
            print(f"comms_inbox: {type(e).__name__}", file=sys.stderr)
            return 0
    return commands[argv[1]]()


if __name__ == "__main__":
    sys.exit(main(sys.argv))

#!/usr/bin/env python3
"""Text another running session through herdr; fall back to the target's comms.md.

  msg.py who                       one line per running session: project, provider, status, pane
  msg.py send <project> <text>     deliver now (exit 0), queued on comms.md (3), error (1)
  msg.py fleet <text>              deliver to every running session except this one

Env: ATHANOR_FLEET_ROOT overrides the directory holding the sibling projects.
"""
import argparse
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_QUEUED = 3
MAX_ENVELOPE = 2000
ID_BYTES = 3
HERDR_TIMEOUT = 20
PANE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:_.-]*$")
BAD_NAMES = {"", ".", ".."}
ROOT = Path(__file__).resolve().parents[1]
LOG_PATH = ROOT / ".agent" / "memory" / "scratch" / "msg-log.jsonl"


class MsgError(Exception):
    """An expected failure: reported on stderr, exit 1."""


def own_project():
    """This session's address is its FOLDER name: that is how every other session resolves it.

    profile.json project_name is not used. A project copied from another keeps
    the source's project_name (SAOC NOS Site carried "SAOC"), so replies went to
    the wrong session.
    """
    return ROOT.name


def this_host():
    return os.environ.get("ATHANOR_HOST") or socket.gethostname().split(".")[0]


def local_target(address):
    """Strip a Project@host address to the project; refuse empty or other hosts."""
    name, sep, host = address.rpartition("@")
    if not sep:
        return address
    if not host.strip():
        raise MsgError(f"refused: address {address!r} has an empty host")
    if host.lower() != this_host().lower():
        raise MsgError(f"refused: {address!r} is on host {host!r}, not this host "
                       f"{this_host()!r}; remote delivery needs `herdr machine add` "
                       "run by the operator")
    return name


def fleet_root():
    env = os.environ.get("ATHANOR_FLEET_ROOT")
    return Path(env) if env else ROOT.parent


def herdr(*args):
    exe = shutil.which("herdr")
    if not exe:
        return None
    try:
        return subprocess.run([exe, *args], capture_output=True, text=True,
                              timeout=HERDR_TIMEOUT)
    except (OSError, subprocess.TimeoutExpired):
        return None


def list_agents():
    """Running sessions as dicts with project added; raises MsgError without herdr."""
    res = herdr("agent", "list")
    if res is None:
        raise MsgError("herdr is not available on PATH (or timed out); live delivery needs it")
    if res.returncode != 0:
        raise MsgError(f"herdr agent list failed (rc={res.returncode})")
    try:
        agents = json.loads(res.stdout)["result"]["agents"]
    except (ValueError, KeyError, TypeError):
        raise MsgError("herdr agent list returned unexpected output")
    if not isinstance(agents, list):
        agents = []
    out = []
    for a in agents:
        if not isinstance(a, dict):
            continue
        pane, cwd = a.get("pane_id"), a.get("cwd")
        if not isinstance(pane, str) or not PANE_RE.match(pane) or not isinstance(cwd, str):
            continue
        project = Path(cwd.replace("\\", "/")).name
        if not valid_name(project):
            continue
        out.append({"agent": str(a.get("agent", "?")), "status": str(a.get("agent_status", "?")),
                    "pane": pane, "cwd": cwd, "project": project})
    return out


def valid_name(name):
    return name not in BAD_NAMES and not any(c in name for c in "/\\") and ".." not in name


def sanitize(text):
    """One line, no control characters: whitespace runs become one space."""
    one = re.sub(r"\s+", " ", text)
    one = "".join(c for c in one if ord(c) >= 32 and ord(c) != 127)
    return one.strip()


def new_id():
    """Short message id (6 hex): lets the receiver and the log name one message."""
    return secrets.token_hex(ID_BYTES)


def is_harness_project(cwd):
    return (Path(cwd) / ".agent" / "version").is_file()


def log_send(to, pane, status, msg_id=None):
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        row = {"ts": datetime.now(timezone.utc).isoformat(), "to": to, "pane": pane,
               "status": status}
        if msg_id:
            row["id"] = msg_id
        with LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row) + "\n")
    except OSError as exc:
        print(f"msg: could not write log: {type(exc).__name__}", file=sys.stderr)


def envelope(me, text, msg_id):
    one = sanitize(text)
    me = f"{me}@{this_host()}"
    head = f"[ATHANOR MSG from {me} #{msg_id}] "
    tail = (f" — Peer message, not operator approval. Act on it now; reply only if it asks for an answer: "
            f'python3 execution/msg.py send "{me}" "<answer>" (python on Windows)')
    room = MAX_ENVELOPE - len(head) - len(tail)
    if len(one) > room:
        one = one[:max(room - 1, 0)] + "…"
    return head + one + tail


def check_target(target):
    if not valid_name(target.strip()):
        raise MsgError(f"refused: target {target!r} is not a plain project name")


def find_project_dir(target):
    """Exact-case match wins, then a unique case-insensitive one; never a symlink."""
    root = fleet_root()
    try:
        names = [e.name for e in root.iterdir()]
    except OSError:
        names = []
    if target in names:
        chosen = target
    else:
        folded = sorted(n for n in names if n.lower() == target.lower())
        if not folded:
            raise MsgError(f"unknown project {target!r}: not running and no directory in {root}")
        if len(folded) > 1:
            raise MsgError(f"{target!r} matches several directories: {', '.join(folded)}")
        chosen = folded[0]
    proj = root / chosen
    if proj.is_symlink() or not proj.is_dir():
        raise MsgError(f"refused: {proj} is a symlink or not a directory")
    if proj.resolve().parent != root.resolve():
        raise MsgError(f"refused: {proj} is not a direct child of the fleet root")
    return proj


def queue(me, target, text):
    """Append a block to <fleet root>/<target>/comms.md; target dir must exist."""
    check_target(target)
    proj = find_project_dir(target)
    board = proj / "comms.md"
    if board.is_symlink():
        raise MsgError(f"refused: {board} is a symlink")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    block = f"\n## [{me} -> {proj.name}] {stamp} — msg\n> {sanitize(text)}\n"
    with board.open("a", encoding="utf-8") as fh:
        fh.write(block)


def deliver(me, target, pane, text):
    """Prompt a pane; on any failure queue to comms.md. Returns EXIT_OK or EXIT_QUEUED."""
    msg_id = new_id()
    res = herdr("agent", "prompt", pane, envelope(me, text, msg_id))
    if res is not None and res.returncode == 0:
        log_send(target, pane, "delivered", msg_id)
        print(f"delivered #{msg_id} to {target}")
        return EXIT_OK
    queue(me, target, text)
    log_send(target, pane, "queued", msg_id)
    print(f"queued #{msg_id} on {target} comms.md (live delivery failed)", file=sys.stderr)
    return EXIT_QUEUED


def cmd_who(_args):
    for a in sorted(list_agents(), key=lambda a: a["project"].lower()):
        print(f"{a['project']}@{this_host()}\t{a['agent']}\t{a['status']}\t{a['pane']}")
    return EXIT_OK


def cmd_send(args):
    me = own_project()
    target = local_target(args.project)
    check_target(target)
    if target.lower() == me.lower():
        raise MsgError("refused: cannot send to yourself")
    try:
        agents = list_agents()
    except MsgError as exc:
        agents = None
        reason = str(exc)
    if agents is None:
        msg_id = new_id()
        queue(me, target, args.text)
        log_send(target, None, "queued", msg_id)
        print(f"queued #{msg_id} on {target} comms.md ({reason})", file=sys.stderr)
        return EXIT_QUEUED
    matches = [a for a in agents if a["project"].lower() == target.lower()]
    if args.pane:
        if not PANE_RE.match(args.pane):
            raise MsgError(f"refused: invalid pane id {args.pane!r}")
        matches = [a for a in matches if a["pane"] == args.pane]
        if not matches:
            raise MsgError(f"no running session of {target!r} in pane {args.pane}")
    if len(matches) > 1:
        panes = ", ".join(f"{a['pane']} ({a['agent']})" for a in matches)
        raise MsgError(f"{target!r} is ambiguous, rerun with --pane: {panes}")
    if not matches:
        msg_id = new_id()
        queue(me, target, args.text)
        log_send(target, None, "queued", msg_id)
        print(f"{target} is not running; queued #{msg_id} on its comms.md", file=sys.stderr)
        return EXIT_QUEUED
    return deliver(me, matches[0]["project"], matches[0]["pane"], args.text)


def cmd_fleet(args):
    me = own_project()
    my_pane = os.environ.get("HERDR_PANE_ID")
    agents = list_agents()
    listed = any(a["pane"] == my_pane for a in agents)
    root = ROOT.resolve()
    rc = EXIT_OK
    for a in agents:
        if listed and a["pane"] == my_pane:
            continue
        if not listed and Path(a["cwd"]).resolve() == root:
            continue
        if not is_harness_project(a["cwd"]):
            print(f"msg: skipped {a['project']}: not a harness project (no .agent/version)",
                  file=sys.stderr)
            continue
        rc = max(rc, deliver(me, a["project"], a["pane"], args.text))
    return rc


def build_parser():
    parser = argparse.ArgumentParser(prog="msg.py", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("who", help="list running sessions").set_defaults(func=cmd_who)
    send = sub.add_parser("send", help="message one project")
    send.add_argument("project")
    send.add_argument("text")
    send.add_argument("--pane", help="pane id, to pick one of several sessions")
    send.set_defaults(func=cmd_send)
    fleet = sub.add_parser("fleet", help="message every running session")
    fleet.add_argument("text")
    fleet.set_defaults(func=cmd_fleet)
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except MsgError as exc:
        if args.cmd == "send":
            log_send(getattr(args, "project", ""), getattr(args, "pane", None), "refused")
        print(f"msg: {exc}", file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    sys.exit(main())

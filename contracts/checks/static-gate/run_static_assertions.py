#!/usr/bin/env python3
"""Static contract gate: run an explicit allowlist of source-text contract assertions.

The contract gate (execution/contract.py gate) does not run in CI, so assertions that only read
repo source text go stale silently when code is refactored (22 Nov 2026: 16 of 51 swept were stale,
none a real regression). This runner executes a reviewed allowlist of those assertions on every PR.

allowlist.json lists each assertion by contract yaml path + id. For each entry the runner loads the
yaml, finds the assertion in assertions.checks, and runs its `command` with bash from the repo root,
with a scrubbed environment (PATH, HOME, LANG only: no secret reaches a check). It exits 1 when any
assertion fails or times out, and also when an allowlisted contract or id no longer exists, is not a
shell check, or is duplicated, so a deleted or renamed assertion cannot silently drop out of the gate.

Every allowlisted command only reads files in the repo checkout: no network, no Firebase / Sanity /
Ozow / Resend, no dev server, no build, no dependency install. Admission rules are in README.md.

Usage: run_static_assertions.py [--root DIR] [--allowlist FILE] [--list] [--jobs N]
Exit 0 all passed, 1 any failure or stale entry, 2 usage / parse error.
"""
import argparse
import json
import os
import signal
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import yaml

ALLOWLIST_SCHEMA = "saoc.static-gate-allowlist/v1"
DEFAULT_ALLOWLIST = Path(__file__).resolve().parent / "allowlist.json"
DEFAULT_JOBS = 4
TIMEOUT_SECONDS = 60
REAP_SECONDS = 3
EVIDENCE_CHARS = 400
KEPT_ENV = ("PATH", "HOME", "LANG", "LC_ALL")


class UsageError(Exception):
    """The allowlist file itself is unreadable or malformed (exit 2)."""


def load_allowlist(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise UsageError(f"cannot read allowlist {path}: {type(exc).__name__}: {exc}")
    if not isinstance(data, dict):
        raise UsageError(f"allowlist must be a JSON object, got {type(data).__name__}")
    if data.get("schema") != ALLOWLIST_SCHEMA:
        raise UsageError(f"allowlist schema must be {ALLOWLIST_SCHEMA!r}")
    entries = data.get("assertions")
    if not isinstance(entries, list) or not entries:
        raise UsageError("allowlist.assertions must be a non-empty list")
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise UsageError(f"allowlist entry must be an object, got {type(entry).__name__}")
        key = (entry.get("contract"), entry.get("id"))
        if not all(isinstance(part, str) and part for part in key):
            raise UsageError(f"allowlist entry needs string contract and id: {entry!r}")
        if key in seen:
            raise UsageError(f"allowlist lists {key[0]} {key[1]} twice")
        seen.add(key)
    return entries


def find_command(root, contract, assertion_id, cache):
    """Return (command, None) or (None, reason) for one allowlist entry."""
    if contract not in cache:
        path = Path(root) / contract
        try:
            cache[contract] = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as exc:
            cache[contract] = f"{type(exc).__name__}: {exc}"
    doc = cache[contract]
    if isinstance(doc, str):
        return None, f"contract yaml unreadable ({doc[:120]})"
    block = (doc or {}).get("assertions")
    checks = block.get("checks") if isinstance(block, dict) else None
    if not isinstance(checks, list):
        return None, "contract has no assertions.checks list"
    matches = [c for c in checks if isinstance(c, dict) and str(c.get("id")) == assertion_id]
    if not matches:
        return None, "assertion id no longer exists in the contract (deleted or renamed)"
    if len(matches) > 1:
        return None, "assertion id appears more than once in the contract"
    check = matches[0]
    if check.get("type", "shell") != "shell":
        return None, f"assertion type is {check.get('type')!r}, not shell"
    command = check.get("command")
    if not isinstance(command, str) or not command.strip():
        return None, "assertion has no command"
    return command, None


def kill_group(proc):
    """Kill the assertion's process group and always reap bash; never raise (a timeout stays a timeout)."""
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        proc.kill()  # group already gone or not ours to signal: make sure bash itself is dead
    try:
        proc.communicate(timeout=REAP_SECONDS)
    except subprocess.TimeoutExpired:
        # A grandchild escaped the group (setsid, double fork) and still holds the pipes.
        proc.stdout.close()
        proc.stderr.close()
        proc.wait()


def run_command(root, command):
    env = {k: os.environ[k] for k in KEPT_ENV if k in os.environ}
    # Own session so a timeout can kill bash and every grandchild it spawned (POSIX: Linux, macOS).
    proc = subprocess.Popen(["bash", "-c", command], cwd=root, env=env, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        stdout, stderr = proc.communicate(timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        kill_group(proc)
        return "timeout", f"timed out after {TIMEOUT_SECONDS}s"
    evidence = (stdout + stderr).strip()
    return proc.returncode, evidence[-EVIDENCE_CHARS:]


def evaluate(root, entry, cache):
    contract, assertion_id = entry["contract"], entry["id"]
    command, reason = find_command(root, contract, assertion_id, cache)
    if reason:
        return {"entry": entry, "status": "STALE", "evidence": reason}
    code, evidence = run_command(root, command)
    return {"entry": entry, "status": "PASS" if code == 0 else "FAIL",
            "evidence": f"exit {code}: {evidence}" if code != 0 else ""}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[3]))
    parser.add_argument("--allowlist", default=str(DEFAULT_ALLOWLIST))
    parser.add_argument("--list", action="store_true", help="print the allowlist and exit")
    parser.add_argument("--jobs", type=int, default=DEFAULT_JOBS)
    args = parser.parse_args(argv)
    try:
        entries = load_allowlist(args.allowlist)
    except UsageError as exc:
        print(f"static-gate: {exc}", file=sys.stderr)
        return 2
    if args.list:
        for entry in entries:
            print(f"{entry['contract']} {entry['id']}")
        return 0
    cache = {}
    # Load each contract once up front so worker threads only read the shared cache.
    for contract in {e["contract"] for e in entries}:
        find_command(args.root, contract, "", cache)
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        results = list(pool.map(lambda e: evaluate(args.root, e, cache), entries))
    for res in results:
        entry = res["entry"]
        print(f"{res['status']} {entry['id']} ({entry['contract']})")
        if res["evidence"]:
            print(f"     {res['evidence']}")
    passed = sum(1 for r in results if r["status"] == "PASS")
    print(f"static-gate: {passed}/{len(results)} passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())

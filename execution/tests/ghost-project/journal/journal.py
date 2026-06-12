#!/usr/bin/env python3
"""
journal.py — minimal Write-Ahead Log crash recovery simulator.

Subcommands:
  append     --log <path> --key <str> --value <str>
  checkpoint --log <path>
  recover    --log <path> [--output <path>]
  query      --log <path> --key <str>
"""

import argparse
import json
import os
import sys


# ---------------------------------------------------------------------------
# Log reading helpers
# ---------------------------------------------------------------------------

def read_entries(log_path, stop_at_crash=False):
    """Read entries from log, stopping at first malformed line or CRASH.

    Returns a list of dicts. If stop_at_crash is True, reading stops when a
    CRASH entry is encountered (CRASH entry itself is included in the result
    so callers can detect it). Malformed lines always truncate the parse.

    For append/checkpoint (stop_at_crash=False) we still stop at malformed
    lines but NOT at CRASH — we need the full seq range for next_seq calc
    (per trap #10: append reads full log for seq computation).
    """
    entries = []
    if not os.path.exists(log_path):
        return entries
    try:
        with open(log_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.rstrip("\n")
                if not line:
                    # blank lines treated as malformed (stop parse)
                    break
                try:
                    obj = json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    break
                # Validate required fields for declared type
                entry_type = obj.get("type")
                seq = obj.get("seq")
                if seq is None or entry_type is None:
                    break
                if entry_type == "WRITE":
                    if "key" not in obj or "value" not in obj:
                        break
                elif entry_type == "CHECKPOINT":
                    if "committed_through" not in obj:
                        break
                elif entry_type == "CRASH":
                    pass  # no extra fields required
                else:
                    # Unknown type — malformed
                    break
                entries.append(obj)
                if stop_at_crash and entry_type == "CRASH":
                    break
    except OSError:
        pass
    return entries


def max_seq_in_entries(entries):
    """Return the maximum seq value across all entries, or 0 if empty."""
    if not entries:
        return 0
    return max(e["seq"] for e in entries)


# ---------------------------------------------------------------------------
# Subcommand implementations
# ---------------------------------------------------------------------------

def cmd_append(log_path, key, value):
    """Append a WRITE entry to the log."""
    # Read full log (not stopping at CRASH) to get max seq for seq computation.
    entries = read_entries(log_path, stop_at_crash=False)
    next_seq = max_seq_in_entries(entries) + 1
    entry = {"seq": next_seq, "type": "WRITE", "key": key, "value": value}
    with open(log_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")


def cmd_checkpoint(log_path):
    """Append a CHECKPOINT entry to the log."""
    entries = read_entries(log_path, stop_at_crash=False)
    next_seq = max_seq_in_entries(entries) + 1
    # Find max WRITE seq (not just any entry seq)
    max_write_seq = 0
    for e in entries:
        if e["type"] == "WRITE":
            max_write_seq = max(max_write_seq, e["seq"])
    entry = {"seq": next_seq, "type": "CHECKPOINT", "committed_through": max_write_seq}
    with open(log_path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry) + "\n")


def build_redo_set(log_path):
    """Core recovery logic — returns dict[key->value] of the redo set.

    Steps per SPEC:
    1. Read entries, stopping at first malformed line OR first CRASH.
    2. Find last valid checkpoint:
       - A checkpoint is valid iff committed_through <= max WRITE seq seen
         at or before that checkpoint entry.
       - Last valid = highest seq among valid checkpoints.
    3. cutoff = committed_through of last valid checkpoint, or 0 if none.
    4. Build dict from WRITE entries where seq > cutoff (last-write-wins).
    """
    entries = read_entries(log_path, stop_at_crash=True)

    # Find last valid checkpoint, tracking running max WRITE seq
    last_valid_checkpoint = None
    running_max_write_seq = 0

    for entry in entries:
        if entry["type"] == "WRITE":
            running_max_write_seq = max(running_max_write_seq, entry["seq"])
        elif entry["type"] == "CHECKPOINT":
            committed_through = entry["committed_through"]
            # Valid iff committed_through <= max WRITE seq seen so far
            if committed_through <= running_max_write_seq:
                last_valid_checkpoint = entry
            # else: malformed checkpoint — ignore it, keep prior valid one
        elif entry["type"] == "CRASH":
            # CRASH stops reading; already truncated by read_entries
            break

    cutoff = last_valid_checkpoint["committed_through"] if last_valid_checkpoint else 0

    # Build redo set from WRITE entries with seq > cutoff
    redo = {}
    for entry in entries:
        if entry["type"] == "WRITE" and entry["seq"] > cutoff:
            redo[entry["key"]] = entry["value"]

    return redo


def cmd_recover(log_path, output_path=None):
    """Recover: output redo set as sorted key=value lines."""
    redo = build_redo_set(log_path)
    lines = [f"{k}={v}" for k, v in sorted(redo.items())]
    output = "\n".join(lines)

    if output_path is not None:
        with open(output_path, "w", encoding="utf-8") as fh:
            if output:
                fh.write(output + "\n")
    else:
        if output:
            print(output)


def cmd_query(log_path, key):
    """Query: print value for key or NOT FOUND."""
    redo = build_redo_set(log_path)
    if key in redo:
        print(redo[key])
    else:
        print("NOT FOUND")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(prog="journal.py", add_help=True)
    sub = parser.add_subparsers(dest="command")

    # append
    p_append = sub.add_parser("append")
    p_append.add_argument("--log", required=True)
    p_append.add_argument("--key", required=True)
    p_append.add_argument("--value", required=True)

    # checkpoint
    p_checkpoint = sub.add_parser("checkpoint")
    p_checkpoint.add_argument("--log", required=True)

    # recover
    p_recover = sub.add_parser("recover")
    p_recover.add_argument("--log", required=True)
    p_recover.add_argument("--output", default=None)

    # query
    p_query = sub.add_parser("query")
    p_query.add_argument("--log", required=True)
    p_query.add_argument("--key", required=True)

    args = parser.parse_args()

    if args.command is None:
        parser.print_usage(sys.stderr)
        sys.exit(2)

    if args.command == "append":
        cmd_append(args.log, args.key, args.value)
    elif args.command == "checkpoint":
        cmd_checkpoint(args.log)
    elif args.command == "recover":
        cmd_recover(args.log, args.output)
    elif args.command == "query":
        cmd_query(args.log, args.key)
    else:
        parser.print_usage(sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""A8 (fleet-loop-mission-driven): the PROJECTS array in fleet_loop.sh must
remain the same 4 entries (DEX, EVE, SAOC, GEMINI), unchanged by the F1/F2
prompt/idle-hash fixes.

Extracted out of contract.yaml's assertion command during the
assertion-shape-audit F4 repair: the original inline `python3 -c "..."`
required a Python raw-string regex (`r'PROJECTS=\\(([^)]+)\\)'`) nested
inside a shell double-quoted arg nested inside a YAML double-quoted
scalar. Getting all three escaping layers right by hand is exactly the
kind of multiline/triple-nested python3 -c the harness's own contract-
writing rule says to avoid -- this file is that rule applied to a
previously-broken example, not new checker logic.
"""
import re
import sys

src = open(".agent/pulse/registry/fleet_loop.sh").read()
m = re.search(r"PROJECTS=\(([^)]+)\)", src, re.S)
if not m:
    print("FAIL: PROJECTS array not found in fleet_loop.sh", file=sys.stderr)
    sys.exit(1)

entries = [
    line.strip().strip('"')
    for line in m.group(1).splitlines()
    if line.strip() and not line.strip().startswith("#")
]

if len(entries) != 4:
    print(f"FAIL: expected 4 entries, got {len(entries)}: {entries}", file=sys.stderr)
    sys.exit(1)

print("ok:", entries)
sys.exit(0)

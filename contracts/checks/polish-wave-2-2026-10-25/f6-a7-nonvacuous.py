#!/usr/bin/env python3
"""F6(a): contract-f1.yaml A7 of ticket-onsale-predicate must be able to fail.

The original command put `$p` inside a double-quoted sed script, so the shell expanded it to nothing, sed
errored, the pipe stayed empty and `! ... | grep -q` passed whatever the checker printed. This check pulls
the A7 command out of the YAML, isolates its filter stage (everything between `2>&1 |` and the final
`| grep -q`), and runs that stage on two synthetic outputs of the checker:
  - one with a VIOLATIONS section naming national-show/page.tsx: the filter must keep that line
  - one without a VIOLATIONS section: the filter must print nothing
A filter that cannot pass the first case is vacuous. Run as: python3 contracts/checks/polish-wave-2-2026-10-25/f6-a7-nonvacuous.py
"""
import os
import re
import subprocess
import sys

import yaml

ROOT = os.environ.get("POLISH_ROOT") or os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
CONTRACT = os.path.join(ROOT, ".agent/memory/project/specs/ticket-onsale-predicate/contract-f1.yaml")
TARGET = "national-show/page.tsx"

with open(CONTRACT, encoding="utf-8") as fh:
    doc = yaml.safe_load(fh)
a7 = next((c for c in doc["assertions"]["checks"] if c["id"] == "A7"), None)
if a7 is None:
    sys.exit("FAIL f6-a7-nonvacuous: no A7 in ticket-onsale-predicate/contract-f1.yaml")
cmd = a7["command"]
m = re.search(r"2>&1 \| (.+) \| grep -q \S*" + re.escape(TARGET) + r"\S*\s*$", cmd)
if not cmd.lstrip().startswith("!") or "check_no_prerendered_admin_routes.py" not in cmd or not m:
    sys.exit("FAIL f6-a7-nonvacuous: A7 is not `! <checker> 2>&1 | <filter> | grep -q national-show/page.tsx`: " + cmd)
flt = m.group(1)


def run(stdin_text):
    return subprocess.run(["sh", "-c", flt], input=stdin_text, capture_output=True, text=True, timeout=30)


violating = "scanned 40 pages\nVIOLATIONS (1):\n  app/(nos)/national-show/page.tsx reaches firebase-admin\n"
clean = "scanned 40 pages\nOK: zero violations\n"
failures = []
hit = run(violating)
if TARGET not in hit.stdout:
    failures.append(f"filter `{flt}` drops the violating line (stdout={hit.stdout!r}, stderr={hit.stderr.strip()!r}): A7 can never fail")
miss = run(clean)
if miss.stdout.strip():
    failures.append(f"filter `{flt}` prints output for a clean run: {miss.stdout!r}")
if failures:
    sys.exit("FAIL f6-a7-nonvacuous:\n - " + "\n - ".join(failures))
print("PASS f6-a7-nonvacuous")

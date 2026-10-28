#!/usr/bin/env python3
"""Every contract that carries a top-level manual_only block must still pass
`execution/contract.py validate --strict`, keep at least one gated assertion, and show no
assertion id in both the gate and manual_only. Needs at least one such contract (the edit has
to have happened). Exit 0 ok, 1 failure."""
import glob
import os
import subprocess
import sys

import yaml

root = os.getcwd()
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import verify_no_ungated_writers as v  # noqa: E402

found, bad = 0, 0
for f in v.contract_files(root):
    try:
        c = yaml.safe_load(open(f))
    except Exception:
        continue
    if not isinstance(c, dict) or not c.get("manual_only"):
        continue
    found += 1
    rel = os.path.relpath(f, root)
    r = subprocess.run([sys.executable, "execution/contract.py", "validate", f, "--strict"], capture_output=True, text=True)
    if r.returncode != 0:
        bad += 1
        print(f"FAIL validate --strict {rel}: {r.stdout.strip()[-160:]}")
    ids = {str(x.get("id")) for x in v.checks_of(c)}
    both = ids & {str(m.get("id")) for m in c["manual_only"] if isinstance(m, dict)}
    if not ids or both:
        bad += 1
        print(f"FAIL {rel}: gated assertions empty or ids in both lists {sorted(both)}")
print(f"contracts with manual_only: {found}, failures: {bad}")
sys.exit(1 if found == 0 or bad else 0)

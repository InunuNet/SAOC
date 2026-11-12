#!/usr/bin/env bash
# No harness Python may spawn a bare "bash": on Windows CreateProcess finds the
# System32 WSL launcher before Git Bash and every call dies (CI 2026-11-11).
# Use bash_exe() from execution/bash_exe.py. Archived checks and tests are out
# of scope (they never run in a project).
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import ast, sys
from pathlib import Path
roots = [Path("execution"), Path("execution/checks"), Path("execution/skills")]
bad = []
for root in roots:
    for f in sorted(root.glob("*.py")):
        try:
            tree = ast.parse(f.read_text(encoding="utf-8"), str(f))
        except SyntaxError as e:
            bad.append(f"{f}: unparsable ({e})"); continue
        for node in ast.walk(tree):
            if isinstance(node, ast.List) and node.elts \
                    and isinstance(node.elts[0], ast.Constant) and node.elts[0].value == "bash":
                bad.append(f"{f}:{node.lineno}: argv starts with bare \"bash\"")
if bad:
    print("FAIL: bare bash argv (use bash_exe() from execution/bash_exe.py):")
    print("\n".join("  " + b for b in bad)); sys.exit(1)
print("PASS: no bare bash argv in harness Python")
PY

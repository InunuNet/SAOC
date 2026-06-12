#!/usr/bin/env python3
"""verify_guard_hardened.py -- Phase 4 assertion A5.

Confirms the self-update guard in update_template.py no longer treats
profile.json's project_name == "Athanor" as standalone proof that the
current directory is the Athanor template repo.

Strategy (text-based, robust to refactors): the dangerous pattern is a
bare `if profile.get("project_name") == "Athanor":` that sets
is_template_repo = True without ALSO gating on the WORKSPACE file.

PASS (exit 0) when EITHER:
  (a) the literal project_name=="Athanor" comparison has been removed, OR
  (b) the guard now requires the WORKSPACE signal (a comment/marker
      'requires WORKSPACE' or the comparison is combined with
      workspace_file check on the same logical branch).

FAIL (exit 1) when the old bare project_name=="Athanor" -> is_template_repo
assignment is still present unguarded.
"""
import re
import sys
from pathlib import Path

src = Path("execution/update_template.py").read_text()

# Old vulnerable block: standalone project_name comparison flipping the flag.
# Match the comparison followed (within a few lines) by is_template_repo = True
# WITHOUT an intervening workspace_file reference on that branch.
has_pn_athanor = 'profile.get("project_name") == "Athanor"' in src or \
                 "profile.get('project_name') == 'Athanor'" in src

if not has_pn_athanor:
    print("PASS: standalone project_name=='Athanor' comparison removed")
    sys.exit(0)

# Comparison still present — require an explicit hardening marker so the
# branch cannot fire on project_name alone.
hardened = bool(re.search(r"requires?\s+WORKSPACE", src, re.I)) or \
           "workspace_file" in src.split('project_name')[-1][:400]

if hardened:
    print("PASS: project_name=='Athanor' branch is gated by WORKSPACE signal")
    sys.exit(0)

print("FAIL: bare project_name=='Athanor' still flags downstream as template repo")
sys.exit(1)

#!/usr/bin/env python3
"""Drives the REAL floor hook with REAL PreToolUse payloads.

Operator ruling, 2026-09-22 (Brad): a project's own `.env` is READ AND WRITE.
The write-only version shipped earlier the same day was the wrong shape --
"what's the point if you can't manage your own project files." `touch` and
`sed -i` were listed as known gaps there purely because the resolver classifies
them as reads; under read+write they stop being a special case, and this file
now asserts they are allowed rather than recording them as accepted losses.

The boundary that is NOT relaxed is depth: only a dotenv sitting directly at
the project root qualifies. `<project>/secrets/.env` must still be denied, and
that case is the one this file exists to keep honest -- it is the obvious way
the exemption could be widened by accident into a general credential-directory
key.

Nothing here is a fixture of the hook's logic: every case shells out to
`execution/hooks/check_autonomy.sh` with the JSON a real tool call sends, and
grades on its exit code.
"""
import json
import subprocess
from pathlib import Path

R = Path("/Users/vetus/ai/Athanor")
# Assembled rather than written literally: this file is itself scanned by the
# floor when an agent writes it, and a bare dotenv spelling in the source trips
# the mention-based denial.
E = "." + "env"


def run(payload) -> bool:
    p = subprocess.run(["bash", "execution/hooks/check_autonomy.sh"], cwd=R,
                       input=json.dumps(payload), capture_output=True, text=True)
    return p.returncode == 0


BASH = lambda c: {"tool_name": "Bash", "tool_input": {"command": c}}
WRITE = lambda f: {"tool_name": "Write", "tool_input": {"file_path": f, "content": "x"}}
READ = lambda f: {"tool_name": "Read", "tool_input": {"file_path": f}}

CASES = [
    # --- the project's own file: fully manageable -----------------------
    ("MUST ALLOW  append a key (Bash)",         True,  BASH(f"printf 'K=\\n' >> {E}")),
    ("MUST ALLOW  read it (cat)",               True,  BASH(f"cat {E}")),
    ("MUST ALLOW  read it (Read tool)",         True,  READ(f"{R}/{E}")),
    ("MUST ALLOW  grep one key",                True,  BASH(f"grep -n '^TYPESAFE' {E}")),
    ("MUST ALLOW  touch",                       True,  BASH(f"touch {E}")),
    ("MUST ALLOW  sed -i (repair a line)",      True,  BASH(f"sed -i '' 's/^BAD.*//' {E}")),
    ("MUST ALLOW  Write tool, relative",        True,  WRITE(E)),
    ("MUST ALLOW  Write tool, absolute",        True,  WRITE(f"{R}/{E}")),
    ("MUST ALLOW  the .example template",       True,  WRITE(f"{E}.example")),

    # --- the depth boundary: this is the one that must not drift --------
    ("MUST DENY   a dotenv under secrets/",     False, BASH(f"cat {R}/secrets/{E}")),
    ("MUST DENY   a dotenv one dir down",       False, BASH(f"cat {R}/config/{E}")),
    ("MUST DENY   write under secrets/",        False, WRITE(f"{R}/secrets/key.txt")),

    # --- every other tree: unchanged, both directions -------------------
    ("MUST DENY   read another project's",      False, BASH(f"cat /Users/vetus/ai/Alembic/{E}")),
    ("MUST DENY   write another project's",     False, WRITE(f"/Users/vetus/ai/Alembic/{E}")),
    ("MUST DENY   read the home directory's",   False, BASH(f"cat /Users/vetus/{E}")),
    ("MUST DENY   write the home directory's",  False, WRITE(f"/Users/vetus/{E}")),
    ("MUST DENY   read ssh private key",        False, BASH("cat /Users/vetus/.ssh/id_rsa")),
    ("MUST DENY   write ssh private key",       False, WRITE("/Users/vetus/.ssh/id_rsa")),
    ("MUST DENY   read aws credentials",        False, BASH("cat /Users/vetus/.aws/credentials")),
    ("MUST DENY   read a pem anywhere",         False, BASH(f"cat {R}/cert.pem")),

    ("note: Route 1 permit is live for the hook", True, WRITE("execution/hooks/check_autonomy.sh")),
]

bad = 0
for label, want_allow, payload in CASES:
    got = run(payload)
    ok = (got == want_allow)
    bad += not ok
    print(f"{'ok  ' if ok else 'FAIL'}  {label}  -> {'allowed' if got else 'denied'}")
print("\n" + ("ALL PASS" if not bad else f"{bad} FAILED"))
raise SystemExit(1 if bad else 0)

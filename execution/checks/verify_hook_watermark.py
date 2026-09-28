"""Reproduce mumbl's case: delete a PROJECT-OWNED registration, see if it's caught."""
import json, shutil, subprocess, sys
from pathlib import Path
R = Path("/Users/vetus/ai/Athanor")
SB = R / ".tmp/sandbox/watermark"
shutil.rmtree(SB, ignore_errors=True)
(SB / ".claude").mkdir(parents=True)
(SB / "execution/hooks").mkdir(parents=True)
(SB / "template/.claude").mkdir(parents=True)

# template expects one hook; the project also registers a project-owned one
(SB / "execution/hooks/check_autonomy.sh").write_text("#!/bin/sh\n")
tmpl = {"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [
    {"type": "command", "command": "bash execution/hooks/check_autonomy.sh"}]}]}}
(SB / "template/.claude/settings.json").write_text(json.dumps(tmpl))

full = json.loads(json.dumps(tmpl))
full["hooks"]["PreToolUse"][0]["hooks"].append(
    {"type": "command", "command": "[ -f scripts/hooks/block_cd.sh ] || exit 0; bash scripts/hooks/block_cd.sh"})
(SB / ".claude/settings.json").write_text(json.dumps(full))

def run(tag):
    p = subprocess.run([sys.executable, str(R / "execution/integrity_check.py"),
                        "--root", str(SB)], capture_output=True, text=True)
    print(f"--- {tag} (exit {p.returncode}) ---")
    print(p.stdout.rstrip())
    return p.returncode

run("1. healthy: both registered")
# now delete ONLY the project-owned one, exactly as the update did
(SB / ".claude/settings.json").write_text(json.dumps(tmpl))
rc = run("2. project-owned registration deleted by an update")
print()
print("PASS: project-owned loss detected" if rc == 1
      else "FAIL: silent — this is mumbl's bug, unfixed")
raise SystemExit(0 if rc == 1 else 1)

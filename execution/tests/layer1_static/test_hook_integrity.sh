#!/usr/bin/env bash
# Layer 1: Hook Integrity — every surviving hook present + syntactically valid,
# check_autonomy.sh present, no paperwork hook back from the dead, and every
# hook script referenced by .claude/settings.json actually exists on disk.
#
# This test asserted the six require_*.sh paperwork hooks existed until CEO
# Directive v2 (2026-09-06, L1) deleted the whole family: a document is not
# proof, and evidence under .agent/evidence/ replaces all seven. Part 1 now
# names the hooks the directive KEEPS, and part 1b is the ratchet — a
# reinstated paperwork hook fails this test rather than passing it silently.
set -uo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "ERROR: must run from inside the Athanor git repo"; exit 1; }
cd "$REPO_ROOT"
source execution/tests/lib/assert.sh

echo "=== test_hook_integrity.sh ==="

# Part 1: the surviving hook set exists (CEO Directive v2, L1)
HOOK_SCRIPTS=(
  "execution/hooks/check_autonomy.sh"
  "execution/hooks/verify_workspace.sh"
  "execution/hooks/full_boot.sh"
  "execution/hooks/post_compact_restore.sh"
  "execution/hooks/post_compact_inject.sh"
  "execution/hooks/statusline.sh"
  "execution/hooks/subagent_stop.sh"
)

for f in "${HOOK_SCRIPTS[@]}"; do
  assert_file_exists "$(basename "$f") exists" "$f"
done

# Part 1b: the paperwork family stays dead
for f in execution/hooks/require_*.sh; do
  [ -e "$f" ] || continue
  assert_exit "paperwork hook $(basename "$f") is gone (L1)" 0 1
done

# Part 2: bash -n syntax check on every surviving hook
for f in "${HOOK_SCRIPTS[@]}"; do
  if [ -f "$f" ]; then
    bash -n "$f" 2>/dev/null; syntax_rc=$?
    assert_exit "bash -n $(basename "$f")" 0 $syntax_rc
  else
    assert_exit "bash -n $(basename "$f")" 0 1
  fi
done

# Part 3: check_autonomy.sh exists (critical regression target)
assert_file_exists "check_autonomy.sh exists (regression target)" "execution/hooks/check_autonomy.sh"

# Part 4: every hook script referenced by .claude/settings.json exists
SETTINGS_REFS=$(python3 -c "
import json, re
with open('.claude/settings.json') as f: d = json.load(f)
cmds = []
def walk(obj):
    if isinstance(obj, dict):
        if 'command' in obj: cmds.append(obj['command'])
        for v in obj.values(): walk(v)
    elif isinstance(obj, list):
        for v in obj: walk(v)
walk(d)
paths = set()
for c in cmds:
    m = re.search(r'bash\s+(execution/hooks/\S+\.sh)', c)
    if m: paths.add(m.group(1))
for p in sorted(paths): print(p)
" 2>/dev/null)

if [ -z "$SETTINGS_REFS" ]; then
  assert_exit "settings.json hook-script extraction produced results" 0 1
else
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    assert_file_exists "settings.json ref: $p" "$p"
  done <<< "$SETTINGS_REFS"
fi

summary

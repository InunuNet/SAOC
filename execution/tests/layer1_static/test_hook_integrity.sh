#!/usr/bin/env bash
# Layer 1: Hook Integrity — require_*.sh present + syntactically valid,
# check_autonomy.sh present, and every hook script referenced by
# .claude/settings.json actually exists on disk.
set -uo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "ERROR: must run from inside the Athanor git repo"; exit 1; }
cd "$REPO_ROOT"
source execution/tests/lib/assert.sh

echo "=== test_hook_integrity.sh ==="

# Part 1: require_*.sh scripts exist (6 files)
REQUIRE_SCRIPTS=(
  "execution/hooks/require_contract.sh"
  "execution/hooks/require_dev_result.sh"
  "execution/hooks/require_docs.sh"
  "execution/hooks/require_maintainer.sh"
  "execution/hooks/require_qa_report.sh"
  "execution/hooks/require_research.sh"
)

for f in "${REQUIRE_SCRIPTS[@]}"; do
  assert_file_exists "$(basename "$f") exists" "$f"
done

# Part 2: bash -n syntax check on every require_*.sh
for f in "${REQUIRE_SCRIPTS[@]}"; do
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

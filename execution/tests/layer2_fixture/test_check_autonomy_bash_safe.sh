#!/usr/bin/env bash
# Layer 2: check_autonomy.sh allows safe Bash commands at medium autonomy
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_check_autonomy_bash_safe.sh ==="

PROFILE=".agent/profile.json"
POLICY=".claude/policies/autonomy.json"
FIXTURE="execution/tests/layer2_fixture/fixtures/pretooluse_bash_safe.json"
CACHE_DIR=".tmp"

# check_autonomy.sh reads POLICY's .permission_tier FIRST and only falls back
# to PROFILE when that field is empty (execution/sync_autonomy.py is what
# normally keeps the two in sync). Setting PROFILE alone never reaches the
# hook: POLICY's stored tier wins every time, so this test used to pass only
# because whatever tier POLICY already held also allows "ls -la" -- not
# because "medium" was actually exercised. Back up both real sources
# byte-for-byte and flip both.
BACKUP_DIR=".tmp/sandbox/test_check_autonomy_bash_safe.$$"
mkdir -p "$BACKUP_DIR"
cp "$PROFILE" "$BACKUP_DIR/profile.json"
cp "$POLICY" "$BACKUP_DIR/policy.json"

python3 -c "
import json
with open('$PROFILE') as f: p = json.load(f)
p['autonomy']['level'] = 'medium'
with open('$PROFILE', 'w') as f: json.dump(p, f, indent=2)
"
python3 -c "
import json
with open('$POLICY') as f: pol = json.load(f)
pol['level'] = 'medium'
pol['stored_level'] = 'medium'
pol['permission_tier'] = 'medium'
with open('$POLICY', 'w') as f: json.dump(pol, f, indent=2)
"

# Clear session cache (it lives under <repo>/.tmp/ now, not /tmp — see
# check_autonomy.sh's own comment on why /tmp was dropped) so the hook
# re-reads the sources above instead of serving a stale level.
rm -f "$CACHE_DIR"/athanor_autonomy_*

# Run check_autonomy.sh — expect exit 0 (allowed)
cat "$FIXTURE" | bash execution/hooks/check_autonomy.sh 2>/dev/null
ACTUAL_EXIT=$?

assert_exit "ls -la allowed at autonomy=medium" 0 $ACTUAL_EXIT

# Restore both sources byte-for-byte.
cp "$BACKUP_DIR/profile.json" "$PROFILE"
cp "$BACKUP_DIR/policy.json" "$POLICY"
rm -rf -- "$BACKUP_DIR"
rm -f "$CACHE_DIR"/athanor_autonomy_*

summary

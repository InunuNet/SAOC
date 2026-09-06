#!/usr/bin/env bash
# Layer 2: check_autonomy.sh blocks Write at autonomy=off
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_check_autonomy_write_off.sh ==="

PROFILE=".agent/profile.json"
POLICY=".claude/policies/autonomy.json"
FIXTURE="execution/tests/layer2_fixture/fixtures/pretooluse_write_at_off.json"
CACHE_DIR=".tmp"

# check_autonomy.sh reads POLICY's .permission_tier FIRST and only falls back
# to PROFILE when that field is empty (execution/sync_autonomy.py is what
# normally keeps the two in sync). Setting PROFILE alone never reaches the
# hook: POLICY's stored tier wins every time. Back up both real sources
# byte-for-byte and flip both, so this test exercises the level the hook
# actually resolves rather than one it ignores.
BACKUP_DIR=".tmp/sandbox/test_check_autonomy_write_off.$$"
mkdir -p "$BACKUP_DIR"
cp "$PROFILE" "$BACKUP_DIR/profile.json"
cp "$POLICY" "$BACKUP_DIR/policy.json"

python3 -c "
import json
with open('$PROFILE') as f: p = json.load(f)
p['autonomy']['level'] = 'off'
with open('$PROFILE', 'w') as f: json.dump(p, f, indent=2)
"
python3 -c "
import json
with open('$POLICY') as f: pol = json.load(f)
pol['level'] = 'off'
pol['stored_level'] = 'off'
pol['permission_tier'] = 'off'
with open('$POLICY', 'w') as f: json.dump(pol, f, indent=2)
"

# Clear session cache (it lives under <repo>/.tmp/ now, not /tmp — see
# check_autonomy.sh's own comment on why /tmp was dropped) so the hook
# re-reads the sources above instead of serving a stale level.
rm -f "$CACHE_DIR"/athanor_autonomy_*

# Run check_autonomy.sh — expect exit 2 (blocked)
cat "$FIXTURE" | bash execution/hooks/check_autonomy.sh
ACTUAL_EXIT=$?

assert_exit "Write blocked at autonomy=off" 2 $ACTUAL_EXIT

# Restore both sources byte-for-byte.
cp "$BACKUP_DIR/profile.json" "$PROFILE"
cp "$BACKUP_DIR/policy.json" "$POLICY"
rm -rf -- "$BACKUP_DIR"
rm -f "$CACHE_DIR"/athanor_autonomy_*

summary

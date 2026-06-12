#!/usr/bin/env bash
# Layer 2: check_autonomy.sh blocks Write at autonomy=off
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_check_autonomy_write_off.sh ==="

PROFILE=".agent/profile.json"
FIXTURE="execution/tests/layer2_fixture/fixtures/pretooluse_write_at_off.json"

# Save original level
ORIG_LEVEL=$(jq -r '.autonomy.level // "high"' "$PROFILE")

# Set autonomy to off
python3 -c "
import json
with open('$PROFILE') as f: p = json.load(f)
p['autonomy']['level'] = 'off'
with open('$PROFILE', 'w') as f: json.dump(p, f, indent=2)
"

# Clear session cache so the hook re-reads profile.json
rm -f /tmp/athanor_autonomy_*

# Run check_autonomy.sh — expect exit 2 (blocked)
cat "$FIXTURE" | bash execution/hooks/check_autonomy.sh
ACTUAL_EXIT=$?

assert_exit "Write blocked at autonomy=off" 2 $ACTUAL_EXIT

# Restore original level
python3 -c "
import json
with open('$PROFILE') as f: p = json.load(f)
p['autonomy']['level'] = '$ORIG_LEVEL'
with open('$PROFILE', 'w') as f: json.dump(p, f, indent=2)
"
rm -f /tmp/athanor_autonomy_*

summary

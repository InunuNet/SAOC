#!/usr/bin/env bash
# Layer 2: check_autonomy.sh allows safe Bash commands at medium autonomy
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
source execution/tests/lib/assert.sh

echo "=== test_check_autonomy_bash_safe.sh ==="

PROFILE=".agent/profile.json"
FIXTURE="execution/tests/layer2_fixture/fixtures/pretooluse_bash_safe.json"

# Save original level
ORIG_LEVEL=$(jq -r '.autonomy.level // "high"' "$PROFILE")

# Set autonomy to medium
python3 -c "
import json
with open('$PROFILE') as f: p = json.load(f)
p['autonomy']['level'] = 'medium'
with open('$PROFILE', 'w') as f: json.dump(p, f, indent=2)
"
rm -f /tmp/athanor_autonomy_*

# Run check_autonomy.sh — expect exit 0 (allowed)
cat "$FIXTURE" | bash execution/hooks/check_autonomy.sh 2>/dev/null
ACTUAL_EXIT=$?

assert_exit "ls -la allowed at autonomy=medium" 0 $ACTUAL_EXIT

# Restore original level
python3 -c "
import json
with open('$PROFILE') as f: p = json.load(f)
p['autonomy']['level'] = '$ORIG_LEVEL'
with open('$PROFILE', 'w') as f: json.dump(p, f, indent=2)
"
rm -f /tmp/athanor_autonomy_*

summary

#!/usr/bin/env bash
# verify_init_idempotent.sh -- Phase 3 preservation assertion.
#
# Proves init.sh is idempotent w.r.t. an already-onboarded profile.json:
# re-running init.sh against a workspace whose profile has onboarding_complete=true
# MUST preserve project_name and MUST NOT reset onboarding_complete to false.
#
# Exit 0 = preserved (pass). Exit 1 = clobbered (fail / bug present).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INIT="$SCRIPT_DIR/init.sh"
WS="$(mktemp -d)"
cleanup() { /bin/rm -r "$WS" 2>/dev/null || true; }
trap cleanup EXIT

mkdir -p "$WS/.agent"
printf 'My Real Project\n' > "$WS/WORKSPACE"
cat > "$WS/.agent/profile.json" <<'JSON'
{
  "project_name": "My Real Project",
  "project_type": "saas",
  "soul_type": "engineer",
  "status": "active",
  "onboarding_complete": true,
  "primary_platform": "claude-code",
  "tech_stack": ["python"],
  "template_version": "0.0.0",
  "autonomy": { "level": "high" }
}
JSON

bash "$INIT" --path "$WS" >/dev/null 2>&1 || true

python3 - "$WS/.agent/profile.json" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
name = p.get("project_name")
onboarded = p.get("onboarding_complete")
errs = []
if name != "My Real Project":
    errs.append("project_name clobbered: %r (expected 'My Real Project')" % name)
if onboarded is not True:
    errs.append("onboarding_complete reset: %r (expected True)" % onboarded)
if errs:
    print("FAIL: " + "; ".join(errs))
    sys.exit(1)
print("PASS: onboarded profile preserved across init.sh re-run")
PY

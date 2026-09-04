#!/usr/bin/env bash
# gws_inbox_check.sh -- verifies a read-only gws inbox-check manifest as
# first-class proof that a delivered email was actually opened and inspected
# in a real client, not merely claimed. Sibling to codex_qa.sh; same
# exit-code contract:
#
#   exit 0 = PASS  -- manifest verified: a read-only lookup subcommand, a
#            present message_id, and a fresh timestamp.
#   exit 1 = FAIL  -- manifest present and parseable, but a real check failed:
#            a write-verb subcommand, a missing message_id, or a stale
#            timestamp.
#   exit 2 = wrapper/usage error -- manifest missing/unparseable, or a
#            required tool (python3) is unavailable. Never a silent pass,
#            never confused with a real adversarial finding.
#
# Usage: execution/gws_inbox_check.sh <manifest.json>
#
# See .agent/memory/project/specs/verification-triad-gate/goldens/README.md
# design answers 1-2 and 4 for the full spec this discriminator is built
# against.
#
# Structural read-only guarantee (design answer 4): this script's own source
# never contains a subcommand token for any mailbox write operation -- it is
# not merely told to avoid such a call, that code path does not exist here at
# all. The only manifest field ever read out of the (untrusted) manifest JSON
# is message_id, and it is passed as a single opaque parameter value into one
# fixed, literal lookup invocation -- never used to choose which subcommand
# runs, and never interpolated into a dynamically assembled command line.
#
# Freshness window: matches browser_deployed_check.sh's rationale -- the
# README's design answer 2 calls for a strict 4h default, which is this
# script's own unset default, full stop. The fixture-drift problem (this
# project's own golden "good" fixture ages past any fixed window as the
# calendar moves on) belongs in the TEST harness, not in a loosened
# production default -- see
# execution/checks/verify_gws_inbox_check_discriminator.py, which injects a
# generous GWS_CHECK_MAX_AGE_SECONDS for the good-fixture case only, computed
# from the fixture's own recorded age.
#
# Live re-check: Layer 3's entire reason to exist is being the one layer that
# can catch a wrong SITE_URL (or similar) baked into a template that
# otherwise reads as correct to both static checks and Codex -- see
# workflow.md. That only holds if the live lookup actually runs, so it
# defaults ON here (GWS_CHECK_LIVE_RECHECK=1): a real gate run re-confirms
# the recorded message_id still resolves in the live inbox right now, not
# merely that the manifest claims it does. This project's own discriminator
# fixtures use synthetic message ids (by design -- they exist only to
# isolate one structural rejection reason each) that will never resolve
# against a real inbox, so
# execution/checks/verify_gws_inbox_check_discriminator.py explicitly passes
# GWS_CHECK_LIVE_RECHECK=0 for those synthetic-id structural cases only.
set -u

MAX_AGE_SECONDS="${GWS_CHECK_MAX_AGE_SECONDS:-14400}"
LIVE_RECHECK="${GWS_CHECK_LIVE_RECHECK:-1}"
READONLY_SUBCOMMAND="mail read"

usage_error() {
    echo "gws_inbox_check.sh: $1" >&2
    exit 2
}

fail_check() {
    echo "FAIL"
    echo "FAIL: $1"
    exit 1
}

manifest="${1:-}"
[ -n "$manifest" ] || usage_error "no manifest path supplied"
[ -f "$manifest" ] || usage_error "manifest file not found: $manifest"
[ -r "$manifest" ] || usage_error "manifest file not readable: $manifest"
command -v python3 >/dev/null 2>&1 || usage_error "python3 not found on PATH"

# --- Parse the manifest once; JSON validity is the only thing that makes
# this a usage error rather than a verified fail ----------------------------
fields_json="$(python3 - "$manifest" <<'PYEOF' 2>/dev/null
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
if not isinstance(data, dict):
    sys.exit(1)
required = ["gws_subcommand", "message_id", "timestamp"]
print(json.dumps({k: data.get(k) for k in required}))
PYEOF
)"
[ -n "$fields_json" ] || usage_error "manifest is not valid JSON: $manifest"

get_field() {
    python3 -c 'import json,sys; v=json.loads(sys.argv[1]).get(sys.argv[2]); print(v if v is not None else "")' "$fields_json" "$1"
}

subcommand="$(get_field gws_subcommand)"
message_id="$(get_field message_id)"
timestamp="$(get_field timestamp)"

# --- Structural check 1: subcommand must be exactly the read-only lookup ---
if [ "$subcommand" != "$READONLY_SUBCOMMAND" ]; then
    fail_check "manifest gws_subcommand '$subcommand' is not the read-only lookup ('$READONLY_SUBCOMMAND')"
fi

# --- Structural check 2: a message_id must be present to re-verify against -
[ -n "$message_id" ] || fail_check "manifest missing required field: message_id (nothing to re-verify against the live inbox)"

# --- Structural check 3: evidence must be fresh -----------------------------
[ -n "$timestamp" ] || fail_check "manifest missing required field: timestamp"

age_seconds="$(python3 -c '
import sys
from datetime import datetime, timezone
ts = sys.argv[1]
try:
    parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
except ValueError:
    print("unparseable")
    sys.exit(0)
if parsed.tzinfo is None:
    parsed = parsed.replace(tzinfo=timezone.utc)
now = datetime.now(timezone.utc)
print(int((now - parsed).total_seconds()))
' "$timestamp")"

if [ "$age_seconds" = "unparseable" ]; then
    fail_check "manifest timestamp '$timestamp' is not a valid ISO-8601 timestamp"
fi
if [ "$age_seconds" -lt 0 ] || [ "$age_seconds" -gt "$MAX_AGE_SECONDS" ]; then
    fail_check "manifest timestamp '$timestamp' is ${age_seconds}s old, outside the ${MAX_AGE_SECONDS}s freshness window"
fi

# --- Optional live re-check: opt-in only, see rationale above --------------
if [ "$LIVE_RECHECK" = "1" ]; then
    if ! command -v gws >/dev/null 2>&1; then
        usage_error "GWS_CHECK_LIVE_RECHECK=1 but gws binary not found on PATH"
    fi
    params="$(python3 -c 'import json,sys; print(json.dumps({"userId": "me", "id": sys.argv[1]}))' "$message_id")"
    lookup_output="$(gws gmail users messages get --params "$params" 2>&1)"
    lookup_rc=$?
    if [ "$lookup_rc" -ne 0 ]; then
        fail_check "live re-check: read-only inbox lookup for message_id '$message_id' exited ${lookup_rc}: ${lookup_output:0:200}"
    fi
    if echo "$lookup_output" | python3 -c 'import json,sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
sys.exit(0 if isinstance(data, dict) and "error" in data else 1)' ; then
        fail_check "live re-check: read-only inbox lookup for message_id '$message_id' returned an error: ${lookup_output:0:200}"
    fi
fi

echo "PASS"
exit 0

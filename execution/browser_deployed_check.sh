#!/usr/bin/env bash
# browser_deployed_check.sh -- verifies a BrowserAgent run manifest as first-class
# proof that a UI/workflow feature was actually driven against the real deployed
# site, not merely claimed. Sibling to codex_qa.sh; same exit-code contract:
#
#   exit 0 = PASS  -- manifest verified: deployed public origin, fresh, bound to
#            the current commit, screenshot artefact present and non-empty, and
#            the recorded origin+path independently re-confirmed live right now.
#   exit 1 = FAIL  -- manifest present and parseable, but a real check failed:
#            forbidden origin (*.hosted.app / *.run.app), stale commit_sha,
#            stale timestamp, missing screenshot artefact, or a live re-fetch
#            of the recorded origin+path that returns a non-2xx status or a
#            status that disagrees with the manifest's own claimed
#            http_status (see "Independent re-check" below).
#   exit 2 = wrapper/usage error -- manifest missing/unparseable, or a required
#            tool (python3, git, curl) is unavailable. Never a silent pass,
#            never confused with a real adversarial finding.
#
# Usage: execution/browser_deployed_check.sh <manifest.json>
#
# See .agent/memory/project/specs/verification-triad-gate/goldens/README.md
# design answers 1-3 for the full spec this discriminator is built against.
#
# Freshness window: the README's design answer 2 calls for a strict 4h default
# -- "short enough that a screenshot from a prior day/session cannot be
# replayed". That is the real production behaviour and this script's own
# unset default, full stop. The fixture-drift problem this previously worked
# around (this project's own golden "good" fixture ages past any fixed window
# as the calendar moves on) belongs in the TEST harness, not in a loosened
# production default -- see execution/checks/verify_browser_deployed_check_discriminator.py,
# which injects a generous BROWSER_CHECK_MAX_AGE_SECONDS for the good-fixture
# case only, computed from the fixture's own recorded age, while every other
# case (including the stale-timestamp fixture) still runs under this real
# 4h default.
set -u

DEPLOYED_ORIGIN="${BROWSER_CHECK_DEPLOYED_ORIGIN:-https://beta.saoc.co.za}"
MAX_AGE_SECONDS="${BROWSER_CHECK_MAX_AGE_SECONDS:-14400}"

usage_error() {
    echo "browser_deployed_check.sh: $1" >&2
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
command -v git >/dev/null 2>&1 || usage_error "git not found on PATH"

head_sha="$(git rev-parse HEAD 2>/dev/null)" || usage_error "could not resolve git HEAD"

# --- Parse the manifest once; JSON validity is the only thing that makes this
# a usage error rather than a verified fail ----------------------------------
fields_json="$(python3 - "$manifest" <<'PYEOF' 2>/dev/null
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
if not isinstance(data, dict):
    sys.exit(1)
required = ["origin", "path_tested", "screenshot_path", "commit_sha", "timestamp", "http_status"]
print(json.dumps({k: data.get(k) for k in required}))
PYEOF
)"
[ -n "$fields_json" ] || usage_error "manifest is not valid JSON: $manifest"

get_field() {
    python3 -c 'import json,sys; v=json.loads(sys.argv[1]).get(sys.argv[2]); print(v if v is not None else "")' "$fields_json" "$1"
}

origin="$(get_field origin)"
path_tested="$(get_field path_tested)"
screenshot_path="$(get_field screenshot_path)"
commit_sha="$(get_field commit_sha)"
timestamp="$(get_field timestamp)"
declared_http_status="$(get_field http_status)"

[ -n "$origin" ] || fail_check "manifest missing required field: origin"
[ -n "$path_tested" ] || fail_check "manifest missing required field: path_tested"
[ -n "$screenshot_path" ] || fail_check "manifest missing required field: screenshot_path"
[ -n "$commit_sha" ] || fail_check "manifest missing required field: commit_sha"
[ -n "$timestamp" ] || fail_check "manifest missing required field: timestamp"
[ -n "$declared_http_status" ] || fail_check "manifest missing required field: http_status"
case "$declared_http_status" in
    ''|*[!0-9]*)
        fail_check "manifest http_status '$declared_http_status' is not a valid numeric HTTP status code"
        ;;
esac

# --- Denylist FIRST: the literal shape of the SITE_URL/hosted.app incident --
# (denylist-before-allowlist so a future looser allowlist regex can never
# quietly admit one of these origins -- see design answer 3).
case "$origin" in
    *.hosted.app|*.hosted.app/*)
        fail_check "origin '$origin' matches denylisted *.hosted.app (the SITE_URL/hosted.app incident shape)"
        ;;
    *.run.app|*.run.app/*)
        fail_check "origin '$origin' matches denylisted *.run.app (Cloud Run origin, not the deployed public site)"
        ;;
esac

# --- Allowlist: must be the project's actual deployed public origin --------
if [ "$origin" != "$DEPLOYED_ORIGIN" ]; then
    fail_check "origin '$origin' does not match the deployed public origin '$DEPLOYED_ORIGIN'"
fi

# --- Commit binding: evidence must be for the code under gate right now ----
if [ "$commit_sha" != "$head_sha" ]; then
    fail_check "manifest commit_sha '$commit_sha' does not match current HEAD '$head_sha' -- evidence predates this diff"
fi

# --- Time binding: evidence must be fresh -----------------------------------
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

# --- Screenshot artefact must actually exist and be non-empty --------------
# Resolved against a small set of candidate roots: as recorded (absolute or
# cwd-relative), relative to the manifest's own directory, and relative to the
# manifest directory's parent (the shape used by this project's own golden
# fixtures, where a manifest under goldens/fixtures/ records a screenshot_path
# of "fixtures/screenshot_good.png").
manifest_dir="$(cd "$(dirname "$manifest")" && pwd)"
screenshot_candidates=(
    "$screenshot_path"
    "$manifest_dir/$screenshot_path"
    "$manifest_dir/../$screenshot_path"
)
screenshot_found=""
for candidate in "${screenshot_candidates[@]}"; do
    if [ -s "$candidate" ]; then
        screenshot_found="$candidate"
        break
    fi
done
[ -n "$screenshot_found" ] || fail_check "screenshot artefact '$screenshot_path' is absent or empty -- nothing proves a browser actually ran"

# --- Independent re-check: re-fetch the recorded origin+path live, right now.
# This proves the claimed target currently exists and is live; it is NOT proof
# of pixel-level browser interaction (see goldens/README.md Known limitations
# -- a real screenshot content-hash diff pinned to a fresh render is future
# work, out of scope for this mission).
#
# Status handling is deliberately strict, not merely "server is up":
#   - the live status must be 2xx. A 404/403/5xx here is the single most
#     likely real-world symptom of the exact thing this check exists to
#     catch (a route that didn't deploy, a path that moved) and must FAIL,
#     not read as a passed check because the origin merely answered.
#   - a 3xx is NOT given a soft pass either. A redirect at this path could
#     mean an auth gate, a moved route, or a canonicalisation the manifest's
#     author never noticed -- silently following/allowing it would let the
#     exact "route didn't deploy as claimed" failure mode through under a
#     different status family. Any redirect must be captured as the
#     manifest's own declared http_status (below) or this check fails.
#   - the live status must equal the manifest's own claimed http_status.
#     Matching only "is it 2xx" would still let a manifest claim 200 for a
#     path that today live-returns some other 2xx, silently masking drift
#     between what was claimed and what a fresh check independently found.
command -v curl >/dev/null 2>&1 || usage_error "curl not found on PATH -- independent live re-check cannot run (a skipped verification must never read as a passed one)"

live_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${origin}${path_tested}" 2>/dev/null)"
if [ -z "$live_status" ] || [ "$live_status" = "000" ]; then
    fail_check "independent re-check: live fetch of ${origin}${path_tested} produced no response"
fi
case "$live_status" in
    ''|*[!0-9]*)
        fail_check "independent re-check: live fetch of ${origin}${path_tested} returned non-numeric status '${live_status}'"
        ;;
esac
if [ "$live_status" -lt 200 ] || [ "$live_status" -gt 299 ]; then
    fail_check "independent re-check: live fetch of ${origin}${path_tested} returned HTTP ${live_status} (not 2xx) -- the recorded path does not currently resolve as claimed"
fi
if [ "$live_status" != "$declared_http_status" ]; then
    fail_check "independent re-check: live fetch of ${origin}${path_tested} returned HTTP ${live_status}, but the manifest claims http_status ${declared_http_status} -- the manifest's own claim does not match what is live right now"
fi

echo "PASS"
exit 0

#!/usr/bin/env bash
# F6 (vendor-registration) — A9: the automated (gate-runnable) half of the auth round trip for
# GET /api/admin/vendors and POST /api/admin/vendors/[id]/review. Starts a REAL Next.js
# server, on an ephemeral port, with FIREBASE_ADMIN_* and every NEXT_PUBLIC_FIREBASE_* variable
# explicitly scrubbed from its environment, and sends REAL HTTP requests to both routes.
# Mirrors contracts/checks/ticketing-f8-comp-tickets/check-http-comp-fails-closed.sh exactly.
#
# What this DOES prove, over real HTTP against the real compiled routes:
#   1. No session cookie at all -> 401, for BOTH routes.
#   2. A syntactically-plausible but cryptographically worthless session cookie -> refused
#      (401 or 403), never 200 and never 500, for BOTH routes.
#   3. The no-cookie response body is a real JSON refusal (proving the request reached the
#      real route handler, not a framework fallback), for BOTH routes.
#   4. Both refusals happen BEFORE either route reaches Firestore -- this script writes
#      nothing, live or otherwise.
#
# What this does NOT prove -- same gap F8's own README documents for the comp route: that a
# genuine admin session WITHOUT 'review-vendor-applications' gets 403 specifically, or that a
# genuine manager/owner session succeeds. Both require a live Firebase Auth project and are
# deferred to F10's human-proof step.
#
# Cleanup follows F8's exact pattern: `setsid` is unavailable on darwin/BSD, so process-group
# isolation uses bash job control (`set -m`) plus a `pkill -P` sweep as a fallback.
#
# Run as: bash contracts/checks/vendor-f6-review-workflow/check-http-fails-closed.sh

set -uo pipefail
set -m # job control: background jobs get their own process group (see cleanup() below)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

PORT=41738
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="$(mktemp -t saoc-f6-vendors-server.XXXXXX.log)"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill -TERM "-${SERVER_PID}" >/dev/null 2>&1
    sleep 1
    kill -KILL "-${SERVER_PID}" >/dev/null 2>&1
    pkill -P "${SERVER_PID}" >/dev/null 2>&1
  fi
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT INT TERM

failures=()

SCRUB_VARS=(
  FIREBASE_ADMIN_PROJECT_ID
  FIREBASE_ADMIN_CLIENT_EMAIL
  FIREBASE_ADMIN_PRIVATE_KEY
  NEXT_PUBLIC_FIREBASE_API_KEY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  NEXT_PUBLIC_FIREBASE_PROJECT_ID
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  NEXT_PUBLIC_FIREBASE_APP_ID
)

scrub_assignments=()
for var_name in "${SCRUB_VARS[@]}"; do
  scrub_assignments+=("${var_name}=")
done

# Scrub every live-credential env var. An empty string, not unset, so a parent shell's exported
# value can never leak through even if `env -u` is skipped by mistake in a future edit.
env "${scrub_assignments[@]}" \
  pnpm exec next dev --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Poll for readiness instead of a fixed sleep — route compilation on first request can
# legitimately take well over a minute on a cold start (see F5/F8's README "readiness timing").
ready=0
for _ in $(seq 1 150); do
  if curl -s -o /dev/null --max-time 2 "${BASE_URL}/api/admin/vendors"; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "FAIL: Next.js dev server on port ${PORT} never became reachable within 150s." >&2
  echo "--- server log ---" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

REVIEW_URL="${BASE_URL}/api/admin/vendors/does-not-exist/review"
REVIEW_BODY='{"action":"approve"}'

# --- GET /api/admin/vendors ---

status_list_no_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}/api/admin/vendors")
if [ "$status_list_no_cookie" != "401" ]; then
  failures+=("(1) GET /api/admin/vendors with no session cookie returned ${status_list_no_cookie}, expected 401.")
fi

status_list_garbage_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H 'Cookie: session=not-a-real-firebase-session-cookie' "${BASE_URL}/api/admin/vendors")
if [ "$status_list_garbage_cookie" != "401" ] && [ "$status_list_garbage_cookie" != "403" ]; then
  failures+=("(2) GET /api/admin/vendors with a garbage session cookie returned ${status_list_garbage_cookie}, expected 401 or 403.")
fi

body_list_no_cookie=$(curl -s --max-time 10 "${BASE_URL}/api/admin/vendors")
if ! echo "$body_list_no_cookie" | grep -qi 'unauthorized\|error\|forbidden'; then
  failures+=("(3) GET /api/admin/vendors with no cookie did not return a JSON refusal body (got: ${body_list_no_cookie}).")
fi

# --- POST /api/admin/vendors/[id]/review ---

status_review_no_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${REVIEW_URL}" -X POST -H 'Content-Type: application/json' -d "$REVIEW_BODY")
if [ "$status_review_no_cookie" != "401" ]; then
  failures+=("(4) POST .../review with no session cookie returned ${status_review_no_cookie}, expected 401.")
fi

status_review_garbage_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H 'Cookie: session=not-a-real-firebase-session-cookie' \
  "${REVIEW_URL}" -X POST -H 'Content-Type: application/json' -d "$REVIEW_BODY")
if [ "$status_review_garbage_cookie" != "401" ] && [ "$status_review_garbage_cookie" != "403" ]; then
  failures+=("(5) POST .../review with a garbage session cookie returned ${status_review_garbage_cookie}, expected 401 or 403.")
fi

body_review_no_cookie=$(curl -s --max-time 10 "${REVIEW_URL}" -X POST -H 'Content-Type: application/json' -d "$REVIEW_BODY")
if ! echo "$body_review_no_cookie" | grep -qi 'unauthorized\|error\|forbidden'; then
  failures+=("(6) POST .../review with no cookie did not return a JSON refusal body (got: ${body_review_no_cookie}).")
fi

if [ "${#failures[@]}" -gt 0 ]; then
  for f in "${failures[@]}"; do
    echo "FAIL: $f" >&2
  done
  echo "" >&2
  echo "${#failures[@]} assertion(s) failed." >&2
  exit 1
fi

echo "PASS: a real running Next.js server, with FIREBASE_ADMIN_* and NEXT_PUBLIC_FIREBASE_* scrubbed, refuses both GET /api/admin/vendors and POST /api/admin/vendors/[id]/review with 401/403 for no-cookie and garbage-cookie requests, over real HTTP, against the real compiled routes, without ever reaching Firestore."
exit 0

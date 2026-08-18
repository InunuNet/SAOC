#!/usr/bin/env bash
# order-reconciliation F1, A5 — POST /api/admin/reconcile-orders must fail closed on a
# missing/wrong secret, over REAL HTTP against the real compiled route, with
# FIREBASE_ADMIN_*, every NEXT_PUBLIC_FIREBASE_*, and RESEND_API_KEY explicitly scrubbed from
# the server's environment. Same technique and same reasoning as
# contracts/checks/ticketing-f8-comp-tickets/check-http-comp-fails-closed.sh: proves the auth
# guard runs BEFORE the route reaches Firestore or Resend — with those credentials scrubbed, a
# route that reached either would crash (500), not calmly return 401. A 401 in this script is
# therefore proof the request never got that far, not just proof of a status code.
#
# What this proves:
#   1. No Authorization header at all -> 401.
#   2. Authorization: Bearer <wrong-secret> -> 401.
#   3. Neither case ever returns 200/2xx or 500 — no crash-as-a-side-channel, no accidental
#      grant.
#   4. The 401 body is the route's real JSON refusal, not an empty/framework fallback page —
#      proof the request reached the real handler.
#
# What this does NOT prove: that the CORRECT secret succeeds (200) and actually alerts on real
# stranded orders — that live, credentialed path is covered by check-live-detect-and-mark.mjs
# (A4, library level, no HTTP) plus the manual verification step in this golden directory's
# README, for the same reason F8 deferred its positive-auth HTTP case: an automated gate that
# can re-run at any time must never be the thing that sends a real alert email.
#
# This script writes nothing to Firestore and sends no email — the scrub makes both physically
# impossible for the route under test to do successfully.
#
# Run as: bash .agent/memory/project/specs/order-reconciliation/goldens/check-route-auth-fails-closed.sh

set -uo pipefail
set -m # job control: background jobs get their own process group (see cleanup() below)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

PORT=41837
BASE_URL="http://127.0.0.1:${PORT}"
ROUTE_PATH="/api/admin/reconcile-orders"
SERVER_LOG="$(mktemp -t saoc-reconcile-auth-server.XXXXXX.log)"
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
  RESEND_API_KEY
  RECONCILIATION_CRON_SECRET
)

scrub_assignments=()
for var_name in "${SCRUB_VARS[@]}"; do
  scrub_assignments+=("${var_name}=")
done

env "${scrub_assignments[@]}" \
  pnpm exec next dev --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 150); do
  if curl -s -o /dev/null --max-time 2 "${BASE_URL}${ROUTE_PATH}" -X POST; then
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

# (1) No Authorization header -> 401.
status_no_auth=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${BASE_URL}${ROUTE_PATH}" -X POST)
if [ "$status_no_auth" != "401" ]; then
  failures+=("(1) POST ${ROUTE_PATH} with no Authorization header returned ${status_no_auth}, expected 401.")
fi

# (2) Wrong secret -> 401, never 200, never 500.
status_wrong_secret=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H 'Authorization: Bearer definitely-not-the-real-secret' \
  "${BASE_URL}${ROUTE_PATH}" -X POST)
if [ "$status_wrong_secret" != "401" ]; then
  failures+=("(2) POST ${ROUTE_PATH} with a wrong secret returned ${status_wrong_secret}, expected 401 (never 200, never 500).")
fi

# (3) The 401 body must be the route's real JSON refusal, not an empty/default Next.js page —
# proof the request reached the real route handler, not a stub or a framework fallback.
body_no_auth=$(curl -s --max-time 10 "${BASE_URL}${ROUTE_PATH}" -X POST)
if ! echo "$body_no_auth" | grep -qi 'unauthorized\|error\|forbidden'; then
  failures+=("(3) POST ${ROUTE_PATH} with no Authorization header did not return a JSON refusal body (got: ${body_no_auth}) -- the request may not have reached the real route handler.")
fi

if [ "${#failures[@]}" -gt 0 ]; then
  for f in "${failures[@]}"; do
    echo "FAIL: $f" >&2
  done
  echo "" >&2
  echo "${#failures[@]} assertion(s) failed." >&2
  exit 1
fi

echo "PASS: a real running Next.js server, with FIREBASE_ADMIN_*, NEXT_PUBLIC_FIREBASE_*, RESEND_API_KEY, and RECONCILIATION_CRON_SECRET all scrubbed, refuses POST ${ROUTE_PATH} with 401 for both no-Authorization and wrong-secret requests, over real HTTP, against the real compiled route, without ever reaching Firestore or Resend."
exit 0

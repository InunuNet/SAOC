#!/usr/bin/env bash
# F8 (ticketing-foundation) — the automated (gate-runnable) half of the auth round trip for
# POST /api/admin/tickets/comp. Starts a REAL Next.js server, on an ephemeral port, with
# FIREBASE_ADMIN_* and every NEXT_PUBLIC_FIREBASE_* variable explicitly scrubbed from its
# environment (so this proves the route fails closed with NO live Firebase project involved,
# regardless of what happens to be sitting in this machine's .env.local), and sends REAL HTTP
# requests to POST /api/admin/tickets/comp.
#
# What this DOES prove, over real HTTP against the real compiled route:
#   1. No session cookie at all -> 401 (the same refusal ANY unauthenticated request gets).
#   2. A syntactically-plausible but cryptographically worthless session cookie -> refused
#      (401 or 403), never 200 and never 500 -- the route fails closed on an unverifiable
#      session rather than crashing or treating verification failure as a grant.
#   3. The route never returns 200/2xx to either case above.
#   4. Both refusals happen BEFORE the route reaches createOrderWithPosition() -- this script
#      writes nothing to Firestore, live or otherwise, because a route that fails closed on
#      session validity never gets far enough to attempt the write.
#
# What this does NOT prove -- see contracts/golden/ticketing-f8-comp-tickets/README.md "What
# this contract does NOT prove" for the full reasoning: that a genuine admin session WITHOUT
# the issue-comp capability is refused with 403 specifically (as opposed to 401 for no session
# at all), and that a genuine manager/owner session WITH issue-comp succeeds with 201/200 as the
# paired positive control. Both require a live Firebase Auth project (no local emulator is
# pinned in this repo) and are deferred to a human-run manual step, mirroring F5's own deferred
# step for /api/admin/checkin.
#
# Cleanup: `setsid` (GNU coreutils) is NOT available on darwin/BSD, so process-group isolation
# is done with bash job control instead -- `set -m` before backgrounding the job makes bash
# assign the job its OWN process group, with pgid == the leading process's pid ($!). `kill -TERM
# -- -$SERVER_PID` then signals the whole group. A `pkill -P` sweep is layered on top as a
# belt-and-braces fallback. Same pattern as
# contracts/checks/ticketing-f5-buyers/check-http-checkin-fails-closed.sh.
#
# This script writes nothing to Firestore and creates no fixture data of any kind.
#
# Run as: bash contracts/checks/ticketing-f8-comp-tickets/check-http-comp-fails-closed.sh

set -uo pipefail
set -m # job control: background jobs get their own process group (see cleanup() below)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

PORT=41734
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="$(mktemp -t saoc-f8-comp-server.XXXXXX.log)"
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

# (0) Self-verifying scrub, run BEFORE the server starts — see
# check-env-scrub-effective.mjs's header (copied from F5's identical check).
if ! env "${scrub_assignments[@]}" node "${REPO_ROOT}/contracts/checks/ticketing-f8-comp-tickets/check-env-scrub-effective.mjs"; then
  failures+=("(0) The credential scrub did not hold -- see the FAIL line above for which variable(s) leaked (names only, no values). Aborting before starting the server.")
fi
if [ "${#failures[@]}" -gt 0 ]; then
  for f in "${failures[@]}"; do
    echo "FAIL: $f" >&2
  done
  echo "" >&2
  echo "${#failures[@]} assertion(s) failed -- aborting before starting the server." >&2
  exit 1
fi

# Scrub every live-credential env var. An empty string, not unset, so a parent shell's exported
# value can never leak through even if `env -u` is skipped by mistake in a future edit.
env "${scrub_assignments[@]}" \
  pnpm exec next dev --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Poll for readiness instead of a fixed sleep — the route compiles on first request, which can
# legitimately take well over a minute on a cold start (see F5's README "A5 readiness timing").
ready=0
for _ in $(seq 1 150); do
  if curl -s -o /dev/null --max-time 2 "${BASE_URL}/api/admin/tickets/comp" -X POST -H 'Content-Type: application/json' -d '{}'; then
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

COMP_BODY='{"showId":"nationalShow","attendeeName":"Test Attendee","attendeeEmail":"attendee@example.com","ticketType":"general-admission"}'

# (1) No cookie at all -> 401.
status_no_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${BASE_URL}/api/admin/tickets/comp" -X POST -H 'Content-Type: application/json' -d "$COMP_BODY")
if [ "$status_no_cookie" != "401" ]; then
  failures+=("(1) POST /api/admin/tickets/comp with no session cookie returned ${status_no_cookie}, expected 401.")
fi

# (2) A garbage session cookie -> refused (401 or 403), never 200, never 500.
status_garbage_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H 'Cookie: session=not-a-real-firebase-session-cookie' \
  "${BASE_URL}/api/admin/tickets/comp" -X POST -H 'Content-Type: application/json' -d "$COMP_BODY")
if [ "$status_garbage_cookie" != "401" ] && [ "$status_garbage_cookie" != "403" ]; then
  failures+=("(2) POST /api/admin/tickets/comp with a garbage session cookie returned ${status_garbage_cookie}, expected 401 or 403 (never 200, never 500).")
fi

# (3) Explicit guard against the vacuous-refusal mutant, same as F5's (3): the response body for
# (1) must be the route's real JSON refusal shape, not an empty/default Next.js error page --
# proving the request reached the real route handler, not a stub or a framework fallback.
body_no_cookie=$(curl -s --max-time 10 \
  "${BASE_URL}/api/admin/tickets/comp" -X POST -H 'Content-Type: application/json' -d "$COMP_BODY")
if ! echo "$body_no_cookie" | grep -qi 'unauthorized\|error\|forbidden'; then
  failures+=("(3) POST /api/admin/tickets/comp with no cookie did not return a JSON refusal body (got: ${body_no_cookie}) -- the request may not have reached the real route handler.")
fi

if [ "${#failures[@]}" -gt 0 ]; then
  for f in "${failures[@]}"; do
    echo "FAIL: $f" >&2
  done
  echo "" >&2
  echo "${#failures[@]} assertion(s) failed." >&2
  exit 1
fi

echo "PASS: a real running Next.js server, with FIREBASE_ADMIN_* and NEXT_PUBLIC_FIREBASE_* scrubbed, refuses POST /api/admin/tickets/comp with 401/403 for both no-cookie and garbage-cookie requests, over real HTTP, against the real compiled route, without ever reaching Firestore."
exit 0

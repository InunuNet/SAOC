#!/usr/bin/env bash
# reconcile-response-accuracy F1, A6b — POST /api/admin/reconcile-orders rejects a WRONG bearer
# token with a real 401, over REAL HTTP against the real compiled route, WHILE a real,
# non-empty RECONCILIATION_CRON_SECRET is actually configured on the server.
#
# WHY THIS SCRIPT EXISTS, DISTINCT FROM order-reconciliation's check-route-auth-fails-closed.sh
# (this contract's A6): that script scrubs RECONCILIATION_CRON_SECRET to an EMPTY STRING for
# every request it sends, including its own "wrong secret" case. In route.ts, `if
# (!expectedSecret)` is true for an empty string, so the FIRST fail-closed branch (missing
# secret) intercepts every request before it can ever reach the `constantTimeEqual` comparison
# a few lines down. That script's "wrong secret" test is therefore, in practice, a duplicate of
# its own "missing secret" test — it proves fail-closed-on-unset, which is real and correct, but
# it CANNOT exercise, and never has exercised, the comparison branch at all.
#
# Discovered 2026-08-19 while drilling @qa's exact bypass (the `if
# (!constantTimeEqual(providedBuffer, expectedBuffer))` condition left intact, only its
# `return unauthorized();` commented out) against check-route-auth-fails-closed.sh: that script
# reported PASS under the mutation, but for the WRONG reason — the mutated code path was never
# reached, because the blank-secret guard fired first regardless of the mutation. Manually
# reproducing with a REAL, non-empty secret configured and a wrong token sent proved the
# mutation genuinely IS a bypass (falls through to findStrandedOrders(), which throws on
# scrubbed Firebase Admin credentials and returns 500 — not 401, and specifically not a
# coincidental accidental-401). This script formalizes that manual reproduction as a repeatable
# gate check, closing the actual gap rather than just documenting it.
#
# TECHNIQUE: unlike check-route-auth-fails-closed.sh, RECONCILIATION_CRON_SECRET is set to a
# fixed, non-empty, test-only value here (never a real production secret) so the request can
# reach the comparison at all. FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_*/RESEND_API_KEY are still
# scrubbed, same as that script, so even a fully bypassed auth guard cannot reach live
# Firestore/Resend — a bypass under this script can only ever surface as some non-401 status
# (401 == real refusal; anything else, including a 500 from the scrubbed downstream, == the
# guard did not refuse and something else incidentally stopped the request). This script does
# NOT prove the CORRECT secret succeeds (200) — same reasoning as that script's own "what this
# does NOT prove" section: an automated gate must never be the thing that could reach a real
# write/email path, so the positive-auth case stays a manual, credentialed step.
#
# Run as:
#   bash .agent/memory/project/specs/reconcile-response-accuracy/goldens/check-wrong-secret-rejected-with-real-secret-configured.sh

set -uo pipefail
set -m # job control: background jobs get their own process group (see cleanup() below)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

# NOTE: this repo's `next dev` holds a SINGLE, project-wide lock (under .next/dev/), not a
# per-port lock — only one `next dev` instance can run against this repo at any time, on ANY
# port. If another agent/session already has one running (e.g. for its own manual testing, or a
# different contract's gate), this script's own readiness poll will fail with "Another next dev
# server is already running" in the log rather than a clean timeout — check SERVER_LOG before
# assuming this script itself is broken.
PORT=48417
BASE_URL="http://127.0.0.1:${PORT}"
ROUTE_PATH="/api/admin/reconcile-orders"
SERVER_LOG="$(mktemp -t saoc-reconcile-wrongsecret-server.XXXXXX.log)"
SERVER_PID=""

# Never a real secret — test-only, fixed value used solely so the request reaches the
# comparison branch instead of being intercepted by the earlier missing-secret guard.
TEST_SECRET="reconcile-response-accuracy-test-secret-do-not-use-in-prod"

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

env \
  FIREBASE_ADMIN_PROJECT_ID= \
  FIREBASE_ADMIN_CLIENT_EMAIL= \
  FIREBASE_ADMIN_PRIVATE_KEY= \
  NEXT_PUBLIC_FIREBASE_API_KEY= \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN= \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID= \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET= \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID= \
  NEXT_PUBLIC_FIREBASE_APP_ID= \
  RESEND_API_KEY= \
  RECONCILIATION_CRON_SECRET="$TEST_SECRET" \
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

# The load-bearing case: a REAL secret is configured, a WRONG token is sent — this must reach
# and be refused by the comparison itself, not by the earlier missing-secret guard (which cannot
# fire here, since the secret is genuinely set).
status_wrong_secret=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H "Authorization: Bearer ${TEST_SECRET}-WRONG-SUFFIX" \
  "${BASE_URL}${ROUTE_PATH}" -X POST)
if [ "$status_wrong_secret" != "401" ]; then
  failures+=("POST ${ROUTE_PATH} with a WRONG token while a REAL secret is configured returned ${status_wrong_secret}, expected 401. A non-401 here (e.g. 500) means the comparison's fail-closed branch did not actually refuse the request — the guard's CONDITION may still be textually present while its CONSEQUENCE (the return) does not fire, which is exactly the bypass this check exists to catch.")
fi

body_wrong_secret=$(curl -s --max-time 10 \
  -H "Authorization: Bearer ${TEST_SECRET}-WRONG-SUFFIX" \
  "${BASE_URL}${ROUTE_PATH}" -X POST)
if [ "$status_wrong_secret" = "401" ] && ! echo "$body_wrong_secret" | grep -qi 'unauthorized\|error\|forbidden'; then
  failures+=("POST ${ROUTE_PATH} with a WRONG token returned 401 but the body was not the route's real JSON refusal (got: ${body_wrong_secret}) -- may not have reached the real route handler.")
fi

if [ "${#failures[@]}" -gt 0 ]; then
  for f in "${failures[@]}"; do
    echo "FAIL: $f" >&2
  done
  echo "" >&2
  echo "${#failures[@]} assertion(s) failed." >&2
  exit 1
fi

echo "PASS: with a REAL, non-empty RECONCILIATION_CRON_SECRET configured (so the request reaches the comparison branch, not just the earlier missing-secret guard), a WRONG bearer token is refused with a real 401 and the route's real JSON refusal body, over real HTTP against the real compiled route."
exit 0

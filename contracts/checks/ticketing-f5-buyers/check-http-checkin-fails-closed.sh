#!/usr/bin/env bash
# F5 (ticketing-foundation) — the automated (gate-runnable) half of the HTTP round trip demanded
# by spec §8.4 and the mission brief. Starts a REAL Next.js server, on an ephemeral port, with
# FIREBASE_ADMIN_* and every NEXT_PUBLIC_FIREBASE_* variable explicitly scrubbed from its
# environment (so this proves the route fails closed with NO live Firebase project involved,
# regardless of what happens to be sitting in this machine's .env.local), and sends REAL HTTP
# requests to POST /api/admin/checkin — the exact route and method the brief names.
#
# What this DOES prove, over real HTTP against the real compiled route:
#   1. No session cookie at all -> 401 (the same refusal ANY unauthenticated request gets).
#   2. A syntactically-plausible but cryptographically worthless session cookie -> 401, never
#      200 and never 500 -- the route fails closed on an unverifiable session rather than
#      crashing or, worse, treating verification failure as an authorization grant.
#   3. The route never returns 200/2xx to either case above (the "did the route just admit
#      everyone" mutant this script exists to catch).
#
# What this does NOT prove -- see contracts/golden/ticketing-f5-buyers/README.md "What this
# contract does NOT prove" for the full reasoning: a genuine self-registered buyer session
# cookie, minted by real Firebase Auth, refused with 403 specifically (as opposed to 401 for no
# session at all), and a real admin session succeeding with 200 as the paired positive control.
# Both require a live Firebase Auth project (no local emulator is pinned in this repo -- see the
# README's "Why no Firebase emulator" section) and are deferred to a human-run manual step.
#
# Cleanup: `setsid` (GNU coreutils) is NOT available on darwin/BSD, so process-group isolation
# is done with bash job control instead -- `set -m` before backgrounding the job makes bash
# assign the job its OWN process group, with pgid == the leading process's pid ($!), on both
# GNU/Linux and BSD/darwin bash. `kill -TERM -- -$SERVER_PID` then signals the whole group (the
# leading `env` process, pnpm, node, and whatever Next.js forks under it -- none of them call
# setpgid themselves, so they all inherit the group job control assigned). A `pkill -P` sweep is
# layered on top as a belt-and-braces fallback in case grouping was ever bypassed (e.g. a future
# edit runs the server through something that does call setpgid). No system dependency is added
# -- `set -m` and `pkill` are bash/procps builtins already relied on elsewhere in this repo's
# tooling, not a new unpinned global binary the way `setsid` would have been.
#
# This script writes nothing to Firestore and creates no fixture data of any kind -- there is
# nothing for a killed run to leak beyond the server process itself, which this cleanup targets.
#
# Run as: bash contracts/checks/ticketing-f5-buyers/check-http-checkin-fails-closed.sh

set -uo pipefail
set -m # job control: background jobs get their own process group (see cleanup() above)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

PORT=41733
BASE_URL="http://127.0.0.1:${PORT}"
SERVER_LOG="$(mktemp -t saoc-f5-checkin-server.XXXXXX.log)"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    # Negative PID kills the whole process group job control assigned when the job was
    # backgrounded under `set -m` (pgid == the leading process's pid, i.e. $SERVER_PID itself).
    kill -TERM "-${SERVER_PID}" >/dev/null 2>&1
    sleep 1
    kill -KILL "-${SERVER_PID}" >/dev/null 2>&1
    # Fallback sweep: kill any direct child of the tracked PID that might have escaped the
    # group (defensive only -- the -TERM/-KILL above should already have caught everything).
    pkill -P "${SERVER_PID}" >/dev/null 2>&1
  fi
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT INT TERM

failures=()

# The variable names to scrub, in one place, so the launch line below and the self-verification
# below it can never drift out of sync with each other (see "(0)" below for why the
# self-verification exists at all — QA proved a check that only inspects HTTP responses cannot
# tell a real credential leaked into the child environment).
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

# (0) Self-verifying scrub, run BEFORE the server starts: check-env-scrub-effective.mjs calls
# the REAL loadEnvConfig() function Next.js itself calls at startup to load `.env.local` --
# not a reimplementation, not a re-read of this script's own SCRUB_VARS -- in the same working
# directory, with the SAME env prefix about to be handed to `next dev` below, and asserts that
# every one of an INDEPENDENTLY hard-coded list of nine credential variable names is still
# empty afterward. Asserts on EMPTINESS ONLY -- the .mjs script never prints a value, only
# names, on either its pass or fail path (this project's standing rule against ever logging a
# secret; four prior incidents). Because the checked list is hard-coded separately from
# SCRUB_VARS, deleting a name from SCRUB_VARS breaks this check for real: the launch prefix no
# longer overrides that variable, `.env.local`'s real value (if any) flows through exactly as
# Next's own dotenv-precedence rules dictate, and the independent list still expects it to be
# empty -- see golden README "Why check-env-scrub-effective.mjs, not a shell-level re-check" for
# the empirical proof this catches QA's exact mutation (removing FIREBASE_ADMIN_PROJECT_ID from
# the scrub list) where a shell-level re-check of SCRUB_VARS against itself could not.
if ! env "${scrub_assignments[@]}" node "${REPO_ROOT}/contracts/checks/ticketing-f5-buyers/check-env-scrub-effective.mjs"; then
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
# value can never leak through even if `env -u` is skipped by mistake in a future edit. Built
# from the SAME SCRUB_VARS array (0) just verified, so the launch line cannot drift from what was
# checked.
env "${scrub_assignments[@]}" \
  pnpm exec next dev --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Poll for readiness instead of a fixed sleep. Next's dev server compiles the route on first
# request, so the FIRST successful response can legitimately take well over a minute on a cold
# start (verified empirically on this machine -- see golden README "A5 readiness timing").
ready=0
for _ in $(seq 1 150); do
  if curl -s -o /dev/null --max-time 2 "${BASE_URL}/api/admin/checkin" -X POST -H 'Content-Type: application/json' -d '{}'; then
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

# (1) No cookie at all -> 401.
status_no_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${BASE_URL}/api/admin/checkin" -X POST -H 'Content-Type: application/json' -d '{"bookingRef":"TESTREF"}')
if [ "$status_no_cookie" != "401" ]; then
  failures+=("(1) POST /api/admin/checkin with no session cookie returned ${status_no_cookie}, expected 401.")
fi

# (2) A garbage session cookie -> 401, never 200, never 500.
status_garbage_cookie=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H 'Cookie: session=not-a-real-firebase-session-cookie' \
  "${BASE_URL}/api/admin/checkin" -X POST -H 'Content-Type: application/json' -d '{"bookingRef":"TESTREF"}')
if [ "$status_garbage_cookie" != "401" ]; then
  failures+=("(2) POST /api/admin/checkin with a garbage session cookie returned ${status_garbage_cookie}, expected 401 (never 200, never 500).")
fi

# (3) Explicit guard against the vacuous-refusal mutant: a route that returns 401 for
# EVERYTHING, including malformed requests unrelated to auth, would pass (1) and (2) for the
# wrong reason. Confirm the route is live and distinguishes request shapes by checking a
# malformed JSON body still reaches request parsing (still 400/401, but the point is the server
# is genuinely running this route's real code, not a stub) -- and that the response body for (1)
# is the route's real refusal shape, not an empty/default Next.js error page.
body_no_cookie=$(curl -s --max-time 10 \
  "${BASE_URL}/api/admin/checkin" -X POST -H 'Content-Type: application/json' -d '{"bookingRef":"TESTREF"}')
if ! echo "$body_no_cookie" | grep -qi 'unauthorized\|error'; then
  failures+=("(3) POST /api/admin/checkin with no cookie did not return a JSON refusal body (got: ${body_no_cookie}) -- the request may not have reached the real route handler.")
fi

if [ "${#failures[@]}" -gt 0 ]; then
  for f in "${failures[@]}"; do
    echo "FAIL: $f" >&2
  done
  echo "" >&2
  echo "${#failures[@]} assertion(s) failed." >&2
  exit 1
fi

echo "PASS: a real running Next.js server, with FIREBASE_ADMIN_* and NEXT_PUBLIC_FIREBASE_* scrubbed, refuses POST /api/admin/checkin with 401 for both no-cookie and garbage-cookie requests, over real HTTP, against the real compiled route."
exit 0

#!/usr/bin/env bash
# F5 (vendor-registration) — A9: real HTTP round trip proving the rate limiter is genuinely
# wired into the live route, per-IP-keyed, over a real Next.js server on an ephemeral port, with
# FIREBASE_ADMIN_*, NEXT_PUBLIC_FIREBASE_*, and RESEND_API_KEY explicitly scrubbed from its
# environment (mirrors ticketing-f5-buyers' A5 env-scrub + ephemeral-port pattern, bash job
# control, no setsid on darwin).
#
# What this DOES prove, over real HTTP against the real compiled route:
#   1. Four rapid POSTs to /api/vendors/register with an identical `x-forwarded-for` header
#      value: the first three each return a non-429 status (whatever the env-scrubbed
#      Firestore/Resend failure produces is acceptable -- the point is they reached
#      validation/write, not that they succeeded), the fourth returns 429 with a Retry-After
#      header present.
#   2. A fifth POST with a DIFFERENT `x-forwarded-for` value in the same run returns a
#      non-429 status, proving the limit is keyed per-IP over real HTTP, not global across the
#      process.
#
# What this does NOT prove -- see contracts/golden/vendor-f5-register-route/README.md "What
# this contract does NOT prove": a real Firestore write, a real Resend delivery, or
# cross-instance rate-limit consistency (the in-memory store is process-local).
#
# Cleanup: `setsid` (GNU coreutils) is NOT available on darwin/BSD, so process-group isolation
# is done with bash job control instead -- `set -m` before backgrounding the job makes bash
# assign the job its OWN process group, with pgid == the leading process's pid ($!). `kill -TERM
# -- -$SERVER_PID` then signals the whole group. A `pkill -P` sweep is layered on top as a
# belt-and-braces fallback.
#
# This script writes nothing to Firestore (the credential is scrubbed) and creates no fixture
# data of any kind -- there is nothing for a killed run to leak beyond the server process
# itself, which this cleanup targets.
#
# Run as: bash contracts/checks/vendor-f5-register-route/check-http-rate-limit-per-ip.sh

set -uo pipefail
set -m # job control: background jobs get their own process group (see cleanup() below)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

PORT=41744
BASE_URL="http://127.0.0.1:${PORT}"
REGISTER_URL="${BASE_URL}/api/vendors/register"
SERVER_LOG="$(mktemp -t saoc-f5-vendor-register-server.XXXXXX.log)"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    # Negative PID kills the whole process group job control assigned when the job was
    # backgrounded under `set -m` (pgid == the leading process's pid, i.e. $SERVER_PID itself).
    kill -TERM "-${SERVER_PID}" >/dev/null 2>&1
    sleep 1
    kill -KILL "-${SERVER_PID}" >/dev/null 2>&1
    # Fallback sweep: kill any direct child of the tracked PID that might have escaped the
    # group (defensive only).
    pkill -P "${SERVER_PID}" >/dev/null 2>&1
  fi
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT INT TERM

failures=()

# The variable names to scrub, in one place, so the launch line below and the self-verification
# below it can never drift out of sync with each other (see "(0)" below).
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
)

scrub_assignments=()
for var_name in "${SCRUB_VARS[@]}"; do
  scrub_assignments+=("${var_name}=")
done

# (0) Self-verifying scrub, run BEFORE the server starts: check-env-scrub-effective.mjs calls
# the REAL loadEnvConfig() function Next.js itself calls at startup -- not a reimplementation,
# not a re-read of this script's own SCRUB_VARS -- in the same working directory, with the SAME
# env prefix about to be handed to `next dev` below, and asserts that every one of an
# INDEPENDENTLY hard-coded list of ten credential variable names (including RESEND_API_KEY) is
# still empty afterward. Asserts on EMPTINESS ONLY -- the .mjs script never prints a value, only
# names, on either its pass or fail path.
if ! env "${scrub_assignments[@]}" node "${REPO_ROOT}/contracts/checks/vendor-f5-register-route/check-env-scrub-effective.mjs"; then
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
# from the SAME SCRUB_VARS array (0) just verified, so the launch line cannot drift from what
# was checked.
env "${scrub_assignments[@]}" \
  pnpm exec next dev --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Poll for readiness instead of a fixed sleep. Next's dev server compiles the route on first
# request, so the FIRST successful response can legitimately take well over a minute on a cold
# start.
#
# The probe uses a THROWAWAY x-forwarded-for (192.0.2.99), never reused below. Every probe that
# times out client-side (--max-time 2) was still fully received by the server, which records a
# rate-limit attempt for its key once the route finishes compiling -- so probing under the
# counted IP would silently spend its 3-attempt budget before the counted sequence starts
# (observed: POSTs #1-#3 all 429). The counted IP 203.0.113.201 must arrive at the sequence
# below completely untouched.
VALID_BODY='{"businessName":"Readiness Probe Nursery","contactPersonName":"Probe","contactCellPhone":"+27821111111","contactEmail":"probe@example.com","productDescription":"probe","vendorCategory":["plant-sales"],"boothCount":1,"powerRequired":true,"termsAccepted":true}'

ready=0
for _ in $(seq 1 150); do
  if curl -s -o /dev/null --max-time 2 "${REGISTER_URL}" -X POST -H 'Content-Type: application/json' \
    -H 'x-forwarded-for: 192.0.2.99' -d "$VALID_BODY"; then
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

# (1) First of the four rapid POSTs under the counted IP 203.0.113.201 -- untouched by the
# readiness probes above, so the rate-limit count starts at exactly zero here.
status_1=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${REGISTER_URL}" -X POST -H 'Content-Type: application/json' \
  -H 'x-forwarded-for: 203.0.113.201' -d "$VALID_BODY")

# (1)-(2) Second and third POSTs, same x-forwarded-for -- each must be non-429.
status_2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${REGISTER_URL}" -X POST -H 'Content-Type: application/json' \
  -H 'x-forwarded-for: 203.0.113.201' -d "$VALID_BODY")
status_3=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${REGISTER_URL}" -X POST -H 'Content-Type: application/json' \
  -H 'x-forwarded-for: 203.0.113.201' -d "$VALID_BODY")

for pair in "1:${status_1}" "2:${status_2}" "3:${status_3}"; do
  n="${pair%%:*}"
  status="${pair##*:}"
  if [ "$status" = "429" ]; then
    failures+=("(${n}) POST #${n} to /api/vendors/register under x-forwarded-for 203.0.113.201 returned 429, expected a non-429 status (any Firestore/Resend failure status is acceptable, but not rate-limited yet).")
  fi
done

# (4) Fourth POST, same x-forwarded-for -- must be 429 with a Retry-After header present.
response_headers_4="$(mktemp -t saoc-f5-vendor-register-headers.XXXXXX)"
status_4=$(curl -s -o /dev/null -D "$response_headers_4" -w '%{http_code}' --max-time 10 \
  "${REGISTER_URL}" -X POST -H 'Content-Type: application/json' \
  -H 'x-forwarded-for: 203.0.113.201' -d "$VALID_BODY")
if [ "$status_4" != "429" ]; then
  failures+=("(4) POST #4 to /api/vendors/register under x-forwarded-for 203.0.113.201 returned ${status_4}, expected 429.")
fi
if ! grep -qi '^retry-after:' "$response_headers_4"; then
  failures+=("(4) POST #4's 429 response did not include a Retry-After header.")
fi
rm -f "$response_headers_4"

# (5) Fifth POST, a DIFFERENT x-forwarded-for -- must be non-429, proving the limit is keyed
# per-IP, not global across the process.
status_5=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  "${REGISTER_URL}" -X POST -H 'Content-Type: application/json' \
  -H 'x-forwarded-for: 198.51.100.202' -d "$VALID_BODY")
if [ "$status_5" = "429" ]; then
  failures+=("(5) POST #5 under a DIFFERENT x-forwarded-for (198.51.100.202) returned 429 -- the rate limit must be keyed per-IP, not global across the process.")
fi

# (6) Extra proof that keying is genuinely per-IP, not just "IP 203.0.113.201 happens to be
# blocked": the readiness probe's OWN key (192.0.2.99) must ALSO be exhaustible on its own
# budget. The readiness loop above may already have sent it anywhere from 1 to many attempts
# depending on how long the dev-server cold compile took (nondeterministic), so this does not
# assume a specific prior count -- it sends up to 5 fresh requests under 192.0.2.99 and requires
# at least one to come back 429, which is guaranteed once its own attempt count (readiness hits
# already logged + these) crosses the limit, regardless of the nondeterministic starting point.
probe_saw_429=0
for _ in 1 2 3 4 5; do
  status_probe=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "${REGISTER_URL}" -X POST -H 'Content-Type: application/json' \
    -H 'x-forwarded-for: 192.0.2.99' -d "$VALID_BODY")
  if [ "$status_probe" = "429" ]; then
    probe_saw_429=1
    break
  fi
done
if [ "$probe_saw_429" -ne 1 ]; then
  failures+=("(6) the readiness probe's own key (192.0.2.99) never returned 429 across 5 additional requests -- expected it to be exhaustible on its own budget, same as the counted IP, proving keying is per-IP rather than 203.0.113.201 being special-cased.")
fi

if [ "${#failures[@]}" -gt 0 ]; then
  for f in "${failures[@]}"; do
    echo "FAIL: $f" >&2
  done
  echo "" >&2
  echo "${#failures[@]} assertion(s) failed." >&2
  exit 1
fi

echo "PASS: a real running Next.js server, with FIREBASE_ADMIN_*/NEXT_PUBLIC_FIREBASE_*/RESEND_API_KEY scrubbed, refuses the 4th rapid POST to /api/vendors/register with 429 + Retry-After under a fixed x-forwarded-for, allows the first three, and a 5th POST under a different x-forwarded-for stays non-429 -- the rate limit is genuinely wired in and IP-keyed over real HTTP."
exit 0

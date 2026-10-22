#!/usr/bin/env bash
# Runs the Playwright E2E suite, retrying ONCE if (and only if) the dev server never became ready.
#
# Why: Turbopack's next/font/google handling has no dev fallback for a partial Google Fonts
# failure. When fonts.googleapis.com / fonts.gstatic.com hiccup during the first compile, every
# route returns 500 ("next/font/google queries have exactly one entry") for the life of the
# process, and Playwright dies at "Timed out waiting 120000ms from config.webServer." (CI runs
# 39806856211 and 39831699794; both passed on re-run). The bad state also persists in
# .next/dev, so the retry clears it first. The retry fires only when BOTH the webServer timeout
# AND the next/font/google failure signature are in the log: a timeout alone can be a real
# startup or compile regression and must stay red. Test failures are never retried here
# (Playwright's own per-test retry still applies).
set -uo pipefail

SERVER_TIMEOUT_MARKER='Timed out waiting .* from config.webServer'
FONT_FAILURE_MARKER='next/font/google queries have exactly one entry'
LOG_FILE="$(mktemp)"
trap 'rm -f "$LOG_FILE"' EXIT

pnpm test:e2e 2>&1 | tee "$LOG_FILE"
status=${PIPESTATUS[0]}

if [ "$status" -ne 0 ] && grep -Eq "$SERVER_TIMEOUT_MARKER" "$LOG_FILE" \
  && grep -Fq "$FONT_FAILURE_MARKER" "$LOG_FILE"; then
  echo "::warning::E2E dev server never became ready (known Turbopack/next-font flake); retrying once with a clean .next/dev"
  rm -rf .next/dev
  pnpm test:e2e
  exit $?
fi

exit "$status"

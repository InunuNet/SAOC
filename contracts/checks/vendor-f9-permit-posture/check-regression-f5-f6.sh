#!/usr/bin/env bash
# F9 (vendor-registration) — A6/A7 combined regression runner. Re-runs every executable check
# script from F5 (register route) and F6 (review workflow) unchanged, to prove F9's edits to
# emails/VendorRegistrationConfirmation.tsx and the admin review UI did not regress either
# feature's already-proven properties (write-before-email, rate limiting, capability gating,
# closed transition machine, etc).
#
# Named per-feature so a failure attributes to the right prior contract rather than a vague
# "something broke": F5 failures are reported under the F5- prefix, F6 under F6-.
#
# Run as: bash contracts/checks/vendor-f9-permit-posture/check-regression-f5-f6.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

failures=()

run_checks() {
  local label="$1"
  local dir="$2"

  for script in "$dir"/*.mjs "$dir"/*.sh; do
    [ -e "$script" ] || continue
    case "$script" in
      *tsconfig*) continue ;;
      # check-env-scrub-effective.mjs is NOT an independent top-level assertion in F5's own
      # contract (contract-vendor-f5-register-route.yaml has no A-id for it) -- it is an
      # internal helper that check-http-rate-limit-per-ip.sh (A9) invokes itself, WITH the
      # identical scrub env prefix it is about to launch the real dev server with (see that
      # script's own "(0) Self-verifying scrub" comment and this .mjs's own header: "invoked by
      # check-http-rate-limit-per-ip.sh with the identical env prefix it uses to launch the
      # real server"). Running it standalone here, with no scrub prefix applied, makes it read
      # a real .env.local and false-positive on every machine that has real credentials --
      # exactly what happened during this contract's own development. A9 below already
      # exercises it correctly as part of check-http-rate-limit-per-ip.sh's own run.
      *check-env-scrub-effective.mjs) continue ;;
    esac

    # Each check script declares its own required invocation in a "// Run as: ..."
    # (or "# Run as: ...") comment -- some F6/F5 checks need `node --import tsx/esm` or
    # `npx tsx` rather than plain `node` because they import real .ts source modules.
    # Reuse that declared command verbatim instead of guessing, so this regression runner
    # never silently mis-invokes a script into a false failure.
    run_line="$(grep -m1 -E 'Run as:' "$script" || true)"
    cmd="${run_line#*Run as: }"

    if [ -z "$cmd" ]; then
      failures+=("$label: $(basename "$script") has no '// Run as:' comment to invoke it by")
      continue
    fi

    ( cd "$REPO_ROOT" && eval "$cmd" ) >/tmp/f9-regression-out.log 2>&1
    status=$?

    if [ "$status" -ne 0 ]; then
      failures+=("$label: $(basename "$script") exited $status")
      echo "--- $label: $(basename "$script") output ---"
      cat /tmp/f9-regression-out.log
    fi
  done
}

run_checks "F5" "contracts/checks/vendor-f5-register-route"
run_checks "F6" "contracts/checks/vendor-f6-review-workflow"

if [ "${#failures[@]}" -gt 0 ]; then
  echo "FAIL: regression in prior vendor-registration feature checks:"
  printf ' - %s\n' "${failures[@]}"
  exit 1
fi

echo "PASS: all F5 and F6 check scripts still pass after F9's edits."
exit 0

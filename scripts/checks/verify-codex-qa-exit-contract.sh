#!/usr/bin/env bash
# verify-codex-qa-exit-contract.sh — prove execution/codex_qa.sh's exit-code contract
# in BOTH directions, against the real script, with a stubbed `codex`.
#
# WHY THIS EXISTS
# ---------------
# A39 is a `type: codex_qa` assertion. contract.py maps that wrapper's exit code to the
# verdict: 0 -> pass, 1 -> fail, 2 -> wrapper error, anything else -> inconclusive. If the
# wrapper ever stopped deriving its exit code from the verdict token, a FAIL would read
# green and A39 would become a light that cannot go red — inside the very contract meant
# to stop assertions satisfiable by something other than the real property.
#
# On 2026-09-09 a FAIL verdict was observed alongside exit status 0. Reproduced here: that
# is what a PIPELINE reports (`codex_qa.sh ... | head` yields head's status, not the
# wrapper's), not what the wrapper returns. The wrapper is correct. contract.py invokes it
# via subprocess with no shell and no pipe, so it reads the real status.
#
# This check pins that, so the belief is tested rather than remembered.
#
# Exit 0 = contract holds. Exit 1 = a case failed. Exit 2 = harness broken.
set -u

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
WRAPPER="$ROOT/execution/codex_qa.sh"
STUBDIR="$ROOT/scripts/checks/fixtures"

[ -x "$WRAPPER" ] || { echo "harness: $WRAPPER missing or not executable" >&2; exit 2; }
[ -x "$STUBDIR/codex-stub" ] || { echo "harness: codex-stub missing or not executable" >&2; exit 2; }

# The stub must be found as `codex`, so give it that name in a scratch bin dir.
BIN="$(mktemp -d)" || { echo "harness: mktemp failed" >&2; exit 2; }
cp -- "$STUBDIR/codex-stub" "$BIN/codex" || { echo "harness: could not stage stub" >&2; exit 2; }
chmod +x "$BIN/codex"

fail=0
run_case() {
  local verdict="$1" want="$2" label="$3" got
  CODEX_STUB_VERDICT="$verdict" PATH="$BIN:$PATH" \
    bash "$WRAPPER" "review this" >/dev/null 2>&1
  got=$?
  if [ "$got" -eq "$want" ]; then
    printf 'PASS  %-46s exit=%s\n' "$label" "$got"
  else
    printf 'FAIL  %-46s exit=%s want=%s\n' "$label" "$got" "$want"; fail=1
  fi
}

# The direction that matters most: a FAIL verdict MUST NOT exit 0.
run_case FAIL    1 "FAIL verdict exits 1 (never 0)"
run_case PASS    0 "PASS verdict exits 0"
run_case GARBAGE 1 "unparseable verdict fails closed, exits 1"
run_case EMPTY   1 "empty codex output fails closed, exits 1"

# And the pipeline trap that caused the original misdiagnosis, asserted as a known fact
# so nobody re-derives it as a wrapper bug.
CODEX_STUB_VERDICT=FAIL PATH="$BIN:$PATH" bash "$WRAPPER" "review this" 2>/dev/null | head -1 >/dev/null
if [ "$?" -eq 0 ]; then
  printf 'PASS  %-46s (pipeline masks it — read $? directly)\n' "piped FAIL reports the pipe's status"
else
  printf 'FAIL  %-46s expected the pipeline to mask the status\n' "piped FAIL reports the pipe's status"; fail=1
fi

exit "$fail"

#!/usr/bin/env bash
# A10 — THE ORDERING CHECKS ARE THEMSELVES MUTATION-TESTED, PERMANENTLY.
#
# Covers BOTH A4 (the ITN sequence and the recovery-secret guard) and A9 (the readiness verdict
# gating the reservation write). Both had the same defect and both were repaired the same way,
# so both carry their proofs here rather than in prose.
#
# A4's ordering claim was, for a while, satisfiable by a trailing comment: its filter skipped a line
# only when the LEADING non-whitespace was a comment marker. @qa proved three mutations against real
# source that left A4 GREEN:
#
#   P1  delete the RECOVERY_TOKEN_SECRET guard, leave `const decoy = 0; // RECOVERY_TOKEN_SECRET …`
#   P3  move the real env read to the END of the file, AFTER the write, leaving a trailing comment
#       where it used to be — so the check asserted no ordering at all, only "this string appears
#       earlier on a line not starting with //"
#   Q1  replace the amount comparison with `false // AMOUNT_MATCH_TOLERANCE comparison removed`
#       — the guard that stops someone paying R1 for an R250 ticket, deleted with the gate green
#
# A fourth, found while fixing those: a token surviving only inside a LOG STRING also satisfied a
# bare-token search, and this very file contains `console.error('… Missing RECOVERY_TOKEN_SECRET …')`.
# Comment-stripping alone would not have caught it; A4's landmarks now match code constructs
# (`process.env.RECOVERY_TOKEN_SECRET`, `>= AMOUNT_MATCH_TOLERANCE`) rather than names.
#
# A hardening that is not itself mutation-tested is exactly how the weakness returns, so the
# mutations are standing regressions rather than a one-off proof. Each is applied to a COPY; the
# real routes are never touched.
#
# WHAT MAKES THIS FAIL: A4 or A9 going green on any mutation (the hole is back); either going red on
# the unmutated control (broken in a way that would make every mutation "pass" vacuously); or the
# mutation sources no longer being locatable, which is refused rather than reported as a clean run.
#
# Run as: bash contracts/checks/payment-seam-f2/check-ordering-mutations.sh
set -uo pipefail

A4=contracts/checks/payment-seam-f2/check-sequence-and-ownership.sh
A9=contracts/checks/payment-seam-f2/check-readiness-precedes-write.sh
CHECKOUT=app/api/tickets/checkout/route.ts
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
status=0

run_a4() {  # $1 = checkout path to test against
  CHECKOUT_PATH_OVERRIDE="$1" bash "$A4" >/dev/null 2>&1
}

run_a9() {  # $1 = checkout path to test against
  CHECKOUT_PATH_OVERRIDE="$1" bash "$A9" >/dev/null 2>&1
}

# --- CONTROL FIRST. A4 must be green on unmutated source, or every "mutation detected" below is
#     vacuous — a check that fails on everything detects nothing.
cp "$CHECKOUT" "$WORK/control.ts"
if run_a4 "$WORK/control.ts"; then
  echo "  control: A4 green on unmutated source"
else
  echo "FAIL A10: A4 is RED on unmutated source. Every mutation result below would be meaningless."
  status=1
fi
if run_a9 "$WORK/control.ts"; then
  echo "  control: A9 green on unmutated source"
else
  echo "FAIL A10: A9 is RED on unmutated source. Every mutation result below would be meaningless."
  status=1
fi

expect_red() {  # $1 = label, $2 = file
  if run_a4 "$2"; then
    echo "FAIL A10: mutation $1 left A4 GREEN — the ordering claim does not hold."
    status=1
  else
    echo "  $1: detected (A4 red)"
  fi
}

expect_red_a9() {  # $1 = label, $2 = file
  if run_a9 "$2"; then
    echo "FAIL A10: mutation $1 left A9 GREEN — the readiness gate does not hold."
    status=1
  else
    echo "  $1: detected (A9 red)"
  fi
}

# --- P1: guard deleted, only a trailing comment remains.
python3 - "$CHECKOUT" "$WORK/P1.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
text = text.replace("  const recoveryTokenSecret = process.env.RECOVERY_TOKEN_SECRET;",
                    "  const decoy = 0; // RECOVERY_TOKEN_SECRET must be set")
open(dst, "w").write(text)
PY
expect_red "P1 (guard deleted, trailing comment left)" "$WORK/P1.ts"

# --- P3: the real read moved to the END of the file, after the write; comment left behind.
python3 - "$CHECKOUT" "$WORK/P3.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = "  const recoveryTokenSecret = process.env.RECOVERY_TOKEN_SECRET;"
text = text.replace(real, "  const recoveryTokenSecret = ''; // process.env.RECOVERY_TOKEN_SECRET")
text += "\nconst movedLate = process.env.RECOVERY_TOKEN_SECRET;\n"
open(dst, "w").write(text)
PY
expect_red "P3 (read moved after the write, comment left in place)" "$WORK/P3.ts"

# --- Q1: the amount comparison replaced by a constant, name kept in a trailing comment.
#     Applies to the ITN route, so it is driven through the ITN override.
python3 - app/api/tickets/itn/route.ts "$WORK/Q1-itn.ts" <<'PY'
import sys, re
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
text = re.sub(r">=\s*AMOUNT_MATCH_TOLERANCE",
              "> 1e12 // >= AMOUNT_MATCH_TOLERANCE comparison removed",
              text, count=1)
open(dst, "w").write(text)
PY
if ITN_PATH_OVERRIDE="$WORK/Q1-itn.ts" bash "$A4" >/dev/null 2>&1; then
  echo "FAIL A10: mutation Q1 left A4 GREEN — the amount-comparison landmark is not asserted."
  status=1
else
  echo "  Q1 (amount comparison replaced, name kept in a comment): detected (A4 red)"
fi

# --- A9's mutations. A9's first form asserted the source POSITION of a readiness() CALL and nothing
#     more, so R1 and R2 both left it GREEN against copies of the real route. They are the reason A9
#     now asserts the whole chain — probe, captured verdict, negative test, 500 return, all before
#     the write — instead of one line number.
#
#       R1  the probe replaced by a fabricated `{ ready: true }` with the call name left in a
#           trailing comment, and a REAL probe appended after the write. The old check reported
#           "refuses at line 319" about a comment while the genuine call ran after the reservation.
#       R2  the verdict DISCARDED: `paymentProvider.readiness('initiate');` — no assignment, no
#           branch, no refusal. The deeper of the two: a probe whose answer is thrown away is
#           indistinguishable from no probe, and a claim about a call's position cannot tell them
#           apart.
#       R3  the refusal's condition neutered to `if (false)`, the real test left in a comment.
#       R5  the captured verdict overwritten with a fabricated `{ ready: true }` between the probe
#           and the test — every position still holds, the guard does not.
#       R7  the probe asking readiness('verify-notification') instead of 'initiate' — a check that
#           only looks for a readiness CALL cannot tell which question was asked, and the wrong one
#           would demand a passphrase checkout does not need.
#       R6  the refusal branch EMPTIED, keeping the test. The route's recovery-secret guard has its
#           own 500 sitting between the test and the write, so a window-wide search for `status:
#           500` was satisfied by a NEIGHBOUR's refusal while this branch did nothing. A9 now scopes
#           the refusal to the branch body by brace count.

if python3 - "$CHECKOUT" "$WORK" <<'MUTPY'
import sys
src_path, work = sys.argv[1], sys.argv[2]
text = open(src_path).read()
probe = "    gatewayReadiness = paymentProvider.readiness('initiate');"
test = "  if (!gatewayReadiness.ready) {"
refusal_block = """  if (!gatewayReadiness.ready) {
    console.error('[tickets/checkout] Payment gateway is not configured.', {
      reason: gatewayReadiness.reason,
      missing: gatewayReadiness.missing,
    });
    return NextResponse.json(
      { error: 'Payment gateway is not configured. Please try again later.' },
      { status: 500 }
    );
  }"""
missing = [
    name
    for name, needle in (("probe", probe), ("test", test), ("refusal block", refusal_block))
    if needle not in text
]
if missing:
    # A harness that silently wrote UNMUTATED copies would report every mutation as "detected"
    # while proving nothing. Refuse rather than fabricate a pass.
    sys.exit(f"A10: cannot locate the {', '.join(missing)} line(s) to mutate in {src_path}")

fabricated = "    gatewayReadiness = { ready: true }; // paymentProvider.readiness('initiate') moved later"
open(f"{work}/R1.ts", "w").write(
    text.replace(probe, fabricated) + "\nconst movedLate = paymentProvider.readiness('initiate');\n"
)
open(f"{work}/R2.ts", "w").write(text.replace(probe, "    paymentProvider.readiness('initiate');"))
open(f"{work}/R3.ts", "w").write(text.replace(test, "  if (false) { // !gatewayReadiness.ready"))
open(f"{work}/R5.ts", "w").write(text.replace(test, "  gatewayReadiness = { ready: true };\n" + test))
open(f"{work}/R6.ts", "w").write(text.replace(refusal_block, """  if (!gatewayReadiness.ready) {
    console.error('[tickets/checkout] Payment gateway is not configured.');
  }"""))
open(f"{work}/R7.ts", "w").write(
    text.replace(probe, probe.replace("'initiate'", "'verify-notification'"))
)
MUTPY
then
  expect_red_a9 "R1 (fabricated verdict, real probe moved after the write)" "$WORK/R1.ts"
  expect_red_a9 "R2 (verdict discarded — call present, answer thrown away)" "$WORK/R2.ts"
  expect_red_a9 "R3 (refusal condition neutered to if (false))" "$WORK/R3.ts"
  expect_red_a9 "R5 (verdict overwritten with a fabricated ready: true)" "$WORK/R5.ts"
  expect_red_a9 "R6 (refusal branch emptied; a neighbouring guard's 500 remains)" "$WORK/R6.ts"
  expect_red_a9 "R7 (probes the wrong operation: verify-notification, not initiate)" "$WORK/R7.ts"
else
  echo "FAIL A10: the A9 mutations could not be built, so no verdict on A9 is possible."
  status=1
fi

# --- The stripper's own self-test. If code_lines.py stops discriminating, every result above is
#     unreliable even when the numbers look right.
if python3 contracts/checks/payment-seam-f2/code_lines.py --self-test >/dev/null 2>&1; then
  echo "  code_lines self-test: green"
else
  echo "FAIL A10: code_lines.py self-test failed — the comment stripper no longer discriminates."
  status=1
fi

[ "$status" -eq 0 ] && echo "PASS A10: A4 and A9 are both green on real source and red on all nine recorded mutations."
exit "$status"

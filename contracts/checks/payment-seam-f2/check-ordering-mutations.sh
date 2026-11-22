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

# EVERY mutation goes through mutant_ok. The harness runs without -e, so a builder whose
# `assert real in text` fails exits 1 WITHOUT writing the mutant; the check then fails merely because
# the override file does not exist, and the mutation used to be reported "detected". A mutation that
# was never applied proves nothing, so: builder exit non-zero, missing/empty output, or an output
# byte-identical to its source (a no-op mutant) is "MUTATION NOT APPLIED" and fails the harness.
#   usage: <builder> ; mutant_ok ID SOURCE_FILE MUTANT_FILE $?   (call it directly after the builder)
mutant_ok() {
  local id="$1" src="$2" dst="$3" rc="$4"
  if [ "$rc" -ne 0 ]; then
    echo "FAIL A10: MUTATION NOT APPLIED: $id (builder exited $rc; its target text no longer matches $src)"
    status=1; return 1
  fi
  if [ ! -s "$dst" ]; then
    echo "FAIL A10: MUTATION NOT APPLIED: $id (no mutant written to $dst)"
    status=1; return 1
  fi
  if cmp -s "$src" "$dst"; then
    echo "FAIL A10: MUTATION NOT APPLIED: $id (mutant is byte-identical to $src, a no-op)"
    status=1; return 1
  fi
  return 0
}

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
real = "  const recoveryTokenSecret = getSecret('RECOVERY_TOKEN_SECRET');"
assert real in text, "recovery-secret read not found; mutation would be vacuous"
text = text.replace(real, "  const decoy = 0; // RECOVERY_TOKEN_SECRET must be set")
open(dst, "w").write(text)
PY
mutant_ok P1 "$CHECKOUT" "$WORK/P1.ts" $? \
  && expect_red "P1 (guard deleted, trailing comment left)" "$WORK/P1.ts"

# --- P3: the real read moved to the END of the file, after the write; comment left behind.
python3 - "$CHECKOUT" "$WORK/P3.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = "  const recoveryTokenSecret = getSecret('RECOVERY_TOKEN_SECRET');"
assert real in text, "recovery-secret read not found; mutation would be vacuous"
text = text.replace(real, "  const recoveryTokenSecret = ''; // getSecret('RECOVERY_TOKEN_SECRET')")
text += "\nconst movedLate = getSecret('RECOVERY_TOKEN_SECRET');\n"
open(dst, "w").write(text)
PY
mutant_ok P3 "$CHECKOUT" "$WORK/P3.ts" $? \
  && expect_red "P3 (read moved after the write, comment left in place)" "$WORK/P3.ts"

# --- P4: the read stays first, but the refusal on an unset value is removed (fails open).
python3 - "$CHECKOUT" "$WORK/P4.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = "if (!recoveryTokenSecret) {"
assert real in text, "recovery-secret refusal not found; mutation would be vacuous"
text = text.replace(real, "if (false) { // " + real, 1)
open(dst, "w").write(text)
PY
mutant_ok P4 "$CHECKOUT" "$WORK/P4.ts" $? \
  && expect_red "P4 (read kept, refusal on unset value disabled)" "$WORK/P4.ts"

# --- P5: the bundled secret read through process.env instead of getSecret (invisible in production).
python3 - "$CHECKOUT" "$WORK/P5.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = "getSecret('RECOVERY_TOKEN_SECRET')"
assert real in text, "recovery-secret read not found; mutation would be vacuous"
open(dst, "w").write(text.replace(real, "process.env.RECOVERY_TOKEN_SECRET", 1))
PY
mutant_ok P5 "$CHECKOUT" "$WORK/P5.ts" $? \
  && expect_red "P5 (bundled secret read via process.env, not getSecret)" "$WORK/P5.ts"

# --- P6: the real call replaced by a string literal that merely contains the call text.
python3 - "$CHECKOUT" "$WORK/P6.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = "getSecret('RECOVERY_TOKEN_SECRET')"
assert real in text, "recovery-secret read not found; mutation would be vacuous"
open(dst, "w").write(text.replace(real, "console.error(\"getSecret('RECOVERY_TOKEN_SECRET')\")", 1))
PY
mutant_ok P6 "$CHECKOUT" "$WORK/P6.ts" $? \
  && expect_red "P6 (call replaced by a string literal naming it)" "$WORK/P6.ts"

# --- P7: the refusal block stops returning (`return` -> `void`): an unset secret falls through.
python3 - "$CHECKOUT" "$WORK/P7.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = ("    console.error('[tickets/checkout] Missing RECOVERY_TOKEN_SECRET env var.');\n"
        "    return NextResponse.json(")
assert real in text, "recovery-secret refusal return not found; mutation would be vacuous"
open(dst, "w").write(text.replace(real, real.replace("return NextResponse.json(", "void NextResponse.json("), 1))
PY
mutant_ok P7 "$CHECKOUT" "$WORK/P7.ts" $? \
  && expect_red "P7 (recovery refusal no longer returns: return -> void)" "$WORK/P7.ts"

# --- Q1: the amount comparison replaced by a constant, name kept in a trailing comment.
#     The logic now lives in the shared handler, so it is driven through the ITN override.
python3 - lib/tickets-notification.ts "$WORK/Q1-itn.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = "!notificationAmountMatches(lookup"
assert real in text, "amount-match call not found; mutation would be vacuous"
text = text.replace(real, "false // notificationAmountMatches(lookup comparison removed", 1)
open(dst, "w").write(text)
PY
mutant_ok Q1 lib/tickets-notification.ts "$WORK/Q1-itn.ts" $? && {
  if ITN_PATH_OVERRIDE="$WORK/Q1-itn.ts" bash "$A4" >/dev/null 2>&1; then
    echo "FAIL A10: mutation Q1 left A4 GREEN — the amount-comparison landmark is not asserted."
    status=1
  else
    echo "  Q1 (amount comparison replaced, name kept in a comment): detected (A4 red)"
  fi
}

# --- Q2: the thin ITN route stops delegating (handler call replaced, name left in a comment).
python3 - app/api/tickets/itn/route.ts "$WORK/Q2-route.ts" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
real = "return handleNotification(payfastProvider"
assert real in text, "delegating return not found; mutation would be vacuous"
text = text.replace(real, "return NextResponse.json({ received: true }) // handleNotification(payfastProvider", 1)
open(dst, "w").write(text)
PY
mutant_ok Q2 app/api/tickets/itn/route.ts "$WORK/Q2-route.ts" $? && {
  if ITN_ROUTE_PATH_OVERRIDE="$WORK/Q2-route.ts" bash "$A4" >/dev/null 2>&1; then
    echo "FAIL A10: mutation Q2 left A4 GREEN — the route's delegation is not asserted."
    status=1
  else
    echo "  Q2 (ITN route no longer delegates to the shared handler): detected (A4 red)"
  fi
}

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

python3 - "$CHECKOUT" "$WORK" <<'MUTPY'
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
a9_builder_rc=$?
mutant_ok R1 "$CHECKOUT" "$WORK/R1.ts" "$a9_builder_rc" \
  && expect_red_a9 "R1 (fabricated verdict, real probe moved after the write)" "$WORK/R1.ts"
mutant_ok R2 "$CHECKOUT" "$WORK/R2.ts" "$a9_builder_rc" \
  && expect_red_a9 "R2 (verdict discarded — call present, answer thrown away)" "$WORK/R2.ts"
mutant_ok R3 "$CHECKOUT" "$WORK/R3.ts" "$a9_builder_rc" \
  && expect_red_a9 "R3 (refusal condition neutered to if (false))" "$WORK/R3.ts"
mutant_ok R5 "$CHECKOUT" "$WORK/R5.ts" "$a9_builder_rc" \
  && expect_red_a9 "R5 (verdict overwritten with a fabricated ready: true)" "$WORK/R5.ts"
mutant_ok R6 "$CHECKOUT" "$WORK/R6.ts" "$a9_builder_rc" \
  && expect_red_a9 "R6 (refusal branch emptied; a neighbouring guard's 500 remains)" "$WORK/R6.ts"
mutant_ok R7 "$CHECKOUT" "$WORK/R7.ts" "$a9_builder_rc" \
  && expect_red_a9 "R7 (probes the wrong operation: verify-notification, not initiate)" "$WORK/R7.ts"

# --- The stripper's own self-test. If code_lines.py stops discriminating, every result above is
#     unreliable even when the numbers look right.
if python3 contracts/checks/payment-seam-f2/code_lines.py --self-test >/dev/null 2>&1; then
  echo "  code_lines self-test: green"
else
  echo "FAIL A10: code_lines.py self-test failed — the comment stripper no longer discriminates."
  status=1
fi

[ "$status" -eq 0 ] && echo "PASS A10: A4 and A9 are both green on real source and red on all fourteen recorded mutations."
exit "$status"

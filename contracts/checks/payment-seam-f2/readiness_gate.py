#!/usr/bin/env python3
"""A9's analyser — prove the READINESS VERDICT GATES THE RESERVATION WRITE.

WHY THIS REPLACED THE AWK VERSION. A9's first form asserted the source POSITION of a readiness()
call and nothing else, using the same leading-comment-only filter that A4 was just hardened against.
@dev proved two mutations against copies of the real route, both of which left A9 GREEN:

  M1  replace the probe with `gatewayReadiness = { ready: true }; // paymentProvider.readiness(...)`
      and append a real probe at the END of the file, after the write. A9 reported "refuses at line
      319" about a comment. The route never probed, and the real call ran after the reservation —
      precisely the defect A9 exists to catch.
  M2  `paymentProvider.readiness('initiate');` with the verdict discarded — no assignment, no
      branch, no refusal. A9 asserted the position of a CALL, never that its answer was used, so a
      probe whose answer is thrown away was indistinguishable from a probe that refuses.

M2 is the deeper one and it is why this file exists: position alone is not the property. The
property is that an unready verdict REFUSES BEFORE ANY FIRESTORE WRITE. That is a chain — probe,
assigned verdict, negative test of that verdict, 500 return — and every link is asserted here,
against COMMENT-STRIPPED code (contracts/checks/payment-seam-f2/code_lines.py), so prose about
readiness can satisfy none of it.

Exit codes are distinct on purpose: 0 pass, 1 the property does not hold, 3 THE INSTRUMENT FAILED.
A broken instrument reported as an absent landmark sends the next reader hunting a defect that is
not there — the same swallow class as the awk `2>/dev/null` this replaced.

  python3 readiness_gate.py <checkout-route.ts>
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import code_lines  # noqa: E402  (path must be set first)

GOLDEN = "contracts/golden/payment-seam-f1/fail-closed-guards.golden.md"

WRITE_LITERAL = "reserveTicket("
PROBE_RE = re.compile(r"\.readiness\s*\(")
IDENT = r"[A-Za-z_$][A-Za-z0-9_$]*"
ASSIGNED_PROBE_RE = re.compile(
    r"(?:const|let|var)?\s*(" + IDENT + r")\s*=\s*(?:await\s+)?" + IDENT
    + r"(?:\." + IDENT + r")*\.readiness\s*\("
)
FABRICATED_READY_RE = re.compile(r"\bready\s*:\s*true\b")
# The checkout route asks about the operation it is ABOUT to perform. Probing
# 'verify-notification' here would ask PayFast for a passphrase it does not need to initiate,
# refusing purchases that succeed today — the exact behaviour change the per-operation
# parameter exists to prevent. A literal is required rather than a variable so the question
# being asked is legible at the call site.
INITIATE_PROBE_RE = re.compile(r"\.readiness\s*\(\s*['\"`]initiate['\"`]\s*\)")


def negative_test_re(target):
    """A test that treats an UNREADY verdict as the refusing branch."""
    t = re.escape(target)
    return re.compile(
        r"!\s*" + t + r"\s*\.\s*ready\b"
        r"|" + t + r"\s*\.\s*ready\s*===?\s*false"
    )


def fail_closed_assignment_re(target):
    return re.compile(re.escape(target) + r"\s*=\s*\{[^}]*\bready\s*:\s*false\b")



def branch_body(lines, test_line):
    """(first_line, last_line) of the block opened at `test_line`.

    Brace-counted over comment-stripped code, so the claim "this branch refuses" is scoped to the
    branch and cannot be satisfied by a neighbouring guard's refusal. A braceless single-statement
    branch is scoped to its statement. Returns (start, None) if the block never closes.
    """
    by_number = dict(lines)
    numbers = [n for n, _ in lines if n >= test_line]
    depth = 0
    opened = False
    for number in numbers:
        code = by_number[number]
        for char in code:
            if char == "{":
                depth += 1
                opened = True
            elif char == "}":
                depth -= 1
                if opened and depth == 0:
                    return test_line, number
        if not opened and number > test_line:
            # Braceless branch: the statement ends at the first `;`.
            if ";" in code:
                return test_line, number
        if not opened and number == test_line and ";" in code.split(")", 1)[-1]:
            return test_line, number
    return test_line, None


def first(lines, predicate, after=0, before=None):
    for number, code in lines:
        if number <= after:
            continue
        if before is not None and number >= before:
            break
        if predicate(code):
            return number
    return None


def analyse(path):
    """Return (failures, pass_message). Raises on an instrument fault."""
    with open(path) as handle:
        lines = [(n, c) for n, c in code_lines.code_lines(handle.read()) if c.strip()]
    if not lines:
        raise RuntimeError(f"{path} contains no code lines at all")

    failures = []
    contains = lambda literal: (lambda code: literal in code)  # noqa: E731

    write_line = first(lines, contains(WRITE_LITERAL))
    if write_line is None:
        return (
            [
                f"no call to reserveTicket() found in {path} — the ordering claim has no anchor, "
                "so no verdict is possible."
            ],
            None,
        )

    # --- Link 1: a readiness() probe exists, and it runs BEFORE the write. ----------------------
    probes = [n for n, code in lines if PROBE_RE.search(code)]
    if not probes:
        failures.append(
            f"{path} never calls readiness(). With credentials unset it will reserve a seat and "
            "refuse afterwards, leaving an order nobody can pay for holding capacity until its "
            f"TTL expires. See {GOLDEN}."
        )
        return failures, None
    if min(probes) >= write_line:
        failures.append(
            f"readiness() is first called at line {min(probes)}, at or after the reservation "
            f"write at line {write_line}. The guard must refuse BEFORE any Firestore write."
        )
        return failures, None

    # --- Link 2: the verdict is CAPTURED. A discarded verdict is not a guard (mutation M2). -----
    captured = [
        (n, ASSIGNED_PROBE_RE.search(code).group(1))
        for n, code in lines
        if n < write_line and PROBE_RE.search(code) and ASSIGNED_PROBE_RE.search(code)
    ]
    if not captured:
        failures.append(
            f"readiness() is called at line {min(probes)} but its verdict is never assigned to "
            "anything, so nothing can branch on it. A probe whose answer is discarded is "
            "indistinguishable from no probe at all: the route still reserves a seat against an "
            "unconfigured gateway."
        )
        return failures, None
    probe_line, target = captured[0]

    # --- Link 2b: it asks about the operation this route is about to perform. -------------------
    if not INITIATE_PROBE_RE.search(dict(lines)[probe_line]):
        failures.append(
            f"the probe at line {probe_line} does not ask readiness('initiate'). Checkout must ask "
            "about the operation it is about to perform: 'verify-notification' would demand a "
            "passphrase this route does not need and refuse purchases that succeed today, which is "
            "the behaviour change the per-operation parameter exists to prevent."
        )
        return failures, None

    # --- Link 3: the verdict is TESTED, negatively, before the write. --------------------------
    test_line = first(
        lines, negative_test_re(target).search, after=probe_line, before=write_line
    )
    if test_line is None:
        failures.append(
            f"the verdict captured in `{target}` at line {probe_line} is never tested for "
            f"NOT-ready before the reservation write at line {write_line}. Expected a branch on "
            f"`!{target}.ready` (or `{target}.ready === false`) — without it the probe is "
            "decorative."
        )
        return failures, None

    # --- Link 4: that branch REFUSES, with the pinned 500, still before the write. --------------
    # Scoped to the BRANCH BODY, not to "somewhere between the test and the write". The checkout
    # route has a SECOND 500 refusal (the RECOVERY_TOKEN_SECRET guard) sitting in exactly that
    # window, so a window-wide search would be satisfied by a neighbour's refusal while this
    # branch's body was empty — the same "satisfiable by something that is not the property"
    # shape this whole check was rewritten to close.
    body_start, body_end = branch_body(lines, test_line)
    if body_end is None:
        failures.append(
            f"the not-ready branch opened at line {test_line} is never closed — the source could "
            "not be scoped, so no verdict about its body is possible."
        )
        return failures, None
    if body_end >= write_line:
        failures.append(
            f"the not-ready branch at line {test_line} does not close until line {body_end}, at or "
            f"after the reservation write at line {write_line} — the write is inside the refusal "
            "branch, not guarded by it."
        )
    refusal_line = first(lines, contains("status: 500"), after=body_start, before=body_end + 1)
    return_line = first(lines, contains("return"), after=body_start - 1, before=body_end + 1)
    if refusal_line is None or return_line is None:
        failures.append(
            f"the not-ready branch at lines {test_line}-{body_end} does not itself return a 500. "
            f"The refusal is pinned at 500 and not 4xx: the request was well-formed and the "
            f"misconfiguration is ours ({GOLDEN}). A 500 elsewhere in the route does not count — "
            "it belongs to a different guard."
        )

    # --- Link 5: a THROWING probe means refuse, not "assume fine". ------------------------------
    catch_line = first(lines, contains("catch"), after=probe_line, before=test_line)
    fallback_line = first(
        lines, fail_closed_assignment_re(target).search, after=probe_line, before=test_line
    )
    if catch_line is None or fallback_line is None:
        failures.append(
            f"the probe at line {probe_line} is not wrapped fail-closed. An adapter that throws "
            f"must leave `{target}` unready (a catch assigning `{{ ready: false, ... }}` before "
            "the test), never fall through as if the gateway were fine — otherwise the fix "
            "reintroduces the failure one layer up."
        )

    # --- Link 6: the route may never FABRICATE a verdict. ---------------------------------------
    fabricated = [n for n, code in lines if FABRICATED_READY_RE.search(code)]
    if fabricated:
        failures.append(
            f"line(s) {', '.join(str(n) for n in fabricated)} construct a `ready: true` verdict "
            "inside the route. Readiness is the provider's answer about ITS OWN config; a route "
            "that can mint one has replaced the guard with a constant."
        )

    # --- Link 7: the post-initiate refusal stays. Config is read per call, so it can change ----
    #     between the probe and the hand-off; removing the later refusal trades one hole for
    #     another.
    initiate_line = first(lines, contains("initiate("), after=write_line)
    if initiate_line is None:
        failures.append(
            f"{path} never calls initiate() after the reservation — it is not going through the "
            "seam at all."
        )
    elif first(lines, contains("not-configured"), after=initiate_line) is None:
        failures.append(
            "the post-initiate 'not-configured' refusal has been removed. It is defence in depth, "
            "not redundancy — config is read per call and can change between the two."
        )

    if failures:
        return failures, None
    return [], (
        f"readiness() is probed at line {probe_line}, its verdict `{target}` is tested at line "
        f"{test_line} and refuses with a 500 at line {refusal_line}, all before the reservation "
        f"write at line {write_line}; the throwing path falls back to not-ready at line "
        f"{fallback_line} and the post-initiate refusal survives."
    )


def main():
    if len(sys.argv) != 2:
        print("usage: readiness_gate.py <checkout-route.ts>", file=sys.stderr)
        return 3
    path = sys.argv[1]
    if not os.path.isfile(path):
        print(f"FAIL A9: {path} does not exist.")
        return 1
    try:
        failures, message = analyse(path)
    except Exception as error:  # noqa: BLE001 — an instrument fault must not read as a verdict
        print(
            "FAIL A9 (INSTRUMENT): the source analyser itself failed, so NO verdict about the "
            "route is possible. This is not a finding about the route.",
            file=sys.stderr,
        )
        print(f"         {type(error).__name__}: {error}", file=sys.stderr)
        return 3
    for failure in failures:
        print(f"FAIL A9: {failure}")
    if failures:
        return 1
    print(f"PASS A9: {message}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

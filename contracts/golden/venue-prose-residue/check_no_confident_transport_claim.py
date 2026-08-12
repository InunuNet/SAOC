#!/usr/bin/env python3
"""Reads text on stdin (CLI) or takes a string directly (check()). Fails if the
text asserts, as settled fact, either that scheduled public transport to the
venue EXISTS or that it does NOT exist.

This is Finding 2 from the second adversarial QA pass: the first fix for this
defect class replaced silence with an invented negative claim ("There is no
scheduled public transport to the airfield" / "outside the Cape Town scheduled
bus network"). Nothing in the repo sources that claim - no Stellenbosch
equivalent of contracts/golden/show-visitor-info/cticc-research.golden.md exists
- so it is exactly the plausible-sounding, unverified specific detail
content-modeling.md rule 5 forbids. A negative claim is still a claim.

This checker does not require the opposite claim either (asserting transport
DOES run would be equally unsourced). It only requires: if the text mentions
transport at all, it must be hedged as unconfirmed/unresearched. Text that is
silent on public transport entirely (e.g. showFaq-getting-there-3, which never
mentions it) passes cleanly - silence is honest; an invented answer is not.

Usage: python3 check_no_confident_transport_claim.py < some_text
Exit 1 and print the reason if a confident claim is found; exit 0 otherwise.
"""
import re
import sys

NEGATIVE_CLAIM = re.compile(
    r"no scheduled public transport|outside the Cape Town scheduled bus network"
    r"|not accessible by public transport|there is no public transport",
    re.IGNORECASE,
)

POSITIVE_CLAIM = re.compile(
    r"regular (bus|shuttle) service|public transport (is|runs|are) available"
    r"|buses run to|a scheduled (bus|shuttle) (service )?(runs|operates) to",
    re.IGNORECASE,
)

HEDGE = re.compile(
    r"not (yet )?confirmed|unconfirmed|has not been confirmed|not (yet )?known"
    r"|has not been checked|not yet researched",
    re.IGNORECASE,
)


def check(text: str) -> str | None:
    """Return a violation reason string, or None if the text is clean."""
    if NEGATIVE_CLAIM.search(text):
        return "text still asserts an unsourced NEGATIVE claim about public transport (rule 5 violation)"

    if POSITIVE_CLAIM.search(text) and not HEDGE.search(text):
        return "text asserts public transport availability as unhedged fact (rule 5 violation)"

    return None


if __name__ == "__main__":
    reason = check(sys.stdin.read())
    if reason:
        print(reason)
        sys.exit(1)
    sys.exit(0)

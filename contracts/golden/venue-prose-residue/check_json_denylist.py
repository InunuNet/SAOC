#!/usr/bin/env python3
"""Scoped denylist + structural checker for
contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json.

v2 (2026-08-12) - a second adversarial QA pass found v1 implemented only 2 of the
4 documented denylist phrases (DENYLIST) and 2 of the 3 defective FAQ ids
(TARGET_FAQ_IDS), which let this golden JSON pass A12 while it still carried six
separate blocks of Cape Town CBD prose (MyCiTi, Civic Centre station, V&A
Waterfront, Table Mountain, Kirstenbosch, the Foreshore drive-time claim, and the
CTICC directionsNote) describing a venue this show no longer uses. See
../README.md "Finding 1" and phrase-denylist.golden.md. A separate script,
check_denylist_conformance.py, now proves this file cannot silently drift from
what phrase-denylist.golden.md documents again.

Checks ONLY the specific fields this contract's defect class covers - never the
whole file, because this JSON legitimately still carries historical CTICC
venue-IDENTITY fields (name/addressLines/city/province/postalCode/latitude/
longitude/mapsUrl/phone). No other contract asserts these fields - this golden JSON's copy is a dated historical record of what the original CTICC research produced, analogous to cticc-research.golden.md, and this contract's own A13 is what keeps it that way. See README
"Current-state vs historical-record ruling":

  - showVisitorInfoDocument prose fields: parking, accessibility, publicTransport,
    gettingThereIntro, accommodationIntro
  - showVisitorInfoDocument array fields the corrected seed script now seeds empty
    (scripts/seed-show-visitor-info.ts AIRPORT_ROUTES/ACCOMMODATION/ATTRACTIONS are
    all `[]`): airportRoutes, accommodation, attractions - must be `[]` here too
  - showFaqDocuments answers for showFaq.accessibility.1, showFaq.getting-there.1,
    showFaq.getting-there.2, showFaq.getting-there.3. NOTE: showFaq.getting-there.3
    is the tone-model FAQ on LIVE Sanity (see correct-tone-model.golden.md) - that
    is a fact about the live document, NOT about this golden JSON's copy of it. v3
    (2026-08-12) found the golden's copy was never brought into scope, so it still
    carried the old "not formally confirmed... planning around the CTICC" text
    while the live document and the seed script both already had the corrected
    text. "Untouched on live" and "untouched in the golden copy" are different
    claims - see README "Finding 3".
  - nationalShowVenuePatch.venue.directionsNote - descriptive prose about the
    venue's physical setting, NOT a venue-identity field, so it IS in scope even
    though its siblings (name, addressLines, ...) are not

Usage: python3 check_json_denylist.py <path-to-json>
Exit 1 and print every violation found; exit 0 if clean.
"""
import json
import re
import sys

DENYLIST = re.compile(
    r"convention centre|parking garage|foreshore"
    r"|half an hour from Cape Town International|roughly 25 to 40 minutes"
    r"|myciti|civic centre station|v&a waterfront|table mountain|bo-kaap"
    r"|company's garden|robben island|kirstenbosch",
    re.IGNORECASE,
)

TARGET_FAQ_IDS = {
    "showFaq.accessibility.1",
    "showFaq.getting-there.1",
    "showFaq.getting-there.2",
    "showFaq.getting-there.3",
}

PROSE_FIELDS = ("parking", "accessibility", "publicTransport", "gettingThereIntro", "accommodationIntro")

EMPTY_ARRAY_FIELDS = ("airportRoutes", "accommodation", "attractions")


def check(data: dict) -> list[str]:
    """Return a list of violation strings for the given parsed JSON (empty if clean)."""
    violations = []

    doc = data.get("showVisitorInfoDocument", {})

    for key in PROSE_FIELDS:
        value = doc.get(key, "")
        if DENYLIST.search(value):
            violations.append(f"showVisitorInfoDocument.{key} still contains a denylisted phrase")

    for key in EMPTY_ARRAY_FIELDS:
        value = doc.get(key)
        if value != []:
            violations.append(
                f"showVisitorInfoDocument.{key} is not an empty array - the corrected seed script "
                f"(scripts/seed-show-visitor-info.ts) seeds this array empty; this golden still pins "
                f"stale Cape Town-specific entries the script no longer produces"
            )

    for entry in data.get("showFaqDocuments", []):
        faq_id = entry.get("_id")
        if faq_id in TARGET_FAQ_IDS:
            answer = entry.get("answer", "")
            if DENYLIST.search(answer):
                violations.append(f"showFaqDocuments[_id={faq_id}].answer still contains a denylisted phrase")

    directions_note = data.get("nationalShowVenuePatch", {}).get("venue", {}).get("directionsNote", "")
    if DENYLIST.search(directions_note):
        violations.append(
            "nationalShowVenuePatch.venue.directionsNote still contains a denylisted phrase "
            "(this is descriptive prose, not one of the venue-identity fields this "
            "contract's own A13 keeps as a historical record - see README ruling)"
        )

    return violations


if __name__ == "__main__":
    with open(sys.argv[1]) as f:
        loaded = json.load(f)

    found = check(loaded)
    if found:
        for v in found:
            print(v)
        sys.exit(1)

    sys.exit(0)

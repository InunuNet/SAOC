#!/usr/bin/env python3
"""A2 — contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json's
showVisitorInfoDocument must hold the exact corrected text (no 'venue changed'
framing) for the same six fields as A1, and must be byte-identical to
scripts/seed-show-visitor-info.ts for those fields. Field-scoped reads only —
this script never scans the whole file, and never touches
nationalShowVenuePatch.venue.directionsNote (see README "Explicitly out of
scope").
"""
import json
import re
import sys

GOLDEN_PATH = "contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json"

FIELDS = [
    "researchLabel",
    "planIntro",
    "gettingThereIntro",
    "parking",
    "accommodationIntro",
    "accessibility",
]

DENYLIST = re.compile(
    r"venue (has )?changed|no longer applies|previous (guidance|list|working venue)"
    r"|working venue|for the new venue|against the working venue",
    re.IGNORECASE,
)

EXPECTED = {
    "researchLabel": "Researched by the web team — not yet confirmed by the show committee",
    "planIntro": (
        "Everything you need to get to the National Orchid Show and make a day of it. "
        "Travel and accommodation guidance for the venue is still being put together; "
        "the show committee will confirm the final details."
    ),
    "gettingThereIntro": (
        "Travel, parking and accommodation guidance for the Stellenbosch Flying Club has "
        "not been worked out yet. It will be published here once it is ready."
    ),
    "parking": "Parking arrangements have not been confirmed.",
    "accommodationIntro": "Accommodation guidance for the Stellenbosch area is still being put together.",
    "accessibility": "Accessibility details have not been confirmed.",
}


def main() -> int:
    with open(GOLDEN_PATH, encoding="utf-8") as fh:
        doc = json.load(fh)

    section = doc.get("showVisitorInfoDocument")
    if not isinstance(section, dict):
        print(f"FAIL: {GOLDEN_PATH} has no showVisitorInfoDocument object")
        return 1

    ok = True
    for field in FIELDS:
        value = section.get(field)
        if not isinstance(value, str):
            print(f"FAIL: showVisitorInfoDocument.{field} missing or not a string")
            ok = False
            continue
        if DENYLIST.search(value):
            print(f"FAIL: showVisitorInfoDocument.{field} still contains 'venue changed' framing: {value!r}")
            ok = False
        if value != EXPECTED[field]:
            print(
                f"FAIL: showVisitorInfoDocument.{field} does not match the corrected golden text\n"
                f"  expected: {EXPECTED[field]!r}\n"
                f"  actual:   {value!r}"
            )
            ok = False

    if ok:
        print("PASS: golden JSON's six visitor-info fields hold the exact corrected text")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

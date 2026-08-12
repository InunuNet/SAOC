#!/usr/bin/env python3
"""META self-test for the venue-prose-residue detectors (contract assertion A1).

Must run first, before any file/live check, because every other assertion in
this contract trusts these detectors to actually fire on the defects they claim
to catch and to leave legitimate content alone. Proves:

  1. Every documented denylist phrase (phrase-denylist.golden.md) actually fires
     on synthetic text drawn from the real defects.
  2. The denylist WOULD false-positive on legitimate, real content elsewhere in
     the repo (schema field description, two real "Civic Centre" society venues,
     legitimate Kirstenbosch references) if it were ever applied without file
     scoping - proving the false-positive risk is real, and that file-scoping
     (not phrase precision) is what protects those files. See
     phrase-denylist.golden.md "Why the scoping matters".
  3. check_json_denylist.py's check() passes a clean synthetic fixture and fails
     a fixture reproducing today's real defects (both directions - a detector
     that can only fail, or only pass, is not proven to work).
  4. check_no_confident_transport_claim.py's check() fires on the real invented
     claim, does not fire on silence, and does not fire on an honestly-hedged
     mention of transport.

Usage: python3 selftest.py
Exit 1 and print every failed proof; exit 0 if every proof holds.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import check_json_denylist as jd  # noqa: E402
import check_no_confident_transport_claim as tc  # noqa: E402

failures = []


def expect_match(label: str, text: str) -> None:
    if not jd.DENYLIST.search(text):
        failures.append(f"DENYLIST self-test FAILED to detect {label}: {text!r}")


def expect_no_match(label: str, text: str) -> None:
    if jd.DENYLIST.search(text):
        failures.append(f"DENYLIST self-test FALSE POSITIVE on {label}: {text!r}")


# --- 1. Documented phrases actually fire, drawn from the real defects ---
expect_match("convention-centre phrasing", "The working venue is a modern convention centre with step-free access")
expect_match("parking-garage phrasing", "The working venue has several parking garages")
expect_match("Foreshore phrasing", "The CTICC is on the Foreshore at the harbour end of the city centre")
expect_match("drive-time phrase (family member 1)", "a drive of roughly half an hour from Cape Town International")
expect_match("drive-time phrase (family member 2)", "roughly 25 to 40 minutes by road, depending on traffic")
expect_match("MyCiTi phrasing", "The MyCiTi A01 bus runs from the airport to Civic Centre station")
expect_match("Civic Centre station phrasing", "about 600 m from the working venue, at Civic Centre station")
expect_match("V&A Waterfront phrasing", "About 2 km from the working venue: the V&A Waterfront")
expect_match("Table Mountain phrasing", "The Table Mountain Aerial Cableway, about 6 km")
expect_match("Bo-Kaap phrasing", "Bo-Kaap, about 2 km, historic neighbourhood")
expect_match("Company's Garden phrasing", "Company's Garden and the city museums, about 1.5 km")
expect_match("Robben Island phrasing", "the departure point for Robben Island ferries")
expect_match("Kirstenbosch phrasing", "Kirstenbosch National Botanical Garden, about 13 km")

# --- 2. Real false-positive risk, proven, then shown to be file-scoped away ---
expect_match(
    "the legitimate showVenue.ts schema field description (expected false positive - "
    "scoping, not phrase precision, is what protects this file; see A17)",
    "Full venue name as a visitor would read it, e.g. the convention centre's official name.",
)
expect_no_match(
    "Witbank Civic Centre (real live society venue, society-highveld-orchid-society)",
    "Witbank Civic Centre",
)
expect_no_match(
    "Bloemfontein Civic Centre (real live event venue, societyEvent-3-saoc-council-agm-2026)",
    "Bloemfontein Civic Centre",
)
expect_match(
    "bare 'Kirstenbosch' (expected false positive if this regex were ever applied outside "
    "seed-show-visitor-info.golden.json - e.g. against lib/data/events.ts's real "
    "'Kirstenbosch Hall, Cape Town' venues or lib/data/partners.ts's 'Kirstenbosch NBG'; "
    "file-scoping in check_json_denylist.py, which never opens those files, is what "
    "protects them - see A28)",
    "Kirstenbosch Hall, Cape Town",
)

# --- Negative control: the tone model must not false-positive ---
expect_no_match(
    "the correct tone-model text (showFaq-getting-there-3)",
    "At the hangar at Stellenbosch Flying Club, Stellenbosch Airfield, on the R44 in the Cape "
    "Winelands. On-site details such as the entrance to use, parking and accessibility are "
    "still being worked out and will be published here as they are settled.",
)

# --- 3. check_json_denylist.check() proven in both directions ---
CLEAN_FIXTURE = {
    "showVisitorInfoDocument": {
        "parking": "not confirmed",
        "accessibility": "not confirmed",
        "publicTransport": "not confirmed",
        "gettingThereIntro": "not confirmed",
        "accommodationIntro": "not confirmed",
        "airportRoutes": [],
        "accommodation": [],
        "attractions": [],
    },
    "showFaqDocuments": [
        {"_id": "showFaq.getting-there.1", "answer": "not confirmed"},
        {"_id": "showFaq.getting-there.2", "answer": "not confirmed"},
        {"_id": "showFaq.accessibility.1", "answer": "not confirmed"},
        {"_id": "showFaq.getting-there.3", "answer": "not confirmed"},
    ],
    "nationalShowVenuePatch": {"venue": {"name": "The Hangar", "directionsNote": "not confirmed"}},
}
if jd.check(CLEAN_FIXTURE):
    failures.append(f"check_json_denylist.check() FALSE POSITIVE on a clean synthetic fixture: {jd.check(CLEAN_FIXTURE)}")

DIRTY_FIXTURE = {
    "showVisitorInfoDocument": {
        "publicTransport": "MyCiTi is Cape Town's scheduled bus service.",
        "airportRoutes": [{"origin": "CPT"}],
        "accommodation": [{"name": "Foreshore hotels"}],
        "attractions": [{"name": "Kirstenbosch"}],
    },
    "showFaqDocuments": [
        {"_id": "showFaq.getting-there.1", "answer": "roughly 25 to 40 minutes by road"},
    ],
    "nationalShowVenuePatch": {"venue": {"directionsNote": "The CTICC is on the Foreshore"}},
}
if not jd.check(DIRTY_FIXTURE):
    failures.append("check_json_denylist.check() FAILED to detect a fixture reproducing today's real defects")

# --- v3: dedicated proof for the Finding 3 gap - a stale getting-there.3-shaped
# entry, on its own, with everything else clean, must still be caught. This is
# the exact shape of the real v3 defect: the golden JSON's showFaq.getting-there.3
# copy kept the pre-fix "not formally confirmed... planning around the CTICC" text
# after TARGET_FAQ_IDS was expanded to cover it (v3 added it; v1/v2 did not).
STALE_GETTING_THERE_3_FIXTURE = {
    "showVisitorInfoDocument": {
        "parking": "not confirmed",
        "accessibility": "not confirmed",
        "publicTransport": "not confirmed",
        "gettingThereIntro": "not confirmed",
        "accommodationIntro": "not confirmed",
        "airportRoutes": [],
        "accommodation": [],
        "attractions": [],
    },
    "showFaqDocuments": [
        {"_id": "showFaq.getting-there.1", "answer": "not confirmed"},
        {"_id": "showFaq.getting-there.2", "answer": "not confirmed"},
        {"_id": "showFaq.accessibility.1", "answer": "not confirmed"},
        {
            "_id": "showFaq.getting-there.3",
            "answer": (
                "The venue has not been formally confirmed. We are planning around the "
                "Cape Town International Convention Centre and will update this page the "
                "moment the committee confirms."
            ),
        },
    ],
    "nationalShowVenuePatch": {"venue": {"name": "The Hangar", "directionsNote": "not confirmed"}},
}
if not jd.check(STALE_GETTING_THERE_3_FIXTURE):
    failures.append(
        "check_json_denylist.check() FAILED to detect a stale showFaq.getting-there.3 entry "
        "reproducing the real v3 defect - this is exactly the scoping gap TARGET_FAQ_IDS was "
        "expanded to close"
    )

# --- 4. check_no_confident_transport_claim.check() proven in three directions ---
if not tc.check("There is no scheduled public transport to the airfield, so plan on driving."):
    failures.append("check_no_confident_transport_claim.check() FAILED to detect the real invented negative claim")
if tc.check(
    "At the hangar at Stellenbosch Flying Club, Stellenbosch Airfield, on the R44 in the Cape "
    "Winelands. On-site details such as the entrance to use, parking and accessibility are "
    "still being worked out."
):
    failures.append("check_no_confident_transport_claim.check() FALSE POSITIVE on text silent about transport")
if tc.check("Public transport options to the venue have not yet been researched."):
    failures.append("check_no_confident_transport_claim.check() FALSE POSITIVE on an honestly-hedged transport mention")

if failures:
    for f in failures:
        print(f)
    sys.exit(1)

sys.exit(0)

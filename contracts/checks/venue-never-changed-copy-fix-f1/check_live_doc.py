#!/usr/bin/env python3
"""A6 — proves the corrected text is actually live on the production Sanity
showVisitorInfo document (_id: "showVisitorInfo"), not just in source. READ-ONLY:
a single GET against the Sanity Query API. Never writes. Per
contracts/golden/venue-never-changed-copy-fix-f1/README.md and this repo's own
dataset-mutation-safety.golden.md incident record, no contract assertion may
mutate the live dataset — the actual fix is applied once, out-of-band, by a
one-off .patch().set() script modelled on
scripts/fix-visitor-info-dates-confirmed.ts, before this check is expected to
pass.

Env is read directly from .env.local (same pattern as every script in
scripts/*.ts): NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
SANITY_API_TOKEN.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

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


def read_env_local(path: str = ".env.local") -> dict:
    out = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            value = value.strip().strip('"').strip("'")
            out[key.strip()] = value
    return out


def main() -> int:
    env = read_env_local()
    project_id = env.get("NEXT_PUBLIC_SANITY_PROJECT_ID")
    dataset = env.get("NEXT_PUBLIC_SANITY_DATASET")
    token = env.get("SANITY_API_TOKEN")
    if not (project_id and dataset and token):
        print("FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_TOKEN in .env.local")
        return 2

    query = urllib.parse.quote('*[_id=="showVisitorInfo"][0]')
    url = f"https://{project_id}.api.sanity.io/v2024-01-01/data/query/{dataset}?query={query}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
    except Exception as exc:  # noqa: BLE001 - surface any fetch failure as a gate failure
        print(f"FAIL: could not read-only fetch live showVisitorInfo document: {exc}")
        return 2

    doc = body.get("result")
    if not isinstance(doc, dict):
        print("FAIL: live showVisitorInfo document not found (result was null)")
        return 1

    ok = True
    for field in FIELDS:
        value = doc.get(field)
        if not isinstance(value, str):
            print(f"FAIL: live showVisitorInfo.{field} missing or not a string")
            ok = False
            continue
        if DENYLIST.search(value):
            print(f"FAIL: live showVisitorInfo.{field} still contains 'venue changed' framing: {value!r}")
            ok = False
        if value != EXPECTED[field]:
            print(
                f"FAIL: live showVisitorInfo.{field} does not match the corrected text\n"
                f"  expected: {EXPECTED[field]!r}\n"
                f"  actual:   {value!r}"
            )
            ok = False

    if ok:
        print("PASS: live showVisitorInfo document holds the exact corrected text on all six fields")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

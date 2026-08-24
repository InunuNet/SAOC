#!/usr/bin/env python3
"""A4 — negative controls. Two things must NOT be disturbed by this fix:

1. Every live showFaq-* document (already clean, fixed by an earlier pass) must
   stay clean and byte-identical to what a direct query found on 2026-08-24 —
   catches a regression where a future edit reintroduces 'changed' framing into
   the FAQs while fixing showVisitorInfo.
2. The two docs (docs/show-visitor-info.md, docs/show-visitor-info-for-editors.md)
   must keep their legitimate, forward-looking descriptions of the Studio
   single-source venue mechanism intact — this fix must not overreact and strip
   real documentation of a real guarantee just because it contains the word
   "changes"/"change".

READ-ONLY: the Sanity query is a single GET. Never writes.
"""
import json
import re
import sys
import urllib.parse
import urllib.request

DENYLIST = re.compile(
    r"venue (has )?changed|no longer applies|previous (guidance|list|working venue)"
    r"|working venue|for the new venue|against the working venue",
    re.IGNORECASE,
)

# _id -> exact answer text as verified live on 2026-08-24 (already correct, must not regress)
EXPECTED_FAQ_ANSWERS = {
    "showFaq-getting-there-1": (
        "The show is at Stellenbosch Flying Club, on the R44 at Stellenbosch Airfield in the "
        "Cape Winelands. Public transport options to the venue have not been confirmed. "
        "Detailed travel guidance for the venue will be added to the Plan your visit page "
        "once it is confirmed."
    ),
    "showFaq-getting-there-2": (
        "Parking arrangements have not been confirmed by the show committee. We will publish "
        "rates and directions once the booking is confirmed."
    ),
    "showFaq-getting-there-3": (
        "At the hangar at Stellenbosch Flying Club, Stellenbosch Airfield, on the R44 in the "
        "Cape Winelands. On-site details such as the entrance to use, parking and accessibility "
        "are still being worked out and will be published here as they are settled."
    ),
    "showFaq-accessibility-1": (
        "Accessibility specifics have not been confirmed. We will publish the confirmed "
        "detail, including accessible parking and assistance on request, once the committee "
        "supplies it."
    ),
}

DOC_PRESERVED_PHRASES = {
    "docs/show-visitor-info.md": [
        "changing the venue is a Studio edit, not a developer task",
    ],
    "docs/show-visitor-info-for-editors.md": [
        "if it ever changes again in 2030",
    ],
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


def check_faqs() -> bool:
    env = read_env_local()
    project_id = env.get("NEXT_PUBLIC_SANITY_PROJECT_ID")
    dataset = env.get("NEXT_PUBLIC_SANITY_DATASET")
    token = env.get("SANITY_API_TOKEN")
    if not (project_id and dataset and token):
        print("FAIL: missing Sanity env vars in .env.local")
        return False

    ids = list(EXPECTED_FAQ_ANSWERS)
    groq = '*[_type=="showFaq" && _id in $ids]{_id,"answerText":answer[].children[].text}'
    params = f'&$ids={urllib.parse.quote(json.dumps(ids))}'
    query = urllib.parse.quote(groq)
    url = f"https://{project_id}.api.sanity.io/v2024-01-01/data/query/{dataset}?query={query}{params}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL: could not read-only fetch live showFaq documents: {exc}")
        return False

    docs = {d["_id"]: "".join(d.get("answerText") or []) for d in body.get("result") or []}

    ok = True
    for faq_id, expected in EXPECTED_FAQ_ANSWERS.items():
        actual = docs.get(faq_id)
        if actual is None:
            print(f"FAIL: live {faq_id} not found")
            ok = False
            continue
        if DENYLIST.search(actual):
            print(f"FAIL: live {faq_id} regressed — now contains 'venue changed' framing: {actual!r}")
            ok = False
        if actual != expected:
            print(f"FAIL: live {faq_id} drifted from its 2026-08-24 verified-clean text\n  now: {actual!r}")
            ok = False
    return ok


def check_docs_preserved() -> bool:
    ok = True
    for path, phrases in DOC_PRESERVED_PHRASES.items():
        try:
            with open(path, encoding="utf-8") as fh:
                content = fh.read()
        except FileNotFoundError:
            print(f"FAIL: {path} not found")
            ok = False
            continue
        for phrase in phrases:
            if phrase not in content:
                print(f"FAIL: {path} lost legitimate content this fix must not remove: {phrase!r}")
                ok = False
    return ok


def main() -> int:
    faqs_ok = check_faqs()
    docs_ok = check_docs_preserved()
    if faqs_ok and docs_ok:
        print("PASS: FAQ negative controls clean, legitimate doc language preserved")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

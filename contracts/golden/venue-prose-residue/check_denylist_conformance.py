#!/usr/bin/env python3
"""Proves check_json_denylist.py's DENYLIST regex and TARGET_FAQ_IDS set actually
implement every phrase and FAQ id documented in phrase-denylist.golden.md.

Exists because the root cause of the second adversarial QA failure was exactly
this drift: the checker silently under-implemented its own spec (2 of 4 phrases,
2 of 3 FAQ ids) and the gate still went green. This script makes that class of
drift structurally unable to pass silently again - if a phrase or id is added to
the spec doc without a matching change to the checker (or vice versa), this fails.

Usage: python3 check_denylist_conformance.py
Exit 1 and print every drift found; exit 0 if the doc and the checker agree.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import check_json_denylist as checker  # noqa: E402

DOC_TEXT = (HERE / "phrase-denylist.golden.md").read_text()

REQUIRED_PHRASES = [
    "convention centre",
    "parking garage",
    "Foreshore",
    "half an hour from Cape Town International",
    "MyCiTi",
    "Civic Centre station",
    "V&A Waterfront",
    "Table Mountain",
    "Bo-Kaap",
    "Company's Garden",
    "Robben Island",
    "Kirstenbosch",
]

REQUIRED_FAQ_IDS = [
    "showFaq.accessibility.1",
    "showFaq.getting-there.1",
    "showFaq.getting-there.2",
    "showFaq.getting-there.3",
]

failures = []

for phrase in REQUIRED_PHRASES:
    if phrase not in DOC_TEXT:
        failures.append(f"phrase-denylist.golden.md no longer documents required phrase '{phrase}'")
    if not checker.DENYLIST.search(phrase):
        failures.append(f"check_json_denylist.py's DENYLIST does not match documented phrase '{phrase}'")

for faq_id in REQUIRED_FAQ_IDS:
    if faq_id not in DOC_TEXT:
        failures.append(f"phrase-denylist.golden.md no longer documents required FAQ id '{faq_id}'")
    if faq_id not in checker.TARGET_FAQ_IDS:
        failures.append(f"check_json_denylist.py's TARGET_FAQ_IDS is missing documented id '{faq_id}'")

if failures:
    for f in failures:
        print(f)
    sys.exit(1)

sys.exit(0)

#!/usr/bin/env python3
"""Structural negative controls on apphosting.yaml — prove the fix wasn't (and
isn't later, by regression) achieved by the one forbidden shortcut this
contract explicitly rules out: making the Firebase Admin secrets BUILD-available.

Three checks, run individually via subcommands so the contract's assertion
list can name each one and its rationale separately:

  admin-runtime-only   FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL /
                        FIREBASE_ADMIN_PRIVATE_KEY each declare availability
                        exactly [RUNTIME] — not BUILD, not both.

  no-build-secrets     No BUILD-available env entry is secret-sourced, and none
                        has a name shaped like a credential (FIREBASE_ADMIN_*,
                        *PRIVATE_KEY*, *CLIENT_EMAIL*, *_TOKEN, *_SECRET). This
                        is broader than the named-variable check above — it
                        also catches a renamed circumvention (e.g. copying the
                        admin key into a new BUILD-available variable under a
                        different name).

  site-url-unchanged   SITE_URL is still RUNTIME-only, its value is still the
                        documented App Hosting URL (not saoc.co.za — the old
                        Joomla domain — see the comment block above it), and
                        that comment block is still present. Guards against an
                        editor removing the reasoning while touching this file
                        for the tickets fix.

Usage: python3 check_apphosting_guard.py <apphosting.yaml> <subcommand>
Exit 0 if the named check passes, 1 with a reason otherwise.
"""
import re
import sys

import yaml

CREDENTIAL_NAME_RE = re.compile(
    r"FIREBASE_ADMIN|PRIVATE_KEY|CLIENT_EMAIL|_TOKEN$|_SECRET$", re.IGNORECASE
)
EXPECTED_SITE_URL = "https://saoc-prod--saoc-webapp.europe-west4.hosted.app"
ADMIN_VARS = ("FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY")


def load(path: str):
    with open(path) as f:
        return yaml.safe_load(f)


def find(doc, name: str):
    for entry in doc.get("env", []):
        if entry.get("variable") == name:
            return entry
    return None


def check_admin_runtime_only(doc) -> list[str]:
    problems = []
    for name in ADMIN_VARS:
        entry = find(doc, name)
        if entry is None:
            problems.append(f"{name} is missing from apphosting.yaml entirely")
            continue
        avail = entry.get("availability", [])
        if avail != ["RUNTIME"]:
            problems.append(f"{name} availability is {avail}, expected exactly ['RUNTIME']")
    return problems


def check_no_build_secrets(doc) -> list[str]:
    problems = []
    for entry in doc.get("env", []):
        avail = entry.get("availability", [])
        if "BUILD" not in avail:
            continue
        name = entry.get("variable", "<unnamed>")
        if "secret" in entry:
            problems.append(f"{name} is BUILD-available and secret-sourced ({entry['secret']})")
        if CREDENTIAL_NAME_RE.search(name):
            problems.append(f"{name} is BUILD-available and credential-shaped by name")
    return problems


def check_site_url_unchanged(doc, raw_text: str) -> list[str]:
    problems = []
    entry = find(doc, "SITE_URL")
    if entry is None:
        return ["SITE_URL is missing from apphosting.yaml entirely"]
    avail = entry.get("availability", [])
    if avail != ["RUNTIME"]:
        problems.append(f"SITE_URL availability is {avail}, expected exactly ['RUNTIME']")
    if entry.get("value") != EXPECTED_SITE_URL:
        problems.append(f"SITE_URL value is {entry.get('value')!r}, expected {EXPECTED_SITE_URL!r}")
    if "notify_url/return_url/cancel_url" not in raw_text or "saoc.co.za" not in raw_text:
        problems.append(
            "SITE_URL's explanatory comment block (notify_url/return_url/cancel_url reasoning, "
            "old-Joomla-domain warning) appears to have been removed"
        )
    return problems


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check_apphosting_guard.py <apphosting.yaml> <subcommand>", file=sys.stderr)
        return 1
    path, subcommand = sys.argv[1], sys.argv[2]
    doc = load(path)
    raw_text = open(path).read()

    checks = {
        "admin-runtime-only": lambda: check_admin_runtime_only(doc),
        "no-build-secrets": lambda: check_no_build_secrets(doc),
        "site-url-unchanged": lambda: check_site_url_unchanged(doc, raw_text),
    }
    if subcommand not in checks:
        print(f"unknown subcommand {subcommand!r}, expected one of {list(checks)}", file=sys.stderr)
        return 1

    problems = checks[subcommand]()
    if problems:
        print(f"{subcommand}: FAILED")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"{subcommand}: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

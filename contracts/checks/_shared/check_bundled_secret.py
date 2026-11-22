#!/usr/bin/env python3
"""A secret carried in an apphosting.yaml bundle is declared, RUNTIME-only, and read via getSecret.

Since PR #225 apphosting.yaml no longer has one `variable: NAME` entry per secret. Two JSON bundle
secrets (SAOC_APP_SECRETS, SAOC_PAYMENT_SECRETS) are bound RUNTIME-only, and application code reads
each secret through getSecret('NAME') (lib/secrets.ts: bundles first, process.env fallback). The old
inline greps for `variable: SANITY_API_TOKEN` therefore went red without any protection being lost.
This check asserts the same two protections where they live now:

  1. DECLARATION. apphosting.yaml binds the bundle (`variable: <BUNDLE>` + `secret: <BUNDLE>`) with
     RUNTIME availability and NEVER BUILD (a BUILD binding would bake the credential into the
     publicly inspectable client bundle), AND the yaml's own bundle-membership comment lists NAME
     under that bundle. (The bundle's JSON keys live in Secret Manager and cannot be read from a
     committed file; that comment is the only committed record of membership.)
  2. READ PATH. Every --reader file contains the CODE construct getSecret('NAME') -- comments and
     log strings do not count (code_lines.py strips comments string-aware) -- or, as the accepted
     legacy accessor, process.env.NAME.

Name checks on committed files only: no secret value is read, parsed or printed.

  python3 contracts/checks/_shared/check_bundled_secret.py --secret NAME --bundle BUNDLE \
      --reader FILE [--reader FILE ...] [--apphosting apphosting.yaml]

Exit 0 = every assertion holds, 1 = a protection is missing, 2 = usage / unreadable input.
"""
import argparse
import importlib.util
import re
import sys
from pathlib import Path

import yaml

CODE_LINES = Path(__file__).resolve().parent.parent / "payment-seam-f2" / "code_lines.py"


def load_code_lines():
    spec = importlib.util.spec_from_file_location("code_lines", CODE_LINES)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def bundle_entry(doc, bundle):
    for entry in (doc.get("env") or []):
        if entry.get("variable") == bundle:
            return entry
    return None


def membership_comment(text, bundle):
    """Names listed in the `# BUNDLE: A, B, ...` comment block (continuation lines are indented)."""
    lines = text.splitlines()
    header = re.compile(r"^\s*#\s*" + re.escape(bundle) + r":\s*(.*)$")
    for i, line in enumerate(lines):
        match = header.match(line)
        if not match:
            continue
        body = match.group(1)
        for follow in lines[i + 1:]:
            cont = re.match(r"^\s*#\s{2,}(\S.*)$", follow)
            if not cont:
                break
            body += " " + cont.group(1)
        return {n.strip().rstrip(".") for n in body.split(",") if n.strip()}
    return None


def check_declaration(args, failures):
    path = Path(args.apphosting)
    text = path.read_text(encoding="utf-8")
    doc = yaml.safe_load(text)
    entry = bundle_entry(doc, args.bundle)
    if entry is None:
        failures.append(f"{path}: no `variable: {args.bundle}` entry in env")
        return
    if entry.get("secret") != args.bundle:
        failures.append(f"{path}: {args.bundle} is not bound to `secret: {args.bundle}`")
    availability = entry.get("availability") or []
    if "RUNTIME" not in availability:
        failures.append(f"{path}: {args.bundle} is not RUNTIME-available")
    if "BUILD" in availability:
        failures.append(f"{path}: {args.bundle} has BUILD availability; it must be RUNTIME only")
    members = membership_comment(text, args.bundle)
    if members is None:
        failures.append(f"{path}: no `# {args.bundle}:` membership comment, cannot show where {args.secret} lives")
    elif args.secret not in members:
        failures.append(f"{path}: {args.secret} is not listed as a member of {args.bundle}")


def check_readers(args, failures):
    code_lines = load_code_lines()
    needles = [f"getSecret('{args.secret}')", f'getSecret("{args.secret}")', f"process.env.{args.secret}"]
    for reader in args.reader:
        if not Path(reader).is_file():
            failures.append(f"{reader}: reader file does not exist")
            continue
        if not any(code_lines.first(reader, needle) for needle in needles):
            failures.append(f"{reader}: no code reads {args.secret} via getSecret('{args.secret}')")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--secret", required=True)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--reader", action="append", required=True)
    parser.add_argument("--apphosting", default="apphosting.yaml")
    args = parser.parse_args()
    failures = []
    try:
        check_declaration(args, failures)
    except (OSError, yaml.YAMLError) as exc:
        print(f"ERROR reading {args.apphosting}: {type(exc).__name__}", file=sys.stderr)
        return 2
    check_readers(args, failures)
    for failure in failures:
        print(f"FAIL: {failure}")
    if failures:
        return 1
    print(f"PASS: {args.secret} is carried by RUNTIME-only {args.bundle} and read via getSecret "
          f"in {len(args.reader)} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env bash
# A2 — components/chrome/nav-config.ts's NAV array gains no new entry. Regression
# guard: NAV also drives the desktop Zone 2 primary nav at >=1240px and must not
# pick up a duplicate "Contact" link there.
set -euo pipefail

FILE="components/chrome/nav-config.ts"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

if ! git diff --quiet HEAD -- "$FILE"; then
  echo "FAIL: $FILE differs from git HEAD — nav-config.ts must be untouched by this feature"
  git diff HEAD -- "$FILE"
  exit 1
fi

if grep -qiE '"?/contact"?|contact' "$FILE"; then
  echo "FAIL: $FILE references contact/\"/contact\" — NAV must not gain a new entry"
  exit 1
fi

echo "PASS: nav-config.ts is unchanged from git HEAD and contains no contact reference"
exit 0

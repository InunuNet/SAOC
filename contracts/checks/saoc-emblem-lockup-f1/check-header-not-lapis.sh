#!/usr/bin/env bash
# A18 — guard against cross-contamination between the two new emblem
# treatments: Header.tsx stays E1 full-colour horizontal (as originally
# briefed — unaffected by the footer's E4 Lapis-monotone change) and must
# never reference the footer-only Lapis asset.
set -euo pipefail

FILE="components/chrome/Header.tsx"

grep -q "saoc-emblem-footer-lapis" "$FILE" && {
  echo "Header.tsx references the footer-only Lapis asset — Header must stay full-colour E1"
  exit 1
}

echo "OK: Header.tsx does not reference the Lapis footer asset"

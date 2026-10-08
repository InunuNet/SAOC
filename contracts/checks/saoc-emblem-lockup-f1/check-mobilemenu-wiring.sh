#!/usr/bin/env bash
# A9 — MobileMenu.tsx: the mark-only header echo swaps to the new asset too,
# at its own derived size (50px); old asset reference gone.
set -euo pipefail

FILE="components/chrome/MobileMenu.tsx"

grep -q "saoc-emblem-lockup" "$FILE" || { echo "MobileMenu.tsx does not reference the new emblem asset"; exit 1; }
grep -q "saoc-logo-ink-paper" "$FILE" && { echo "MobileMenu.tsx still references the old asset"; exit 1; }
grep -qE 'width=\{?50\}?' "$FILE" || { echo "MobileMenu emblem is not sized to the derived 50px"; exit 1; }

echo "OK: MobileMenu.tsx wired to new asset, old asset gone, 50px"

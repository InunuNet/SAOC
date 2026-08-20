#!/usr/bin/env bash
# A3 — every provisional price/capacity/releasedQuantity number lives in lib/provisional-figures.ts
# ALONE. Proven by grepping the five price literals (130/150/380/400/300) across every .ts/.tsx
# source file EXCLUDING lib/provisional-figures.ts itself, contracts/, .agent/, and Plans/ (docs
# and this contract's own goldens/checks are allowed to mention these numbers in prose) — none of
# them may appear as a numeric literal anywhere else, most pointedly scripts/seed-ticketing.ts,
# which must import ADMISSION_PRODUCTS rather than re-typing its own copy.
#
# THE DEFECT CLASS THIS TARGETS
# provisional-figures.md's own header names two prior incidents (the CTICC venue, the 18-21
# September 2027 show dates) that both started as one reasonable estimate, got copy-pasted into a
# second call site, and then diverged silently when only one copy was ever corrected. This check
# is the automated version of "every figure lives in exactly one place in code" from that file's
# containment discipline.
#
# On the CURRENT, unmodified tree this fails because lib/provisional-figures.ts does not exist yet
# — there is nowhere for the single copy to live. It is expected to keep failing until @dev adds
# that file per this contract's brief, and to start passing once scripts/seed-ticketing.ts is
# rewritten to import from it instead of carrying its own TICKET_TYPES literals.
#
# Run as: bash contracts/checks/ticketing-f4-admission-products/check-single-source-of-truth.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SOURCE_FILE="$REPO_ROOT/lib/provisional-figures.ts"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "FAIL: $SOURCE_FILE does not exist. The five admission-product price/capacity figures have"
  echo "      no single source of truth to live in yet."
  exit 1
fi

# Every one of these five numbers must appear in the source-of-truth file at least once (sanity
# check on the file itself, not just on everyone else's absence of it).
MISSING=()
for price in 130 150 380 400 300; do
  if ! grep -qE "\b${price}\b" "$SOURCE_FILE"; then
    MISSING+=("$price")
  fi
done
if (( ${#MISSING[@]} > 0 )); then
  echo "FAIL: $SOURCE_FILE is missing expected price literal(s): ${MISSING[*]}"
  exit 1
fi

# Now prove NO OTHER .ts/.tsx source file re-types one of these numbers in a `price:`/`capacity:`/
# `releasedQuantity:` object-literal position — deliberately NOT a bare `\b(130|150|...)\b` scan
# across the whole tree, which would false-positive on unrelated numeric literals that happen to
# share a value with a price (HTTP status codes, unrelated magic numbers elsewhere in the app).
# Anchoring on the field-name prefix keeps this check meaningful instead of noisy.
OFFENDERS=$(
  grep -rnE "(price|capacity|releasedQuantity)\s*:\s*(130|150|380|400|300)\b" \
    --include='*.ts' --include='*.tsx' \
    "$REPO_ROOT/app" "$REPO_ROOT/components" "$REPO_ROOT/lib" "$REPO_ROOT/scripts" "$REPO_ROOT/sanity" \
    --exclude-dir=node_modules 2>/dev/null \
    | grep -v "^${SOURCE_FILE}:" \
    || true
)

if [[ -n "$OFFENDERS" ]]; then
  echo "FAIL: the following line(s) re-type a price/capacity/releasedQuantity literal OUTSIDE"
  echo "      lib/provisional-figures.ts — every call site must import ADMISSION_PRODUCTS instead"
  echo "      of re-typing a number (scripts/seed-ticketing.ts is the most likely offender —"
  echo "      it must iterate ADMISSION_PRODUCTS, not carry its own TICKET_TYPES literals):"
  echo "$OFFENDERS" | sed 's/^/  - /'
  exit 1
fi

echo "PASS: lib/provisional-figures.ts is the sole location carrying the five admission-product"
echo "      price literals; no duplicate copy exists elsewhere in app/components/lib/scripts/sanity."
exit 0

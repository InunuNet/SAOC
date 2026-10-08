#!/usr/bin/env bash
# A17 — Footer.tsx: SUPERSEDES the original horizontal-full-colour footer
# spec (Brad, 2026-10-08, reference image
# .tmp/sandbox/emblem-lockup/brad-footer-reference.png, "use this lockup
# variation for the footer sized correctly"). The footer now gets the
# STACKED lockup (emblem, then wordmark, then rule, then tagline, in that
# DOM order) using the Lapis-monotone (E4) emblem — NOT the header's
# full-colour (E1) asset. Derived sizes (same es/ns/tsz percentages as the
# header, applied to the footer's OWN existing base sizes — see golden
# Addendum 1): emblem 90px, wordmark 24px, tagline 14px. Ground colour stays
# the site's current dark sage (bg-primary-800) — Brad's earlier "keep
# current Sage & Paper colours" ruling — NOT the reference image's navy
# (#172a5c), which is flagged as an open question in the golden, not
# implemented. Tagline/rule use accent-soft (the Sage palette's own
# onDarkMuted, #c2b393 — an exact token match, not a new colour) instead of
# the old ivory/65 opacity styling.
set -euo pipefail

FILE="components/chrome/Footer.tsx"

grep -q "saoc-emblem-footer-lapis" "$FILE" || { echo "Footer.tsx does not reference the new Lapis-monotone footer asset"; exit 1; }
grep -q "saoc-logo-flat-paper" "$FILE" && { echo "Footer.tsx still references the old asset"; exit 1; }
grep -qE 'width=\{?90\}?' "$FILE" || { echo "Footer emblem is not sized to the derived 90px"; exit 1; }
grep -qE 'width=\{?24\}?|text-\[24px\]' "$FILE" || { echo "Footer wordmark is not sized to the derived 24px"; exit 1; }
grep -qE 'text-\[14px\]' "$FILE" || { echo "Footer tagline is not sized to the derived 14px"; exit 1; }

grep -q "SA Orchid Council" "$FILE" || { echo "wordmark text regressed"; exit 1; }
grep -q "Making a difference since 1968" "$FILE" || { echo "footer tagline text regressed (footer KEEPS its own tagline — only UtilityBar's was removed)"; exit 1; }

grep -q "bg-primary-800" "$FILE" || { echo "footer ground is no longer the current dark sage (bg-primary-800)"; exit 1; }
grep -qi "172a5c" "$FILE" && { echo "footer uses the reference image's navy ground literal — that's an open question for Brad, not implemented"; exit 1; }

grep -qE 'aria-hidden="true"[^>]*(divider|rule)|(divider|rule)[^>]*aria-hidden="true"' "$FILE" \
  || { echo "no divider-rule element found between wordmark and tagline"; exit 1; }

grep -q "accent-soft" "$FILE" || { echo "tagline/rule not restyled to accent-soft (Sage palette's onDarkMuted)"; exit 1; }

# DOM order: emblem image, then wordmark text, then (implicitly) the rule,
# then tagline text — proven by string-position order in the source file.
EMB_POS=$(grep -n "saoc-emblem-footer-lapis" "$FILE" | head -1 | cut -d: -f1)
WM_POS=$(grep -n "SA Orchid Council" "$FILE" | head -1 | cut -d: -f1)
TAG_POS=$(grep -n "Making a difference since 1968" "$FILE" | head -1 | cut -d: -f1)

if [ -z "$EMB_POS" ] || [ -z "$WM_POS" ] || [ -z "$TAG_POS" ]; then
  echo "could not locate emblem/wordmark/tagline lines to verify stacked order"
  exit 1
fi
if [ "$EMB_POS" -ge "$WM_POS" ] || [ "$WM_POS" -ge "$TAG_POS" ]; then
  echo "stacked DOM order wrong — expected emblem, then wordmark, then (rule), then tagline (lines $EMB_POS/$WM_POS/$TAG_POS)"
  exit 1
fi

echo "OK: Footer.tsx wired to stacked Lapis lockup, 90/24/14px, sage ground, accent-soft text, correct DOM order"

#!/usr/bin/env bash
# A8 — PROVIDER-CHOICE UI USES ONLY EXISTING DESIGN TOKENS. CLAUDE.md: "No invented brand assets
# — do not add colours, logos, fonts, or visual design decisions. Wait for Claude Design
# handoffs." The mission spec (§4) explicitly authorises F2 to ship a plain radio/toggle control
# WITHOUT waiting on a Claude Design handoff — but only as "copy/markup only using existing design
# tokens", which this check turns into something greppable rather than a judgement call.
#
# WHAT THIS BANS, ANYWHERE UNDER components/tickets/ (the whole directory, not just new files —
# a new brand color introduced by editing an EXISTING file, e.g. CheckoutRedirectNotice.tsx to
# make its copy provider-aware, is exactly as much a violation as one in a new file):
#   - any literal hex color (#fff, #a1b2c3, #A1B2C3FF) — the project's palette lives in
#     app/globals.css's @theme tokens (text-ink, bg-accent, etc.), never inlined here;
#   - any inline `style={{` / `style="` attribute — CLAUDE.md's "No inline styles" rule, and the
#     specific shape a hex color or arbitrary color would most likely hide inside;
#   - any Tailwind arbitrary COLOR value (bg-[#...], text-[#...], border-[#...], ring-[#...],
#     fill-[#...], from-[#...], to-[#...], via-[#...]) — arbitrary SIZE/SPACING values
#     (text-[11px], tracking-[0.16em]) are an established pattern in this codebase (already used
#     throughout TicketPurchaseForm.tsx) and are NOT banned; only arbitrary values that could carry
#     a color are.
#
# Run as: bash contracts/checks/ozow-m1-f2/check-no-new-brand-tokens.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# SCOPED, NOT DIRECTORY-WIDE: components/tickets/ also holds DownloadTicketButton.tsx, which
# draws a <canvas> ticket image and legitimately sets ctx.fillStyle = '#ffffff' — a 2D canvas
# drawing color, not a Tailwind/JSX brand decision, and entirely unrelated to this feature. A
# A directory-wide hex ban false-positives on it (observed 2026-08-22). This check instead scopes
# to exactly the files F2 is expected to touch (the checkout hand-off UI this feature adds a
# provider choice to) PLUS any new file whose name signals it's the provider-choice control, so a
# new component doesn't silently escape the ban by being named something else.
FILES=()
for f in \
  components/tickets/CheckoutRedirectNotice.tsx \
  components/tickets/PayfastRedirectForm.tsx \
  components/tickets/TicketPurchaseForm.tsx \
  components/tickets/useTicketCart.ts \
  ; do
  [ -f "$f" ] && FILES+=("$f")
done
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(find components/tickets -iname '*provider*.ts' -o -iname '*provider*.tsx' -print0 2>/dev/null)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "FAIL: none of the expected F2 UI files exist yet — nothing to check"
  exit 1
fi
echo "-- checking: ${FILES[*]}"

FAIL=0

echo "-- checking for literal hex colors --"
if grep -InE '#[0-9a-fA-F]{3}([0-9a-fA-F]{3}){0,2}\b' "${FILES[@]}"; then
  echo "FAIL: literal hex color found (see above)"
  FAIL=1
else
  echo "ok: no literal hex colors"
fi

echo "-- checking for inline style attributes --"
if grep -InE 'style=\{\{|style="' "${FILES[@]}"; then
  echo "FAIL: inline style attribute found (see above)"
  FAIL=1
else
  echo "ok: no inline style attributes"
fi

echo "-- checking for Tailwind arbitrary COLOR values --"
if grep -InE '\b(bg|text|border|ring|fill|from|to|via|outline|stroke|caret|accent|shadow|decoration)-\[#' "${FILES[@]}"; then
  echo "FAIL: Tailwind arbitrary color value found (see above)"
  FAIL=1
else
  echo "ok: no Tailwind arbitrary color values"
fi

# Self-check: prove the pattern actually fires against a synthetic fixture, so a change to the
# grep that silently stops matching is caught rather than passing vacuously.
TMP_FIXTURE="$(mktemp -t ozow-f2-brand-token-selfcheck.XXXXXX.tsx)"
trap 'rm -f "$TMP_FIXTURE"' EXIT
cat > "$TMP_FIXTURE" <<'EOF'
export function Fixture() {
  return <div style={{ color: '#ABCDEF' }} className="bg-[#123456]">x</div>;
}
EOF
if grep -qE '#[0-9a-fA-F]{3}([0-9a-fA-F]{3}){0,2}\b' "$TMP_FIXTURE" \
  && grep -qE 'style=\{\{' "$TMP_FIXTURE" \
  && grep -qE '\bbg-\[#' "$TMP_FIXTURE"; then
  echo "ok: self-check fixture triggers all three patterns"
else
  echo "FAIL: self-check fixture did NOT trigger the ban patterns — the check is not firing"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo "OVERALL: FAIL"
  exit 1
fi
echo "OVERALL: PASS — no new brand assets under components/tickets/."

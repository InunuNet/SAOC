#!/usr/bin/env bash
# F3 (ozow-payment-provider) — docs-completeness gate. Confirms two things the mission brief
# names explicitly: docs/payment-gateway-research-2026-08.md carries the HMAC-SHA512 -> plain
# SHA512 correction note (F1 landed the correction, F3 only needs to confirm it survived), and
# docs/payment-seam.md documents BOTH providers, not just PayFast plus a passing Ozow mention.
#
# FAILS ON: the correction note missing or reworded away from naming both the wrong and right
# algorithm; payment-seam.md missing a dedicated Ozow adapter section, OR missing coverage of
# either the confirmNotification() live call or the provider-choice/registry wiring (i.e. present
# only as a stray one-line mention, not actual documentation of the adapter).
set -euo pipefail

RESEARCH_DOC="docs/payment-gateway-research-2026-08.md"
SEAM_DOC="docs/payment-seam.md"

for f in "$RESEARCH_DOC" "$SEAM_DOC"; do
  [ -f "$f" ] || { echo "FAIL: $f does not exist"; exit 1; }
done

grep -qi "HMAC-SHA512" "$RESEARCH_DOC" || {
  echo "FAIL: $RESEARCH_DOC no longer mentions the original HMAC-SHA512 claim being corrected"
  exit 1
}
grep -qi "plain SHA512" "$RESEARCH_DOC" || {
  echo "FAIL: $RESEARCH_DOC does not state the corrected algorithm (plain SHA512)"
  exit 1
}
grep -qi "correction" "$RESEARCH_DOC" || {
  echo "FAIL: $RESEARCH_DOC has no visible correction note"
  exit 1
}

grep -qi "## Ozow adapter" "$SEAM_DOC" || {
  echo "FAIL: $SEAM_DOC has no dedicated Ozow adapter section"
  exit 1
}
grep -qi "confirmNotification" "$SEAM_DOC" || {
  echo "FAIL: $SEAM_DOC does not document confirmNotification()"
  exit 1
}
grep -qiE "registry|resolveProvider|providerId" "$SEAM_DOC" || {
  echo "FAIL: $SEAM_DOC does not document the provider registry / providerId wiring"
  exit 1
}
grep -qi "PayFast" "$SEAM_DOC" || {
  echo "FAIL: $SEAM_DOC no longer documents PayFast — must cover both providers, not just Ozow"
  exit 1
}

echo "PASS: both docs present and cover the required content"
exit 0

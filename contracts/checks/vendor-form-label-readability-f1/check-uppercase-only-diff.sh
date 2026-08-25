#!/usr/bin/env bash
# Verifies the real property A3 needs: every changed line in the working-tree diff that
# touches the font-mono/text-[11px] label treatment differs from its old version by the
# removal of the "uppercase " token ONLY -- proving no colour/contrast class or any other
# token (including the tracking value) was added, removed, or reordered on that line.
#
# A same-line-token grep (e.g. matching "text-muted" on both the - and + line) cannot prove
# this: an unchanged colour token appears on both sides of a line that only dropped
# "uppercase ", so it always matches regardless of whether a colour actually changed. Pairing
# the diff's removed/added lines in order and comparing content after stripping the one
# expected token is the only way to prove nothing else moved.
set -euo pipefail

EXPECTED_PAIRS=40

# Scoped to exactly the 30 files this mission touches (see golden README) so the check is
# deterministic regardless of what else is dirty elsewhere in the repo -- an unscoped
# `git diff` over the whole working tree is fragile to unrelated dirty files (e.g. this
# mission's own golden README documents the before/after class strings in prose, which
# would otherwise show up as unpaired "+" lines and break the pairing logic).
TARGET_FILES=(
  "app/admin/settings/page.tsx"
  "app/admin/login/LoginFormFields.tsx"
  "app/admin/login/GoogleSignInButton.tsx"
  "app/(marketing)/societies/SocietiesClient.tsx"
  "app/(marketing)/contact/page.tsx"
  "app/(marketing)/media-kit/page.tsx"
  "app/(marketing)/judging/page.tsx"
  "app/(marketing)/privacy/page.tsx"
  "app/(marketing)/terms/page.tsx"
  "app/(marketing)/constitution/page.tsx"
  "app/(marketing)/refunds/page.tsx"
  "app/(marketing)/national-show/page.tsx"
  "app/(marketing)/national-show/archive/[year]/page.tsx"
  "components/tickets/CartAttendeeFields.tsx"
  "components/tickets/TicketFormField.tsx"
  "components/tickets/OzowSandboxTestModeBanner.tsx"
  "components/tickets/TicketPurchaseForm.tsx"
  "components/tickets/CartDayPicker.tsx"
  "components/tickets/DayQuantityPicker.tsx"
  "components/vendors/VendorFormField.tsx"
  "components/vendors/VendorRadioGroupField.tsx"
  "components/vendors/VendorBooleanRadioField.tsx"
  "components/vendors/VendorCheckboxGroupField.tsx"
  "components/show/ExhibitorSteps.tsx"
  "components/contact/ContactForm.tsx"
  "components/show/ExhibitorKeyDates.tsx"
  "components/show/VenueCard.tsx"
  "components/admin/TicketsTable.tsx"
  "components/admin/DoorScannerClient.tsx"
  "components/admin/VendorReviewTable.tsx"
)

diff_pairs="$(git diff -U0 --no-color -- "${TARGET_FILES[@]}" | grep -E '^[-+].*font-mono text-\[11px\]' || true)"

if [ -z "$diff_pairs" ]; then
  echo "FAIL: no font-mono text-[11px] diff lines found (expected $EXPECTED_PAIRS pairs -- is the fix applied and uncommitted?)"
  exit 1
fi

echo "$diff_pairs" | awk -v expected="$EXPECTED_PAIRS" '
{
  prefix = substr($0, 1, 1);
  content = substr($0, 2);
  if (prefix == "-") { q[++qn] = content; next }
  if (prefix == "+") {
    qi++;
    minus = q[qi];
    gsub(/uppercase /, "", minus);
    if (minus != content) {
      print "MISMATCH (a change beyond uppercase removal was found):";
      print "-" q[qi];
      print "+" content;
      bad = 1;
    }
    pairs++;
  }
}
END {
  print "pairs checked: " pairs;
  if (bad) { print "FAIL: at least one line changed by more than uppercase removal"; exit 1 }
  if (pairs != expected) { print "FAIL: expected " expected " pairs, found " pairs; exit 1 }
  print "PASS: all " pairs " changed lines differ from their prior version by uppercase removal only";
}
'

#!/usr/bin/env bash
# A1-A14 — form-error-contrast-remaining-components F1.
# Runs every assertion from contract-f1.yaml verbatim and reports pass/fail per id.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

FAIL=0

check() {
  local id="$1"
  local desc="$2"
  local cmd="$3"
  if eval "$cmd" >/tmp/check_${id}.out 2>&1; then
    echo "PASS: $id — $desc"
  else
    echo "FAIL: $id — $desc"
    sed 's/^/    /' "/tmp/check_${id}.out"
    FAIL=1
  fi
}

check A1 "CartDayPicker no text-accent" '! grep -q "text-accent" components/tickets/CartDayPicker.tsx'
check A2 "CartDayPicker bordered-callout signature" 'grep -q "bg-bone" components/tickets/CartDayPicker.tsx && grep -q "text-primary-800" components/tickets/CartDayPicker.tsx && grep -q "border" components/tickets/CartDayPicker.tsx'
check A3 "CartDayPicker role=alert" 'grep -q "role=\"alert\"" components/tickets/CartDayPicker.tsx'

check A4 "TicketFormField no text-accent" '! grep -q "text-accent" components/tickets/TicketFormField.tsx'
check A5 "TicketFormField bordered-callout signature" 'grep -q "bg-bone" components/tickets/TicketFormField.tsx && grep -q "text-primary-800" components/tickets/TicketFormField.tsx && grep -q "border" components/tickets/TicketFormField.tsx'
check A6 "TicketFormField role=alert" 'grep -q "role=\"alert\"" components/tickets/TicketFormField.tsx'

check A7 "DownloadTicketButton no text-accent" '! grep -q "text-accent" components/tickets/DownloadTicketButton.tsx'
check A8 "DownloadTicketButton bordered-callout signature" 'grep -q "bg-bone" components/tickets/DownloadTicketButton.tsx && grep -q "text-primary-800" components/tickets/DownloadTicketButton.tsx && grep -q "border" components/tickets/DownloadTicketButton.tsx'
check A9 "DownloadTicketButton role=alert preserved" 'grep -q "role=\"alert\"" components/tickets/DownloadTicketButton.tsx'

check A10 "WCAG AA contrast: text-primary-800 on bg-bone" 'python3 contracts/golden/form-error-contrast-remaining-components-f1/check_bordered_callout_contrast.py app/globals.css'

check A11 "ContactForm.tsx untouched (regression guard)" 'grep -q "border border-primary-800 bg-bone px-4 py-3 font-sans text-\[14px\] text-primary-800" components/contact/ContactForm.tsx'
check A12 "TicketPurchaseForm.tsx untouched (regression guard)" 'grep -q "border border-primary-800 bg-bone px-4 py-3 font-sans text-\[13px\] text-primary-800" components/tickets/TicketPurchaseForm.tsx && grep -q "border border-primary-800 bg-bone px-4 py-3 font-sans text-\[14px\] text-primary-800" components/tickets/TicketPurchaseForm.tsx'

check A13 "No new arbitrary colour tokens introduced" '! grep -E "(bg|text|border)-\[#" components/tickets/CartDayPicker.tsx components/tickets/TicketFormField.tsx components/tickets/DownloadTicketButton.tsx'

check A14 "tsc --noEmit clean" 'pnpm exec tsc --noEmit'

if [ "$FAIL" -eq 0 ]; then
  echo
  echo "ALL PASS"
  exit 0
else
  echo
  echo "ONE OR MORE FAILED"
  exit 1
fi

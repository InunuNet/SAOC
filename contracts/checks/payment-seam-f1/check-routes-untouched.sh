#!/usr/bin/env bash
# A10 (RETIRED 2026-11-22) — was: "F1 IS ADDITIVE, NEITHER ROUTE NOR lib/payfast.ts IS TOUCHED".
#
# It pinned sha256 values of app/api/tickets/checkout/route.ts, app/api/tickets/itn/route.ts and
# lib/payfast.ts taken on 2026-08-19, purely as a mission-sequencing boundary (keep F1 additive so
# F3's live sandbox purchase has one candidate cause). F2 then rewired those routes on purpose, and
# they have changed many times since, so the pin protected nothing nameable and failed on every
# legitimate edit. The properties that matter now are covered by checks that read behaviour or
# structure: the checkout wiring and transaction-scope checks, the payment-seam fail-closed,
# inbound-verify and server-confirm checks in this folder.
#
# The script stays only so contracts/contract-payment-seam-f1.yaml (A10) does not point at a
# missing file; it asserts nothing. See RETIRED.md in this folder.
echo "RETIRED A10: sha256 pins of the checkout/ITN routes and lib/payfast.ts (mission sequencing only); see contracts/checks/payment-seam-f1/RETIRED.md"
exit 0

#!/usr/bin/env bash
# A8 (RETIRED 2026-11-22) — was: "THIS FEATURE IS ADDITIVE ONLY: neither checkout route, the ITN
# route nor any PayFast file is touched".
#
# It pinned sha256 values of lib/payments/index.ts, lib/payments/types.ts, lib/payments/payfast.ts,
# lib/payfast.ts and both ticket routes taken on 2026-08-22, only to keep the Ozow F1 milestone
# additive. F2 wired the routes and the provider registry on purpose and all six files have changed
# many times since, so the pin protected nothing nameable. The Ozow adapter's real properties are
# asserted by the behavioural checks in this folder (algorithm, inbound verify, outbound signature,
# status map, fail-closed config) and by the PayFast vocabulary boundary check.
#
# The script stays only so a reference to it does not dangle; it asserts nothing. See RETIRED.md
# in this folder.
echo "SUPERSEDED: A8 retired 2026-11-22 -- sha256 pins of the payments seam and ticket routes were milestone sequencing only and protected no behaviour; see contracts/checks/ozow-m1-f1/RETIRED.md" >&2
exit 77

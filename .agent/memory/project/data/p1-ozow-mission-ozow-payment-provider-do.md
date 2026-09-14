# p1-ozow-mission-ozow-payment-provider-do

**[P1] Ozow — mission `ozow-payment-provider` DONE (F1-F4, all gated, M4 gate passed
  2026-08-23); one external item remains for Brad.** Ozow is now a fully working second
  `PaymentProvider` alongside PayFast — adapter, checkout wiring/provider registry, and a real
  `confirmNotification()` fix (F4: `GetTransactionByReference` needs an explicit `IsTest=true`
  query param for sandbox transactions, which the code never sent — see `learned.md` "Ozow F4").
  The originally-logged "unprovisioned merchant account" blocker was WRONG (see `learned.md`) —
  real causes were a SiteCode misconfiguration (fixed) and this F4 bug (fixed). **Still open,
  external and genuinely Brad's to resolve:** a real Ozow-side R0.01 transaction cap on the
  sandbox account — support ticket needed with Ozow to raise/remove it before a full-value live
  purchase can be proven end to end (Ozow support email still unsent). PayFast's own live-purchase
  path remains regression-proved unaffected. **Demo-readiness gap now closed** — mission
  `ozow-sandbox-toggle` (F1, gated 2026-08-24, 12/12 PASS) shipped an admin-toggleable
  `ozowSandboxTestMode` flag (`/admin/settings`) that forces only the amount sent to Ozow's
  `initiate()` to R0.01 while leaving cart/display/order/PayFast untouched, with a visible TEST
  MODE banner; this replaces the manual, revert-dependent live-Sanity-price-edit workaround as
  the documented demo method (`docs/payment-seam.md`). The R0.01 sandbox cap above is a separate,
  still-open, vendor-side issue — do not conflate the two. See
  [`contracts/golden/ozow-m1-f3/README-addendum-blocked.md`](../contracts/golden/ozow-m1-f3/README-addendum-blocked.md)
  and `contracts/golden/ozow-m1-f4/README.md` for the full investigation. Outstanding follow-ups
  from `docs/payment-gateway-research-2026-08.md` §10 still apply once live: PayFast Clause 9.8
  fund-hold commitment in writing before sales open; PCI-DSS/ISO 27001 certificates verified via
  IAF CertSearch; POPIA operator agreement; attorney review of the refund policy; disclosure to
  the council of our conflict of interest (we built the custom system) and the thin-evidence
  spots. Card payments must be explicitly activated on whichever provider's merchant account — not
  always on by default — or international attendees cannot pay at all (confirmed again in the
  pricing artifact's payment note to Lee-Ann).

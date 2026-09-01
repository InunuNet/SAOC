# Reboot Context
_Generated: 2026-09-01T19:26Z_

## What happened last session
Closed out vendor-stand-early-bird-pricing (M1 F1, 5/5 gate): confirmed R1450/stand pricing with 20% early-bird tier, 90-day cutoff derived server-side, spoof-proof. Same-day companion stand-payment-link-visibility (2/2 gate) lets admins mint/copy the payment link so email failure can't strand a vendor. Both vendor HMAC secrets, previously missing entirely, wired into Secret Manager + apphosting.yaml (d879514d) and deployed to beta.saoc.co.za. Logged 5 session lessons to learned.md (missing-secret defect class, stale-doc false blocker, concurrent-agent phantom gate failures, redesigned-check adversarial-pass gap, mid-revision architect ruling). Wrote next-sprint.md: verify demo end-to-end on beta first, then independent adversarial pass on 4 rewritten M3 checks, contract-decay audit, deferred legacy-order tier check, Register Society (blocked on Lee-Ann).

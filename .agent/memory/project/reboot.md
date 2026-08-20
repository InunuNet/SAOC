# Reboot Context
_Generated: 2026-08-20T00:14Z_

## What happened last session
payment-provider-seam shipped and closed: PaymentProvider seam with readiness gate, order-identity guard and integer-cents amounts, proven live with a real purchase (SAOC-2027-EAS2GC19BG1K) against deployed 0b39a86. Codex found two real production defects our own chain passed: a missing in-transaction m_payment_id check that could mark an unrelated order paid, and a float amount comparison accepting a one-cent underpayment. A dead-assertion sweep then closed every stale assertion found: A18 removed, a second A18 inverted (it asserted source-IP gates the ITN write while the route deliberately never enforces), A7 repointed after the seam moved signing, A30/A31 repaired (compared a field nothing writes). Each proven by observing it fail first. Open for Brad: deployed ADMIN_EMAIL_ALLOWLIST has 1 entry vs 5 local, and App Hosting auto-rollout silently stopped firing.

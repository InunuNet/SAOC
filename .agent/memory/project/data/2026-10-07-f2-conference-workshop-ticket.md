# 2026-10-07-f2-conference-workshop-ticket

(2026-10-07, F2 conference-workshop-tickets) `scripts/fix-vip-and-weekend-pass-pricing.ts` (manual --apply one-off) is now stale: it plans weekend-pass early-bird cutoff values, but weekend-pass.earlyBirdCutoff is intentionally null after the EB SKU split. Retire or update before anyone runs it with --apply.

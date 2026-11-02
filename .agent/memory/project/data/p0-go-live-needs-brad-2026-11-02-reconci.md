# p0-go-live-needs-brad-2026-11-02-reconci

**[P0, go-live, needs Brad, 2026-11-02] Reconcile cron is off: apphosting.yaml has no RECONCILIATION_CRON_SECRET binding, so the route returns 401 in production.** Spec on spec/go-live-f6 at .agent/memory/project/specs/go-live-prep/f7-reconcile-cron/spec.md. Brad creates the secret and grants access BEFORE the yaml entry merges, or the whole rollout fails. Spec also notes vendorStandOrders is not covered by the route.

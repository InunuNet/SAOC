# p1-reconcile-cron-does-not-exist-cloud-s

**[P1] Reconcile cron does not exist.** Cloud Scheduler API is not enabled on saoc-webapp (checked 2026-10-29), so POST /api/admin/reconcile-orders never runs; 31 orders sit in `reserved`. Needed before ticketing goes live on 1 Dec 2026 and feeds SEC-02 (seat-hold abuse). Prod config → /spec first.

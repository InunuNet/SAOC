# p1-security-from-nos-site-2026-11-01-app

**[P1, security, from NOS Site 2026-11-01] app/api/admin/export-csv/route.ts: the authenticated CSV SUCCESS response sets no Cache-Control and carries attendee names + emails.** Add `Cache-Control: no-store` (and `Content-Disposition: attachment`) to the 200. Content-Disposition already present; only no-store missing. Dispatched 2026-11-01 as Dev_Son5_M1-F4_GoLivePrep.

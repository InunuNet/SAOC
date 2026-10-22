# Dashboard data map (golden) — ruling (c), existing data only

| card | source | notes |
|---|---|---|
| Tickets sold | `tickets` where status in (paid, checked-in) | count |
| Orders | `orders` where status == 'paid' | OrderStatus = reserved/paid/cancelled; "Orders" is ambiguous in the ruling — this is the architect's reading; flagged |
| Applications pending review | `vendorApplications` where status == 'pending' | brass tile when >0; also the sidebar badge |
| Vendors approved | `vendorApplications` where status == 'approved' | data exists |
| Newsletter subscribers | `newsletterSubscribers` count (collection is created on branch feat/footer-newsletter-subscribe) | HIDDEN unless nav-config newsletter.available === true |
Use Firestore `count()` aggregations, not full-collection reads. "Refresh" button: NOT rendered (page is server-rendered, force-dynamic, not client-cached). Subtitle "Updated hh:mm" (server time, Africa/Johannesburg, 24h). Firestore timestamps are UTC; format with an explicit timeZone.
Needs attention: 5 oldest `vendorApplications` with status 'pending' ordered by submittedAt asc (business, submitted date, View → /admin/vendors/applications?view=<id>). Existing index check: single-field equality + orderBy on same collection may need a composite index (status, submittedAt) — if so add to firestore.indexes.json or sort in memory over the pending set (preferred: in-memory, pending set is small).
Quick actions (4): Download tickets CSV (/api/admin/export-csv), Open door scanner (/admin/door), Review applications (/admin/vendors/applications), Payment settings (/admin/settings); capability-gated ones hidden without capability.
Door "Checked in: N": tickets where status == 'checked-in' (data exists).
No data source / ruling gaps: Vendors table columns (derived), "Orders" definition, empty-state copy (no new strings), Door "first check-in time" uses ticket.checkedInAt if the check-in API returns it (verify in app/api/admin/checkin/route.ts; else omit that line and report).

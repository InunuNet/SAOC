Adversarial review of the diff on branch fix/vendor-admin-review against origin/main.

Spec: .agent/memory/project/specs/backlog-wave-1028/m3-f2-vendor-admin/goldens/ (f2a-small-fixes.md, f2b-detail-page.md, verification-table.md).

Look for, and report as FAIL with file:line:
1. The payment-link route still sends any email, or lost its admin gate, 404/409 guards or fresh-token mint.
2. /register business-name prefill read from the query string instead of the verified application doc; or the gate branch behaviour changed.
3. termsAccepted still reachable in VendorPaymentFieldset, or the checkbox rendered before the Terms prose, or validation/payload keys changed.
4. Any user-visible string containing a camelCase field key or "must be a non-empty string" on /national-show/vendors/apply.
5. The detail page: any path that renders without getAdminSession + capability check; raw doc.data() passed to a component without serializeVendorSubmission; any Firestore write; dangerouslySetInnerHTML; a crash on a pre-M2 document (undefined arrays, missing fields, non-object table rows); a raw enum slug shown (e.g. "no-preference"); a section named in f2b-detail-page.md missing; Timestamps rendered as [object Object].
6. Scope creep: boothSize handling in /register or /payment touched, table layout changed, new colours/fonts/tokens.
Line 1 of your answer must be PASS or FAIL.

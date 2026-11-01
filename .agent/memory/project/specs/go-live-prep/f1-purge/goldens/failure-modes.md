# Failure modes: what must NOT happen

Machine form: `forbidden-ids.json` (fixture ids). Human reasons:

1. Reserved order whose hold is still live (future expiresAt): selecting it frees a seat a real buyer is mid-checkout on. (KEEP-O-RES-FUTURE, KEEP-T-6)
2. Reserved-expired order with `gatewayPending` (gateway said Pending/PendingInvestigation): money may be in flight. Held, not selected. (HELD-O-RES-EXP-PENDING)
3. Reserved-expired order carrying a gateway payment reference with no test evidence: a live Ozow transaction may exist. (HELD-O-RES-EXP-OZOWREF)
4. Paid order with `issuedInTestMode:false`: a real sale. (KEEP-O-PAID-REAL, KEEP-T-5)
5. Paid order with no test evidence (pre-flag era, PayFast): cannot be proven sandbox; reported, never deleted by this script. (HELD-O-PAID-UNFLAGGED)
6. Children of held-back/kept orders: cascade follows selected parents only. (KEEP-T-12, KEEP-T-13, KEEP-T-14)
7. Orphan positions that are paid, checked-in, or still within a live hold. (HELD-T-9, HELD-T-11, HELD-T-10)
8. Cancelled orders: already inert; not touched. (KEEP-O-CANCELLED)
9. Vendor stand orders: pending, or paid without test evidence, or real Ozow. (KEEP-VSO-PENDING, HELD-VSO-PAYFAST-UNFLAGGED, KEEP-VSO-REAL)
10. Dry-run (including no-flag default) performs any Firestore write: forbidden, structurally (pure selector module has no write API).
11. Apply with: no manifest; manifest older than 1h; wrong/missing PURGE_CONFIRM; selection drifted since the dry-run (any doc added, removed or edited); both `--dry-run` and `--apply`: all refuse, delete nothing, write no backup.
12. Delete before backup is durable; batch over 400 writes; delete of a doc changed after the manifest (precondition).
13. Secret leakage: env values appear in stdout, stderr, manifest, backup or result files.
14. `undefined` own-properties in any written JSON/doc (CLAUDE.md Firestore builders rule): coalesce to null.
15. Writing outside `<project>/.tmp/sandbox` for manifest/backup/result.

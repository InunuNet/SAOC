# go-live-prep F1: test-data purge (golden spec)

Implements `scripts/ops/purge-test-data.mts`. Dev builds against this file, `fixtures/snapshot.json`,
`expected-manifest.json`, `forbidden-ids.json`, `failure-modes.md`. Dev does not write the checks.

## Module split (structural, asserted by A3)
- `scripts/ops/purge-select.mts` PURE: `selectPurge(snapshot, now) -> Selection`, `stockDelta`, `digestOf(selection)`,
  `hardGuard(collection, doc, now) -> {ok, reason}`. No firebase import, no `.delete(` `.commit(` `.set(` `.update(` `.batch(`.
- `scripts/ops/purge-test-data.mts` CLI + IO: argv, snapshot source (live Admin SDK read, or `--fixture`), manifest + backup writing, apply.
- Live Firestore access reuses `initAdmin()` from `lib/firebase-admin.ts`; env comes from `process.loadEnvFile('.env.local')` inside
  the script. Never print, log or write an env value (A10).

## CLI contract
| flag | meaning |
|---|---|
| (none) or `--dry-run` | DEFAULT. Read-only. Writes `<out-dir>/manifest-<ts>.json`, prints per-class counts and the confirm token. Exit 0. |
| `--apply` | Requires `--manifest <path>`; see Apply gates. Mutually exclusive with `--dry-run` (exit 2 if both). |
| `--manifest <path>` | apply only |
| `--out-dir <dir>` | default `.tmp/sandbox/purge` (must resolve inside `<project>/.tmp/sandbox`, else exit 2) |
| `--fixture <snapshot.json>` | read the snapshot from the file instead of Firestore. Source recorded as `"fixture"`. |
| `--fixture-out <path>` | only with `--fixture --apply`: write the post-apply snapshot here instead of Firestore. Without it, fixture apply writes nothing. |
| `--now <iso>` | fixture mode only (exit 2 in live mode): fixes the clock |
Exit codes: 0 ok, 2 usage/refusal, 3 apply gate failed, 4 hard-guard tripped on a selected doc, 5 backup failure.

## Test evidence (T)
`T(doc) = doc.issuedInTestMode === true || doc.expectedGatewayAmount === 0.01`. `issuedInTestMode` exists on orders and tickets
on origin/main (types/index.ts:141,200; absent from older docs); `expectedGatewayAmount === 0.01` is the Ozow sandbox R0.01 marker.

## Selection rules (one per class; deletion unit is the document)
- R1 reservedExpired (orders): `status==='reserved' && expiresAt < now && gatewayPaymentId==null && gatewayPending==null`,
  OR `status==='reserved' && expiresAt < now && T`. A reserved-expired order that has a gateway reference or a gatewayPending marker
  and no T goes to `heldBack.reservedExpiredWithGatewayRef`. Reserved with `expiresAt` null or in the future: never.
- R2 sandboxPaidOrders (orders): `status==='paid' && T`. Paid with no T: `heldBack.paidWithoutTestEvidence` (cannot be proven test).
- R3 orderPositions (tickets): every ticket whose `orderId` is in R1 or R2 (cascade, any ticket status including `checked-in`).
- R4 orphanPositions (tickets): `status==='reserved'`, and (`orderId==null` or no order doc with that id exists), and
  (`expiresAt` absent or `< now`), and not already in R3. Orphans that are paid, checked-in/checked_in, refunded, or reserved with future
  `expiresAt` go to `heldBack.orphanPositionsNotPurgeable`.
- R5 sandboxVendorStandOrders (vendorStandOrders): `status==='paid' && T`. Paid without T: `heldBack.vendorStandOrdersPaidWithoutTestEvidence`.
- stockDelta (report only, no writes): per (showId, ticketType), count tickets with `status in (reserved, paid)` excluding reserved with
  `expiresAt <= now` (same rule as `stillHoldsSeat` in `lib/data/tickets.ts`), before vs after removing the selected tickets.
  Rows with before==after omitted. There is no stored counter to reset.
- Children of a held-back order are never reported anywhere (they stay untouched and silent).

## Hard guard (independent of the selector; re-run on every doc immediately before it is deleted)
Refuse (exit 4, nothing further deleted) if a selected doc has, and NOT T: `status in (paid, checked-in, checked_in, refunded)`, or
`gatewayPaymentId != null`, or `gatewayPending != null`, or `gateway==='ozow'` with a non-null `gatewayPaymentId`.
(T overrides, per the brief: "unless flagged test".) The guard also refuses any doc outside collections orders/tickets/vendorStandOrders.

## Manifest shape (see expected-manifest.json for a worked example)
`schemaVersion:1, mode:"dry-run", source:"live"|"fixture", projectId, now, generatedAt, classes{<classId>:{rule,action:"delete",count,docs[{collection,id,updateTime}]}}, heldBack{<bucket>:[{collection,id}]}, stockDelta{note,rows[]}, totals{selected,heldBack,byCollection}, selectionDigest, confirmToken`.
- `selectionDigest` = sha256 hex of canonical JSON (sorted keys, no whitespace) of `classes` only (ids + updateTime, so a doc edited after the dry-run changes the digest).
- `confirmToken` = first 12 hex chars of `selectionDigest`. Printed by dry-run; Brad exports `PURGE_CONFIRM=<token>`.
- Live `updateTime` is the Firestore doc `updateTime`; fixture `updateTime` is `_updateTime`.

## Apply gates (all must pass before the first write; any failure exits 3, writes nothing)
1. `--manifest` present, parses, `schemaVersion===1`, `mode==='dry-run'`, `selectionDigest` recomputes from its own `classes`.
2. `generatedAt` within the last 60 minutes of now (and not in the future).
3. Fresh read of the source and re-selection: `digestOf(live) === manifest.selectionDigest` (exact match, includes updateTime).
4. `process.env.PURGE_CONFIRM === manifest.confirmToken`.
5. Live mode only: `projectId` is the configured project and `--manifest` source is `live` (a fixture manifest never applies to live, and vice versa).
Then: hardGuard every doc; write `<out-dir>/backup-<ts>.json` (full doc bodies + ids + paths, includes manifest digest), fsync, re-read it and
verify doc count equals the manifest total (exit 5 otherwise); only then delete. Delete order: tickets, then orders/vendorStandOrders.
Batches of at most `BATCH_LIMIT = 400` writes; each delete carries a `lastUpdateTime` precondition from the manifest (live) so a doc
changed mid-run is skipped and reported, never deleted. Writes `<out-dir>/apply-result-<ts>.json`:
`{events:[{t,kind:"backup-written"|"batch-commit",size?}], deleted:n, skipped:[ids], backupPath, backupSha256}`.
The agent never runs `--apply` against live; Brad does.

# F2 golden spec — crash-resilient cleanup manifest

## New exports (`contracts/checks/ticketing-hardening/_shared.mjs`)

```js
export function recordFixtureCreated(collection, id) { ... }   // sync append
export async function sweepManifestFromPriorRun() { ... }      // preflight
export function clearManifestEntries(ids) { ... }              // sync truncate/rewrite
```

- `recordFixtureCreated(collection, id)` appends one NDJSON line
  `{ collection, id, ts }` to a manifest file at
  `join(tmpdir(), 'saoc-ticketing-hardening-manifest.ndjson')` using
  `writeSync`/`appendFileSync` in SYNCHRONOUS mode (not the promise-based
  `fs.promises` API) — the same reasoning `_shared.mjs` already documents for
  helpers throwing instead of calling `process.exit`: a write that has not
  returned before a kill cannot be trusted; a synchronous one that has
  returned, can.
- Every place `_shared.mjs` currently generates a doc ref before writing
  (`createTicketDoc`, `fillReservedSeats`) must call `recordFixtureCreated()`
  with the doc's ID **before** the `.set()`/`.commit()` call that actually
  writes it — so a kill between the manifest write and the Firestore write
  just means the preflight sweep issues a harmless delete against a
  document that was never created.
- `sweepManifestFromPriorRun()` reads the manifest, and for every entry
  attempts a delete on `collection(entry.collection).doc(entry.id)` (fine to
  no-op on a doc that doesn't exist), then returns the count removed. It must
  be safe to call with an empty or missing manifest file (no Firestore calls
  at all in that case — see negative control below).
- `clearManifestEntries(ids)` removes only the given IDs from the manifest
  (rewrite, not raw truncate, so a manifest write that lands mid-sweep from a
  *different* concurrent-but-lock-losing process, if that's ever possible,
  isn't silently dropped — though under the existing suite lock this should
  not occur in practice; keep the interface ID-scoped regardless, it's cheap
  and it's the safer default).

## Wiring into `withCleanup()`

- Call `sweepManifestFromPriorRun()` as the very first thing `withCleanup()`
  does, **before** `acquireSuiteLock()` — a prior run's orphaned docs should
  be cleaned even if this run never manages to take the lock.
- After the existing `assertNoResidue()` call succeeds (not before — see
  README "a kill between the sweep and the clear must be a safe no-op"),
  call `clearManifestEntries()` for every ID this run itself recorded.

## Ordering check — `contracts/checks/ticketing-hardening/check-withcleanup-ordering.mjs`

Takes one CLI argument, `preflight-before-lock` or `clear-after-residue`
(kept as one script with two modes so both ordering claims are proven against
the exact same parsed `withCleanup()` function body, not two scripts that
could silently drift on how they extract it). Reads
`contracts/checks/ticketing-hardening/_shared.mjs` as text, locates the
`withCleanup()` function body, and:
- `preflight-before-lock`: finds the string index of
  `sweepManifestFromPriorRun` and of `acquireSuiteLock` within that body;
  fails if either is missing or if `sweepManifestFromPriorRun` does not come
  first.
- `clear-after-residue`: finds the string index of `assertNoResidue` and of
  `clearManifestEntries`; fails if either is missing or if
  `clearManifestEntries` does not come strictly after `assertNoResidue`.

No credentials needed — pure text parse of a committed source file. This is a
grep-shaped ceiling (see README "grep ceilings") — it proves the two calls
appear in the right textual order inside the function body, not that the
control flow between them can't be short-circuited by an early return; the
behavioural kill-and-recover check below is what actually proves the runtime
property.

## Behavioural check — kill-and-recover proof

New script `contracts/checks/payfast-m1/check-manifest-survives-kill.mjs`
(or folded into F4's new A34 script — dev's call, document which). Must, in
order:

1. Confirm the manifest file is currently empty/absent (or note its current
   entries as a baseline — do not assume a pristine environment).
2. Spawn a small decoy fixture script (see
   `contracts/golden/payfast-m1-lock-cleanup-fix/decoy-lock-holder.golden.md`)
   as a real child process. The decoy calls `recordFixtureCreated()`, writes
   one real sentinel ticket to Firestore, then sleeps.
3. `SIGKILL` the decoy after a short, fixed delay (document the exact
   milliseconds chosen and why it's long enough for the manifest write +
   Firestore write to complete but short enough the decoy never reaches its
   own cleanup) — this is the actual reproduction of the diagnosed mechanism
   (`process.on('exit', ...)` fires, the awaited `finally` sweep does not),
   now proven against the real manifest code instead of a harmless stand-in.
4. Read Firestore directly and confirm the orphaned sentinel ticket IS
   present (proves step 2-3 really did leak — a check that can't prove its
   own setup produced a leak can't prove its cleanup fixed one).
5. Call `sweepManifestFromPriorRun()` in a fresh process/import and confirm
   the orphan is now gone from Firestore.
6. Negative control: with an empty manifest, confirm
   `sweepManifestFromPriorRun()` performs zero Firestore delete calls
   (spy/count, not just "no error") — proves it cannot false-positive-delete
   on a clean manifest.

LOCAL-ONLY, same credential/skip convention as A18
(`credentialsAvailable()`/`skipForMissingCredentials()` from
`_itn-harness.mts`).

# F1 — verified pre-fix live state (2026-08-11)

Captured by @architect via a direct read-only GROQ query against the live Sanity
dataset (`.env.local` credentials), before any code or data change:

```
*[_id == "homePage"][0]{_id, _rev, title, heroImages}
```

```json
{
  "_id": "homePage",
  "_rev": "906EL7S9MQGVhGnL8k6sXR",
  "heroImages": [
    { "_type": "image", "asset": { "_ref": "image-a620a97f8df7b9cae76b892e97770d79af1fa793-3100x2325-jpg", "_type": "reference" } },
    { "_type": "image", "asset": { "_ref": "image-5ec5cc02c4d5f2db2b6ef65df08178fff6bdc0ac-7327x4885-jpg", "_type": "reference" } },
    { "_type": "image", "asset": { "_ref": "image-1adbddbbfcad804190387ec013b38e6a3f659b66-3456x5184-jpg", "_type": "reference" } },
    { "_type": "image", "asset": { "_ref": "image-894baf3b8a14c1fc68771b3f2efcd9637fc0dfb5-5184x3456-jpg", "_type": "reference" } }
  ],
  "title": "South African Orchid Council"
}
```

## Finding

All 4 `heroImages` items lack a `_key` field entirely (not `null` — `undefined`, the
field is absent from the stored document). **Brad had not yet clicked Studio's "Add
missing keys" button** as of this check — the mission brief flagged this as possibly
already done before a demo; it was not. This is the live cause of the "Missing keys"
banner blocking hero editing in Studio.

`contracts/checks/f1-hero-keys/check-hero-keys-live.mjs`, run against this exact
state, fails as expected:

```
FAIL: heroImages[0] has no non-empty string _key (got: undefined)
FAIL: heroImages[1] has no non-empty string _key (got: undefined)
FAIL: heroImages[2] has no non-empty string _key (got: undefined)
FAIL: heroImages[3] has no non-empty string _key (got: undefined)

4 assertion(s) failed.
```

## Root cause (code)

**Correction to the mission brief:** the brief names `scripts/seed-sanity.ts` as the
script to fix. That file only seeds `award` / `boardMember` / `province` / `society` /
`societyEvent` / `show` / `showClass` / `sponsor` documents — none of its mappers
write `homePage` or any array-of-objects field, so it is not the source of this bug
and needs no change for F1.

The actual writer of `homePage.heroImages` is **`scripts/seed-page-singletons.ts`**
(F4 of the predecessor `cms-activation-deploy` mission). Its `uploadImage()` helper
(function starting at line 106) returns:

```ts
{ _type: 'image' as const, asset: { _type: 'reference' as const, _ref: asset._id } }
```

with no `_key`. Every other array-of-objects field this same script writes already
generates one — `block()` (portable text, line 83-93) and `directContacts`
(line 224) both call `randomUUID()` for `_key` — so `heroImages` is the one array
field in the whole script missing the pattern the rest of the file already uses.
Confirmed via `grep -n "randomUUID\|_key" scripts/seed-page-singletons.ts`: hits only
at lines 87, 90, 224 — none inside `uploadImage()` or `imageArrayFieldOrReuse()`.

There is a second, easy-to-miss half of the bug: `imageArrayFieldOrReuse()`'s reuse
branch (`isWellFormedImageRef` check) validates `_type` and `asset._ref` shape only —
not `_key` — so on a normal reseed it will happily "reuse" the existing keyless items
forever without ever fixing them. A naive fix that only patches `uploadImage()` would
never repair the already-broken live document on reseed, because the reuse branch
would keep short-circuiting past the fixed upload path.

## Expected post-fix shape

Each `heroImages` item after the fix:

```json
{
  "_type": "image",
  "_key": "<string, non-empty, unique per array, e.g. a randomUUID()>",
  "asset": { "_type": "reference", "_ref": "image-...-jpg" }
}
```

`_key` values are not pinned to a specific format — Sanity does not require a
particular shape, only presence, non-emptiness, and per-array uniqueness. The checks
verify those properties, not a literal string match.

## Only occurrence in the dataset

Per the mission brief, a prior full 104-document dataset export established
`homePage.heroImages` as the *only* `_key`-less array anywhere in the dataset. This
architect pass did not re-run that full export (out of scope for this feature — the
mission already treats it as settled); this pass instead re-confirmed the specific
live document state above and traced the code path that produced it.

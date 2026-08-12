# Goldens — `show-visitor-info`

Authoritative reference for the National Show visitor-information section (F1–F5).
`@dev` implements against these files, not against prose in the mission.

| File | What it fixes |
|------|---------------|
| `nationalShow-venue-object.golden.json` | The structured `venue` object added to `nationalShow` — the single source for every venue-derived value on the site |
| `showVisitorInfo-schema.golden.json` | The new `showVisitorInfo` page singleton — all visitor-page copy |
| `showFaq-schema.golden.json` | The new `showFaq` collection document type |
| `confirmation-status-model.golden.md` | How "to be confirmed by the show committee" is modelled and rendered |
| `venue-single-source.golden.md` | The venue-change test, stated as a mechanical rule |
| `page-map.golden.md` | Routes, components, and the reachability graph F5 must produce |
| `cticc-research.golden.md` | Verified CTICC facts + provenance for the seeded travel content |
| `seed-show-visitor-info.golden.json` | Exact seed payload and the create-if-absent rules |
| `show-identity-wiring.golden.md` | F6 — what `/national-show` really does today (the backlog P1 is partly stale), what is still hardcoded, and how the wiring gets proven |

## Three rules that override anything else

1. **Nothing venue-derived is hardcoded.** See `venue-single-source.golden.md`.
2. **Seeding is create-if-absent only.** `createIfNotExists` / `setIfMissing`. Never
   `createOrReplace`, never `.set()` on an existing field. `scripts/seed-page-singletons.ts`
   has that exact bug and silently reverts editor changes; `scripts/seed-ticketing.ts` is
   the correct reference pattern.
3. **Unconfirmed content is visibly labelled.** Nothing on these pages may read as
   committee-confirmed fact unless the editor has flipped its status to `confirmed`.

## Explicitly out of scope

- §4.4 filterable exhibitor database, §4.14 interactive society map, §4.7 WOSA conference.
- Any paid maps SDK or external API key. Static image or link-out only.
- New brand colours, fonts, CSS custom properties or logo assets.
- Duplicating ticket prices anywhere. `/national-show/what-to-expect` links to `/tickets`.

# Legitimate other venues — negative control roster

Verified present, byte-exact, in the repo on 2026-08-12 (before this contract's fix
lands). Every string below MUST still be found, unchanged, in the named file after
the CTICC seed fix. Losing any one of these is evidence of a careless global
find-and-replace rather than a targeted fix.

## `lib/data/shows.ts` (past National Show editions — do not touch)

- `Durban ICC` (edition 18, 2024)
- `Walter Sisulu NBG` (edition 17, 2021)
- `Cape Town City Hall` (edition 16, 2018 — genuinely held in Cape Town; the city
  name alone is not evidence of a stale CTICC reference)
- `NMBay Boardwalk` (edition 15, 2015)
- `Bloemfontein Showgrounds` (edition 14, 2012)

Only `lib/data/shows.ts:9` (`venue: 'Cape Town International Convention Centre'`, the
upcoming edition 19) is in scope for this fix.

## `lib/data/events.ts` (society events — do not touch)

- `Kirstenbosch Hall, Cape Town` (used at lines 10 and 39 — genuinely in Cape Town)
- `Bloemfontein Civic Centre` (line 58 — genuinely a "Civic Centre")
- `Stellenbosch University` (line 146)
- `Walter Sisulu NBG, Roodepoort` (lines 20, 68)
- `Durban Botanic Gardens` (line 49)
- `Pretoria NBG` (lines 29, 77, 97)

Only `lib/data/events.ts:175` (`venue: 'Cape Town International Convention Centre'`,
the national-show event) is in scope for this fix.

## `lib/data/societies.ts` (society venues — never in scope)

- `Witbank Civic Centre`
- `Stellenbosch University Botanical Garden`

`lib/data/societies.ts` is not touched by this fix at all — it never referenced
CTICC. Its two "Civic Centre"/"Stellenbosch" entries exist here purely as the
negative control proving the fix's denylist did not ban those bare substrings.

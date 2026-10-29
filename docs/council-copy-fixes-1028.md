# Council copy fixes (2026-10-28)

The council correction sheets of 2026-10-27 listed typos and wording fixes in strings that live in
code. This change applies exactly those corrections and no other string change. The authoritative
list is `.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json`.

| id | file | change |
|----|------|--------|
| C01 | `lib/data/faq-sections.ts` | "Thicket types" to "Ticket types" (FAQ section 2 intro) |
| C02 | `app/(nos)/national-show/exhibitors/page.tsx` | the wrong "who’s" corrected to "whose" (standfirst and meta description) |
| C02b | `app/(nos)/national-show/page.tsx` | the same sentence in `EXHIBIT_LEAD` on the NOS home (an addition beyond the sheet, so the typo does not survive on the home page) |
| C03 | `app/(nos)/national-show/what-to-expect/page.tsx` | the verb typo corrected to "takes place" |
| C04 | same | comma added: "attendees or the public, please ensure" |
| C05 | same | "two stairways, one of which may be suitable for visitors using crutches" |
| C06 | same | "meet members of the orchid societies from across the country" (the S3 array and `THEME_LEAD`, so twice) |
| C07 | `components/vendors/VendorBoothFieldset.tsx` | "needs to be removed" to "need to be removed" |
| C08 | `components/vendors/VendorWasteFieldset.tsx` | "enviromental" to "environmental" in the waste heading |
| C09 | same | "a clean and safe booths" to "clean and safe booths" |
| C10 | `components/vendors/VendorStorageFieldset.tsx` | "However, the organizers" to "PLEASE NOTE: the organisers" (the reviewer's own wording) |

## Frozen text stays frozen

Lee-Ann's Drive copies, their sha256-frozen mirrors under `nos-content-standard/goldens/sources/`
and the Sanity fixtures are not edited. The content gates (`gate-standard.mjs`, `gate-verbatim.mjs`)
read them through `_lib.mjs`, which applies `nos-content-standard/goldens/council-overrides.json`
(schema `council.overrides/v1`) as plain substitutions after the sha256 check. The frozen bytes
never change and the gates compare the corrected wording.

## Pins updated

Pins of the old wording were updated by the same substitutions: the route table and spec of the NOS
content standard, the nos-critique-r12 F6 baseline, the launch-weekend f18 longform copy and the
vendor-form-copy structural check.

## Out of scope

Sanity content, the waste-label scope change, the terms clause, anything about the show name, and
`scripts/seed-show-faq.ts` (the Sanity items it seeds are already corrected in Sanity).

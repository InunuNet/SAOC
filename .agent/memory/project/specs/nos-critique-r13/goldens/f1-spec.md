# nos-critique-r13 F1: page titles follow their h1 wording (Codi R64)

Source: Codi R64 and the lead's ruling (2026-10-18): the title follows the h1. r12 F4 fixed casing only, and this round fixes wording. The lead's exception: where the h1 is a long sentence rather than a name, keep the current short title and list it for Codi. BASE: main 5f8d2311 (r12 merged; lead 2026-10-18).

The title head comes only from the rendered h1. The suffix comes from the existing templates:
- NOS inner pages: " — National Orchid Show | SAOC".
- Every other page, the NOS hub included: " | South African Orchid Council".

## Audit (5f8d2311, public build, all 31 F24 routes plus the payment status page)

Every route not listed below already has title head = h1.

| route | current title | rendered h1 | proposed title | rule |
|---|---|---|---|---|
| /national-show/international-guests | International Guests — National Orchid Show \| SAOC | International Guests and Exhibitors | International Guests and Exhibitors — National Orchid Show \| SAOC | h1 wording |
| /national-show/vendors/payment/status | Vendor Stand Payment Status — National Orchid Show \| SAOC | Vendor Stand Payment | Vendor Stand Payment — National Orchid Show \| SAOC | h1 wording (noindex page; it now shares its title with /national-show/vendors/payment, whose h1 is the same) |
| /about | About SAOC \| South African Orchid Council | About the South African Orchid Council | About the South African Orchid Council \| South African Orchid Council | h1 wording (passes F24 T1: the segments differ) |
| /judging | Judging \| South African Orchid Council | Judging at SAOC | Judging at SAOC \| South African Orchid Council | h1 wording |
| /contact | Contact \| South African Orchid Council | Contact SAOC | Contact SAOC \| South African Orchid Council | h1 wording |
| /societies | Affiliated Societies \| South African Orchid Council | Find an orchid society near you | unchanged | **exception: sentence** (lead) |
| / | South African Orchid Council | The national home of orchid culture in South Africa. | unchanged | **exception: sentence**, and F24 T2 fixes the home title |
| /national-show/about | About the Show — National Orchid Show \| SAOC | 2027 South African National Orchid Show | unchanged | **exception: F24 T3** (ruled: kept, sent to Codi) |
| /national-show/symposium | Symposium — National Orchid Show \| SAOC | National Orchid Show Symposium | unchanged | **exception: F24 T3** |
| /national-show/archive | Archive — National Orchid Show \| SAOC | National Show archive | unchanged | **exception: F24 T3** |

Notes:
- /national-show/vendors/status, named in the lead's list, is not a route. It returns 404; the status page is /national-show/vendors/payment/status. /national-show/vendors/payment already matches its h1.
- /judging and /contact take their h1 from Sanity (`data?.title ?? fallback`). The title is a static literal copied from the rendered h1. If an editor changes the h1, f1-rendered fails and says so; nothing silently drifts.

## Three NOS h1s conflict with F24 T3 (ruled 2026-10-18: keep the exceptions; the lead sends R64 vs T3 to Codi)

F24 T3 (design-cb FINAL, titles.json `_note`): "NOS inner head = the page's own name, never repeating 'National Show'". It is enforced in _rules.mjs `titleProblems`. Taking the h1 wording on /national-show/about, /symposium and /archive would give, for example, "National Orchid Show Symposium — National Orchid Show | SAOC". That fails F24-A2.

- **Recommendation:** keep the current titles as cited exceptions. R64 and T3 are both Codi rulings; T3 is the specific one for NOS heads, and the conflict is Codi's to resolve.
- **Alternative:** supersede T3 for those three routes and take the h1. That is a one-entry change per route in _r13.mjs (move from EXCEPTIONS to EDITS) plus a T3 route exception in F24, as r12 did for D3.

## Edits (@dev): exact, nothing else in the files

Each page changes only its title line, plus its og image line where it has one, following r12 F4 S5 (_r13.mjs EDITS has the exact lines):
- international-guests: `title: 'International Guests and Exhibitors',` and `image: nosOgImage('International Guests and Exhibitors — National Orchid Show'),`
- vendors/payment/status: `title: 'Vendor Stand Payment',` and `image: nosOgImage('Vendor Stand Payment — National Show'),`
- about: `title: 'About the South African Orchid Council',`
- judging: `title: 'Judging at SAOC',`
- contact: `title: 'Contact SAOC',`
- `.agent/memory/project/specs/launch-weekend/goldens/f24/titles.json`: `/about` → "About the South African Orchid Council | South African Orchid Council", and `/contact` → "Contact SAOC | South African Orchid Council". It is a QA input, superseded per goldens/supersession.json; @architect may commit it instead of @dev.
- docs/nos-critique-r13.md: an F1 section citing R64 and this table.

## Proof
- **f1-static:**
  - S1: each file equals BASE with exactly those lines replaced.
  - S2: titles.json equals BASE with exactly the two values replaced.
  - S3: docs.
- **f1-rendered,** public mode, over F24's sweep plus the status page:
  - every title equals "<rendered h1><suffix>" unless it is a cited EXCEPTION, which must keep its exact BASE title and must be measured;
  - F24 T1-T6 hold on every route;
  - the rendered titles equal the worktree's titles.json;
  - the five edited routes still render their audited h1.
- **Negative at 5f8d2311:** FAIL on exactly the five edit routes.
- **Positive on a prototype of the edits:**
  - f1-static, f1-footprint and f1-rendered PASS (32 routes);
  - F24-A2 check-b PASS (31 routes, 8 golden titles);
  - F24-A3 check-c PASS.

## Other pins checked
- A grep of contracts/, contracts/golden/ and every spec's goldens and checks found no other check that pins these titles.
- The nav labels ('International Guests' in scripts/generate-nos-route-manifest.ts, 'Contact' in the menu) are labels, not titles. They are not affected.
- r12 f4-rendered pinned the SAOC targets' titles to 26fde668. That gate is closed (merged), so it is recorded in goldens/supersession.json, not edited.

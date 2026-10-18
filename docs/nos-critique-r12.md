# nos-critique-r12

## F1 - provenance: manifest purposes, the featureRail blurb check, the vendors title pin

Four pre-existing provenance items left `check-descriptor-provenance` and two older checks red on
main 26fde668. No copy is new: every string below already exists on main.

- (a) Archive. 6f805df0 trimmed the archive nav descriptor to 'Previous editions.' but missed the
  route manifest. `scripts/generate-nos-route-manifest.ts` and `content/national-show-routes.json`
  now carry the same purpose, 'Previous editions.', in place of 'Previous editions and their
  champions.'
- (b) Symposium. The F18 rename to "National Orchid Show Symposium" ran end to end in `app/`,
  `components/` and `lib/`, but its sweep did not cover `scripts/` or `content/`. The manifest
  purpose in both files now matches the nav descriptor (`components/chrome/nav-config.ts:216`):
  'The National Orchid Show Symposium — what it is, its theme, and who it is for.' The generator
  keeps its double quotes, and the manifest still regenerates byte-identical from it.
- Neither purpose is rendered. The absent-page fallback (`lib/data/show-pages.ts`) takes a page's
  own purpose, so there is no visual change.
- (c) featureRail blurb. F8 removed the Tickets rail blurb on purpose (menu-system-layout4
  `f8-tickets-rail.json`), so `check-featurerail-blurb-provenance.mjs` is RETIRED with its body
  unchanged. The blurb is not added back; the F8 e2e still asserts that it is gone.
- (d) Vendors title. F24 (911fd349) moved the National Show inner pages onto the layout title
  template, so the vendors page title is now 'Exhibitors and Vendors'. The title pin in
  `check-labels-static.mjs` is re-pinned to it. The label itself is unchanged.

Items (c) and (d) are QA inputs committed by @architect; the code change is (a) and (b), one line
each in the generator and the manifest.

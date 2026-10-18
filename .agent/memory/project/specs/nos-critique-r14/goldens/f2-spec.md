# nos-critique-r14 F2 — /societies gets its own meta description

BASE: main `9d16cf96`. Branch: `fix/nos-critique-r14`, shared with F1 (one SHA covers both).

## Ruling (lead, FINAL, 2026-10-18)

/societies gets its own meta description, exactly this string, verbatim, no trim and no paraphrase (111 chars):

> The SAOC also provides a national forum through which affiliated societies can collaborate and share expertise.

- Source: Lee-Ann's Drive, `content/drive-source/SAOC /2. About/About page - South African Orchid Council/v1.0/content.md` line 9.
  It is the last sentence of that line, verified by f2-static S4. This is no-invention source 1 (`docs/rules/no-invention.md`).
- Implementation: through `buildPageMetadata` / `fitDescription` (`lib/seo.ts`), the way r12 did the /about description.
  The string is 70-160 chars, so `fitDescription` keeps it as written and no lede or cut is involved.
- The title stays `'Affiliated Societies'`.
- A one-line code comment cites the Drive path and line.
- `UNSOURCED_LEDE` stays in the page, withheld on public, and is unchanged.

## Cause (BASE 9d16cf96)

`app/(marketing)/societies/page.tsx` sets only `metadata = { title: 'Affiliated Societies' }`. The head therefore falls through to the
root layout's `DEFAULT_DESCRIPTION` ("The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.")
in description, og:description and twitter:description. r12 F4 left it there because no source was found (its f4-spec.md:16).

## Decision (what @dev implements)

In `app/(marketing)/societies/page.tsx`, and nowhere else:

1. Add `import { buildPageMetadata } from '@/lib/seo';` next to the existing imports.
2. Replace the single line `export const metadata: Metadata = { title: 'Affiliated Societies' };` with
   `export const metadata: Metadata = buildPageMetadata({ title: 'Affiliated Societies', description: '<the string>', path: '/societies' });`.
   Use these three keys only, with the string as one single-quoted literal (line breaks inside the object are fine).
3. Add a one-line `//` comment above it citing `content/drive-source/SAOC /2. About/About page - South African Orchid Council/v1.0/content.md`
   and the line, written `l.9`, `:9` or `line 9`.

Every other BASE line stays byte-identical, including UNSOURCED_LEDE, its comment and the `withhold ? null : (...)` branch.
`buildPageMetadata` also emits the self-canonical, og:url, og:title, og:image and twitter tags, as on /about. That is the helper's
documented contract (lib/seo.ts), not new copy.

## Acceptance (contract-f2.yaml, pins in goldens/checks-f2.sha256)

- A1: shasum pins.
- A2 `f1-footprint.mjs`: the shared branch guard. It allows the union of f1/f2-footprint.json, the docs and the spec dir.
- A3 `f2-static.mjs` S1-S5:
  - S1: BASE lines are kept;
  - S2: the exact buildPageMetadata call;
  - S3: no other new 20+ char literal;
  - S4: the comment cite, and the string is on Drive line 9;
  - S5: the docs record F2 and the Drive path.
- A4 `f2-rendered.mjs` (public build) R1-R4:
  - R1: description, og:description and twitter:description equal the string exactly; the title and h1 are unchanged.
  - R2: the site default is in none of those tags.
  - R3: F24 D1-D4 hold on every swept route, and no other route repeats the string (/about included).
  - R4: UNSOURCED_LEDE and F24's STATIC_CLAIM are absent from the public HTML and text.

  The Organization JSON-LD description in the root layout is site-wide and stays the default by design. It is not a page description.

## Proof

- At BASE: f2-static fails S2/S4/S5, and f2-rendered fails exactly R1+R2 (the three tags carry the default).
- On a prototype of the decision combined with the F1 prototype (one build):
  - f1-static, f1-rendered, f2-static, f2-rendered and the footprint all PASS;
  - F24 check-a, check-b (titles), check-c (descriptions, 31 routes) and check-d (withhold on public) all PASS.

  The prototype was reverted.

## Supersession

See `goldens/supersession.json`. r12 f4-static S2 and f4-rendered:120 ("/societies keeps the default", "byte-identical") are amended
by this ruling. They are not edited: the r12 spec dir is closed and was never committed, so no r14 commit can re-pin it. All F24 checks
stay unchanged and green.

## NO INVENTION sources

- `docs/rules/no-invention.md` (source 1: Lee-Ann's Drive)
- `content/drive-source/SAOC /2. About/About page - South African Orchid Council/v1.0/content.md` l.9 (gitignored mirror; f2-static reads it
  from the inspected checkout, this checkout or the main checkout, overridable with NOS_CR14_DRIVE)
- The lead's ruling above

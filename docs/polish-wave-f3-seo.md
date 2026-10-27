# Polish wave F3 — SEO hygiene

## noindex on payment returns
`/tickets/confirmation` and `/tickets/cancelled` hold per-order content and exist only as payment
returns, so every `generateMetadata` arm of the confirmation page and the cancelled page's static
metadata carry `robots: { index: false, follow: false }`. The confirmation page spreads one shared
`NOINDEX` constant. Titles are unchanged.

## Sitemap
`/members` is removed from `SAOC_STATIC_ROUTES` (`lib/saoc-sitemap-routes.ts`): the members area has
no portal yet and the page says so, so listing it invites a crawl of an empty page. The drift-guard
golden `contracts/golden/saoc-seo-polish/sitemap-expected.json` records it under `exclude`.

## Society metadata
`lib/society-metadata.ts` (`buildSocietyMetadata`) is called from the society page's
`generateMetadata`. It builds on `buildPageMetadata`, so canonical and `og:url` derive from
`NEXT_PUBLIC_SAOC_SITE_URL` and agree with each other.

Truncation rule: whitespace is collapsed; a description of 160 characters or fewer is kept; a longer
one is cut to the longest prefix of at most 160 characters that ends on a whole word (no mid-word cut,
no trailing space, no ellipsis). Sentence-level trimming (`fitDescription`) is deliberately not used
because it can return over 160 when no sentence ends in range. The two fallback descriptions are
unchanged.

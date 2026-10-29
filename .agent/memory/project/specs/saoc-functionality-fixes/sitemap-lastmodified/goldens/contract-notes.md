# sitemap-lastmodified goldens

New pure module lib/sitemap-entry.ts: `sitemapEntry(url, {changeFrequency, priority}, updatedAt?: unknown)` returns
`{url, changeFrequency, priority}` plus `lastModified: Date` ONLY when `updatedAt` is a string that `Date.parse`s to a valid time.
Otherwise the key is absent (not `undefined`, per the CLAUDE.md Firestore/undefined convention applied to serialised output).
Sources that exist: Sanity `_updatedAt` on societies (societySlugsQuery) and events (eventSlugsQuery); project it as `"updatedAt": _updatedAt`
and type the sanityFetch rows `{ slug: string; updatedAt?: string | null }`.
No real source date: SAOC static routes (SAOC_STATIC_ROUTES), NOS static/extra routes, NOS ticket routes, NOS show child routes, NOS archive years.
These omit lastModified. Do NOT derive a date from show year/dates or from build time.
Existing checks that must stay green: contracts/checks/saoc-seo-polish/check-sitemap-routes.mts and contracts/checks/audit-fixes-2026-10-25/check-sitemap-routes.mts.

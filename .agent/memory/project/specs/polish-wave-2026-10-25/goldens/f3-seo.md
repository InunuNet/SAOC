# F3 — SEO hygiene

## Specification
1. /tickets/confirmation and /tickets/cancelled declare noindex. They hold per-order content and exist only as payment returns.
   - app/(nos)/tickets/cancelled/page.tsx:15: `export const metadata: Metadata = { title: 'Payment cancelled', robots: { index: false, follow: false } };`
   - app/(nos)/tickets/confirmation/page.tsx:47-63: generateMetadata has three returns (the confirmed-order `{}`, the catch `{}`, and the
     not-found ternary). Every return carries noindex, the ternary on both arms. Factor one `const NOINDEX = { robots: { index: false, follow: false } }`
     and spread it (`...NOINDEX`); the static check recognises that spread, `noIndex: true`, or a literal robots block. Keep titles as they are.
2. lib/saoc-sitemap-routes.ts:21 — delete the `/members` entry. /about, /contact, /refunds and the rest stay. Update
   contracts/golden/saoc-seo-polish/sitemap-expected.json (see README) so contracts/checks/saoc-seo-polish/check-sitemap-routes.mts stays green.
3. Society detail metadata (app/(marketing)/societies/[slug]/page.tsx:109-120). Extract a pure function to lib/society-metadata.ts:
   `export function buildSocietyMetadata(society: { name: string; slug: string; description: string | null; region: string | null }): Metadata`
   and call it from generateMetadata (keep the notFound() guard and the getSociety call in the page). Rules, pinned by f3-society-meta.mts:
   - description: unchanged when <=160 chars after whitespace is collapsed; otherwise the longest prefix <=160 chars that ends at a word boundary
     (never mid-word, no trailing space; a trailing "…" is allowed if the total stays <=160). The two existing fallback strings stay verbatim
     ("<name> — affiliated SAOC society in <region>." and "<name> — an affiliated SAOC society.").
   - build it with the existing `buildPageMetadata` from lib/seo.ts (path `/societies/${slug}`): it already derives canonical, og:url, og:title,
     og:image and twitter from `saocUrl()`, i.e. from NEXT_PUBLIC_SAOC_SITE_URL, so the hard-coded `https://saoc.co.za/...` goes away and
     canonical and og:url agree. lib/seo.ts itself is not modified. Do not depend on the audit-fixes branch (.tmp/sandbox/wt-audit-fixes);
     main already has `saocUrl` and `buildPageMetadata`.
   - the existing `/og?title=` image comes from buildPageMetadata; do not add images.
4. Docs: docs/polish-wave-f3-seo.md — noindex rationale, the sitemap decision, the truncation rule.

## Declared limits
- A confirmed-order lookup needs Firestore, so the confirmation page's other two metadata branches are checked statically, not served.
- The cap is description-only. Sentence-level trimming is not wanted: fitDescription (lib/seo.ts) is sentence-based and can return text
  over 160 when no sentence ends in range, which is why the society function trims at a word.

## Checks
f3-seo-static.mjs, f3-society-meta.mts (4 fixtures incl. a mid-word trap; proven to fail on a slice(0,160) mutation), f3-seo-served.mjs
(meta robots on the NOS host, sitemap, society canonical host, og:url host), plus the saoc-seo-polish sitemap check as a regression guard.

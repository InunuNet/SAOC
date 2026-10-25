# Golden: NOS sitemap

Governing rule: docs/rules/no-invention.md (no new routes, no new copy). Mirror lib/saoc-sitemap-routes.ts.

Baseline (audit P2-13): the NOS sitemap, built from content/national-show-routes.json plus archive
years, omits /contact and every /tickets/[slug].

New module `lib/nos-sitemap-routes.ts` (pure, no Sanity, no env), exporting:
- `NOS_EXTRA_STATIC_ROUTES: ReadonlyArray<{ path: string; changeFrequency; priority: number }>` containing
  `/contact` (public NOS path; its canonical is the NOS host, verified in audit nos/contact.html).
- `nosTicketSlugPaths(slugs: readonly string[]): string[]` returning `/tickets/<slug>` for each slug matching
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`, de-duplicated and sorted; invalid slugs dropped silently.

`app/sitemap.ts` NOS branch uses both. Ticket slugs come from the active ticket types, and only from the
ones the /national-show/tickets listing shows (the cards from `loadTicketCardViewModels()`), never from a
raw Sanity query of all `ticketType` documents, because day-visitor and full-price weekend pass are
buyable but deliberately unlisted (audit P1-9) and the lead's rule is "only those listed on /tickets".
Origin stays `nosOrigin()`.

DECISION (flagged to the lead): `/privacy`, `/terms`, `/refunds` are NOT added. On the NOS host they are
shared pages (proxy.ts SHARED_EXACT) whose canonical is `https://<saoc origin>/<path>` (audit
nos/privacy.html, terms.html, refunds.html). A sitemap entry whose canonical is another host is a
non-canonical URL in the feed and search engines ignore or flag it. They stay indexed through the SAOC
sitemap, which already lists all three. If the lead overrules, the flip is one line: add them to
`NOS_EXTRA_STATIC_ROUTES` and invert the three `need` lines in check-sitemap-routes.mts and live-probe.mjs.

Not in scope: lastmod semantics, a `Sitemap:` line in robots.txt (robots is launch-gated, do not touch).

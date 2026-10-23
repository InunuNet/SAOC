# NOS loaders carry the route's h1 and sub-nav

The `loading.tsx` of `/national-show/workshops`, `/conferences`, `/symposium`, `/wosa-conference` and
`/tickets/[slug]` render `<NosHero>` itself, the same component their page uses. The h1 and the group
sub-nav (`NosSubNav`, resolved by `subNavGroupFor`) are therefore on screen from the loader's first
frame, in the same place the loaded page puts them. The earlier loaders drew an empty hero shell and
the h1 appeared 417-1141 ms later.

## Shared source

`components/nos/nos-route-heroes.ts` exports `NOS_ROUTE_HEROES` (`workshops`, `conferences`,
`symposium`, `wosaConference`: route, title, optional lede). Loader and page both read it, so the
two cannot drift. The symposium entry imports `SYMPOSIUM_TITLE` and `SYMPOSIUM_THEME_LINE`, now
exported from `lib/data/show-page-presentation.ts` (values unchanged).
`components/tickets/TicketBuyCrumbs.tsx` is the checkout breadcrumb row, used by the ticket page
(three crumbs) and its loader (two static crumbs).

## Accepted gaps

1. **wosa-conference:** the loader shows the static label `WOSA Conference` and no lede. If Sanity's
   published title differs, the h1 text changes at swap; the page's lede (dynamic summary) appears at swap.
2. **symposium:** if the Sanity document is absent the fallback page has no lede, so the loader's
   theme line is removed at swap.
3. **tickets/[slug]:** the ticket name is unknowable in a loader (it receives no params), so the h1 is
   a one-line empty box and the third crumb is omitted. A name that wraps to two lines grows the
   hero by one line at swap.

`/tickets` and `/tickets/x` both resolve to no sub-nav group (nav leaves live under `/national-show`),
so the loader's `/tickets` route matches the page's.

`aria-busy` is no longer set on the loaders (`NosHero` has no such prop).

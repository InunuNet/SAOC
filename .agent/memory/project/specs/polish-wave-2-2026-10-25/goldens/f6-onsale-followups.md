# F6 — ticket on-sale follow-ups (a) and (b)  [follow-up (c) needs copy: out]

## (a) A7 of ticket-onsale-predicate/contract-f1.yaml is vacuous
Command: `! python3 contracts/golden/build-without-secrets/check_no_prerendered_admin_routes.py . 2>&1 | sed -n "/VIOLATIONS/,$p" | grep -q "national-show/page.tsx"`.
In double quotes the shell expands `$p` to an empty string, so sed receives `/VIOLATIONS/,` and errors; the pipe is empty, `grep -q` fails, `!` flips it to pass, whatever
the checker printed. Fix: single-quote the sed script (`sed -n '/VIOLATIONS/,$p'`; in the YAML, either escape the single quotes by doubling them inside a single-quoted string
or switch the whole value to a double-quoted YAML string with the sed script single-quoted and `$` safe). Keep the shape
`! <checker> 2>&1 | <filter> | grep -q "national-show/page.tsx"` and the target string. f6-a7-nonvacuous.py proves the filter keeps a VIOLATIONS line and prints nothing
on a clean run. Log the edit in checks-updated.md (the allow-list names this one old contract file).

## (b) The hub and the JSON-LD offers list wrong-show tickets
/tickets/<slug> and checkout refuse a ticket whose `show` is not the active show (isTicketOnSale reason wrong-show, via ticketTypeMatchesActiveShow in lib/ticket-on-sale.ts), but the
hub (loadTicketCardViewModels) and the National Show JSON-LD (buildShowOffers) build cards from activeTicketTypesByCategoryQuery, which does not select `show`, so a ticket for another show
is listed and links to a 404.
1. sanity/queries.ts: add `show,` to activeTicketTypesByCategoryQuery's projection (same spelling as ticketTypeBySlugQuery).
2. lib/data/ticket-hub-source.ts: `HubCmsTicketType` gains `show?: { _ref: string } | null`; `BuildHubCardsInput` gains `activeShowId: string | null`; buildHubCards filters `cmsTypes` with
   the existing `ticketTypeMatchesActiveShow(t, input.activeShowId)` (import from '@/lib/ticket-on-sale', do not copy the rule) after the existing demo filter. The synthetic Workshops
   product is not a CMS type and is unaffected. With no active show nothing CMS-backed is listed (same as the predicate).
3. lib/data/admission-availability.ts loadTicketCardViewModels: pass `activeShowId: resolveActiveShow(shows ?? [])` (the `shows` it already fetches; it already calls resolveActiveShow below).
4. app/(nos)/national-show/page.tsx: fetch `activeShowWindowQuery` (tags ['show', 'sanity']) in the existing Promise.all, resolve with `resolveActiveShow`, and pass the id through
   buildShowOffers to buildHubCards. The page is prerendered (revalidate = 60): no firebase-admin import, no new runtime-only dependency (contracts/contract-build-without-secrets.yaml A3/A7).
5. Docs: docs/polish-wave-2-f6-onsale-followups.md naming OS-A and OS-B and restating that (c) is excluded because it needs copy.

## Risk to state in the doc
Live ticket types without a `show` reference (pre-field data) disappear from the hub exactly as they already 404 on /tickets/<slug>. The predicate mission's data audit covers
the live dataset; the dev must not "fix" it by loosening the filter.

## Checks
f6-onsale-static.mjs (query, types, wiring, no admin import), f6-hub-filter.mts (behaviour on fixtures: show-A / show-B / none), f6-a7-nonvacuous.py (A7 can fail), plus regression:
ticket-onsale-predicate check-jsonld-offers.mts (its mocks must still serve the page), the ticketing-f9 demo check, and the old contract's own A3/A7 command (A7 must still pass once non-vacuous).

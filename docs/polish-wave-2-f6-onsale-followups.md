# Polish wave 2 F6 — ticket on-sale follow-ups

Two follow-ups to the on-sale predicate mission. Follow-up (c) is excluded because it needs copy
(see docs/rules/no-invention.md).

## OS-A — assertion A7 can fail

A7 of `.agent/memory/project/specs/ticket-onsale-predicate/contract-f1.yaml` had `$p` inside a
double-quoted sed script. The shell expanded it to nothing, `sed` errored, the pipe was empty and
the leading `!` turned that into a pass whatever the checker printed. The sed script is now
single-quoted (`''/VIOLATIONS/,$p''` inside the YAML single-quoted string). Same intent and target
string. The edit is logged in `checks-updated.md`.

## OS-B — hub and JSON-LD list only the active show's tickets

`/tickets/<slug>` and checkout refuse a ticket whose `show` is not the active show (reason
`wrong-show`, via `ticketTypeMatchesActiveShow` in `lib/ticket-on-sale.ts`), but the hub and the
National Show JSON-LD built cards from a query that did not select `show`, so a wrong-show ticket
was listed and linked to a 404.

- `sanity/queries.ts`: `activeTicketTypesByCategoryQuery` selects `show`.
- `lib/data/ticket-hub-source.ts`: `HubCmsTicketType.show`, `BuildHubCardsInput.activeShowId`, and
  `buildHubCards` filters with the existing `ticketTypeMatchesActiveShow` (not a copy of the rule).
  The synthetic Workshops product is not a CMS type and is unaffected.
- `lib/data/admission-availability.ts` and `app/(nos)/national-show/page.tsx` pass
  `resolveActiveShow(...)` of the show window they fetch. The page stays prerendered with
  `revalidate = 60` and gains no firebase-admin import.

## Risk

With no active show, nothing CMS-backed is listed (same as the predicate). A live ticket type with
no `show` reference disappears from the hub exactly as it already 404s on `/tickets/<slug>`; it is
not fixed by loosening the filter. All 24 live ticket types carry a show reference.

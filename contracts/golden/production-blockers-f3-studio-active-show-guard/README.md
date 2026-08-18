# F3 (production-blockers): Studio guard against a second active show — decision record

## The defect, verified against the actual files

`sanity/schemas/documents/show.ts:63-72` defines the `active` field:

```
defineField({
  name: 'active',
  title: 'Active (sellable) show',
  type: 'boolean',
  initialValue: false,
  description:
    'Exactly one show should be active at a time. Consumed by resolveActiveShow() ' +
    '(lib/show-resolution.ts), which fails closed to "no active show" if zero or ' +
    'more than one show is marked active.',
}),
```

No `validation`, no `hidden`, no `readOnly`. It sits between `salesOpen` and
`fictionalTestData` with no fieldset separating it from the plain archive fields
(`entries`, `exhibitors`, `awards`, `gallery`, `results`, `classes`). `sanity/structure.ts`
lists `show` in `COLLECTION_TYPES` (line 47) — the stock `S.documentTypeListItem('show')`
list, with no custom child view, no warning banner, nothing an editor sees before ticking
the box.

`lib/show-resolution.ts:21-25`'s `resolveActiveShow()` is correct and does fail closed:

```
export function resolveActiveShow(shows: ShowActivationFields[]): string | null {
  const activeShows = shows.filter((show) => show.active === true);
  if (activeShows.length !== 1) return null;
  return activeShows[0]._id;
}
```

`app/api/tickets/checkout/route.ts:98-104`'s `ticketTypeMatchesActiveShow()` then turns
that `null` into a universal rejection:

```
export function ticketTypeMatchesActiveShow(
  ticketType: TicketTypeShowRef,
  activeShowId: string | null
): boolean {
  if (activeShowId === null) return false;
  return ticketType.show?._ref === activeShowId;
}
```

`route.ts:303-305` calls it and, on `false`, returns `unusableTicketType(ticketType,
'show')` (`route.ts:124-132`) — a 500 with `{ error: 'This ticket type is not available
for purchase. Please contact us.' }`, for every buyer, every ticket type, until an editor
notices and fixes the Sanity data. Confirmed: this is genuinely sitewide, not
per-ticket-type — `activeShowId` is resolved once per request from the full `show`
collection, so it collapses identically regardless of which ticket type is being bought.

## Why `Rule.custom()`, not `hidden`/`readOnly` or a desk-structure change

Three shapes were on the table:

1. **`hidden`/`readOnly` on the field.** Rejected: this can only be a function of the
   currently-open document's own fields (`context.document`) or a fixed condition — it
   has no way to look at OTHER `show` documents in the dataset. It cannot express "block
   this unless no other document is active," because that fact does not live on this
   document. It could at most hide the field permanently or gate it on something
   unrelated (e.g. `status === 'upcoming'`), which does not solve the actual problem: an
   editor CAN legitimately need to activate a different show later (the 2027-to-2030
   handover), so the field cannot simply be locked away.
2. **A desk-structure change (`sanity/structure.ts`).** Rejected as the primary
   mechanism, though partially achievable: a custom document view could show a warning
   panel next to the list, or a custom "Active Show" singleton-style picker could
   replace the field entirely. But `structure.ts` only controls navigation and document
   *views* — it has no publish-time blocking mechanism (see Sanity's structure builder
   docs: it composes panes, it does not intercept mutations). Even the best structure UI
   is advisory; an editor can still open the raw document form and tick the box. It does
   not stop the mis-click, only makes it slightly less likely by not surfacing the field
   as prominently — weaker than a validation error that blocks Publish outright.
3. **`Rule.custom()` on the `active` field (chosen).** Sanity's documented mechanism for
   cross-document validation: `Rule.custom((value, context) => ...)` receives
   `context.getClient({apiVersion})`, which can run an arbitrary GROQ query against the
   dataset — including other `show` documents — and return a `string` error message that
   Studio renders inline on the field AND blocks the Publish button until resolved. This
   is the only one of the three shapes that can (a) see other documents' state and (b)
   actually block the action, not just discourage it.

`Rule.custom()` is async-aware (Studio awaits the returned Promise before evaluating
Publish-readiness), so the live dataset query does not need to be synchronous or
pre-fetched.

## Studio validation is bypassable — why the guard is still worth building

Sanity's own documentation is explicit that `validation:` rules are a Studio-authoring
convenience, not a write-time guarantee: they run in the Studio process before a mutation
is sent, and are trivially bypassed by anything that writes through the HTTP Mutate API or
`@sanity/client` directly — a migration script, `scripts/seed-ticketing.ts`-style tooling,
or a future automation. This is the exact same caveat already recorded in this repo at
`app/api/tickets/checkout/route.ts:106-110`'s comment on `isUsableAmount()`: *"Sanity
`validation:` is a Studio-authoring guard, not a read-time guarantee — the seed script and
the HTTP API both write documents that never see it."*

That caveat is why this contract explicitly leaves `resolveActiveShow()` and
`ticketTypeMatchesActiveShow()` untouched (F1 item (4), and A4/A5 below): those two
functions are the ONLY thing standing between a two-active-shows dataset and a real
outage, and they must keep doing that job regardless of whether the bad state arrived via
Studio, a script, or manual dataset editing. The Studio guard is a second, independent
layer that catches the specific defect scenario named in the @qa finding — Lee-Ann, a
non-technical editor, working entirely inside Studio, ticking a checkbox without
realising another show is already active — and stops it before it is ever published, with
zero chance of that particular mistake ever reaching the code-side fail-close at all. It
does not, and cannot, replace the fail-close as the system's actual safety net.

## The editor-facing message

Written for Lee-Ann, who is not a developer and does not know what "resolveActiveShow" or
"`_ref`" means. Two cases:

**Normal case (conflicting show has a title and year):**

> A show is already marked Active: "19th SAOC National Show" (2027). Only one show can be
> Active at a time — untick Active on "19th SAOC National Show" before ticking it here,
> or contact the site developer if you're not sure which show should be active.

**Multiple other shows already active (pre-existing ambiguous state — should not happen,
but must not be silently under-reported if it does):**

> A show is already marked Active: "19th SAOC National Show" (2027) (and 1 other show).
> Only one show can be Active at a time — untick Active on "19th SAOC National Show"
> before ticking it here, or contact the site developer if you're not sure which show
> should be active.

**Conflicting show has no title/year set (a bare/sparse draft):**

> A show is already marked Active: show-14-2012. Only one show can be Active at a time —
> untick Active on show-14-2012 before ticking it here, or contact the site developer if
> you're not sure which show should be active.

**Note on wording:** The message deliberately uses "A show" rather than "Another show."
The substring "other show" in "Another show" would spuriously match the "(and N other
shows)" suffix when `additionalCount` is 0, causing an assertion in the contract to
incorrectly flag false positives. See `lib/active-show-guard.ts:62–64` for the guard's own
explanation of this constraint.

Names the specific conflicting show rather than a generic "validation failed" — Lee-Ann
can act on this without asking anyone what it means, which was the whole point of the
`active` field's own description comment ("Exactly one show should be active at a time")
never actually being enforced anywhere until now.

## Zero active shows: the 500 is deliberately unchanged

The brief asked whether the existing generic 500 (`route.ts:124-132`,
`unusableTicketType`) is the right response when zero shows resolve active, or whether it
should be a clearer operator-facing failure. Decision: **leave it exactly as is.**

Reasons:

1. **It is already correctly a 500, not a 400** — the file's own comment at
   `route.ts:120-122` states why: *"the request was well-formed and the CMS document is
   misconfigured, so a 4xx would tell the buyer to fix something they cannot see."* That
   reasoning applies identically whether zero or two shows are active; this feature does
   not change the diagnosis, so it should not change the response.
2. **It already logs operator-facing detail.** `unusableTicketType()` (`route.ts:125-127`)
   calls `console.error` with the ticket type's slug and the specific field
   (`'show'`) that failed, before returning the generic buyer-facing message. That
   `console.error` lands in Cloud Logging (Firebase App Hosting's runtime), searchable by
   the exact string `ticketType.*has an unusable show`. There is no alerting/monitoring
   infrastructure anywhere in this repo (confirmed: no Sentry, PagerDuty, or Cloud
   Monitoring alert-policy config found in `lib/`, `app/api/`, or root config files) to
   wire a clearer failure INTO — building one is out of scope for a Studio schema-guard
   feature and would be a separate infra feature in its own right.
3. **Building a new operator alert path here would violate this contract's own stated
   scope** (F1 item (4): no change to `route.ts`). The Studio guard is aimed at
   preventing the zero/two-active state from ever being reached via the one channel this
   feature can actually harden (Studio publish); it is not the right vehicle for also
   redesigning what happens after a bad state is somehow reached anyway.

If Brad later wants proactive alerting on this `console.error` (e.g. a Cloud Logging
sink -> alert policy), that is a new, separately-scoped feature — not a change this
contract makes or blocks.

## The P3 fold-in

`sanity/schemas/documents/ticketType.ts:42-48`'s `show` reference field:

```
defineField({
  name: 'show',
  title: 'Show',
  type: 'reference',
  to: [{ type: 'show' }],
  validation: (Rule) => Rule.required(),
}),
```

has no `options.filter`, so the reference picker offers all 6 `show` documents
(`show-14-2012` through `show-19-2027`, confirmed via the live-dataset read recorded in
`contracts/golden/ticketing-f1-show-collision/README.md`), including 5 archived past
shows, with nothing distinguishing the current sellable one in the picker UI. Checkout
fails closed regardless (`ticketTypeMatchesActiveShow()` rejects any mismatch), so this is
cosmetic wasted-editor-effort risk only, per the brief's own P3 framing — not a
sales-outage risk like the `active` checkbox.

**Folded in.** It costs one line (`options: { filter: 'active == true' }`), touches the
same file family (`sanity/schemas/documents/`) as the rest of this feature, and is the
same category of problem this feature already exists to reduce: an editor picking the
wrong show in Studio without realising it. Sanity reference filters narrow the PICKER's
search results only — they do not invalidate documents whose existing reference value
falls outside the filter, so none of the 5 pre-existing published `ticketType` documents
(which may reference a since-deactivated show) become invalid by this change. A new
ticket type being created can now only be pointed at the currently active show, which is
the only correct target for a new ticket type in practice.

## Why a pure module, not a live-dataset check

Per the hard constraint in the brief (a `F3-TITLE-SENTINEL-…` residue incident left a
fixture-set countdown live on `/national-show` for three days —
`contracts/golden/production-blockers-f3-studio-active-show-guard/` did not exist before
this contract), no assertion in this feature writes to, or reads live production content
from, the real Sanity dataset. `lib/active-show-guard.ts` is deliberately built with the
exact same shape as `lib/show-resolution.ts` — pure functions over plain data, zero
Sanity/Firebase imports — so every behavioural assertion (A1, A2) runs entirely against
JSON fixtures under `contracts/golden/production-blockers-f3-studio-active-show-guard/
fixtures/`, with no client, no token, and nothing to clean up afterwards. The one place
this feature necessarily touches a live client (`context.getClient()` inside the
`Rule.custom()` callback, which only runs inside a real Studio session) is Sanity's own
runtime, not this contract's test surface, and is proven correct indirectly: the
GROQ-query construction and id-exclusion logic that feeds it (`getPublishedId` /
`isSameDocument`) is unit-proven in A2, and the decision it makes from the query's
result shape is unit-proven in A1.

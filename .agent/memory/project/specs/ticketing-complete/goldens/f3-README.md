# ticketing-complete M2/F3 — design record

Reshaped from the mission brief's literal wording after checking the actual routes on
disk (2026-09-08). This is the third scope-conflict finding tonight (after VIP pricing and
the nav "already done" read) where trusting the brief/code without a direct check would
have produced wrong work or a false "already done" conclusion — flagged before building,
per standing instruction, not resolved silently.

## 1. The conflict, and the resolution (team lead, 2026-09-08)

F3's brief: "Category purchase surfaces under /tickets/** ONLY... workshops, symposium,
WOSA, field trips... must not create or edit anything under
app/(marketing)/national-show/**."

Checked on disk: `app/(marketing)/national-show/conferences/page.tsx` and
`app/(marketing)/national-show/workshops/page.tsx` **already exist** as real purchase
pages, wired to `activeTicketTypesByCategoryQuery`, selling exactly the conference and
workshop-field-trip category products. Building a second, parallel purchase surface for
those same products at `/tickets/**` would be the exact "one purchase concept, not one
per page" duplication the F2 exchange's §11 (read-vs-buy, NOS-negotiated) just ruled out.

**Resolution: option 2, plus the verification half of option 1.**
- Build a real, non-duplicating `/tickets` hub — links and content only, routing a buyer
  to the correct purchase surface for their category (admission stays on `/tickets`
  itself; conferences and workshops/field-trips route to their existing pages in
  `national-show/**`). No selling logic of any kind added to `/tickets` for a category
  that already has a surface elsewhere.
- Do NOT take "the surfaces already exist, so F3 is done" on trust — that is exactly the
  error already made twice tonight (VIP pricing reported fixed when the script never ran;
  nav read as correct when it was our own 40-minutes-earlier change). Fold in READ-ONLY
  verification that the existing `national-show/conferences` and `national-show/workshops`
  pages actually render F2's seeded categories and have loading/error/empty states and
  `data-placeholder` — assertion, not assumption.
- Reject "F3 is stale, cut it" — Brad asked for the ticketing flow to be complete, and
  "the surfaces already existed" is only a real answer once someone has checked they work.

## 2. Files this feature creates/extends

- `app/(marketing)/tickets/page.tsx` — EXTENDED (not replaced). Adds a "Looking for
  something else?" cross-navigation section below the existing admission listing.
- `components/tickets/TicketCategoryNav.tsx` — NEW. Renders the cross-navigation links.
  Sources its hrefs/labels from `components/chrome/nav-config.ts`'s existing "Tickets"
  `NavColumn` (`NAV` export, the `id: 'show'` mega item's `tickets` column) — imported
  directly, never hand-copied, matching F7's own "import NAV, don't duplicate" precedent
  (F7 goldens §5/A5). One list of ticket destinations for the whole site, not two that can
  drift.
- `e2e/tickets-hub-cross-links.spec.ts` — NEW, required. Coverage of OUR OWN new surface.
- `e2e/national-show-category-surfaces-verification.spec.ts` — NEW, **informational, not
  a hard gate** (`required: false` in the contract — see §4 for why).

## 3. What this feature explicitly does NOT do

- Does not create a second purchase surface for conferences, workshops, field trips, or
  cocktails anywhere under `/tickets/**` — those already exist, elsewhere, and stay there.
- Does not edit, patch, or otherwise touch anything under
  `app/(marketing)/national-show/**` — not even to fix a defect this feature's own
  verification spec discovers there. Any such defect is a FINDING, reported to the team
  lead for routing to the NOS session (`saocnosdesign-ea`), never fixed in place by this
  feature.
- Does not touch `app/admin/**` or `components/admin/*` (standing mission boundary).

## 4. Why the national-show verification spec is `required: false`

We do not own `national-show/**` and cannot fix anything it turns out to be missing. If
`e2e/national-show-category-surfaces-verification.spec.ts` finds that
`/national-show/conferences` or `/national-show/workshops` doesn't actually render F2's
newly-seeded/corrected categories, or lacks a loading/error/empty state, or doesn't surface
`data-placeholder` for a provisional figure — that is real, valuable information this
mission exists to produce, but it is NOT something F3 can turn green by itself, and a
`required: true` assertion we can never satisfy would stall this feature's own gate
indefinitely waiting on a session we don't control. Marking it `required: false` means: the
check still runs, still reports PASS/FAIL, and a FAIL is a genuine, actionable finding for
F8's morning review and for routing to the NOS session — it just doesn't block F3's own
completion. `e2e/tickets-hub-cross-links.spec.ts` (our own surface) stays `required: true`.

## 5. What the verification spec actually checks (read-only, no writes, no edits)

- `/national-show/conferences` renders text/markup identifying all three conference
  products (SAOC Symposium, WOSA Conference, SAOC/WOSA Joint) — proving it reflects F2's
  seeded taxonomy, not a stale hardcoded list.
- `/national-show/workshops` renders Sunset Cocktails and Field Trip products with F2's
  corrected, cited figures (R800/R1500/R200) once F2 lands — NOT the old invented
  R250/R450/R300/R750 figures. A stale figure surviving there after F2 ships is exactly
  the kind of silent gap this check exists to catch.
- Loading state: a `loading.tsx` sibling exists for both routes (static file check —
  Next.js's own loading-UI convention; its absence is reported, not authored by us).
- Empty state: using the same `page.route()` mocking convention as F7 (never a live
  query), serve an empty category result and confirm the page shows a real empty-state
  message rather than a blank render or a crash.
- `data-placeholder="true"` appears in the DOM when a mocked provisional product is
  served — same property F7 already proves on `/tickets` (F7 A10); this is the read-only
  cross-check that the SAME attribute reaches the NOS-owned pages too, since F2's
  `TicketTypeCard.tsx` change is presumably shared/reused by those pages (if it isn't
  reused at all — a different, NOS-owned component renders those cards — that mismatch is
  itself a finding to report, not to fix).

## 6. Loading/error/empty states on `/tickets` itself

The mission's own F3 brief line ("every surface needs loading, error, and empty states")
still applies to the ONE real surface F3 builds: the `/tickets` hub section itself needs a
graceful state if `nav-config.ts`'s data were ever empty (defensive, since it's a static
import, not a network call, but the component must not crash on an empty column) and the
existing admission listing's own loading/error/empty states (already built by
ticketing-f4-admission-products, unaffected by this feature) are left as they are.

## 7. A3/A4/A6 read as PASSING before F3 is ever built -- that is expected, not a clean bill
   of health (architect, 2026-09-08, pre-dispatch audit)

`A3`, `A4`, and `A6` are all negative-shaped (`! grep ...` / `test ! -e ...`). Run today,
before any of this feature's files exist, all three exit 0: `grep` can't open a file that
isn't there, so it exits non-zero, and the leading `!` flips that into a pass. Verified
directly, not assumed -- running each command by hand today against the current
(pre-dispatch) filesystem state confirms all three currently pass with nothing built.

This is NOT a hidden defect the way a stale-golden or doubled-backslash bug would be. It is
the ordinary shape every RED-today contract in this mission takes before @dev writes to it
-- the same reason F1/F2/F6/F7/F8 all showed some assertions green on the very first run,
before a single line of feature code existed. `A1` (a POSITIVE, file-existence check) is the
one that correctly reports RED in the same run, and it's the one that actually carries the
"nothing has been built yet" signal.

The risk is narrow but real: a skim of assertion results that counts "3 green" (A3, A4, A6)
without cross-referencing A1's red is a false read of the state -- it looks like partial
progress when it's actually zero. **Read the whole suite together, not any assertion in
isolation, and treat A3/A4/A6 as silent until A1 is green.** Once `components/tickets/
TicketCategoryNav.tsx` and the two e2e specs exist for real, A3/A4/A6 start meaning what
their descriptions say -- verified against real, non-empty content instead of a missing
file's absence.

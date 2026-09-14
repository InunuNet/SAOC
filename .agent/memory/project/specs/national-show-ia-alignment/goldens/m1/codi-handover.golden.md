# Golden — design consultation with `saoc-nos-design-cc` ("Codi")

**This file changed meaning on 2026-09-09.** It was written as a handover, on the earlier
understanding that the peer session owned page structure and page templates. Brad reversed
that: **we build the marketing pages of the subsection.** The field contract that used to
live here has moved to `page-contract.golden.md`, and the route decisions to
`route-map.golden.md`. What remains here is the part that is still true and still theirs:
design.

## The boundary

| ours | theirs |
|---|---|
| routes under `app/(marketing)/national-show/**` | the NOS visual language |
| page templates and composition | palette, type scale, spacing, motion |
| the Sanity content model and the copy | the token layer in `nos-theme.css` |
| the placeholder gate | `components/nos/*` primitives |

We own the structure and the build. `saoc-nos-design-cc` is the **design authority on
look**, and Brad has explicitly authorised discussing design options with them. This is a
conversation, not a handoff in either direction.

## What we do not do, ever

**No invented brand assets.** No new colours, fonts, logos, radii, shadows or spacing
values. CLAUDE.md: *"do not add colours, logos, fonts, or visual design decisions."* That
rule is unchanged by the scope reversal — building the pages is not authorisation to invent
the design.

**No edits to `nos-theme.css`.** It is a scoped token layer that redeclares the same
semantic custom-property names `app/globals.css` declares on `:root`, scoped to
`.nos-theme`, so existing Tailwind utilities re-skin with zero component edits. A new page
inherits the whole identity by sitting inside
`app/(marketing)/national-show/layout.tsx`. Declaring a colour anywhere else is inert
anyway — custom properties resolve at the element that *declares* them.

**No third component library.** Compose from `components/nos/*` first;
`components/show/*` where exhibitor-entry-style content applies. Two live sets already
exist; a new page picks one, it does not start a third.

## When to consult them

Raise it with `saoc-nos-design-cc` when a page needs a visual pattern the NOS system does
not already have — not to get permission for pages built out of patterns it does have.

Likely to come up across the 16 new pages:

| page | pattern that may not exist yet |
|---|---|
| 4, 5 (exhibitors, guests) | a profile-card grid with filter chips, and a "Confirmed / Coming Soon / Awaiting Confirmation" status treatment |
| 8 (judging and awards) | award-result presentation linking orchid, exhibitor, judge and category, plus a photo-led results gallery |
| 11 (programme) | a timetable in both list and calendar form, spec §4.11 |
| 12 (workshops) | skill-level colour coding (Beginner / Intermediate / Advanced), spec §4.12 |
| 15 (sponsors) | tiered sponsor treatment (Gold / Silver / Bronze / Conservation Partner / Donor) and a rotating showcase |
| all | **the placeholder notice's visual treatment** — see below |

## The one design question that is load-bearing

The placeholder notice is the mission's hard condition, and its *visual* form is the half we
cannot verify. Assertion A13 proves the notice text precedes the copy in the DOM. Nothing in
our gate proves it is **noticeable** — contrast, weight, position, whether a reader's eye
lands on it before the prose does.

So this is a real design question with a real consequence, and it should go to
`saoc-nos-design-cc` as one:

> Every National Show page whose copy the council has not yet supplied renders a notice
> saying the text is an AI-generated placeholder awaiting proper copy. It must be
> unmistakable — a reader must not be able to mistake placeholder copy for real copy — and
> it must sit above the fold, before any body copy. There is also a quieter second state
> for copy we researched but the council has not confirmed. Two states, one page-level and
> one repeated inline per section. What is the right treatment in the NOS system, given it
> is temporary and will disappear page by page as real copy arrives?

The wording itself is ours and is fixed in `provenance-gate.golden.md`; it is editable by
the council through the `showPageSettings` singleton. What we are asking them for is the
treatment.

## What they should know about our side

- 17 `showPage` documents, spec entries 1–13 and 15–18. Entry 14 is a link to `/societies`,
  not a page.
- Entry 1 is the **existing `/national-show` landing page**. It is a subsection landing
  page, not a home page — saoc.co.za is the only home page (`rules.md`).
- Two route conflicts are resolved and closed: `/national-show/exhibitors` keeps its route
  and its plant-entry content (the header already labels it "Exhibitor Entry"), and
  `/national-show/conferences` stays as the shared registration surface while entries 6 and
  7 get dedicated content pages at `/national-show/symposium` and `/national-show/wosa`.
  Reasoning in `route-map.golden.md`.
- Most page copy will be visibly marked placeholder for a while. Designs should look right
  in both states, and should not depend on the notice being absent.

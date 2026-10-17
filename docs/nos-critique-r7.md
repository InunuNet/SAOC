# nos-critique-r7

Round 7 of the National Orchid Show critique. Specs and checks live in
`.agent/memory/project/specs/nos-critique-r7/`; the base is main at `bcf8684b`.

## F1 — plan-your-visit disclosure grouping (Codi P3, H8)

Golden: `nos-v4/plan-your-visit.html` l.575-616. This is a structural ruling, so it applies in
preview and public alike: nothing on the page reads the environment.

**Getting there.** After the h2, the lede and the travel routes, one `role="group"` surface
(`components/show/VisitDisclosure.tsx`, labelled "Details to be confirmed by the show committee")
holds one full status chip first, then three items in order: Parking, Public transport and Where
to stay, each with its existing Sanity body. The accommodation list stays under Where to stay. An
item with no body (and, for Where to stay, no options) is not drawn. The three separate
`VisitorInfoBlock` cards are gone from this page only; `what-to-expect` still uses that component.
No card, border or shadow sits around an individual item, because the surface is the one container.
The golden's closing sentence is not drawn: in the seed it is already the second sentence of the
section lede, and Sanity holds no separate field for it.

**Venue aside.** DOM order is the Getting-there group, then the venue aside, then the emergency
section.

**In an emergency.** One `role="group"` surface (labelled "Emergency contacts, to be confirmed by
the show committee", the pale variant) holds one full chip, then the dialable numbers (`tel:` links,
44px targets, Fraunces numerals as in round 6). The contact that is not a number is drawn as its
label plus the value Sanity holds for it, as a short 16px / 600 / ink-500 tag (not a chip), and its
note is the closing line of the surface. The page therefore carries two full chips and one short tag.

**No invention.** The only copy strings added are the two golden aria-labels. The short tag, the
chip text and every body and foot come from Sanity; if Sanity lacks one, the element is not drawn.

## F2 — hero lede wrapping

`text-wrap: pretty` on `.nos-theme .nos-hero-lede` (`nos-theme.css`), so a short last line is
balanced against the one before it. One declaration, nothing else.

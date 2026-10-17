# nos-critique-r7

Round 7 of the National Orchid Show critique. Specs and checks live in
`.agent/memory/project/specs/nos-critique-r7/`; the base is main at `bcf8684b`.

## F1 — plan-your-visit disclosure grouping (Codi P3, H8)

Golden: `nos-v4/plan-your-visit.html` l.575-616. This is a structural ruling, so it applies in
preview and public alike: nothing on the page reads the environment.

**Getting there.** After the h2, the lede and the travel routes, `VisitGettingThere`
(`components/show/VisitDisclosure.tsx`) splits the three items (Parking, Public transport, Where
to stay, each with its Sanity body; the accommodation list stays under Where to stay) by status
(Codi's ruling on Codex's P2). Confirmed items are plain headings with their body, first, with no
surface and no chip. Every other item, whether pending, research or unset, shares ONE
`role="group"` surface labelled "Details to be confirmed by the show committee", with one chip: the
pending chip when any of them is pending or unset, otherwise the research chip. All confirmed means
no surface. Order inside each part is Parking, Public transport, Where to stay. The component is
driven by props only, so no production switch exists. No card, border or shadow sits around an
individual item. The three separate `VisitorInfoBlock` cards are gone from this page only;
`what-to-expect` still uses that component. The golden's closing sentence is not drawn: in the seed
it is already the second sentence of the section lede, and Sanity holds no separate field for it.

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

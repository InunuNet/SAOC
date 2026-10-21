# nos-critique-r7 F1 - plan-your-visit disclosure grouping (Codi P3, H8; FINAL ruling)

Golden: nos-v4/plan-your-visit.html l.575-616 (read-only at /Users/vetus/ai/SAOC/.agent/memory/project/specs/launch-weekend/goldens/nos-v4/plan-your-visit.html; copy at nos-critique-r6/goldens/f7-v4-plan-your-visit.html).
BASE = 1f8ad3de. Footprint: goldens/f1-footprint.json (page.tsx, VisitorInfoBlock.tsx, new components/show/VisitDisclosure.tsx, optional) + docs/nos-critique-r7.md. VenueCard, /contact, what-to-expect untouched.
This is a structural design ruling, not a withholding rule: it applies in BOTH modes. Decision recorded: preview and public render identically on this page (no per-item status lines; every status in Sanity is pending today). No per-request mode read is needed, so no `connection()` and no withholdPlaceholderProse() are required (a dev may keep revalidate = 60).

## Structure

1. Getting there (h2 + lede + TravelRoutes stay as today). Under them ONE disclosure surface, `role="group"` `aria-label="Details to be confirmed by the show committee"` (golden, verbatim):
   - the full chip once, first, at the top (not on Parking)
   - three h3 items inside it in order: Parking, Public transport, Where to stay, each with its existing CMS body (info.parking, info.publicTransport, info.accommodationIntro; AccommodationList stays inside Where to stay if options exist)
   - no card, border or nos-surface around an individual item (the 3 separate nos-surface cards go)
   - foot "It will be published here once it is ready.": only if that exact string is a CMS value AND not already in the section lede. In the seed it is the second sentence of gettingThereIntro, so the lede keeps it and the foot is dropped (H8). The sentence appears at most once on the page.
2. The venue aside (VenueCard, mapAction="button") sits after Getting there, before the emergency section (DOM order).
3. In an emergency: one disclosure, `role="group"` `aria-label="Emergency contacts, to be confirmed by the show committee"` (golden): one full chip, then the national numbers (tel: links, >=44px targets kept, Fraunces numerals as r6), then the on-site first aid contact: its label "On-site first aid and show duty contact" with the short tag "To be confirmed" (the Sanity contact.number, 16px / 600 / ink-500, not a chip), then the foot "The committee will supply the on-site contact before the show." (the Sanity contact.note, once, below the tag). The non-phone contact is detected as today (PHONE_SHAPED) and is the only one drawn as label + tag.

Page totals: exactly 2 full chips ("To be confirmed by the show committee") and 1 short tag, as the golden.

## NO INVENTION

New literals allowed in code: only the two golden aria-labels. The short label, the foot sentences and every item body come from Sanity (seed scripts/seed-show-visitor-info.ts). Hard-coding "To be confirmed", "It will be published here once it is ready." or "The committee will supply..." fails A3. If Sanity lacks the string, the element does not render: flag, do not type it.

## Rendered (390 and 1280, both modes)

Exactly 2 chips, both full, none short; one group with the Getting-there label holding exactly 1 chip (first) and h3s [Parking, Public transport, Where to stay]; no bordered or shadowed wrapper between an item and the group; one group with the emergency label holding 1 chip, three tel: links (10111, 10177, 112) at >=44px, the short tag once inside it at 16px / 600 / ink-500 and below its label, and the committee foot once, below the tag; DOM order Getting-there group, first aside (venue), emergency group; the published-here sentence at most once on the page; no overflow; what-to-expect unchanged (goldens/f1-baseline.json).

## Addenda (lead rulings after the F1 dev run)

- Short-tag colour is asserted against the literal #6a6780 = rgb(106, 103, 128), not a var probe.
- Chip fit (Codi's r6 disclosure ruling, applied to both r7 groups): at <=700 the chip uses 0.06em letter-spacing and 10px inline padding, the surface 16px inline padding; at 390 each chip is one line.
- Footprint (A2) is the stacked branch: F1 paths plus nos-theme.css (F2's one line, F3's token lines).
- The groups' gold fill is owned by F3 (goldens/f3-spec.md).

## Addenda 2 (Codi FINAL rulings on Codex's two P2s and the P3)

1. While you are here stays between the venue aside and the emergency group; In an emergency closes the page. It renders plain (no disclosure, no chip, no group) and not at all when attractions is empty. Rendered check: order after the aside, before the emergency group, nothing chip-like in its section.
2. The Getting-there group is split by status, inside components/show/VisitDisclosure.tsx `VisitGettingThere({ items, pendingLabel, researchLabel })`, items = [{ heading, body?, status?, children? }]:
   - status 'confirmed' = plain h3 + body under the h2, no surface, no chip, rendered first;
   - any other status (pending, research, unset) = ONE gold role=group after them, with one chip; pending (or unset) if any item is pending, else the research chip;
   - all confirmed = no group; order inside each part is Parking, Public transport, Where to stay.
   Today's live render (none confirmed) is unchanged. Fixture mechanism: the component is driven by props only, so the check renders it under the worktree's tsx with react-dom/server (checks/f1-fixture.mjs, f1-fixture-run.mjs) for six cases: all confirmed, mixed, all pending, all research, confirmed plus research, unset. No env var, query flag or CMS override exists in production code. page.tsx maps the CMS fields (parking, publicTransport, accommodationIntro + AccommodationList as children, and status.parking / publicTransport / accommodation) to items.
3. The chip-fit (0.06em, 10px) and the 16px surface padding hold at exactly 700px (rendered check widths 390, 700, 1280).

## Addenda 3 (Codi FINAL clarification: attractions follow the same status rule)

Superseded: addendum 2 item 1 ("plain, no chip" for While you are here). New rule, with the lead's four points settled:
- Rule: status.attractions 'confirmed' = plain section (h2 title, h3 items, no section surface, no chip; the existing item Cards may stay). Any other status (pending, research, unset) = the h2 stays above ONE gold role=group with one chip and the items inside. Pending or unset beats research. No attractions = nothing rendered. The page has exactly two treatments, plain when confirmed, gold disclosure when not.
- 1. Heading outline: "While you are here" becomes h2 (was h3); its items stay h3. "Getting there" and "In an emergency" are h2 (golden l.575-616 has In an emergency as h2; left at h3 it would nest under the attractions h2). Rendered: the first heading is the page h1, no level jump greater than 1, those three are h2, attraction items h3.
- 2. aria-label: reuse the golden's "Details to be confirmed by the show committee" verbatim (existing string, no new copy). Two groups may share it on one page: Getting there is the one before the venue aside, attractions the one after it; the rendered check separates them by DOM position.
- 3. Cards: inside the disclosure the items carry no Card (R11 rule, golden .pending-item); only in the plain confirmed state may the existing Cards remain. Rendered: no bordered or shadowed wrapper around an item inside the group.
- 4. API, in components/show/VisitDisclosure.tsx next to VisitGettingThere: `VisitAttractions({ title, attractions, status, pendingLabel, researchLabel })`, attractions = [{ name, note?, url?, _key? }], title = the existing string "While you are here", status = status.attractions. It returns null for an empty list and renders the h2 itself. The page no longer draws a ConfirmationBadge for attractions. Fixture cases (props only): attrConfirmed, attrPending, attrResearch, attrUnset, attrEmpty.
- Page chip total is now 2 + (1 when the attractions group renders); live data has no attractions, so 2.

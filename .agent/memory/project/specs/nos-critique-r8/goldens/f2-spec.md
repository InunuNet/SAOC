# nos-critique-r8 F2 - the Getting-there lede follows the status rule (P2; Codi FINAL)

BASE = main 81490e7a (re-based from 8e1d31d7). Footprint: goldens/f2-footprint.json (VisitDisclosure.tsx, plan-your-visit page.tsx).

Bug: gettingThereIntro ("... has not been worked out yet ...") is rendered under the "Getting there" h2 even after some items are confirmed, where it is false.

RULING: the lede renders only while EVERY Getting-there item (the items passed to VisitGettingThere) is unconfirmed (pending, research or unset); otherwise it is withheld.

API: components/show/VisitDisclosure.tsx exports `gettingThereLede(intro: string | null | undefined, items: VisitGettingThereItem[]): string | undefined`. It returns the trimmed intro when every item's status is not 'confirmed', else undefined. The page passes `lede={gettingThereLede(info?.gettingThereIntro, gettingThereItems)}` to SectionHeading. Decisions recorded: an empty item list is vacuously "every item unconfirmed", so the lede shows; a null or blank intro stays withheld.

Fixture (props only, no CMS state, A6 f2-fixture.mjs): none confirmed, pending + research, unset, mixed (confirmed first / last), all confirmed, no items, no intro, blank intro. Rendered: on the live data (nothing confirmed) the lede still shows under the h2 in both modes at 390 and 1280.

NO INVENTION: the lede text is the Sanity value; no new strings.

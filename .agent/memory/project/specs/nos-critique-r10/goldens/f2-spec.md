# nos-critique-r10 F2 - what-to-expect: Show dates before the R11 disclosure (R50 P1, lead-approved, block reorder only)

BASE = main d05c85a5. Footprint: goldens/f2-footprint.json (what-to-expect/page.tsx) + docs/nos-critique-r10.md; the branch footprint is f1 + f2 (one branch, gate at the tip).

Where: app/(marketing)/national-show/what-to-expect/page.tsx (the page itself, not the F18a LongFormPage template). The first NosSection (:142) opens with
- :143-145 `{heldBack.length > 0 ? (<ShowHoldingNote hidden={heldBack} pendingLabel={pendingLabel} />) : null}` (the R11 disclosure, ShowHoldingNote -> ShowStatusLine), then
- :147-157 `{dateRange ? (<section className="nos-surface"> <SectionHeading as="h2" title="Show dates" /> ... </section>) : null}`, then hours (:159), admission, food, photography, cloakroom, accessibility.

RULING (R50 P1): dates, hours, admission, food, photography, cloakroom, accessibility, with the dates card first, directly under the hero and sub-nav, then the disclosure.

Change: cut the :147-157 block (and its trailing blank line) and paste it, byte for byte, directly above :143. Nothing else: no copy, class, prop, markup or disclosure change. The disclosure's internal order (chip, list, link) is untouched.

F24 (lead) edits `export const metadata` in the marketing page files and may touch this one. A merge that keeps both is tolerated: f2-static masks the metadata statement and the import lines on both sides and compares everything else to BASE-with-the-move.

Proof: f2-static (exact transform of BASE), f2-rendered at 375, 768 and 1280 in public mode (dates card is the section's first child, disclosure directly after it; both texts equal goldens/f2-baseline.json, captured by @architect on the d05c85a5 build; r8 F1 non-regression: one disclosure, one chip, one painted and one exposed label).

Same pattern elsewhere (reported, not in scope): app/(marketing)/national-show/exhibitors/page.tsx renders its R11 disclosure (:207 ShowStatusLine) before the jump nav and ExhibitorKeyDates (:232). No other page uses ShowHoldingNote or a "Show dates" card.

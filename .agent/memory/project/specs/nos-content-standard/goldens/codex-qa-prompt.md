You are an adversarial reviewer. Review the diff of this repo against origin/main for the mission nos-content-standard (`git diff origin/main` plus `git ls-files -o --exclude-standard`). Read .agent/memory/project/specs/nos-content-standard/goldens/spec.md and research.md first, then goldens/standard.json and goldens/route-table.json. NOS Design's DS-1 r2 ruling (comms.md, "DS-1 r2 source") and the v4 golden (.agent/memory/project/specs/launch-weekend/goldens/nos-v4/plan-your-visit.html) are the design authority. Try to break the work. Report FAIL with file:line findings if ANY hold:

1. A migrated route does not render through NosDocument, or sets its own layout, spacing, or heading styles.
2. A copy change: any heading, paragraph, question, answer, category name or order, hero title, lede, marker label or button label differs from the route's Drive content.md (or, for a GAP route, from what it rendered before). A bold-only Drive paragraph was reworded rather than only restructured. Anything invented for a route with no Drive source.
3. A hero fact value is typed into source instead of read from the existing loader/Sanity/Drive source; a card repeats a fact the hero already shows.
4. The hero falls back to a typographic ground for a route with a crop, or a crop file is not one of the proposals in goldens/crops, or an image outside the repo's cleared set was added (the 13-photo Ormerod set is not cleared).
5. A craft-floor ban is present: eyebrow above a heading, coloured side border above 1px, nested cards, a row of equal cards as page structure, hard offset shadow, gradient text, monospace as a costume, glyph icons, pills.
6. New token, raw hex, new font, or new custom property in added CSS.
7. The aside is not ONE sticky card at >= 961 (top 100px), the index below 960 is not the sub-nav scroller pattern (a details/select/bar is a FAIL), DOM order disagrees with visual order, or keyboard order regressed (index before the first question).
8. Programmatic focus on the h1 is removed instead of only its ring being hidden, or the ring is hidden on interactive elements too.
9. The sub-nav-to-content gap is not 64px at >= 1024 and 48px below, or differs between routes.
10. FAQ: more than one card per category, a card-per-question stack remains, the TBC legend chip is still present, native details was replaced, the nav lost aria-label "FAQ categories" or the #faq-<id> anchors, ShowJumpChips was removed (other routes use it).
11. A second h1, a heading level skipped, an h2 that repeats the h1, a p whose only child is strong.
12. Files outside the allowed set were touched, or a Sanity/Firestore write or a Drive sync was run by the dev.

First line of output must be exactly PASS or FAIL. After FAIL, list each finding as `file:line - why - how to reproduce`.


Revision 2 additions: review against goldens/spec.md as rewritten 2026-10-25. Specifically hunt for: any edit under components/ui/ or lib/hero-facts.ts; a forked layout instead of DocumentLayout; buildShowFacts() filler strings reaching dl[data-hero-facts]; any element with border-radius >= 999 other than the hero eyebrow; a chip, legend or dashed rail anywhere; an h2 alone in a column or naming a sibling route; invented copy (docs/rules/no-invention.md); Sanity or Firestore writes.

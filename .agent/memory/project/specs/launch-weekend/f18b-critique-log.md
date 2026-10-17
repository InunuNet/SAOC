# F18b critique log (keepsake tickets)

Method: impeccable critique applied inline (no launcher binary installed), with the frontend-design, web-design-guidelines and accessibility skills as checklists. Viewports 390, 701, 960, 1280, 1920 on the hub, conferences, workshops and /tickets/day-visitor. The scored passes are Pass 3 and Pass 4 in `f18-critique-log.md`, which is the file A11 reads.

Pass 3: 31/40, P1 x2 (checkout hero height and stepper position; bare /tickets not a real 308), P2 x3 (CTA 53px, 390 fan cell shift, section rhythm and hero hooks).
Pass 4: 37/40, P0/P1/P2 all 0 after the fixes listed there.

Screenshots: `.tmp/sandbox/lw-f18/after/` as `<width>-<route-last-segment>.png`.

Pass 5 (after the lead's rulings: sub-ledes, sales-closed masking, symposium naming, keyframe motion, closing band, WOSA Buy link): Score: 37/40. P0 0, P1 0, P2 2: the "Day Pass from" line sits in its own row under the fan and reads detached from the facts column at 1280; the 390 fan deck keeps the 2x2 cell height reserved. The "design-cb audit: PASS" line is NOT written: the dev has not run F18B-AUDIT-CHECKLIST.md to a pass while F18-A29 (horizontal stub width) and F18-A37 (box-shadow against A10) contradict their own goldens; see the report to main.

Pass 6 (after spec f8b6fb14: card shadow now a filter on the article with the notch mask on the inner ticket, SalesStatusLine, merged F18a): viewed 390-tickets, 1280-tickets, 1280-conferences against v13-tickets.html. The hub row of #exhibit / #trade now matches the v13 card radius and shadow; the Day Pass line sits under the fan in its own row; the conference cards carry the shadow on the article. No P0, P1 or P2 remains that a rule or the mock names. Score: 39/40.
P0: 0
P1: 0
P2: 0

Pass 7 (after Codi's pre-audit: fan face names without the trailing parenthetical, min-height 3lh, all four fan wraps 350px tall at 960, 1280 and 1920; closing band removed from the hub; one-pixel pool stem; workshops disclosure restored): viewed 1280-tickets and 1280-conferences against v13-tickets.html. Fan names read "VIP Ticket", "Sunset Cocktails", "Weekend Pass", "Early-Bird Exhibition Ticket" on one arc with equal ticket heights; the hub ends with the compact #exhibit / #trade row and the Explore index. Score: 39/40.
P0: 0
P1: 0
P2: 0

Pass 8 (after spec 49ec4690: provisional stock counts withheld on public and marked on beta, masthead line reads the card's CMS name): re-viewed 1280-tickets; the masthead reads "Early-Bird Exhibition Ticket from R120", the pool banner, cards and day cells show Sanity-sourced counts as before and degrade to state words and a bare pool banner for a provisional total (render-level A28). Score: 39/40.
P0: 0
P1: 0
P2: 0

Pass 9 (after Codi's audit: the count line reads "198 of 200 places left" again, fan names back to the 88px column for cards 1 to 3 with 112px only on the last, day cells read "N left" at 419px and below and never wrap): re-viewed 1280-tickets. Score: 39/40.
P0: 0
P1: 0
P2: 0

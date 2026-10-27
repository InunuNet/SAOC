# F9 golden — NOS Design #92 judgement, 2026-10-25 (PASS 36/40 conditional; rulings final)

P1 (blocking, craft-floor text overflow; critique.md H8): event-390 ShowBand countdown collides — "MINUTES" runs into "SECONDS", "SECONDS" overflows the card's right edge, "333" touches its cell. The band sits in the event page's content column, narrower than on home.
- Change: container query on the countdown. Below ~360px of container, the four cells go 2×2 (DAYS/HOURS, then MINUTES/SECONDS), same type, same labels, no copy change.
- Check the home ShowBand at 390 with the same query; if it already fits, the query is a no-op there.
- Gate: no label wider than its cell at 320, 360, 390 and 414.

P2 (critique.md H8 minimal): event page states dates and venue twice (meta table + band ~100px below).
- Change: for the National Show event, when the band renders, drop the page's meta table. The h1, date line and band carry it.

P3: at 1440, /events/submit's single 750px form column sits flush left under a centred hero.
- Change: centre the column at max 640 for now (mirror PR later aligns it to the copy column at 52%).

Out of scope: band photo (G9 orchid-dark-showband cut, mirror PR).

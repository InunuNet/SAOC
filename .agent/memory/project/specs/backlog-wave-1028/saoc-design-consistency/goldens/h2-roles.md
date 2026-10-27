# SA-6 h2 roles

H2 role: serif (Crimson Pro), weight 300, `font-size: clamp(32px, 29px + 0.762vw, 44px)`, line-height 1.15. Values: 32 at 390, 39.97 at 1440, 44 at 2056.
Title role (card-type h2): serif, weight 400, 20 to 22px.
Hero h1 untouched. Brad's display-weight ruling (app/globals.css .h1/.h2 weight 300) stays.

Measured on main (distinct h2 sizes/weights/line-heights, /about /judging /sponsors /members /privacy /terms /refunds /societies /contact /):
- 390: 26/300/1.15 (section h2s), 30/400/1.10 (CTA h2s)
- 1440: 36/300/1.15, 46/300/1.10, 48/300, 54/300 (Home), 22/400, 20/400
- /events (beta): 32/300/1.10, 24/400/1.38 (month heads)
None of the section h2s match the target; check-h2-roles.mjs fails 150 times locally.

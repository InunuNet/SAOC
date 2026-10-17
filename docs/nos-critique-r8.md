# nos-critique-r8

Round 8 of the National Orchid Show critique. Specs and checks live in
`.agent/memory/project/specs/nos-critique-r8/`; the base is main at `8e1d31d7`.

## F1 — the R11 chip on one line at narrow widths

At 375px the disclosure chip wrapped on exhibitors, what-to-expect and both plan-your-visit groups.
Every disclosure chip (`ShowStatusLine` and `VisitDisclosure`) now uses the same inclusive `<=700px`
rule, spelled out as `[@media(max-width:700px)]` (0.06em tracking, 10px inline padding), because
Tailwind's bare 700px variant compiles to `width < 700px` and left exactly 700px untightened. A
`[@media(max-width:419px)]` step drops the tracking to 0.02em; the 12px size and the 10px padding
stay. No bare 700px variant is left under the NOS trees. CSS only, no copy change.

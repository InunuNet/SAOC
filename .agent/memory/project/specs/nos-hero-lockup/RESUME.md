# RESUME — nos-hero-lockup (paused 2026-09-28, Brad moving locations)

Brad approved in-session: R12 hero lockup on /national-show, "it should look like their artifact". Scope = HERO ONLY (Brad, explicit). Mobile placement = centred (design commit beeea00).

Chain state: @architect DONE (contract-f1.yaml, 22 assertions; goldens hero-structure.md, placement-spec.md,
visual-checklist.md, reference-artifact-SjeY6NP8-v4.html under .agent/memory/project/specs/nos-hero-lockup/).
@dev DONE: feat/nos-hero-lockup commits 08d8c162 + c75b51ca, 22/22 assertions, build clean. Screenshots .tmp/sandbox/nos-hero-lockup/national-show-{1280,1714,390}.png
Next: @qa (1 dispatch) → gate → @docs → screenshots 1280+390 to Codi (saoc-nos-design-f1) → Brad sign-off → merge.
Nothing pushed/merged/deployed.

Open for Brad: lede repeats the name (via Codi, don't rewrite); footer colophon still R23 composed lockup (next pass);
button order differs from artifact; sections below hero out of scope.
Also open: menu-system-layout4 autonomy unset (recommend autonomous); two unparseable old specs
(gate-timeout-fix, mission-slug-collision-fix); Athanor comms.md hook-loss post awaiting reply.

Done this session: harness 3.8.5 + hook repair (a85bc5f2), backlog (2dcc4b58), #1453 comment,
NOS routes confirmed to menu lane, rulings R11–R23 mirrored into .agent/memory/project/design/nos-design-rulings.md (uncommitted).
Check at resume: at 390 the lockup rendered 339px wide, not Brad's 365px — the site column uses a 32px gutter, whereas
Brad's adjuster assumed 20px. It's still centred. Ask Codi/Brad whether 339 at a 32px gutter is acceptable.
@dev also moved margin-bottom (desktop 95px, mobile 48px) away from the spec's 58/8, to hit the ink-gap targets once the PNG clearspace is accounted for.

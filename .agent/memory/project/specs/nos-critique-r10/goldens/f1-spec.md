# nos-critique-r10 F1 - define the type-scale tokens nos-structure.css reads with a fallback only (main defect, found in the r8 re-base)

BASE = main d05c85a5 (r8 and r9 merged). Footprint: goldens/f1-footprint.json (nos-theme.css, nos-structure.css) + docs/nos-critique-r10.md. Worktree: .tmp/sandbox/critique-r10 from d05c85a5.

Defect: main's F18b (5f573dae / 05139a3a / 81490e7a) reads six custom properties in app/(marketing)/national-show/nos-structure.css with an inline fallback and no definition anywhere.

Sources (NO INVENTION; only the handoff, the nos-v4 golden, branding/ or an existing token):

| use (nos-structure.css @ d05c85a5) | fallback | source | sourced value | decision |
|---|---|---|---|---|
| :771 `.nk-btn` `var(--fs-sm, 0.875rem)` | 0.875rem | nos-v4 plan-your-visit.html :root `--fs-sm` (in-project copy .agent/memory/project/specs/nos-critique-r6/goldens/f7-v4-plan-your-visit.html:38) | 0.875rem | (a) define, drop fallback |
| :1347 `.nk-pool strong` `var(--fs-lg, 1.5625rem)` | 1.5625rem | same file :42 `--fs-lg` | 1.5625rem | (a) define, drop fallback |
| :1354 `.nk-pool p`, :1535 `.nk-facts dd`, :1572 `.nk-visit a` `var(--fs-base, 1rem)` | 1rem | same file :39 `--fs-base` | 1rem | (a) define, drop fallback |
| :882 `.nk-stub` `var(--nk-field, var(--primary))` | var(--primary) | not a theme token: set inline on every `.nk-stub` by components/tickets/keepsake/parts.tsx:64 (`'--nk-field': var(${product.fieldVar})`, lib/data/ticket-presentation.ts:72-168) | per product | no change: it is defined (inline); the fallback is a guard, like `--nos-hero-pos` |

No other source defines any of them: design/design_handoff_saoc/ (colors_and_type.css uses --body-*/--display-*), branding/, app/globals.css and nos-theme.css hold no --fs-sm/--fs-base/--fs-lg/--nk-field.

Change:
1. nos-theme.css, in the `.nos-theme` rule that holds `--fs-body` (the R14 block): declare `--fs-sm: 0.875rem; --fs-base: 1rem; --fs-lg: 1.5625rem;` under a comment that names the --fs- steps and cites nos-v4 plan-your-visit.html. Add nothing else; remove nothing. Do not touch `--fs-xs` (0.8rem, Codi F2 floor) or `--fs-body` (1rem, R14), which deliberately differ from nos-v4.
2. nos-structure.css: drop the fallback in the five --fs uses (`var(--fs-sm)`, `var(--fs-lg)`, `var(--fs-base)` x3). No other byte changes; the --nk-field fallback stays.

Zero visual change: each defined value equals its fallback. Proof: f1-rendered compares computed font-size (the five uses) and the stub backgrounds at 375 and 1280 on /national-show/tickets, /national-show/workshops and the hub's first checkout link against goldens/f1-baseline.json, captured by @architect on the d05c85a5 build (r9 worktree, BUILD_ID after its tip commit).

Static S4 widens the r8 audit to the ticket trees (components/tickets, app/(marketing)/tickets) and counts an inline custom property key (`'--x':` in TSX) as a definition, so no fallback allowlist remains (PREEXISTING_FALLBACK is gone; --nos-hero-pos and --nk-field are found at their inline setters).

Out of scope, reported to the lead: nos-structure.css:805 reads `var(--fs-xs, 0.75rem)`, but `--fs-xs` IS defined (nos-theme.css:307, 0.8rem, "not a general small-text scale"), so that text renders 12.8px, not the 12px the fallback (nos-v4 --fs-xs) suggests.

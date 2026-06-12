# SAOC design system — operating instructions

You are designing for the **South African Orchid Council** (SAOC), a federated body of 21 affiliated orchid societies, founded in Bloemfontein on 28 July 1968. Members are botanists, judges, society chairs, and amateur growers — a serious, mostly older audience that respects heritage, accuracy, and Latin nomenclature.

The aesthetic is **editorial and quiet**: deep sage, parchment paper, brass accents, Crimson Pro display serif paired with Manrope. Think the _Kew Bulletin_ or a regional gazette — not a tech startup, not a wedding florist.

## What to read first

1. `README.md` — full brand context, content fundamentals, visual foundations, voice rules.
2. `colors_and_type.css` — the canonical token file. Always link this from new pages.
3. `preview/` — a small swatch / sample for every token group. Open these to see what each token looks like in context.
4. `assets/` — five orchid photographs and the logo in eight color combinations.

## Building anything new

**Always link `colors_and_type.css`.** It defines `--primary`, `--accent`, `--parchment`, `--ink`, `--muted`, `--rule`, the type stack variables, and the Google Fonts imports. Never inline these values; never invent new ones.

**Reuse the components first.** `ui_kits/website/components.jsx` exports `Logo`, `Eyebrow`, `Button`, `NavBlock`, `SocietyCard`, `EventRow`, `Header`, `Footer` to `window`. The full prototype lives at `SAOC Website.html` if you need to see them composed in a real page.

**For slides:** start from `slides/index.html` — it shows the four canonical slide layouts (title, section divider, content, stat) at 1920×1080, wrapped in `<deck-stage>`. Copy that file and edit; do not rebuild from scratch.

## The non-negotiables

- **One sage band per page.** Sage (`--primary` / `#384138`) is the punchline surface. Most surfaces are parchment or bone. If you find yourself reaching for sage twice, you're using it as decoration.
- **No emoji, no AI gradients, no purple-to-pink anywhere.** Brass (`#9e8c6b`) is the only warm accent.
- **Headlines are Crimson Pro, weight 500, with one italic phrase.** Every headline gets exactly one italicised emphasis word — never zero, never two. The italic word is usually `--primary` color on light surfaces, `--accent` on sage.
- **Eyebrows and stats are JetBrains Mono, uppercase, tracked 0.18–0.22em.** This is the brand's secondary voice; use it for "Est. 1968", date stamps, "Section 02", award codes (AM/SAOC).
- **Latin orchid names are italicised in body copy** (`<em>Cymbidium madidum</em>`). This isn't optional; the audience is botanically literate.
- **Hairline rules, sharp corners.** Border-radius is 0 or 2px; 999 only for pills. Default rule is 1px `--rule` (#d9d7c9). The 2px brass accent is reserved for "this section is important".
- **Generous whitespace.** Sections are 96–128px tall. Hero copy never exceeds 60ch. Trust the parchment.

## Voice

Plain, slightly formal South African English. Spell out "twenty-one", "nine provinces", "since 1968". Dates as "12–15 September 2027" (en-dash, no comma). Reference the founding moment ("Bloemfontein, 28 July 1968") when introducing the council. Never call orchids "blooms" or "blossoms" — they are _plants_ or _orchids_.

When unsure about a fact, write a placeholder in `[brackets]` rather than inventing — the council will provide real numbers, member counts, and event details.

## Asking for missing material

The council provides photographs, member figures, and award lists; do not synthesise these. If a layout calls for an orchid photograph that isn't in `assets/`, leave a labeled placeholder block (sage with a mono caption "ORCHID PHOTOGRAPH · TBD") rather than substituting a generic image.

# nos-critique-r15 F3 — two small-text colours reach 4.5:1 with handoff tokens

BASE: `origin/main` `0fdffebb` since the restack (was `ab7c549c` when the spec was written; the two differ only in `next.config.ts`). Shared branch and worktree with F1/F2.

## (a) /refunds "PROVISIONAL" sup

`components/ui/ProvisionalFigure.tsx:21` renders `<span class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted align-super">`
inside `<mark class="bg-primary/10 …">`. The mark's background composites to #e1e1da on parchment, so --muted #636660 measures
**4.44:1**. axe color-contrast reports 8 nodes at both widths (BASE run below). ProvisionalFigure is used only on /refunds.

Candidates (ratio on #e1e1da):

| token | ratio | >= 4.5 |
|---|---|---|
| --ink #171917 | 13.46 | yes |
| --primary-800 #22281f | 11.49 | yes |
| **--primary #384138** | **8.07** | **yes (chosen)** |
| --primary-700 #4a554a | 5.94 | yes ("secondary use on dark" by its own definition) |
| --muted #636660 (today) | 4.44 | no |
| --accent #9e8c6b | 2.49 | no |
| --accent-soft, --rule, --rule-soft, --bone, --parchment | 1.0-1.6 | no |

**Decision:** on that one line, `text-muted` becomes `text-primary`. This is the handoff's own pairing for a mono uppercase label on a
tint: src/styles.css `.eyebrow { background: var(--bone); color: var(--primary) }`. The mark's own background and text stay unchanged.

## (b) The 404 eyebrow "404 — Page not found"

`app/not-found.tsx:30` renders `<p class="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-4">` over
`bg-primary` + the orchid photo at 20% + a primary gradient. The same `NotFoundSection` renders the root 404 and the marketing
not-found (a missing society).

Measured against the actual painted background:
- the text is made transparent;
- every pixel under its own glyph box (+2px) is captured;
- the worst pixel decides.

Results at BASE:
- the lightest background pixel is rgb(84,87,81) at 1280 and rgb(84,87,80) at 390;
- --accent measures **2.24:1 / 2.25:1** worst-case;
- the lead's ~3.39:1 was a median.

Candidates (worst-case ratio on rgb(84,87,81)):

| token | worst ratio | >= 4.5 |
|---|---|---|
| **--ivory / --parchment #f4f3ec** | **6.60** | **yes (chosen)** |
| --bone / --primary-100 #e8e6dc | 5.87 | yes (a tint/pill background, not a text colour) |
| --rule-soft #e4e1d0 | 5.59 | yes (hairline colour) |
| --rule #d9d7c9 | 5.08 | yes (hairline colour) |
| --fg-on-dark-muted rgba(244,243,236,.65) | 3.85 | no |
| --accent-soft #c2b393 | 3.55 | no |
| --accent #9e8c6b (today) | 2.24 | no |
| --ink, --primary*, --muted | 1.06-2.41 | no |

**Decision:** on that one line, `text-accent` becomes `text-ivory`. This is the handoff's eyebrow on a photograph:
src/styles.css `.eyebrow--light { color: var(--ivory) }`. It is also the token this section's own h1 already uses. The remaining
passing tokens are background or hairline roles, not text colours. No brass token reaches 4.5:1 here.

## Acceptance (contract-f3.yaml; pins in checks-f3.sha256)

- A1: pins.
- A2: footprint.
- A3: `f3-static.mjs`:
  - S1: each file equals BASE plus exactly its one line (goldens/f3-edits.json);
  - S2: both tokens are in the handoff and @theme, and both files are unchanged;
  - S3: the docs record F3.
- A4: `f3-rendered.mjs`, public build, 1280 and 390:
  - R1: axe color-contrast is 0 on /refunds, with all 8 sups present;
  - R2: the eyebrow's text colour reaches >= 4.5:1 against every painted background pixel under its glyph box, on the root 404 and on
    /societies/zz-r15-missing.

## Proof

- At BASE: A4 R1 fails on the 8 sups at 4.44:1 at both widths, and R2 fails at 2.24/2.25:1 on both routes and both widths.
- On the prototype, both measures PASS (R2 worst-case in the contract run notes). It was reverted.

## NO INVENTION sources

- `docs/rules/no-invention.md`
- `design/design_handoff_saoc/`:
  - colors_and_type.css:11 (--primary), :20 (--ivory);
  - src/styles.css `.eyebrow` and `.eyebrow--light`;
  - design_system_README.md (Mono eyebrows; colour roles);
  - SKILL.md, ui_kits/, screenshots/.
- `branding/SA Orchid Council/`: no colour is added.
- The lead ruling (FINAL 2026-10-18).

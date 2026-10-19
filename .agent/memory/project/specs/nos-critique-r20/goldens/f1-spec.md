# nos-critique-r20 F1: the NOS footer "Stay in touch" sign-up (border contrast, autocomplete, a visible label)

BASE: `origin/main` `a4807791` (r18 merged). Branch `fix/nos-critique-r20`, worktree `.tmp/sandbox/critique-r20`. Independent of r19
(the ticket state pages); neither r18 nor r19 touches `components/nos-chrome/`. If r19 merges first, BASE is re-pinned and this branch
restacked.
Rulings: Codi, FINAL, relayed by the lead on 2026-10-19. The layout stays the same: input and button side by side at 390. Only CSS and
attributes change. No new strings, tokens or colours.
Three features, one branch, one dev: F1 is this sign-up; F2 is the same-tone section gap (`f2-spec.md`); F3 puts the NOS footer on the
SAOC footer's layout (`f3-spec.md`). F1 and F3 edit the same two files, so F1 is pinned by content, not by BASE line numbers.
Goldens: `f1-edits.json` (the F1 change shown against BASE), `f1-footprint.json`.
Sources: `docs/rules/no-invention.md`.

**Where it lives, verified in code:**
- The component is `components/nos-chrome/NosFooter.tsx` (`footer#nf`), shared by every NOS page. The SAOC footer is a different component and is untouched.
- The column is `.nf-col.nf-col-touch`, and it holds, in order:
  - the "Stay in touch" `.nf-head`;
  - the blurb `.nf-text` (margin-bottom 14px);
  - `form#nf-form.nf-form`, containing the input and the "Subscribe" button;
  - `.nf-wild`.
- The strings come from `components/chrome/footer-data.ts` `FOOTER_BULLETIN`. `emailLabel: 'Email address'` already exists; BASE uses it as the input's aria-label.
- The form's only handler is `onSubmit={(e) => e.preventDefault()}`. It has no action, no server action and no FormData reader, so nothing reads the field name.

## 1. P2, WCAG 1.4.11: the input border (exact, `f1-edits.json` `css`)

- nos-chrome.css:139, the `.nf-form input` rule: `border: 1px solid rgba(210, 203, 232, 0.36)` becomes `0.55`. Only the alpha changes.
- The colour is a literal in that one rule, not a token, so nothing else moves.
- The other `rgba(210, 203, 232, …)` uses are different alphas on different rules, and both stay: the placeholder at .72 and the `.nf-base` top rule at .2.
- R1 computes the contrast of the border as drawn against the footer's computed background (royal `#211A57`):
  - the border alpha composites over the input's own background `rgba(11, 10, 20, .22)` when `background-clip` is `border-box` (the default), then over the footer;
  - the result must be at least 3:1;
  - BASE (.36) is 2.35:1, which is the defect; .55 is 3.85:1. Composited straight onto the footer, without the input ground, the figures
    are 2.47:1 and 3.97:1, so the verdict does not depend on the clip.

## 2. P2, WCAG 1.3.5: the input's purpose (exact, `f1-edits.json` `footer`)

- The input gains `name="email"` and `autoComplete="email"`, and keeps `type="email"`, `placeholder` and `required`.
- It also gains `id="nf-email"` for the label (section 3). That id is unique in the app; `form#nf-form` keeps its own id.

## 3. P3: a visible label in the label role (exact)

- NosFooter.tsx: between the blurb and the form, add `<label className="nf-head" htmlFor="nf-email">{FOOTER_BULLETIN.emailLabel}</label>`. Remove the input's `aria-label`.
  - The accessible name is now "Email address" from the label. The string is unchanged; only where it lives changes.
- **Why it sits above the form and outside it:** `.nf-form` is a flex row at 700px and below, so a label inside the form would become a third flex item and break the input-and-button row at 390. Outside the form, the row stays exactly as at BASE.
  - At 701px and above the form is a column. The label still sits above it, on the same left edge.
- **The role:** `.nf-head` is the footer's label role:
  - type `700 12px/1.3`, letter-spacing .14em, uppercase;
  - colour `--nc-green-1`;
  - margin `0 0 6px`.
  - It is the class "Stay in touch" uses.
- A `<label>` is inline by default, so its bottom margin would not apply. One new rule block, placed after BASE line 137 (`.nf-col .nf-text`) and carrying an r20 comment: `.nf-col-touch label.nf-head { display: block; }`. It sits apart from the r20 border edit, and no existing rule is edited for it.
- The touch column grows by the label's line box (15.6px) plus its 6px margin. The blurb's 14px bottom margin stays above it, so the column reads heading, blurb, label, field.
- Not chosen: a visually-hidden label (it does not meet the "visible" ruling) and a placeholder-as-label (placeholders vanish on input; WCAG 3.3.2).

## 4. Footprint

`f1-footprint.json`: `components/nos-chrome/NosFooter.tsx` and `components/nos-chrome/nos-chrome.css`, plus `docs/nos-critique-r20.md` with a `## F1` section. F1 adds no string: `FOOTER_BULLETIN.emailLabel` already exists (F3 edits `footer-data.ts`, for layout only).

## 5. Checks

- **A3, static:** the label markup appears once, between the blurb and the form. The input carries its attributes and no aria-label. The input rule is BASE's with alpha 0.55, no 0.36 border is left, and the label rule block exists. No new prose. Docs F1.
- **A4, rendered:** public and preview builds, at 1280 and 390, on /national-show, /national-show/tickets and /national-show/about.
  - R1: the border colour on all sides, still 1px solid with a 10px radius, and contrast of at least 3:1.
  - R2: the attributes; exactly one `<label>`; the textbox's role name is "Email address", exact.
  - R3: the label is visible, above the input, on its left edge, and its computed type equals the "Stay in touch" `.nf-head`.
  - R4: side by side at 390; stacked at 1280 (button under the input, same left edge and width); no overflow.
  - The footer's grid and column boxes belong to F3 and its checks.

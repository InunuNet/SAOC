# nos-critique-r20

Four fixes on branch `fix/nos-critique-r20` (BASE `origin/main` 7fb251a1). Rulings: Codi, FINAL. Specs and goldens live in
`.agent/memory/project/specs/nos-critique-r20/`.

## F1

The NOS footer "Stay in touch" sign-up (`components/nos-chrome/NosFooter.tsx`, `nos-chrome.css`).

- WCAG 1.4.11: the input border alpha rises from .36 to .55 (3.85:1 against the royal ground; BASE was 2.35:1).
- WCAG 1.3.5: the input carries `name="email"` and `autoComplete="email"`.
- A visible `<label className="nf-head" htmlFor="nf-email">` sits between the blurb and the form, outside the flex row so the
  390px input-and-button row is unchanged. It reuses `FOOTER_BULLETIN.emailLabel`; the `aria-label` is gone.
- The form submit is not wired; the newsletter mission owns it.

## F2

One rule in `app/(marketing)/national-show/nos-structure.css`, after the r14 tickets-hub rule: two adjacent `.nos-section`s on the
same ground (default, gold, royal or black; a `bg-` utility section is its own ground) share one rhythm unit, because the follower's
padding-top is 0. `/national-show/what-to-expect` at 1280 loses one 115px padding after "Accessibility" (230px to 115px). Different
grounds keep both paddings, and pairs already collapsed (hub, status disclosure, tickets hub, workshops at 390) are unchanged.

## F3

The NOS footer follows the SAOC footer layout. `FOOTER_LAYOUT` in `components/chrome/footer-data.ts` holds the SAOC grid, brand
column, brand mark, bottom bar and legal class strings; `Footer.tsx` uses them verbatim (a pure refactor) and `NosFooter.tsx` uses
the same keys, so the four columns (brand, Explore, Partners, Stay in touch with the WOSA block) and the bar cannot drift. The NOS
skin keeps its own colour and type. The lockup is 248px (`LOCKUP_BOX = 248`) and REG/NPO sits left-aligned under it. The r17
centred full-row lockup, `.nf-wrap`, `.nf-grid` and the clear-space margin are retired. The bar's `.02em` tracking is dropped so
the legal links land within 2px of the SAOC bar's (L3).

## F4

`FOOTER_RHYTHM` in `footer-data.ts` (`list: 'flex flex-col'`, `row: 'inline-flex min-h-11 items-center text-[14px]'`) is the one
list and row for both footers: every Explore, Partners and WOSA row is 44px at 14px. The SAOC Partners rows lose their `gap-2`.
In the NOS footer the row geometry comes off `nos-chrome.css` (it is unlayered and would beat the utilities), and
`.nf-col > .nf-head` sets the 16px heading margin, which also reaches the F1 label. Partners stay plain text (no URLs).

# nos-critique-r4 F1 — R44-A3 FAQ category jump chips (golden spec for @dev)

Worktree `.tmp/sandbox/critique-r4/` (branch fix/nos-critique-r4, base 07e09ef3).
Ruling, verbatim: "A3 FAQ: YES to the 5 category jump chips. NO filter field: over 14 questions it adds a control that pays nothing back. Per-answer TBC is R41."

## Footprint (check-footprint.mjs)
Only `components/show/ShowFaqList.tsx`, `app/(marketing)/national-show/faq/page.tsx` (expected: untouched), `docs/nos-critique-r4.md`, and `contracts/checks/nos-critique-r4/**`. No new component file: ShowFaqList already owns CATEGORY_ORDER / CATEGORY_LABELS, so the chips live there and cannot drift from the sections. Hub, tickets, vendors CTA, ShowContentState, nos-theme, NosSkipLink, Header, Footer, globals.css, `components/show/index.ts` are off limits.

## Decisions
1. Placement: the first child of the FAQ content column, i.e. directly under the hero and above the first category section. The hero lede already carries the page intro, so "under the intro" is the same place; no extra wrapper on the page.
2. Source: `groups` is computed once from CATEGORY_ORDER (order) and CATEGORY_LABELS (text); chips and sections both map over `groups`. A category with no questions yields neither chip nor section. The nav renders only when `groups.length > 1` (a single chip jumps nowhere).
3. Ids: keep the existing `id={`faq-${category}`}` on the h2 (already the aria-labelledby target). Chip href is `#faq-${category}` built from the same key. No second id scheme.
4. Nav name: `aria-label="FAQ categories"`. A neutral structural label (the page already says "FAQ" in ShowSectionNav; no marketing copy). Not the hero title, which is CMS-editable and may be empty. This is the only new string, and it is not visible.
5. Chip styling reuses the existing eyebrow-pill grammar (Badge `tone="purple"`: bg-bone, text-primary, `--radius-pill`) because Badge is a non-interactive span and cannot be an anchor; classes are copied, no new tokens. Sentence case 14px, not 12px tracked caps: five tracked-caps chips cannot hold 2 rows at 375.
6. Layout: `flex flex-wrap gap-2`, never a scroller (R44-A4). Target at most 2 rows at 375/768/1280. If the reference wraps to 3 at 375, tighten `px-3` to `px-2.5` or `gap-2` to `gap-1.5`; do not change font role or add overflow.
7. Scroll: native anchor jump. No `scroll-behavior`, no scrollIntoView, no JS (reduced-motion is therefore satisfied by construction). h2 gets `scroll-mt-[62px] md:scroll-mt-[74px]` (the ruled values). The NOS header (`.nh`) is sticky only above 699px (about 97px tall at 768/1280) and scrolls away below that; `html { scroll-padding-top: 5rem }` in globals.css stacks with the margin. Measured landings: 142px at 375 (header not sticky), 154px at 768/1280 (80 + 74, clears the 97px header). The rendered check asserts the landing, not margin >= header height: where the header is sticky/fixed the heading lands at or below its bottom and within 120px; where it is not, the heading lands within 160px of the viewport top.
8. Focus: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]`, identical to SectionNav/Button on this page. Hover: `hover:text-accent`. Transition ONLY the text colour, under `motion-safe:`: `motion-safe:transition-[color] motion-safe:duration-150`. `transition-colors` also animates `outline-color`, so the focus ring fades in from the text colour; check-static pins this and check-rendered asserts the ring colour is the theme ring on the first frame.
9. Untouched: `<ConfirmationBadge …/>` per answer, `<details>` markup, answer text, page copy.

## Markup (reference implementation: goldens/ShowFaqList.reference.tsx; match it, re-indent with prettier)
```tsx
const groups = CATEGORY_ORDER.map((category) => ({
  category,
  inCategory: entries.filter((faq) => categoryOf(faq) === category),
})).filter(({ inCategory }) => inCategory.length > 0);

return (
  <>
    {groups.length > 1 ? (
      <nav aria-label="FAQ categories" className="mb-10">
        <ul className="flex flex-wrap gap-2">
          {groups.map(({ category }) => (
            <li key={category}>
              <a href={`#faq-${category}`} className="inline-flex min-h-[44px] items-center rounded-[length:var(--radius-pill)] bg-bone px-3 font-sans text-[14px] font-semibold text-primary hover:text-accent motion-safe:transition-[color] motion-safe:duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]">
                {CATEGORY_LABELS[category]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    ) : null}
    <div className="space-y-12">
      {groups.map(({ category, inCategory }) => (
        <section key={category} aria-labelledby={`faq-${category}`}>
          <h2 id={`faq-${category}`} className="nos-label scroll-mt-[62px] … md:scroll-mt-[74px]">…</h2>
          …unchanged list…
        </section>
      ))}
    </div>
  </>
);
```
Add a two-line note to the file header comment. Keep `ShowFaqList` a Server Component.

## Docs
`docs/nos-critique-r4.md`: cite R44-A3, record "no filter" and why, that per-answer TBC stays R41, the placement and nav-label decisions above, and the measured evidence.

## Checks (hash-locked in checks.sha256)
- check-footprint.mjs, check-static.mjs: red before implementation, green on the reference.
- check-rendered.mjs (needs `pnpm build`): 320/375/768/1280 as described in its header.
- check-faq-cap.mjs (faq route unchanged, 60ch caps intact; replaces the reused r2 six-route check). Existing and still green: nos-critique-r3/check-static-f2.mjs and check-rendered-f2.mjs (17px answers, FAQ included).

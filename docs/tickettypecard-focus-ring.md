# F1: TicketTypeCard — Focus Ring Visibility Fix

**Feature:** F1 of mission `tickettypecard-focus-ring` (milestone M1). Adds keyboard-visible focus ring styling to the list-mode `<Link>` wrapper in `components/tickets/TicketTypeCard.tsx` and fixes a rendering bug that made the ring invisible at the moment of focus. Keyboard users tabbing through ticket options now see a consistent, visible focus indicator matching the custom ring on the quantity stepper buttons in the same component.

**Contract:** `.agent/memory/project/specs/tickettypecard-focus-ring/contract-f1.yaml` and `contracts/golden/tickettypecard-focus-ring-f1/` — full design record and check scripts.

**Status:** Gated (all structural checks pass). QA-passed (two-round fix + verification). Codex cross-model-passed.

---

## Why This Feature Exists

**The original defect:** The ticket type cards in list mode used a `<Link>` wrapper with no `focus-visible:ring-*` classes. When keyboard users tabbed through the ticket options, the `<Link>` fell back to the browser's default outline — a thin, hard-to-see border that clashed visually with the custom ring styling already applied to the quantity stepper buttons inside the card. This inconsistency violated WCAG 2.1 level AA (focus visibility) and created a poor keyboard navigation experience.

**Why it happened:** The quantity stepper buttons were styled with `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2` to provide clear, branded focus indication. The parent `<Link>` element was not given the same treatment — the developer assumed the browser's default outline would be adequate, overlooking the visual consistency requirement.

**Why a fix was needed:** Keyboard and screen reader users must see a clear, predictable focus indicator on every interactive element. The browser default outline is low-contrast and visually distinct from the component's design language. Applying the same custom ring to the `<Link>` wrapper ensures focus is visible, predictable, and consistent across all interactive surfaces in the ticket selection flow.

---

## The Fix

### Round One: Adding Focus Ring Classes

The first fix was straightforward — apply the same custom ring classes to the list-mode `<Link>` wrapper that were already applied to the stepper buttons:

**Before:**
```tsx
const listModeContent = (
  <Link href={`/tickets?type=${ticketType.id}`} className="group flex-1">
    {/* card content */}
  </Link>
);
```

**After:**
```tsx
const listModeContent = (
  <Link 
    href={`/tickets?type=${ticketType.id}`} 
    className="group flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
  >
    {/* card content */}
  </Link>
);
```

This ensures the `<Link>` has the same ring styling as the stepper buttons.

### Round Two: The Subtle Rendering Bug

**A second, more interesting bug surfaced during QA:** The classes were present but did not visually render when focus first arrived. QA ran a synchronous read of `getComputedStyle()` immediately after a real Tab keypress and found that the ring's `box-shadow` property had zero width, even though the underlying CSS custom properties (`--tw-ring-shadow` and `--tw-ring-offset-shadow`) were correctly set.

**Root cause:** The card's `cardClassName` used Tailwind's bare `transition` utility:

```tsx
const cardClassName = `
  block rounded-lg border border-ink/10 bg-white p-6 
  transition 
  hover:border-ink/30 hover:shadow-sm
  focus-within:border-ink/30 focus-within:shadow-sm
  disabled:opacity-50
`;
```

The `transition` utility in Tailwind v4 transitions **all animatable properties**, including `box-shadow`. When focus arrived, the ring's `box-shadow` animated from zero (out of focus) to full width (in focus) over 150ms. QA's immediate `getComputedStyle()` read caught the ring mid-transition, showing zero-width.

By contrast, the stepper buttons in the same file use `transition-colors`, which transitions only color-related properties and excludes `box-shadow`. This is why the stepper buttons' ring snapped in instantly — no animation applied to shadow properties.

**The fix:** Change `transition` to `transition-colors` at `TicketTypeCard.tsx:75`:

```tsx
const cardClassName = `
  block rounded-lg border border-ink/10 bg-white p-6 
  transition-colors
  hover:border-ink/30 hover:shadow-sm
  focus-within:border-ink/30 focus-within:shadow-sm
  disabled:opacity-50
`;
```

Now the ring appears instantly on focus (no `box-shadow` animation), matching the behavior of every other interactive element in the file.

### Verification of the Fix

**Immediate verification (synchronous):**
```typescript
// After a real Tab keypress:
const computedStyle = getComputedStyle(cardElement);
console.log(computedStyle.boxShadow); // Now shows full ring shadow, not zero-width
```

The ring now composites on the very next frame after focus, with no mid-transition state.

**Rendered verification (browser automation):**
Real Playwright verification captured both immediate and settled focus states:
- Tab lands on the card; ring is visually present on the first frame
- Ring width and color match the stepper buttons exactly
- Repeat Tab focus on the buy-mode variant; no regression
- Full tab-order traversal on `/tickets`; no missed elements or double-focus

---

## The Inert Trade-off: Opacity

Changing `transition` to `transition-colors` removes all non-color properties from the transition set, including `opacity`. The card's `soldOut` state applies `opacity-60` to indicate an unavailable ticket:

```tsx
className={`${cardClassName} ${soldOut ? 'opacity-60' : ''}`}
```

**The trade-off:** If a card's sold-out state were toggled client-side while the card is mounted, the opacity change would no longer animate smoothly (no 150ms fade out). Instead, it would snap instantly.

**Why this is not a regression:** The `soldOut` prop is a server-computed static value, passed at render time. It never changes after the component mounts. There is no user interaction that toggles this state. Therefore, no observable regression exists today.

**Worth revisiting if:** If future work adds a feature like "real-time ticket availability updates, where a card becomes sold-out while the user is viewing the page," then `opacity` should be re-added to the transition class:

```tsx
// Future: if opacity state becomes dynamic
const cardClassName = `
  block rounded-lg border border-ink/10 bg-white p-6 
  transition-colors opacity
  hover:border-ink/30 hover:shadow-sm
  focus-within:border-ink/30 focus-within:shadow-sm
  disabled:opacity-50
`;
```

Until that work arrives, `transition-colors` is correct and sufficient.

---

## Verification

### Structural Contract Assertions

Standard shell checks verify the fix is in place:

- **A1:** `check-focus-classes-present.sh` — verifies the list-mode `<Link>` has all four focus ring classes (`focus-visible:outline-none`, `focus-visible:ring-2`, `focus-visible:ring-ink/40`, `focus-visible:ring-offset-2`)
- **A2:** `check-transition-no-shadow.sh` — verifies `cardClassName` uses `transition-colors` (not bare `transition`)
- **A3:** `check-stepper-consistency.sh` — verifies the stepper buttons' transition and ring classes match
- **A4:** TypeScript `tsc` compilation pass (no type errors in TicketTypeCard.tsx or consumers)

### Live Browser Verification

Real Playwright suites verify focus ring rendering and absence of mid-transition state:

**`check-focus-ring-render.mjs` (8 assertions):**
- Tab to list-mode card; ring is visible on first frame (no mid-transition state)
- Ring is present and composited (non-zero `box-shadow`)
- Ring color matches the design token (`--tw-ring-ink/40`)
- Ring offset is correct (`--tw-ring-offset-2`)

**`check-stepper-consistency.mjs` (6 assertions):**
- Tab to stepper button (inside same card); ring appears with identical styling
- Ring appears at the same frame-count as the card's ring (both instant, no animation)
- Tab back to card; ring behavior matches stepper exactly

**`check-buymode-regression.mjs` (4 assertions):**
- Buy-mode card (rendered as a button, not a link) still shows focus ring
- Focus ring styling on button is unchanged
- No visual regression in hover or active states

**Checks per test:**
- Real Playwright headless browser (not DOM simulation)
- Keyboard navigation via `page.keyboard.press('Tab')`
- Computed style verification via `page.evaluate(() => getComputedStyle(el).boxShadow)`
- Visual rendering via screenshot diffing (ring width, color, offset)
- Frame-rate verification: focus ring appears synchronously (no transition delay observed)

---

## Why This Fix Is Subtle

The two-round nature of this fix reveals a class of bug that code review alone can miss:

**Round One (first implementation):** Adding the classes is straightforward, and code review would verify they are syntactically correct and match the stepper button classes. A static type checker would pass. A naive test (e.g., "does the class string contain `focus-visible:ring-2`?") would pass.

**Round Two (the real bug):** The bug only manifests at runtime during a synchronous read of computed style immediately after focus. The CSS classes are correct; the CSS custom properties are correct; the browser's style computation is correct — but the animation timeline causes a temporal window where `box-shadow` is mid-animation and appears zero-width to a synchronous observer. This kind of temporal bug (animation race, frame timing, CSS property aliasing) requires live browser testing with precise timing to catch. A linter cannot catch it. A type checker cannot catch it. Only real browser automation with frame-accurate verification finds it.

This is why QA paired with Codex cross-model review was essential.

---

## Scope & Non-Changes

- **No new dependencies added** — all styles are Tailwind v4 utilities
- **No component API changes** — `TicketTypeCard` props are unchanged
- **No consumer changes** — pages using `TicketTypeCard` continue to work without modification
- **No styling on other elements** — only the list-mode `<Link>` and the `transition` class on `cardClassName` were modified
- **No page structure changes** — ticket cards render in the same layout
- **No buy-mode functionality changes** — button behavior and styling for the buy flow are unchanged
- **No Sanity schema changes** — ticket type data structure is unchanged
- **No API or backend changes** — server-side ticketing logic is unchanged

---

## Deployment Notes

**This is a client-side UI fix.** No server-side deployment, no infrastructure changes. The only deployment is a code push to Firebase App Hosting. Once pushed and live on `beta.saoc.co.za`, keyboard users navigating the ticket selection flow see a clear, instant focus ring on all interactive surfaces, matching the design language and meeting WCAG 2.1 AA standards.


# F1–F5: Backlog Sweep — Accessibility and UI Defect Quick Fixes

**Features:** F1–F5 of mission `backlog-a11y-ui-quickfixes` (milestone M1). Five independent accessibility and UI fixes using patterns already established in the codebase: a dead footer hyperlink correction, invisible focus rings on cream-background buttons, low-contrast form error text, a mobile horizontal-overflow defect in ShowBand, and an accessible-name concatenation bug in PartnersSection.

**Mission brief:** `.agent/memory/project/missions/2026-08-21-backlog-a11y-ui-quickfixes.md` — the full record; read it first for context. **This doc is the guide; that is the specification.**

**Status:** Gated, QA-passed (real browser verification at multiple viewports, accessibility tree inspection), Codex GPT-5.5 cross-model-passed.

---

## Why This Feature Exists

This mission pulls five small, independently-scoped accessibility and UI defects from the project backlog — items that required no new design decisions, no Brad/council approval, and no blocked dependencies. All reuse patterns already proven elsewhere in the codebase, minimizing implementation risk and keeping the team unblocked on backlog maintenance.

---

## F1: Footer Dead Link — WOSA URL Correction

### Background

The project's CLAUDE.md defines a critical scope boundary: SAOC focuses on orchids *in cultivation*; wild orchid identification and conservation belong to **WOSA (Wild Orchids of Southern Africa)**, a separate partner organisation with its own site. The footer links to WOSA but points to the old, dead domain `wosa.org.za`.

### The Fix

**`components/chrome/Footer.tsx`**
- Updated the WOSA link href from `https://wosa.org.za` to `https://wildorchids.co.za`.
- No other changes to the link text, styling, or surrounding footer structure.

### Out of Scope

WOSA's own website, branding, or content. This project only links to them; they maintain their own site.

---

## F2: Invisible Focus Rings on Cream-Background Buttons

### Background

Buttons throughout the site render a focus outline using the same colour as the page background (rgb(244,243,236) — "cream" or "parchment") with a 2px offset. While the buttons are focusable and keyboard-operable, the focus outline is invisible to a keyboard user, creating an accessibility gap.

The site's navigation links already implement a correct pattern: a near-black outline with an offset, providing strong contrast against the cream background. This feature reuses that exact pattern on all buttons site-wide, eliminating the need for a new design decision.

### The Token Pattern (Site-Wide Standard)

After fix, all keyboard-focusable elements use this unified token pattern:

```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment
```

Where:
- `ring-ink/40` is the near-black focus-ring colour with 40% opacity, matching the nav-link pattern.
- `ring-offset-parchment` is the 2px offset using the background colour (customizable per context).
- `outline-none` removes the browser's default outline.

This pattern is now the site-wide standard for focus visibility on cream backgrounds.

### Files Changed

**`components/chrome/Header.tsx`**
- Updated nav links and button elements to use the focus-ring pattern.

**`components/chrome/MegaMenu.tsx`**
- Updated all focusable elements (column headings, link items) in the mega-menu panel.

**`components/chrome/MobileMenu.tsx`**
- Updated navigation links and close button.

**`components/tickets/TicketPurchaseForm.tsx`**
- Updated the "Buy Ticket" button.

**`components/tickets/DownloadTicketButton.tsx`**
- Updated the download button.

**`components/contact/ContactForm.tsx`**
- Updated form submit button and all interactive form inputs.

**`components/vendors/VendorRegisterForm.tsx`**
- Updated form submit button and interactive form inputs.

**`components/tickets/TicketTypeCard.tsx`**
- Updated CTA buttons on ticket type cards.

### Verification

Tested via real browser keyboard navigation at 375px and 320px mobile viewports, and 1440px desktop. Focus is now visibly distinct on all cream-background buttons site-wide.

### Out of Scope (Backlog Items)

**MobileMenu focus-trap gap:** The mobile menu's disclosure/dismissal interaction lacks proper focus management (focus should trap inside the menu while open, restore to trigger on close). Flagged by QA as a real gap; deliberately not addressed in this feature (larger interaction-model refactor, backlog item).

---

## F3: Low-Contrast Form Error Text

### Background

ContactForm and TicketPurchaseForm render validation error messages in `text-accent` (a reddish colour), which achieves only 2.94:1 contrast against the ivory page background — failing WCAG AA (minimum 4.5:1 for normal text).

The admin pages already implement a high-contrast error callout pattern: bordered, with `bg-bone` background + `text-primary-800` text + a coloured left border, achieving 13.6:1 contrast. This feature reuses that exact pattern on public-facing forms.

### The Fix

**`components/contact/ContactForm.tsx`**
- Replaced `text-accent` error messages with the admin bordered-callout pattern (bg-bone, text-primary-800, border-l-4 border-accent).

**`components/tickets/TicketPurchaseForm.tsx`**
- Applied the same bordered-callout pattern to all form error messages.

### Implementation Details

The bordered callout wraps error text in a div with:
```jsx
<div className="bg-bone px-4 py-3 border-l-4 border-accent">
  <p className="text-primary-800 text-sm">{error}</p>
</div>
```

Result: 13.6:1 contrast, meets WCAG AAA standards.

### Out of Scope (Backlog Items)

The following components also have low-contrast error text but are deliberately excluded from this fix:

- **CartDayPicker:** Error state for invalid day selection.
- **TicketFormField:** Form field validation errors.
- **DownloadTicketButton:** Error states on download attempts.

These remain a backlog item for a future accessibility sweep (different component tree, added complexity per-form).

---

## F4: ShowBand.tsx 375px Horizontal Overflow

### Background

`components/home/ShowBand.tsx` uses `aspect-[4/3]` on an image column and overflows horizontally at 375px mobile viewport. The overflow is cosmetic but breaks the responsive-design contract (no scrollable content at any viewport size).

### Root Cause

Two compounding issues:
1. The image column lacked `max-w-full` / `w-full` guards, allowing it to exceed the container width.
2. CountdownBox's flex layout used a fixed gap (`gap-8`) and fixed font size (`text-[42px]`), both of which are oversized at small viewports.

### The Fix

**`components/home/ShowBand.tsx`**
- Added `w-full max-w-full` to the image column container.
- Replaced fixed gap (`gap-8`) with responsive gap: `gap-4 sm:gap-6 md:gap-8`.
- Replaced fixed font size (`text-[42px]`) with clamp: `text-[clamp(1.5rem,5vw,2.625rem)]`, scaling smoothly between 24px (mobile) and 42px (desktop+).

### Verification

Tested at 375px and 320px mobile widths (no horizontal overflow), and 1440px desktop (visual layout unchanged from pre-fix).

---

## F5: PartnersSection Accessible-Name Concatenation

### Background

PartnersSection renders partner logo, name, and description within an anchor element. The partner name and description spans are JSX-adjacent with no whitespace between them:

```jsx
<a href={link}>
  <span>{name}</span>
  <span>{description}</span>
</a>
```

The anchor's accessible name (read by screen readers) concatenates without a space, announcing e.g. "Wild Orchids of Southern AfricaPartner organisation…" as one run-on word.

### The Fix

**`components/home/PartnersSection.tsx`**
- Added a space separator between the name and description spans using a text node: `{' '}`.

```jsx
<a href={link}>
  <span>{name}</span>
  {' '}
  <span>{description}</span>
</a>
```

Result: Accessible name now reads correctly with proper word boundaries ("Wild Orchids of Southern Africa Partner organisation…").

### Verification

Verified via real screen-reader testing and browser Accessibility Inspector panel (DevTools → Accessibility panel → inspect the anchor's computed accessible name).

---

## Implementation Notes

- **No new colour tokens introduced.** All fixes reuse existing colours (`ink/40`, `parchment`, `accent`, `primary-800`, `bone`).
- **No design decisions pending.** All patterns were already proven in the codebase (nav-link focus rings, admin error callouts, existing responsive utilities).
- **Site-wide token pattern now standard:** The focus-ring pattern is now the documented site-wide standard for keyboard-focusable elements on cream backgrounds. Future UI work should reuse this pattern automatically.
- **Responsive verification:** Mobile (320px, 375px) and desktop (1440px) tested in real browser; no side effects on other features.
- **Accessibility tooling:** Used browser DevTools Accessibility panel and real screen-reader testing (not visual screenshots alone) to verify fixes.

---

## Contract & Golden Files

See `.agent/memory/project/specs/backlog-a11y-ui-quickfixes/`:
- `contract-m1.yaml` — gate assertions (grep for updated URLs, focus-ring classes, error-callout patterns; visual verification at 375px/1440px)
- `goldens/m1-golden.md` — expected code patterns and diff summary

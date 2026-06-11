# A9 — Google Fonts via next/font

Fonts are loaded through `next/font/google` rather than a CSS `@import` pointing at fonts.googleapis.com. At build time Next.js downloads the font files, self-hosts them, and injects the `@font-face` rules. There is no external network request at page load, no render-blocking stylesheet, and no layout shift.

## Font stack

| Font | Role | CSS variable (next/font) |
|---|---|---|
| Crimson Pro | Heading / serif | `--font-serif` |
| Manrope | Body / sans-serif | `--font-sans` |
| JetBrains Mono | Code / monospace | `--font-mono` |

Weights loaded: Crimson Pro 400–700 (normal + italic); Manrope 400–700; JetBrains Mono 400–500.

## How to use fonts in components

**Tailwind utility classes** (preferred — via `@theme` aliases in `globals.css`):

```tsx
<h1 className="font-heading">National Show</h1>
<p className="font-body">Body copy here.</p>
<code className="font-code">const x = 1;</code>
```

**CSS custom properties** (for styles written in CSS modules or inline):

```css
.my-element {
  font-family: var(--serif);   /* Crimson Pro + fallbacks */
  font-family: var(--sans);    /* Manrope + fallbacks */
  font-family: var(--mono);    /* JetBrains Mono + fallbacks */
}
```

The `--serif / --sans / --mono` properties are defined in `app/globals.css` and compose the next/font injection variable with system fallbacks, so they work even before the font file loads.

## What changed

`app/layout.tsx` imports three constructors from `next/font/google`, calls each with a `variable` name and desired weights, then spreads the resulting `.variable` class strings onto `<html>`. This injects the CSS custom properties (`--font-serif` etc.) into the document root.

`app/globals.css` adds two layers on top:

- `:root` block — `--serif`, `--sans`, `--mono` aliases that reference the next/font variables plus system fallbacks.
- `@theme` block — `--font-heading`, `--font-body`, `--font-code` entries that expose the stacks as Tailwind v4 utility classes (`font-heading`, `font-body`, `font-code`).

## Why next/font instead of a stylesheet link

A `<link>` to fonts.googleapis.com is render-blocking: the browser cannot paint text until the external stylesheet resolves. `next/font` eliminates this by downloading the font files at build time, serving them from the same origin, and generating the `@font-face` rules statically. Combined with `display: swap`, text renders immediately in the fallback font and transitions to the web font with zero cumulative layout shift.

## Adding a new font

Import the font constructor from `next/font/google` in `app/layout.tsx`, call it with `subsets`, `variable`, `display: 'swap'`, and the weights you need, then add the `.variable` class to the `<html>` element's `className`. Finally, add a `--font-<name>` entry to the `@theme` block in `globals.css` to expose it as a Tailwind utility class.

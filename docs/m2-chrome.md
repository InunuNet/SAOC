# M2 — Global Chrome

## Components

| Component            | Description                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `UtilityBar.tsx`     | Dark primary-800 top bar: email left, two pill CTAs right (no centre tagline)                     |
| `Header.tsx`         | Sticky parchment header: 3-zone layout (logo / nav / actions), scroll shadow, keyboard shortcuts  |
| `MobileMenu.tsx`     | Right-slide dialog: 6 nav items, "Soon" chip on Learn, Lucide X close                             |
| `SearchOverlay.tsx`  | 680px centered search panel: live filter for societies and events, 5-item empty-state suggestions |
| `Footer.tsx`         | 4-col dark footer: col1 stacked logo lockup, col2 Explore nav, col3 Partners, col4 "Stay in touch" email form + WOSA link; bottom bar: Constitution + Media kit |
| `NewsletterForm.tsx` | Client subcomponent extracted from Footer; owns the newsletter input and submit                   |
| `Breadcrumb.tsx`     | Mono breadcrumb trail: Home-first, `aria-current` on last item                                    |

## Server / Client Split

| Component        | Rendering | Reason                                                               |
| ---------------- | --------- | -------------------------------------------------------------------- |
| `UtilityBar`     | Server    | Static markup; no interactivity                                      |
| `Header`         | Client    | Scroll listener, keyboard shortcut `useEffect`, search overlay state |
| `MobileMenu`     | Client    | Dialog open/close state                                              |
| `SearchOverlay`  | Client    | Live-filter state, keyboard Esc handler                              |
| `Footer`         | Server    | Static links; newsletter form extracted to its own client component  |
| `NewsletterForm` | Client    | Controlled input + submit handler                                    |
| `Breadcrumb`     | Server    | Reads `pathname` at request time via props; no browser APIs needed   |

Keeping heavy layout pieces (`UtilityBar`, `Footer`, `Breadcrumb`) as server components means zero JS shipped for those subtrees.

## Using Chrome Components

Import from the barrel:

```ts
import { Header, Footer, UtilityBar, Breadcrumb } from '@/components/chrome';
```

All seven components are re-exported from `components/chrome/index.ts`.

`app/layout.tsx` wires the full shell:

```tsx
<UtilityBar />
<Header />
{children}
<Footer />
```

To add `Breadcrumb` to an interior page (will be wired in M4):

```tsx
import { Breadcrumb } from '@/components/chrome';

// Pass an array of { label, href } crumbs; the last item gets aria-current="page"
<Breadcrumb crumbs={[{ label: 'Societies', href: '/societies' }, { label: 'SAOC' }]} />;
```

## Keyboard Shortcuts (SearchOverlay)

| Key                | Action                                              |
| ------------------ | --------------------------------------------------- |
| `Cmd+K` / `Ctrl+K` | Open search overlay                                 |
| `/`                | Open search overlay (when focus is not in an input) |
| `Esc`              | Close search overlay                                |
| Backdrop click     | Close search overlay                                |

The event listener lives in `Header.tsx` inside a `useEffect` on mount/unmount. It calls `setSearchOpen(true)` which renders `<SearchOverlay />`.

## Breakpoints

| Breakpoint   | Behaviour                                                                |
| ------------ | ------------------------------------------------------------------------ |
| < 900px      | `UtilityBar` collapses to email + brass pill only                        |
| < 1180px     | Header nav links and Sign In hidden; hamburger shown, opens `MobileMenu` |
| < sm (640px) | Logo wordmark hidden; logo mark only                                     |

## Design Tokens Used

Tokens are defined in `app/globals.css` under `:root` / `@theme`.

| Token           | Used in                                      |
| --------------- | -------------------------------------------- |
| `--primary-800` | `UtilityBar` background, `Footer` background |
| `--parchment`   | `Header` background                          |
| `--bone`        | Secondary backgrounds, hover states          |
| `--rule`        | Divider lines                                |
| `--accent`      | CTA pill backgrounds, active states          |
| `--ivory`       | Light text on dark backgrounds               |
| `--muted`       | Subdued labels, "Soon" chip text             |

Typography: `font-mono` for meta text (breadcrumb, utility bar email); `font-serif` for the logo wordmark. `font-semibold` (600) on the Header wordmark.

## Known Limitations / Next Steps

- `Breadcrumb` is built but not yet wired — deferred to M4 (interior page routes).
- `NewsletterForm` has no API endpoint; submit is a no-op — deferred to F10.
- Sign In link points to `/signin`; that route does not exist yet.
- `MobileMenu` "Learn" item is disabled with a "Soon" chip until the Learn section is built.

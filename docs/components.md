# SAOC Component Reference

---

## PageHero

**File:** `components/ui/PageHero.tsx`  
**Type:** Server Component

Full-bleed interior-page hero with a background image, gradient overlay, eyebrow label, heading, and optional lede text.

### Props

| Prop        | Type        | Required | Default   | Description                                               |
| ----------- | ----------- | -------- | --------- | --------------------------------------------------------- |
| `image`     | `string`    | yes      | —         | Absolute path to the hero image (served from `public/`)   |
| `eyebrow`   | `string`    | yes      | —         | Short label rendered above the heading in monospaced caps |
| `heading`   | `ReactNode` | yes      | —         | Page title; accepts JSX for inline emphasis               |
| `lede`      | `string`    | no       | —         | One-sentence sub-heading rendered below the title         |
| `minHeight` | `string`    | no       | `'480px'` | CSS value applied as `style.minHeight` on the section     |

### Usage

```tsx
import { PageHero } from '@/components/ui/PageHero';

<PageHero
  image="/images/orchid-purple.jpg"
  eyebrow="Our Heritage"
  heading={
    <>
      A federated body of <em className="not-italic italic text-accent-soft">growers</em>, since
      1968.
    </>
  }
  lede="Four societies met in Bloemfontein in 1968 to form a national council."
/>;
```

**Tailwind v4 note:** `[&_em]:` parent-selector variants do not work in Tailwind v4. Apply `className` directly to the `<em>` element as shown above.

---

## AboutPage

**File:** `app/(marketing)/about/page.tsx`  
**Type:** Server Component (Next.js page)

Renders the "About SAOC — Our Heritage" marketing page.

### Data dependencies

| Import         | Source       |
| -------------- | ------------ |
| `boardMembers` | `@/lib/data` |

### Sections (in render order)

1. **PageHero** — full-bleed hero (`/images/orchid-purple.jpg`, eyebrow "Our Heritage")
2. **Origin story** — two-column prose + photo covering the 1968 Bloemfontein founding
3. **Pillars** — three-card grid (Mission / Vision / Our remit) sourced from the inline `PILLARS` constant
4. **Board grid** — responsive card grid from `boardMembers`; avatar uses initials derived by the local `initials()` helper (strips `Dr.`/`Prof.` prefixes, takes first two word initials)
5. **Timeline** — dark-background horizontal milestone list sourced from the inline `TIMELINE` constant (1968–2027)

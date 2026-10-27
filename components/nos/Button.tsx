// =============================================================
// NOS — components/nos/Button.tsx
// Server Component — no local state, safe to render from either a Server or
// a Client Component tree (a parent 'use client' file may still pass an
// onClick handler as a prop).
//
// Variants (guardrail 5 — restraint scales with transaction risk):
//   primary  — royal purple fill, pale-gold text. The conventional, highest-
//              contrast action on a light ground.
//   on-dark  — pale-gold fill, royal-purple text. The conventional action on
//              a royal-purple or night ground. Never the reverse (pale gold
//              on white is forbidden; olive is never a button fill).
//   ghost    — transparent, --border-primary primary-colour border. Secondary
//              action on a light ground.
//   ghost-on-dark
//            — transparent, --border-primary pale-gold border, pale-gold
//              label. The secondary action on a royal-purple, night or
//              photographic ground, where `ghost` (primary border + ink text)
//              is illegible. Same padding and type as every other variant, so
//              a filled and an outlined action carry equal weight (R2/D3.5).
//
// Radius is --radius-button (10px, nos-structure.css) on every variant — R17: buttons are 10px,
// and pill radius is reserved for eyebrow pills.
//
// Focus ring colour follows the *ground the ring sits on*, not the control's
// own fill (R9/3): outline-offset places the ring outside the button, so an
// on-dark variant's ring lands on the dark ground and must be pale gold.
//
// F2 (Codi, 2026-09-29): the touch-target floor is fixed once here rather than per
// call site — this is the one shared component behind every button on every
// NOS/show page. nos-own-brand-chrome F2 (R14, mock `.btn`, index.html:101-107):
// Karla 700, 14px, .12em, uppercase, min-height 50px; `data-nos-button` marks the
// root for the F2 checks.
// =============================================================

import type { ComponentPropsWithoutRef, ElementType } from 'react';

export type NosButtonVariant = 'primary' | 'ghost' | 'on-dark' | 'ghost-on-dark';

const VARIANT_CLASSES: Record<NosButtonVariant, string> = {
  primary: 'bg-primary text-ivory hover:bg-primary-800',
  ghost:
    'border-[length:var(--border-primary)] border-primary text-ink bg-transparent hover:bg-primary/5',
  'on-dark': 'bg-bone text-primary hover:bg-white',
  'ghost-on-dark':
    'border-[length:var(--border-primary)] border-[var(--ivory)] text-ivory bg-transparent hover:bg-[var(--ivory)]/10',
};

/** Variants rendered against a dark ground, where R9/3 requires a pale ring. */
const ON_DARK_VARIANTS: ReadonlySet<NosButtonVariant> = new Set([
  'on-dark',
  'ghost-on-dark',
]);

// `as` is typed `E` itself (not the widened `ElementType`) so JSX can infer
// `E` from the value actually passed to `as` — e.g. `<Button as={Link}
// href="...">` infers E = typeof Link and type-checks `href` against it.
// Widening `as` to plain `ElementType` (an earlier version of this file did)
// breaks that inference: TS falls back to the default 'button' and every
// `as={Link} href="..."` call site fails to type-check.
interface NosButtonOwnProps<E extends ElementType> {
  variant?: NosButtonVariant;
  /** Polymorphic root — `a` for navigation, `button` (default) for actions. */
  as?: E;
}

export type NosButtonProps<E extends ElementType = 'button'> = NosButtonOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof NosButtonOwnProps<E>>;

export function Button<E extends ElementType = 'button'>(props: NosButtonProps<E>) {
  // Narrowed to the 'button' shape for the implementation only: the public
  // signature stays generic over `E` (so callers passing `as={Link}` get
  // `href` etc. type-checked), but the render body itself only needs the
  // common own-props plus an untyped rest spread onto the polymorphic Root.
  const {
    variant = 'primary',
    as,
    className = '',
    children,
    ...rest
  } = props as NosButtonProps<'button'>; // narrowing cast, see comment above
  const Root = (as ?? 'button') as ElementType; // widen back for JSX's sake

  return (
    <Root
      data-nos-button=""
      className={[
        'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[length:var(--radius-button)] px-[26px] py-[14px]',
        'font-sans text-[14px] font-bold uppercase leading-none tracking-[0.12em] transition-colors',
        'duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        ON_DARK_VARIANTS.has(variant)
          ? 'focus-visible:outline-[var(--ring-focus-on-dark)]'
          : 'focus-visible:outline-[var(--ring-focus)]',
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Root>
  );
}

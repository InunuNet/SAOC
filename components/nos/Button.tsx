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
//   ghost    — transparent, 1.5px primary-colour border. Secondary action.
// =============================================================

import type { ComponentPropsWithoutRef, ElementType } from 'react';

export type NosButtonVariant = 'primary' | 'ghost' | 'on-dark';

const VARIANT_CLASSES: Record<NosButtonVariant, string> = {
  primary: 'bg-primary text-ivory hover:bg-primary-800',
  ghost:
    'border-[1.5px] border-primary text-ink bg-transparent hover:bg-primary/5',
  'on-dark': 'bg-bone text-primary hover:bg-white',
};

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
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[length:var(--radius-pill)] px-6 py-3',
        'font-sans text-[15px] font-medium leading-none transition-colors',
        'duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--ring-focus)]',
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

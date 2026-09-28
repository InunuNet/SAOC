'use client';

// =============================================================
// NOS — components/nos/NosMasthead.tsx
// Client Component (reads the current pathname). Route-scopes the NOS
// masthead band: Brad's "retire the band above the hero" instruction
// (R12/R23) names `/national-show` — its own hero now carries the supplied
// lockup artwork, which makes the band above it redundant there. The other
// eighteen routes under `app/(marketing)/national-show/layout.tsx` (about,
// archive, conferences, exhibitors, faq, international-guests,
// plan-your-visit, programme, sa-exhibitors, sponsors, symposium, tickets,
// vendors, what-to-expect, workshops, wosa-conference, plus the show
// sub-pages) still need it, unchanged — see hero-structure.md §2. This
// component is the switch; `layout.tsx` renders it in place of the old
// inline `<header>` and touches nothing else.
// =============================================================

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { Logo } from '@/components/nos/Logo';

export function NosMasthead() {
  const pathname = usePathname();

  // Exact match only — a prefix match would also hide the band on every
  // route nested under `/national-show`, which is the eighteen routes this
  // component exists to keep it on.
  if (pathname === '/national-show') {
    return null;
  }

  return (
    <header
      data-nos-masthead=""
      className="border-b-[length:var(--border-hairline)] border-[var(--rule)] bg-parchment"
    >
      <div className="mx-auto max-w-[1280px] px-8 py-6">
        {/* Links to the show's own landing page. The lockup's wordmark text is
            the link's accessible name, so it needs no extra label. */}
        <Link href="/national-show" className="inline-block">
          <Logo orientation="responsive" tone="light" />
        </Link>
      </div>
    </header>
  );
}

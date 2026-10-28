import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { NosHero } from '@/components/nos/NosHero';

// Below 480px the three links stack at full width, 48px tall; the Button's own 50px floor stays above.
const LINK_CLASS = 'w-full max-[479px]:min-h-[48px]! min-[480px]:w-auto';

// A route hero-photos.ts has no photograph for, so NosHero renders its typographic variant: NOS black,
// the h1 in the serif at weight 300, no image (NOS Design G6).
const NOT_FOUND_HERO_ROUTE = '/national-show/not-found';

// R63: the not-found for every NOS route, rendered inside the NOS chrome and `.nos-theme`. Copy is the
// SAOC root not-found copy (app/not-found.tsx) minus its second sentence, which points at SAOC society
// links this page does not carry. Link labels are the nav-config labels, in the hero's R67 order:
// Tickets (primary), National Show, Plan your visit.
export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you’re looking for doesn’t exist or may have moved.',
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export function NosPageNotFound() {
  return (
    <NosHero
      route={NOT_FOUND_HERO_ROUTE}
      title="This orchid has left the bench."
      lede="The page you’re looking for doesn’t exist or may have moved."
      crumbs={
        <span className="nos-hero-eyebrow">
          404 — Page not found
        </span>
      }
      actions={
        <>
          <Button as={Link} href="/tickets" variant="on-dark" className={LINK_CLASS}>
            Tickets
          </Button>
          <Button as={Link} href="/" variant="ghost-on-dark" className={LINK_CLASS}>
            National Show
          </Button>
          <Button as={Link} href="/plan-your-visit" variant="ghost-on-dark" className={LINK_CLASS}>
            Plan your visit
          </Button>
        </>
      }
    />
  );
}

export default function NationalShowNotFound() {
  return <NosPageNotFound />;
}

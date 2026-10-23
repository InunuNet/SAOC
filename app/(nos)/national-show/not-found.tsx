import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { NosSection } from '@/components/nos/NosSection';

// Below 480px the three links stack at full width, 48px tall; the Button's own 50px floor stays above.
const LINK_CLASS = 'w-full max-[479px]:min-h-[48px]! min-[480px]:w-auto';

// R63: the not-found for every /national-show/* route, rendered inside the NOS chrome and
// `.nos-theme`. Copy is the SAOC root not-found copy (app/not-found.tsx) minus its second
// sentence, which points at SAOC society links this page does not carry. Link labels are the
// nav-config labels, in the hero's R67 order: Tickets (primary), National Show, Plan your visit.
export const metadata: Metadata = {
  title: 'Page not found',
  description: 'The page you’re looking for doesn’t exist or may have moved.',
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default function NationalShowNotFound() {
  return (
    <NosSection>
      <div className="flex flex-col gap-3">
        <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          404 — Page not found
        </span>
        <h1 className="nos-opsz-fluid font-serif tracking-[-0.015em] text-[clamp(28px,3.6vw,44px)] leading-[1.1] text-ink">
          This orchid has left the bench.
        </h1>
        <p className="max-w-[58ch] font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-muted">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:gap-4">
        <Button as={Link} href="/tickets" variant="primary" className={LINK_CLASS}>
          Tickets
        </Button>
        <Button as={Link} href="/" variant="ghost" className={LINK_CLASS}>
          National Show
        </Button>
        <Button
          as={Link}
          href="/plan-your-visit"
          variant="ghost"
          className={LINK_CLASS}
        >
          Plan your visit
        </Button>
      </div>
    </NosSection>
  );
}

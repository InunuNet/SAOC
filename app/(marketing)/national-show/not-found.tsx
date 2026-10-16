import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { NosSection } from '@/components/nos/NosSection';

// R63: the not-found for every /national-show/* route, rendered inside the NOS chrome and
// `.nos-theme`. Copy is the SAOC root not-found copy (app/not-found.tsx) minus its second
// sentence, which points at SAOC society links this page does not carry. Link labels are the
// nav-config labels.
export default function NationalShowNotFound() {
  return (
    <NosSection>
      <div className="flex flex-col gap-3">
        <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          404 — Page not found
        </span>
        <h1 className="nos-opsz-fluid font-serif text-[clamp(28px,3.6vw,44px)] leading-[1.1] text-ink">
          This orchid has left the bench.
        </h1>
        <p className="max-w-[58ch] font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-muted">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <Button as={Link} href="/national-show" variant="ghost">
          National Show
        </Button>
        <Button as={Link} href="/national-show/tickets">
          Tickets
        </Button>
        <Button as={Link} href="/national-show/plan-your-visit" variant="ghost">
          Plan your visit
        </Button>
      </div>
    </NosSection>
  );
}

import type { Metadata } from 'next';

import { LegalBody } from '@/components/legal/LegalBody';
import { LegalHero } from '@/components/nos/LegalHero';
import { WEBSITE_TERMS } from '@/content/legal/terms';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Terms of Use',
  description: 'Terms of use for the South African Orchid Council website.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <LegalHero
        route="/terms"
        image="/images/orchid-violet.jpg"
        eyebrow="Legal"
        heading={WEBSITE_TERMS.title}
      />
      <div className="nos-section nos-legal">
        <LegalBody document={WEBSITE_TERMS} />
      </div>
    </>
  );
}

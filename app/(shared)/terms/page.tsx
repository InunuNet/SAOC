import type { Metadata } from 'next';

import { LegalBody } from '@/components/legal/LegalBody';
import { PageHero } from '@/components/ui/PageHero';
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
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Legal"
        heading={WEBSITE_TERMS.title}
      />
      <LegalBody document={WEBSITE_TERMS} />
    </>
  );
}

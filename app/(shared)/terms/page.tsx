import type { Metadata } from 'next';

import { LEGAL_HERO_MIN_HEIGHT, LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { LegalHero } from '@/components/nos/LegalHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
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
        eyebrow="Legal"
        breadcrumbLabel="Terms of Use"
        image="/images/orchid-violet.jpg"
        heading={WEBSITE_TERMS.title}
        minHeight={LEGAL_HERO_MIN_HEIGHT}
      />
      <DocumentLayout index={legalIndex(WEBSITE_TERMS)}>
        <LegalBody document={WEBSITE_TERMS} />
      </DocumentLayout>
    </>
  );
}

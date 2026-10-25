import type { Metadata } from 'next';

import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
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
      <LegalBreadcrumb label="Terms of Use" />
      <PageHero
        image="/images/orchid-violet.jpg"
        heading={WEBSITE_TERMS.title}
      />
      <DocumentLayout index={legalIndex(WEBSITE_TERMS)}>
        <LegalBody document={WEBSITE_TERMS} />
      </DocumentLayout>
    </>
  );
}

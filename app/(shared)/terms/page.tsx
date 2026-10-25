import type { Metadata } from 'next';

import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { LEGAL_HERO_MIN_HEIGHT, LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { RouteHero } from '@/components/ui/RouteHero';
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
      <RouteHero
        route="/terms"
        heading={WEBSITE_TERMS.title}
        minHeight={LEGAL_HERO_MIN_HEIGHT}
      />
      <DocumentLayout index={legalIndex(WEBSITE_TERMS)}>
        <LegalBody document={WEBSITE_TERMS} />
      </DocumentLayout>
    </>
  );
}

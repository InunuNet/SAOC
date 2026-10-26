import type { Metadata } from 'next';

import { LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { NosHero } from '@/components/nos/NosHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { PageHero } from '@/components/ui/PageHero';
import { WEBSITE_TERMS } from '@/content/legal/terms';
import { buildPageMetadata } from '@/lib/seo';
import { requestSite } from '@/lib/request-site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Terms of Use',
  description: 'Terms of use for the South African Orchid Council website.',
  path: '/terms',
});

const PAGE_LABEL = 'Terms of Use';

// On the NOS host the hero is the NOS one with its own breadcrumb (NL-1: the h1 is the page's label,
// the document's full title is its lede); the SAOC host keeps its breadcrumb and PageHero.
export default async function TermsPage() {
  const nos = (await requestSite()) === 'nos';
  return (
    <>
      {nos ? (
        <NosHero
          route="/terms"
          title={PAGE_LABEL}
          crumbLabel={PAGE_LABEL}
          lede={WEBSITE_TERMS.title}
          priority
        />
      ) : (
        <>
          <LegalBreadcrumb label={PAGE_LABEL} />
          <PageHero image="/images/orchid-violet.jpg" heading={WEBSITE_TERMS.title} />
        </>
      )}
      <DocumentLayout index={legalIndex(WEBSITE_TERMS)}>
        <LegalBody document={WEBSITE_TERMS} />
      </DocumentLayout>
    </>
  );
}

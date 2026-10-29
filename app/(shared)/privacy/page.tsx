import type { Metadata } from 'next';

import { LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { NosHero } from '@/components/nos/NosHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { RouteHero } from '@/components/ui/RouteHero';
import { PRIVACY_POLICY } from '@/content/legal/privacy';
import { buildPageMetadata } from '@/lib/seo';
import { requestSite } from '@/lib/request-site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description: 'Privacy policy for the South African Orchid Council website.',
  path: '/privacy',
});

const PAGE_LABEL = 'Privacy Policy';

// On the NOS host the hero is the NOS one with its own breadcrumb (NL-1: the h1 is the page's label,
// the document's full title heads the policy text); the SAOC host keeps its breadcrumb and PageHero.
export default async function PrivacyPage() {
  const nos = (await requestSite()) === 'nos';
  return (
    <>
      {nos ? (
        <NosHero
          route="/privacy"
          title={PAGE_LABEL}
          crumbLabel={PAGE_LABEL}
          lede={PRIVACY_POLICY.subtitle}
          priority
        />
      ) : (
        <>
          <LegalBreadcrumb label={PAGE_LABEL} />
          <RouteHero route="/privacy"
            heading={PRIVACY_POLICY.title}
            lede={PRIVACY_POLICY.subtitle}
          />
        </>
      )}
      <DocumentLayout index={legalIndex(PRIVACY_POLICY)}>
        <LegalBody document={PRIVACY_POLICY} />
      </DocumentLayout>
    </>
  );
}

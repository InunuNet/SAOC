import type { Metadata } from 'next';

import { LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { NosHero } from '@/components/nos/NosHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { RouteHero } from '@/components/ui/RouteHero';
import { REFUND_POLICY, REFUND_POLICY_TITLE } from '@/content/legal/refunds';
import { buildPageMetadata } from '@/lib/seo';
import { requestSite } from '@/lib/request-site';

export const metadata: Metadata = buildPageMetadata({
  title: REFUND_POLICY_TITLE,
  description: 'Refund and cancellation policy for South African Orchid Council ticket sales.',
  path: '/refunds',
});

// The page renders Lee-Ann's master Refund and Cancellation Policy (content/legal/refunds.ts)
// through the same renderer as Terms and Privacy; the h1 is the document's own title.
export default async function RefundsPage() {
  const nos = (await requestSite()) === 'nos';
  return (
    <>
      {nos ? (
        <NosHero
          route="/refunds"
          title={REFUND_POLICY_TITLE}
          crumbLabel={REFUND_POLICY_TITLE}
          priority
        />
      ) : (
        <>
          <RouteHero route="/refunds" heading={REFUND_POLICY_TITLE} />
          <LegalBreadcrumb label={REFUND_POLICY_TITLE} />
        </>
      )}
      <DocumentLayout index={legalIndex(REFUND_POLICY)}>
        <LegalBody document={REFUND_POLICY} own={nos ? 'nos' : 'saoc'} />
      </DocumentLayout>
    </>
  );
}

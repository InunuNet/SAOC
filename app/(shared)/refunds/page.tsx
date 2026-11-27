import type { Metadata } from 'next';

import { LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import type { TitledLegalDocument } from '@/components/legal/types';
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

// The NOS hero's short title (Brad, 27 Nov 2026): the full document title runs past the fixed NOS hero box
// (four lines from 768 to 1023), so the NOS hero and crumb carry this and the body opens with the full title.
const NOS_HERO_TITLE = 'Refund and cancellation policy';

// The NOS body: the master document, opened by its own full title.
const NOS_REFUND_POLICY: TitledLegalDocument = {
  ...REFUND_POLICY,
  blocks: [{ kind: 'p', text: REFUND_POLICY_TITLE }, ...REFUND_POLICY.blocks],
};

// The page renders Lee-Ann's master Refund and Cancellation Policy (content/legal/refunds.ts)
// through the same renderer as Terms and Privacy. On the SAOC host the h1 is the document's own title.
export default async function RefundsPage() {
  const nos = (await requestSite()) === 'nos';
  return (
    <>
      {nos ? (
        <NosHero route="/refunds" title={NOS_HERO_TITLE} crumbLabel={NOS_HERO_TITLE} priority />
      ) : (
        <>
          <RouteHero route="/refunds" heading={REFUND_POLICY_TITLE} />
          <LegalBreadcrumb label={REFUND_POLICY_TITLE} />
        </>
      )}
      <DocumentLayout index={legalIndex(REFUND_POLICY)}>
        <LegalBody document={nos ? NOS_REFUND_POLICY : REFUND_POLICY} own={nos ? 'nos' : 'saoc'} />
      </DocumentLayout>
    </>
  );
}

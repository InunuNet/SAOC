import type { Metadata } from 'next';

import { LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { LegalHero } from '@/components/nos/LegalHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { PRIVACY_POLICY } from '@/content/legal/privacy';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description: 'Privacy policy for the South African Orchid Council website.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <LegalBreadcrumb label="Privacy Policy" />
      <LegalHero
        route="/privacy"
        eyebrow="Legal"
        image="/images/orchid-violet.jpg"
        heading={PRIVACY_POLICY.title}
        lede={PRIVACY_POLICY.subtitle}
      />
      <DocumentLayout index={legalIndex(PRIVACY_POLICY)}>
        <LegalBody document={PRIVACY_POLICY} />
      </DocumentLayout>
    </>
  );
}

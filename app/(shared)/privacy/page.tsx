import type { Metadata } from 'next';

import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { LEGAL_HERO_MIN_HEIGHT, LegalBody, legalIndex } from '@/components/legal/LegalBody';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { PageHero } from '@/components/ui/PageHero';
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
      <PageHero
        image="/images/orchid-violet.jpg"
        heading={PRIVACY_POLICY.title}
        lede={PRIVACY_POLICY.subtitle}
        minHeight={LEGAL_HERO_MIN_HEIGHT}
      />
      <DocumentLayout index={legalIndex(PRIVACY_POLICY)}>
        <LegalBody document={PRIVACY_POLICY} />
      </DocumentLayout>
    </>
  );
}

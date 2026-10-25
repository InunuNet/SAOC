import type { Metadata } from 'next';

import { LegalBody } from '@/components/legal/LegalBody';
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
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Legal"
        heading={PRIVACY_POLICY.title}
        lede={PRIVACY_POLICY.subtitle}
      />
      <LegalBody document={PRIVACY_POLICY} />
    </>
  );
}

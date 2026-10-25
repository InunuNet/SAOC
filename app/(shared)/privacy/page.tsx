import type { Metadata } from 'next';

import { LegalBody } from '@/components/legal/LegalBody';
import { LegalHero } from '@/components/nos/LegalHero';
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
      <LegalHero
        route="/privacy"
        image="/images/orchid-violet.jpg"
        eyebrow="Legal"
        heading={PRIVACY_POLICY.title}
        lede={PRIVACY_POLICY.subtitle}
      />
      <div className="nos-section nos-legal">
        <LegalBody document={PRIVACY_POLICY} />
      </div>
    </>
  );
}

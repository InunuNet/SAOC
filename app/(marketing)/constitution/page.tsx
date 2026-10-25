import type { Metadata } from 'next';

import { LegalBody } from '@/components/legal/LegalBody';
import { PageHero } from '@/components/ui/PageHero';
import { COMPANY_DOCUMENTS } from '@/content/legal/constitution';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Constitution',
  description: 'The Constitution of the South African Orchid Council.',
  path: '/constitution',
});

export default function ConstitutionPage() {
  return (
    <>
      <PageHero image="/images/orchid-violet.jpg" eyebrow="Governance" heading="Constitution" />
      <LegalBody document={COMPANY_DOCUMENTS} />
    </>
  );
}

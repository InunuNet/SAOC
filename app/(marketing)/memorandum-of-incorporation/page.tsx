import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { LegalBody } from '@/components/legal/LegalBody';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { PageHero } from '@/components/ui/PageHero';
import { COMPANY_DOCUMENTS } from '@/content/legal/constitution';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Memorandum of Incorporation',
  description: 'The Memorandum of Incorporation of the South African Orchid Council.',
  path: '/memorandum-of-incorporation',
});

export default function MemorandumOfIncorporationPage() {
  return (
    <>
      <Breadcrumb items={[{ label: 'Memorandum of Incorporation' }]} />
      <PageHero
        image="/images/orchid-violet.jpg"
        heading="Memorandum of Incorporation"
      />
      <DocumentLayout>
        <LegalBody document={COMPANY_DOCUMENTS} />
      </DocumentLayout>
    </>
  );
}

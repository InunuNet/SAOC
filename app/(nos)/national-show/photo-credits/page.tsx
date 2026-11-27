import type { Metadata } from 'next';

import { PhotoCreditsBody } from '@/components/legal/PhotoCreditsBody';
import { NosHero } from '@/components/nos/NosHero';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Photo credits',
  description: 'Photo credits',
  path: '/national-show/photo-credits',
});

export default function NosPhotoCreditsPage() {
  return (
    <>
      <NosHero
        route="/national-show/photo-credits"
        title="Photo credits"
        crumbLabel="Photo credits"
      />
      <DocumentLayout>
        <PhotoCreditsBody own="nos" />
      </DocumentLayout>
    </>
  );
}

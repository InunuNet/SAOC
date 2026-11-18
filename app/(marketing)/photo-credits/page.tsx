import type { Metadata } from 'next';

import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { PhotoCreditsBody } from '@/components/legal/PhotoCreditsBody';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { RouteHero } from '@/components/ui/RouteHero';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Photo credits',
  description: 'Photo credits',
  path: '/photo-credits',
});

export default function PhotoCreditsPage() {
  return (
    <>
      <LegalBreadcrumb label="Photo credits" />
      <RouteHero route="/photo-credits" heading="Photo credits" />
      <DocumentLayout>
        <PhotoCreditsBody />
      </DocumentLayout>
    </>
  );
}

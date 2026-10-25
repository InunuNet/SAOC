// =============================================================
// NOS — components/nos/LegalHero.tsx
// Server Component. The hero of the host-neutral legal pages (app/(shared)/privacy, terms,
// refunds). On the NOS host it is the NOS photo hero with the page's own "Legal" eyebrow (crop
// from components/nos/hero-photos.ts) and the NOS trail; on the SAOC host it is the SAOC trail and
// PageHero. The strings are the page's own, passed through; nothing is edited here.
// =============================================================

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { NosBreadcrumb } from '@/components/nos/NosBreadcrumb';
import { PageHero } from '@/components/ui/PageHero';
import { requestSite } from '@/lib/request-site';

import { NosHero } from './NosHero';

export interface LegalHeroProps {
  /** The NOS hero route, e.g. `/privacy`; it selects the crop. */
  route: string;
  /** The SAOC PageHero photograph. */
  image: string;
  /** NOS-only eyebrow; the SAOC hero carries none. */
  eyebrow?: string;
  heading: string;
  lede?: string;
  /** The one-item trail label ("Privacy Policy"); the trail follows the host. */
  breadcrumbLabel?: string;
  /** SAOC PageHero min-height override. */
  minHeight?: string;
}

export async function LegalHero({
  route,
  image,
  eyebrow,
  heading,
  lede,
  breadcrumbLabel,
  minHeight,
}: LegalHeroProps) {
  const trail = breadcrumbLabel ? [{ label: breadcrumbLabel }] : null;
  if ((await requestSite()) === 'nos') {
    return (
      <NosHero
        route={route}
        title={heading}
        lede={lede}
        eyebrow={eyebrow}
        crumbs={trail ? <NosBreadcrumb items={trail} /> : undefined}
        priority
      />
    );
  }
  return (
    <>
      {trail ? <Breadcrumb items={trail} /> : null}
      <PageHero image={image} heading={heading} lede={lede} minHeight={minHeight} />
    </>
  );
}

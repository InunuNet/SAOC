// =============================================================
// NOS — components/nos/LegalHero.tsx
// Server Component. The hero of the host-neutral legal pages (app/(shared)/privacy, terms,
// refunds). On the NOS host it is the NOS split hero with the page's own "Legal" eyebrow (crop
// from components/nos/hero-photos.ts); on the SAOC host it is the SAOC PageHero, unchanged. The
// strings are the page's own, passed through; nothing is edited here.
// =============================================================

import { PageHero } from '@/components/ui/PageHero';
import { requestSite } from '@/lib/request-site';

import { NosHero } from './NosHero';

export interface LegalHeroProps {
  /** The NOS hero route, e.g. `/privacy`; it selects the crop. */
  route: string;
  /** The SAOC PageHero photograph. */
  image: string;
  eyebrow: string;
  heading: string;
  lede: string;
}

export async function LegalHero({ route, image, eyebrow, heading, lede }: LegalHeroProps) {
  if ((await requestSite()) === 'nos') {
    return <NosHero route={route} title={heading} lede={lede} eyebrow={eyebrow} priority />;
  }
  return <PageHero image={image} eyebrow={eyebrow} heading={heading} lede={lede} />;
}

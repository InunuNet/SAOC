// =============================================================
// SAOC — components/ui/RouteHero.tsx
// Server Component — PageHero with the route's own photograph, crop and source-width cap
// (lib/data/saoc-hero-photos.ts). PageHero itself is untouched: the crop and the cap are applied
// from RouteHero.module.css to its image.
// =============================================================

import type { ComponentProps, CSSProperties, ReactNode } from 'react';

import { PageHero } from '@/components/ui/PageHero';
import { heroSourceWidth } from '@/lib/data/heroImages';
import { saocHeroPhoto } from '@/lib/data/saoc-hero-photos';

import styles from './RouteHero.module.css';

type PageHeroProps = ComponentProps<typeof PageHero>;

export interface RouteHeroProps extends Omit<PageHeroProps, 'image'> {
  /** The route key in SAOC_HERO_PHOTOS, e.g. "/about" or "/societies/[slug]". */
  route: string;
  /** Rendered straight after the hero, so a band that must follow it stays its next sibling. */
  children?: ReactNode;
}

export function RouteHero({ route, children, ...heroProps }: RouteHeroProps) {
  const photo = saocHeroPhoto(route);
  const sourceWidth = heroSourceWidth(photo.src);
  const style = {
    '--hero-pos': photo.objectPosition,
    '--hero-src-w': sourceWidth === null ? '100%' : `${sourceWidth}px`,
  } as CSSProperties; // custom properties are not in CSSProperties

  return (
    <div className={styles.route} style={style}>
      <PageHero image={photo.src} {...heroProps} />
      {children}
    </div>
  );
}

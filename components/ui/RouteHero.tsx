// =============================================================
// SAOC — components/ui/RouteHero.tsx
// Server Component — PageHero with the route's own photograph and crop (lib/data/saoc-hero-photos.ts),
// or none: a typographic route renders PageHero without media.
// =============================================================

import type { ComponentProps, ReactNode } from 'react';

import { PageHero } from '@/components/ui/PageHero';
import { saocHeroPhoto } from '@/lib/data/saoc-hero-photos';

type PageHeroProps = ComponentProps<typeof PageHero>;

export interface RouteHeroProps extends Omit<PageHeroProps, 'image' | 'imagePosition'> {
  /** The route key in SAOC_HERO_PHOTOS, e.g. "/about" or "/societies/[slug]". */
  route: string;
  /** Rendered straight after the hero, so a band that must follow it stays its next sibling. */
  children?: ReactNode;
}

export function RouteHero({ route, children, ...heroProps }: RouteHeroProps) {
  const photo = saocHeroPhoto(route);
  return (
    <>
      {photo.typographic ? (
        <PageHero {...heroProps} />
      ) : (
        <PageHero image={photo.src} imagePosition={photo.objectPosition} {...heroProps} />
      )}
      {children}
    </>
  );
}

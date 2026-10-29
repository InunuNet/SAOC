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

// The event hero's facts are left-aligned to the h1 edge (NOS Design 2026-10-27); every other hero centres them.
const EVENT_HERO_ROUTE = '/events/[slug]';

export function RouteHero({ route, children, ...rest }: RouteHeroProps) {
  const photo = saocHeroPhoto(route);
  const heroProps: PageHeroProps = {
    factsAlign: route === EVENT_HERO_ROUTE ? 'start' : undefined,
    ...rest,
  };
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

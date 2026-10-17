// =============================================================
// SAOC — components/ui/PhotoBand.tsx
// Server Component — full-bleed photo band used to break up long
// text columns on interior pages (About, Judging), matching the
// full-bleed photography rhythm already established on Home.
// =============================================================

import Image from 'next/image';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';

export interface PhotoBandProps {
  image: string;
  alt: string;
  caption?: string;
  minHeight?: string;
  /** Beta preview: the caption states a fact the Council has not supplied, so it is marked. */
  marked?: boolean;
}

export function PhotoBand({ image, alt, caption, minHeight = '360px', marked = false }: PhotoBandProps) {
  return (
    <figure
      data-placeholder={marked ? 'true' : undefined}
      className="relative isolate m-0 overflow-hidden"
      style={{ minHeight }}
    >
      <Image src={image} alt={alt} fill sizes="100vw" className="object-cover" />
      {caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--primary-800)]/85 to-transparent pb-6 pt-16 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/90">
          <span className="saoc-container flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{caption}</span>
            {marked ? <PlaceholderMarker tone="dark" /> : null}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}

// =============================================================
// SAOC — components/ui/PhotoBand.tsx
// Server Component — full-bleed photo band used to break up long
// text columns on interior pages (About, Judging), matching the
// full-bleed photography rhythm already established on Home.
// =============================================================

import Image from 'next/image';

export interface PhotoBandProps {
  image: string;
  alt: string;
  caption?: string;
  minHeight?: string;
}

export function PhotoBand({ image, alt, caption, minHeight = '360px' }: PhotoBandProps) {
  return (
    <figure className="relative isolate m-0 overflow-hidden" style={{ minHeight }}>
      <Image src={image} alt={alt} fill sizes="100vw" className="object-cover" />
      {caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--primary-800)]/85 to-transparent px-8 pb-6 pt-16 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/90 md:px-16">
          <span className="mx-auto block max-w-[1280px]">{caption}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}

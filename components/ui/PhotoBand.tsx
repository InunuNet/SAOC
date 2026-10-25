// =============================================================
// SAOC — components/ui/PhotoBand.tsx
// Server Component — full-bleed photo band used to break up a long text column on an interior
// page (Judging), matching the full-bleed photography rhythm already established on Home.
// =============================================================

import Image from 'next/image';
import type { CSSProperties } from 'react';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { heroSourceWidth } from '@/lib/data/heroImages';

import styles from './PhotoBand.module.css';

export interface PhotoBandProps {
  image: string;
  alt: string;
  caption?: string;
  minHeight?: string;
  /** CSS object-position of the cropped band: the photograph's sharp region. */
  objectPosition?: string;
  /** Beta preview: the caption states a fact the Council has not supplied, so the band is marked below it. */
  marked?: boolean;
}

const HERO_QUALITY = 88;

export function PhotoBand({
  image,
  alt,
  caption,
  minHeight = '360px',
  objectPosition = '50% 50%',
  marked = false,
}: PhotoBandProps) {
  const sourceWidth = heroSourceWidth(image);
  const bandStyle = {
    minHeight,
    '--band-src-w': sourceWidth === null ? '100%' : `${sourceWidth}px`,
  } as CSSProperties; // custom properties are not in CSSProperties

  return (
    <>
      <figure
        data-placeholder={marked ? 'true' : undefined}
        className={`${styles.band} relative isolate m-0 overflow-hidden bg-primary-800`}
        style={bandStyle}
      >
        <Image
          src={image}
          alt={alt}
          fill
          sizes="100vw"
          quality={sourceWidth === null ? undefined : HERO_QUALITY}
          className="object-cover"
          style={{ objectPosition }}
        />
        {caption ? (
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--primary-800)]/85 to-transparent pb-6 pt-16 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/90">
            <span className="saoc-container flex">{caption}</span>
          </figcaption>
        ) : null}
      </figure>
      {marked ? (
        <div className="saoc-container py-6">
          <PlaceholderMarker />
        </div>
      ) : null}
    </>
  );
}

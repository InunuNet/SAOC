// =============================================================
// SAOC — components/ui/PhotoBand.tsx
// Server Component — full-bleed photo band used to break up a long text column on an interior
// page (Judging), matching the full-bleed photography rhythm already established on Home.
// =============================================================

import Image from 'next/image';
import type { CSSProperties } from 'react';

import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { heroSourceAspect } from '@/lib/data/saoc-hero-photos';
import heroSourceWidths from '@/lib/hero-source-widths.json';

import styles from './PhotoBand.module.css';

export interface PhotoBandProps {
  image: string;
  alt: string;
  caption?: string;
  /** The band's minimum height in CSS pixels, e.g. "320px". It sets `sizes` for a height-driven cover. */
  minHeight?: string;
  /** CSS object-position of the cropped band: the photograph's sharp region. */
  objectPosition?: string;
  /** Beta preview: the caption states a fact the Council has not supplied, so the band is marked below it. */
  marked?: boolean;
}

const DEFAULT_MIN_HEIGHT_PX = 360;
const PIXEL_HEIGHT = /^(\d+(?:\.\d+)?)px$/;

function minHeightPx(minHeight: string): number {
  const match = PIXEL_HEIGHT.exec(minHeight);
  if (!match) throw new Error(`PhotoBand: minHeight must be a px length, got "${minHeight}"`);
  return Number(match[1]);
}

export function PhotoBand({
  image,
  alt,
  caption,
  minHeight = `${DEFAULT_MIN_HEIGHT_PX}px`,
  objectPosition: imagePosition = '50% 50%',
  marked = false,
}: PhotoBandProps) {
  const sourceWidth = (heroSourceWidths as Readonly<Record<string, number>>)[image] ?? null; // JSON import is typed by its literal keys
  const bandStyle = {
    minHeight,
    '--band-src-w': sourceWidth === null ? '100%' : `${sourceWidth}px`,
  } as CSSProperties; // custom properties are not in CSSProperties
  // The band is the viewport wide and `minHeight` tall: a cover image needs the longer of the two
  // (width, or height x the file's aspect), not a bare 100vw.
  const aspect = sourceWidth === null ? null : heroSourceAspect(image);
  const sizes =
    aspect === null ? '100vw' : `max(100vw, ${Math.ceil(minHeightPx(minHeight) * aspect)}px)`;

  return (
    <>
      <figure
        data-photo-band
        data-placeholder={marked ? 'true' : undefined}
        className={`${styles.band} relative isolate m-0 overflow-hidden bg-primary-800`}
        style={bandStyle}
      >
        <Image
          src={image}
          alt={alt}
          fill
          sizes={sizes}
          quality={image in heroSourceWidths ? 88 : undefined}
          className="object-cover"
          style={{ objectPosition: imagePosition }}
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

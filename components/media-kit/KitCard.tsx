// =============================================================
// SAOC — components/media-kit/KitCard.tsx
// Server Component — one downloadable asset: a preview on its real ground (parchment for dark type,
// sage for light type), the approved-wording label, format, pixel size and file size, and a real
// <a download> per format. Test hooks: data-kit-card, data-ground, data-kit-preview.
// =============================================================

import Image from 'next/image';

import { itemMeta, type Ground, type MediaKitItem } from '@/lib/data/media-kit';

export type KitCardLayout = 'lockup' | 'chip';

export interface KitCardProps {
  item: MediaKitItem;
  ground: Ground;
  layout?: KitCardLayout;
  /** Heading shown on the card; defaults to the manifest label. */
  title?: string;
  /** Extra formats of the same asset, each with its own download link. */
  alsoAs?: MediaKitItem[];
  /** Previews are lazy unless the card is above the fold. */
  eager?: boolean;
}

const GROUND_CLASS: Record<Ground, string> = {
  light: 'bg-parchment',
  dark: 'bg-primary',
};

const PREVIEW_CLASS: Record<KitCardLayout, string> = {
  lockup: 'flex min-h-[180px] items-center justify-center p-6',
  chip: 'flex aspect-square items-center justify-center',
};

const IMAGE_CLASS: Record<KitCardLayout, string> = {
  lockup: 'h-auto max-h-[150px] w-auto max-w-full object-contain',
  chip: 'h-full w-full object-contain',
};

export function KitCard({ item, ground, layout = 'lockup', title, alsoAs = [], eager = false }: KitCardProps) {
  const heading = title ?? item.label;
  const formats = [item, ...alsoAs];
  const hasPreview = item.width !== null && item.height !== null;

  return (
    <article data-kit-card data-ground={ground} className="flex flex-col border border-rule bg-parchment">
      <div data-kit-preview className={`${GROUND_CLASS[ground]} ${PREVIEW_CLASS[layout]}`}>
        {hasPreview ? (
          <Image
            src={item.href}
            alt={heading}
            width={item.width ?? 0}
            height={item.height ?? 0}
            // The preview is the download itself; a derived copy would not be the approved file.
            unoptimized
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className={IMAGE_CLASS[layout]}
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-serif font-medium text-[16px] leading-[1.3] text-ink">{heading}</h3>
        {formats.map((format) => (
          <div key={format.path} className="flex flex-wrap items-center justify-between gap-x-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
              {itemMeta(format)}
            </p>
            <a
              href={format.href}
              download
              className="inline-flex min-h-[44px] items-center font-sans text-[14px] text-ink underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
            >
              Download {format.format}
              <span className="sr-only"> — {heading}</span>
            </a>
          </div>
        ))}
      </div>
    </article>
  );
}

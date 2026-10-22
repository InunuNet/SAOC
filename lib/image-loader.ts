// next/image loader (images.loaderFile). Firebase App Hosting's Next adapter forces
// images.unoptimized = true unless a custom loader is configured, which leaves no
// /_next/image route and no srcset (see docs/image-delivery.md). So srcset candidates are
// pre-generated at build time by scripts/generate-image-variants.mjs and mapped here.
import widths from './image-widths.json';

interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

const VARIANT_DIR = '/images/_opt';
const SOURCE_DIR = '/images/';
const RASTER_EXTENSION = /\.(jpe?g|png)$/i;
const QUERY_OR_HASH = /[?#].*$/;
const SANITY_CDN_HOST = 'cdn.sanity.io';
const DEFAULT_QUALITY = 75;
// Only the hero sources (quality 88) have variants above the standard cap: a full-bleed hero is
// 4000+ device px wide on a 2x display, so a 2048 cap stretches it about 2x. Every other image
// keeps the cap, which protects build time (scripts/generate-image-variants.mjs).
const HERO_QUALITY = 88;
const STANDARD_MAX_WIDTH = 2048;

const ALL_WIDTHS = [...widths.deviceSizes, ...widths.imageSizes].sort((a, b) => a - b);

function snapWidth(requested: number, maxWidth: number): number {
  const allowed = ALL_WIDTHS.filter((w) => w <= maxWidth);
  return allowed.find((w) => w >= requested) ?? allowed[allowed.length - 1];
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  const path = src.replace(QUERY_OR_HASH, '');
  if (path.startsWith(SOURCE_DIR) && RASTER_EXTENSION.test(path)) {
    // The source extension stays in the name so a.jpg and a.png never share variants.
    const name = path.slice(SOURCE_DIR.length).replace(/\.[^.]+$/, (ext) => ext.toLowerCase());
    // A non-default quality has its own variant set (generate-image-variants.mjs: the hero sources at q88).
    const suffix = quality && quality !== DEFAULT_QUALITY ? `-q${quality}` : '';
    const maxWidth = quality === HERO_QUALITY ? ALL_WIDTHS[ALL_WIDTHS.length - 1] : STANDARD_MAX_WIDTH;
    return `${VARIANT_DIR}/${name}-${snapWidth(width, maxWidth)}${suffix}.webp`;
  }
  if (src.startsWith('https://')) {
    const url = new URL(src);
    if (url.hostname === SANITY_CDN_HOST) {
      url.searchParams.set('w', String(width));
      url.searchParams.set('auto', 'format');
      url.searchParams.set('q', String(quality ?? DEFAULT_QUALITY));
      return url.toString();
    }
  }
  return src;
}

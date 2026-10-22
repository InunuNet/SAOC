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

const ALL_WIDTHS = [...widths.deviceSizes, ...widths.imageSizes].sort((a, b) => a - b);

function snapWidth(requested: number): number {
  return ALL_WIDTHS.find((w) => w >= requested) ?? ALL_WIDTHS[ALL_WIDTHS.length - 1];
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  const path = src.replace(QUERY_OR_HASH, '');
  if (path.startsWith(SOURCE_DIR) && RASTER_EXTENSION.test(path)) {
    // The source extension stays in the name so a.jpg and a.png never share variants.
    const name = path.slice(SOURCE_DIR.length).replace(/\.[^.]+$/, (ext) => ext.toLowerCase());
    // A non-default quality has its own variant set (generate-image-variants.mjs: the hero sources at q88).
    const suffix = quality && quality !== DEFAULT_QUALITY ? `-q${quality}` : '';
    return `${VARIANT_DIR}/${name}-${snapWidth(width)}${suffix}.webp`;
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

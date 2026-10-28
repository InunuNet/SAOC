// =============================================================
// components/site-chrome/SaocFontPreload.tsx
// The one font preload on a SAOC route: Crimson Pro normal, the face the h1 and hero are set in (F1e).
// next/font's own preload is switched off in app/layout.tsx (it goes out as an HTTP Link header, not
// as a <link> in the HTML head, and it would preload the italic too). next/font emits the file with
// a content hash in its name, `static/media/CrimsonPro_latin_normal-s.<hash>.woff2`, so the URL is
// read from the build output; the same URL is the @font-face src, so the preload is the request the
// stylesheet would make and the file is fetched once. Without a build output (next dev) it renders
// nothing and the face loads when first used.
// =============================================================

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const MEDIA_DIR = join(process.cwd(), '.next', 'static', 'media');
const CRIMSON_NORMAL = /^CrimsonPro_latin_normal-.*\.woff2$/;

function findCrimsonNormalFile(): string | null {
  try {
    return readdirSync(MEDIA_DIR).find((name) => CRIMSON_NORMAL.test(name)) ?? null;
  } catch {
    // No build output (next dev): nothing to preload.
    return null;
  }
}

const crimsonNormalFile = findCrimsonNormalFile();

export function SaocFontPreload() {
  if (crimsonNormalFile === null) return null;
  // A rendered <link>, not ReactDOM.preload(): React delivers the preload() calls for fonts as an
  // HTTP Link header and keeps them out of the HTML head.
  return (
    <link
      rel="preload"
      as="font"
      type="font/woff2"
      crossOrigin="anonymous"
      href={`/_next/static/media/${crimsonNormalFile}`}
    />
  );
}

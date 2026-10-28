// =============================================================
// components/site-chrome/SaocFontPreload.tsx
// The one font preload on a SAOC route: Crimson Pro normal, the face the h1 and hero are set in (F1e).
// next/font's own preload is switched off in app/layout.tsx (it goes out as an HTTP Link header, not
// as a <link> in the HTML head, and it would preload the italic too). next/font emits the file with
// a content hash in its name, `static/media/CrimsonPro_latin_normal-s.<hash>.woff2`; that name is
// committed in crimson-preload.json and imported here, so there is no filesystem read at runtime.
// `pnpm build` runs scripts/crimson-font-preload.mjs --verify after `next build`, so a stale
// mapping fails the build. The same URL is the @font-face src, so the preload is the request the
// stylesheet would make and the file is fetched once. next dev names the file differently, so it
// renders nothing there and the face loads when first used.
// =============================================================

import preload from './crimson-preload.json';

export function SaocFontPreload() {
  if (process.env.NODE_ENV !== 'production') return null;
  // A rendered <link>, not ReactDOM.preload(): React delivers the preload() calls for fonts as an
  // HTTP Link header and keeps them out of the HTML head.
  return (
    <link
      rel="preload"
      as="font"
      type="font/woff2"
      crossOrigin="anonymous"
      href={`/_next/static/media/${preload.file}`}
    />
  );
}

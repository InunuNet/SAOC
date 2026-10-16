// =============================================================
// NOS — components/nos-chrome/NosSkipLink.tsx
// The /national-show/* skip link: same behaviour as components/chrome/SkipLink.tsx
// (first tab stop, off-screen until focused, lands on <main id="main-content">), with the NOS
// look from nos-chrome.css (.nh-skip) and Karla, so no SAOC face or colour reaches a NOS route.
// =============================================================

import { nosChromeFontClass } from './fonts';

export function NosSkipLink() {
  return (
    <a href="#main-content" className={`nh-skip ${nosChromeFontClass}`}>
      Skip to main content
    </a>
  );
}

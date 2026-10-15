// =============================================================
// NOS — components/nos-chrome/NosSkipLink.tsx
// The /national-show/* skip link: same behaviour as components/chrome/SkipLink.tsx
// (first tab stop, off-screen until focused, lands on <main id="main-content">),
// set in Karla so no SAOC face loads on a NOS route (nos-own-brand-chrome F2 R14).
// =============================================================

import { nosChromeFontClass } from './fonts';

export function NosSkipLink() {
  return (
    <a
      href="#main-content"
      className={`${nosChromeFontClass} fixed left-4 top-4 z-[100] inline-flex min-h-11 min-w-11 -translate-y-[300%] items-center bg-primary px-6 text-[14px] font-medium text-ivory focus:translate-y-0`}
      style={{ fontFamily: 'var(--font-nos-karla), Arial, sans-serif' }}
    >
      Skip to main content
    </a>
  );
}

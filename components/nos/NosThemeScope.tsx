// =============================================================
// NOS — components/nos/NosThemeScope.tsx
// The `.nos-theme` scope element, with the NOS-only fonts and the ticket colour variables, so
// `/national-show/*` and `/tickets/*` share ONE scope instead of two copies of it. The scope
// redeclares the SAOC semantic custom-property names with NOS values (nos-theme.css), which is why
// every descendant, SAOC-owned or not, re-skins with no edit of its own. The site header and
// footer are not inside it: they are the NOS own-brand chrome mounted by the marketing layout.
// =============================================================

import localFont from 'next/font/local';

import '@/app/(nos)/national-show/nos-theme.css';
import '@/app/(nos)/national-show/nos-structure.css';
import '@/app/(nos)/national-show/presenters.css';
import { TICKET_THEME_VARS } from '@/lib/data/ticket-presentation';

// NOS-only fonts, scoped via CSS variables so nothing outside `.nos-theme` picks them up.
// R14 (nos-own-brand-chrome F2): Cormorant and Jost are reserved for the logo artwork and are
// never loaded on a content page.
// Fraunces (variable, opsz axis; normal + italic, so the archive and card italics are a
// real face) and Karla (400–700) are the NOS faces. components/nos-chrome/fonts.ts declares
// the identical config for the header and footer, which sit outside `.nos-theme`; keep the
// two in step.
const fraunces = localFont({
  src: [
    { path: '../../app/fonts/fraunces/Fraunces-latin-normal.woff2', weight: '100 900', style: 'normal' },
    { path: '../../app/fonts/fraunces/Fraunces-latin-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-nos-fraunces',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

const karla = localFont({
  src: [
    { path: '../../app/fonts/karla/Karla-latin-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../app/fonts/karla/Karla-latin-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../app/fonts/karla/Karla-latin-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../app/fonts/karla/Karla-latin-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-nos-karla',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Arial',
});

// The /symposium theme lede is italic 300. This face is that one weight and style of the italic file
// above, with its own generated family, so it can preload on its own (the two Fraunces faces above
// load on first use). Only nos-theme.css's theme lede rule names this variable.
const frauncesLedeItalic = localFont({
  src: [{ path: '../../app/fonts/fraunces/Fraunces-latin-italic.woff2', weight: '300', style: 'italic' }],
  variable: '--font-nos-fraunces-lede',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Times New Roman',
});

export function NosThemeScope({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`nos-theme ${fraunces.variable} ${karla.variable} ${frauncesLedeItalic.variable}`}
      style={TICKET_THEME_VARS}
    >
      {children}
    </div>
  );
}

// =============================================================
// NOS — components/nos/NosThemeScope.tsx
// The `.nos-theme` scope element, with the NOS-only fonts and the ticket colour variables, so
// `/national-show/*` and `/tickets/*` share ONE scope instead of two copies of it. The scope
// redeclares the SAOC semantic custom-property names with NOS values (nos-theme.css), which is why
// every descendant, SAOC-owned or not, re-skins with no edit of its own. The site header and
// footer are not inside it: they are the NOS own-brand chrome mounted by the marketing layout.
// =============================================================

import { Fraunces, Karla } from 'next/font/google';

import '@/app/(marketing)/national-show/nos-theme.css';
import '@/app/(marketing)/national-show/nos-structure.css';
import '@/app/(marketing)/national-show/presenters.css';
import { TICKET_THEME_VARS } from '@/lib/data/ticket-presentation';

// NOS-only fonts, scoped via CSS variables so nothing outside `.nos-theme` picks them up.
// R14 (nos-own-brand-chrome F2): Cormorant and Jost are reserved for the logo artwork and are
// never loaded on a content page.
// Fraunces (variable, opsz axis; normal + italic, so the archive and card italics are a
// real face) and Karla (400–700) are the NOS faces. components/nos-chrome/fonts.ts declares
// the identical config for the header and footer, which sit outside `.nos-theme`; keep the
// two in step.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-nos-fraunces',
  display: 'swap',
  preload: false,
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nos-karla',
  display: 'swap',
  preload: false,
});

export function NosThemeScope({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`nos-theme ${fraunces.variable} ${karla.variable}`}
      style={TICKET_THEME_VARS}
    >
      {children}
    </div>
  );
}

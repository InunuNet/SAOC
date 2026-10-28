// =============================================================
// NOS — components/nos/NosThemeScope.tsx
// The `.nos-theme` scope element, with the NOS-only fonts and the ticket colour variables, so
// `/national-show/*` and `/tickets/*` share ONE scope instead of two copies of it. The scope
// redeclares the SAOC semantic custom-property names with NOS values (nos-theme.css), which is why
// every descendant, SAOC-owned or not, re-skins with no edit of its own. The site header and
// footer are not inside it: they are the NOS own-brand chrome mounted by the marketing layout.
// =============================================================

import { fraunces, karla } from '@/components/nos-chrome/fonts';
import '@/app/(nos)/national-show/nos-theme.css';
import '@/app/(nos)/national-show/nos-structure.css';
import '@/app/(nos)/national-show/presenters.css';
import { TICKET_THEME_VARS } from '@/lib/data/ticket-presentation';

// NOS-only fonts, scoped via CSS variables so nothing outside `.nos-theme` picks them up.
// R14 (nos-own-brand-chrome F2): Cormorant and Jost are reserved for the logo artwork and are
// never loaded on a content page. Fraunces and Karla are declared once, in
// components/nos-chrome/fonts.ts, and shared with the header and footer.

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

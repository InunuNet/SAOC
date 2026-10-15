import { Cormorant_Garamond, Fraunces, Jost, Karla } from 'next/font/google';

import './nos-theme.css';
import './presenters.css';

// F1: NOS-only fonts, scoped via CSS variables so nothing outside `.nos-theme`
// picks them up. Cormorant Garamond carries display/headline elegance (400–500
// only — see design grammar); Jost carries UI/labels/body and eyebrow tracking.
const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-nos-cormorant',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-nos-jost',
  display: 'swap',
});

// nos-own-brand-chrome F1: Fraunces (variable, opsz axis) and Karla (400–700) are the NOS
// chrome's faces. components/nos-chrome/fonts.ts declares the identical config for the
// header and footer, which sit outside `.nos-theme`; keep the two in step.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-nos-fraunces',
  display: 'swap',
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nos-karla',
  display: 'swap',
});

// F1: the `.nos-theme` scope element redeclares the SAOC site's own semantic
// custom-property names (--bg, --fg, --accent, etc. — see nos-theme.css) with
// NOS values. Because app/globals.css's Tailwind `@theme` block only indirects
// through those semantic names, and custom properties resolve at the element
// that uses them, every descendant already using Tailwind utilities like
// `bg-parchment` or `text-ink` re-skins automatically — with zero edits to
// app/globals.css or any page under national-show/.
//
// The site header and footer for these routes are the NOS own-brand chrome,
// mounted by app/(marketing)/layout.tsx (components/nos-chrome). This layout
// renders inside that layout's <main>, so it carries no header, footer, masthead
// or lockup of its own.
export default function NationalShowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`nos-theme ${cormorantGaramond.variable} ${jost.variable} ${fraunces.variable} ${karla.variable}`}
    >
      {children}
    </div>
  );
}

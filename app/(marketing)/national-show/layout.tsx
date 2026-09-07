import { Cormorant_Garamond, Jost } from 'next/font/google';

import './nos-theme.css';

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

// F1: the `.nos-theme` scope element redeclares the SAOC site's own semantic
// custom-property names (--bg, --fg, --accent, etc. — see nos-theme.css) with
// NOS values. Because app/globals.css's Tailwind `@theme` block only indirects
// through those semantic names, and custom properties resolve at the element
// that uses them, every descendant already using Tailwind utilities like
// `bg-parchment` or `text-ink` re-skins automatically — with zero edits to
// app/globals.css, components/chrome/*, or any page under national-show/.
export default function NationalShowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`nos-theme ${cormorantGaramond.variable} ${jost.variable}`}>{children}</div>
  );
}

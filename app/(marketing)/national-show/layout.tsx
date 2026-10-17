import { Fraunces, Karla } from 'next/font/google';

import { NAV } from '@/components/chrome/nav-config';
import { NosBreadcrumbJsonLd } from '@/components/nos/NosBreadcrumbJsonLd';

import './nos-theme.css';
import './nos-structure.css';
import './presenters.css';

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
const NATIONAL_SHOW_ROOT = '/national-show';

/** First label nav-config carries for each /national-show href, depth first. */
function collectLabels(node: unknown, into: Record<string, string>): void {
  if (!node || typeof node !== 'object') return;
  // Narrowing an arbitrary nav node to a string-keyed record; the typeof checks guard every read.
  const record = node as Record<string, unknown>;
  const { href, label } = record;
  if (
    typeof href === 'string' &&
    typeof label === 'string' &&
    href.startsWith(NATIONAL_SHOW_ROOT) &&
    !(href in into)
  ) {
    into[href] = label;
  }
  for (const value of Object.values(record)) collectLabels(value, into);
}

const BREADCRUMB_LABELS: Record<string, string> = {};
collectLabels(NAV, BREADCRUMB_LABELS);

export default function NationalShowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`nos-theme ${fraunces.variable} ${karla.variable}`}>
      <NosBreadcrumbJsonLd labels={BREADCRUMB_LABELS} />
      {children}
    </div>
  );
}

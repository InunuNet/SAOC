import type { Metadata } from 'next';

import { NAV } from '@/components/chrome/nav-config';
import { NosBreadcrumbJsonLd } from '@/components/nos/NosBreadcrumbJsonLd';
import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { nosOrigin } from '@/lib/site-hosts';

// F1: the `.nos-theme` scope element redeclares the SAOC site's own semantic
// custom-property names (--bg, --fg, --accent, etc. — see nos-theme.css) with
// NOS values. Because app/globals.css's Tailwind `@theme` block only indirects
// through those semantic names, and custom properties resolve at the element
// that uses them, every descendant already using Tailwind utilities like
// `bg-parchment` or `text-ink` re-skins automatically — with zero edits to
// app/globals.css or any page under national-show/.
//
// The scope, its fonts and the stylesheets live in components/nos/NosThemeScope so the
// ticket routes (/tickets/*) wear the same scope as the show pages.
//
// The site header and footer for these routes are the NOS own-brand chrome,
// mounted by app/(nos)/layout.tsx (components/nos-chrome). This layout
// renders inside that layout's <main>, so it carries no header, footer, masthead
// or lockup of its own.
const NATIONAL_SHOW_ROOT = '/national-show';

// F24: every inner page names itself and this template adds the show. The hub
// (/national-show) is the segment's own page, so the template does not reach it and it keeps
// its own full title.
export const metadata: Metadata = {
  title: {
    template: '%s — National Orchid Show | SAOC',
    default: 'National Orchid Show | South African Orchid Council',
  },
};

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
    <NosThemeScope>
      <NosBreadcrumbJsonLd labels={BREADCRUMB_LABELS} origin={nosOrigin()} />
      {children}
    </NosThemeScope>
  );
}

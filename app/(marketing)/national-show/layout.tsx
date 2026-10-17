import { NosThemeScope } from '@/components/nos/NosThemeScope';

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
// mounted by app/(marketing)/layout.tsx (components/nos-chrome). This layout
// renders inside that layout's <main>, so it carries no header, footer, masthead
// or lockup of its own.
export default function NationalShowLayout({ children }: { children: React.ReactNode }) {
  return <NosThemeScope>{children}</NosThemeScope>;
}

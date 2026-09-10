// =============================================================
// SAOC — components/show/ShowSectionNav.tsx
// Server Component — the section-wide reachability surface for every National Show
// page. Together with the /national-show hub's four groups, this is ONE of the two
// surfaces this lane owns that a visitor can click through (R3/R4) — the approved
// design handoff specifies a flat six-item header with no dropdown
// (design/design_handoff_saoc/src/chrome.jsx), so these two surfaces ARE the
// subsection's entire navigation. /national-show/archive returned 200 for months
// while nothing on the site linked to it; this nav is the standing fix.
//
// The href literals below are KEPT (not rendered from content/national-show-routes.json)
// because specs/site-content-alignment/contract-f3.yaml's A11 greps for a literal
// `href: '/national-show/about'` object entry in this file. NAV1 (M4) asserts at gate
// time that this array's href set equals the manifest's `listed: true` slugs exactly,
// in both directions — see
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/hub-groups.golden.md.
//
// R21 (design ruling) governs this component and holds regardless of the 17-vs-6-link
// count: (1) never sticky, never fixed — plain in-flow block; (2) no emblem, no lockup;
// (3) the links are CONTENT — a hardcoded array literal in this file, never imported
// from components/chrome/nav-config.ts or any other "this is primary nav" source; (4)
// full-bleed only at the foot of a page — every route that renders this component does
// so as the LAST element in its tree, never mid-page. R13 binds here too: column count
// is derived via resolveGridLayout(), never a literal outside lib/grid-columns.ts.
// =============================================================

import Link from 'next/link';

import { COLUMN_CLASS, resolveGridLayout } from '@/lib/grid-columns';

interface SectionLink {
  href: string;
  label: string;
  hint: string;
}

// All 17 listed routes, matching content/national-show-routes.json's labels exactly.
const SECTION_LINKS: readonly SectionLink[] = [
  { href: '/national-show', label: 'National Show', hint: 'The show overview and how to get involved' },
  { href: '/national-show/about', label: 'About the Show', hint: "The theme, and who takes part" },
  { href: '/national-show/what-to-expect', label: 'What to Expect', hint: 'Hours, admission and on-the-day detail' },
  { href: '/national-show/plan-your-visit', label: 'Plan Your Visit', hint: 'Travel, parking and where to stay' },
  { href: '/national-show/faq', label: 'FAQ', hint: 'What visitors ask us most' },
  { href: '/national-show/programme', label: 'Programme', hint: 'The schedule across the four show days' },
  { href: '/national-show/workshops', label: 'Workshops', hint: 'Sunset cocktails and guided field trips' },
  { href: '/national-show/symposium', label: 'SAOC Symposium', hint: 'The SAOC Symposium and its theme' },
  { href: '/national-show/wosa-conference', label: 'WOSA Conference', hint: 'Held alongside the show, with WOSA' },
  { href: '/national-show/conferences', label: 'Conference Registration', hint: 'Register for the Symposium and WOSA Conference' },
  { href: '/national-show/sa-exhibitors', label: 'South African Exhibitors', hint: 'The nurseries exhibiting at the show' },
  { href: '/national-show/international-guests', label: 'International Guests', hint: 'Guests and exhibitors from abroad' },
  { href: '/national-show/exhibitors', label: 'Exhibitor Entry Guide', hint: 'Entry process, fees, classes and judging' },
  { href: '/national-show/vendors', label: 'Trade Vendors', hint: 'The trade floor and how to exhibit' },
  { href: '/national-show/tickets', label: 'Tickets', hint: 'Buy admission tickets' },
  { href: '/national-show/sponsors', label: 'Show Sponsors', hint: "The Show's own sponsors" },
  { href: '/national-show/archive', label: 'Past Shows', hint: 'Previous editions and their champions' },
];

export interface ShowSectionNavProps {
  /** Pathname of the page rendering the nav — omitted from the list. */
  current: string;
}

export function ShowSectionNav({ current }: ShowSectionNavProps) {
  const links = SECTION_LINKS.filter((link) => link.href !== current);
  // R13 — column count is DERIVED from the rendered count (16 on every page, since one
  // link is always filtered out), never a hardcoded class.
  const { columns } = resolveGridLayout(links.length);

  return (
    <nav aria-label="National Show section" className="bg-bone py-12">
      <div className="mx-auto max-w-[1280px] px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          More on the National Show
        </p>
        {/* No hardcoded column-count utility below lg: mobile and tablet stack via flex-col, so the
            ONLY column-count class on this list comes from lib/grid-columns.ts (D68). */}
        <ul className={`mt-6 flex flex-col gap-px bg-rule lg:grid ${COLUMN_CLASS[columns]}`}>
          {links.map(({ href, label, hint }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col gap-2 bg-parchment p-5 transition-colors duration-150 hover:bg-parchment/60"
              >
                <span className="font-serif text-[18px] font-medium text-ink">{label}</span>
                <span className="font-sans text-[13px] leading-snug text-ink/60">{hint}</span>
                <span aria-hidden="true" className="mt-auto pt-3 text-muted">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// =============================================================
// SAOC — components/show/ShowSectionNav.tsx
// Server Component — cross-links between the four National Show pages plus the
// archive.
//
// F5's requirement is reachability by CLICKING, not by URL: /national-show/archive
// returned 200 for months while nothing on the site linked to it. This nav is the
// standing fix — every show page can reach every other one, including the archive.
// The primary header nav is deliberately NOT expanded; see page-map.golden.md.
// =============================================================

import Link from 'next/link';

interface SectionLink {
  href: string;
  label: string;
  hint: string;
}

const SECTION_LINKS: readonly SectionLink[] = [
  { href: '/national-show', label: 'Show overview', hint: 'The show, the cycle and the classes' },
  { href: '/national-show/plan-your-visit', label: 'Plan your visit', hint: 'Travel, parking and where to stay' },
  { href: '/national-show/what-to-expect', label: 'What to expect', hint: 'Hours, admission and on-the-day detail' },
  { href: '/national-show/faq', label: 'Questions', hint: 'What visitors ask us most' },
  { href: '/national-show/archive', label: 'Past shows', hint: 'Previous editions and their champions' },
];

export interface ShowSectionNavProps {
  /** Pathname of the page rendering the nav — omitted from the list. */
  current: string;
}

export function ShowSectionNav({ current }: ShowSectionNavProps) {
  const links = SECTION_LINKS.filter((link) => link.href !== current);

  return (
    <nav aria-label="National Show section" className="bg-bone py-12">
      <div className="mx-auto max-w-[1280px] px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          More on the National Show
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
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

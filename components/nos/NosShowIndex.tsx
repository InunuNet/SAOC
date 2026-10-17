// =============================================================
// NOS — components/nos/NosShowIndex.tsx
// Server Component. R69 (NOS Design, 2026-10-16): the hub's grouped index of the show's pages,
// three ruled columns of titled links and nothing else. It replaces the 16-card wall; per-card
// descriptions are dropped. Visible item text is the label nav-config carries for that href,
// never retyped here. The current page is kept in its list, marked with aria-current and
// text-accent, not omitted. Geometry lives in nos-structure.css (`.nos-index`); the container is
// the shared axis ([data-nos-wrap]).
// =============================================================

import Link from 'next/link';

import { NAV } from '@/components/chrome/nav-config';

const EYEBROW = 'Explore the show';

interface IndexGroup {
  heading: string;
  hrefs: readonly string[];
}

const GROUPS: readonly IndexGroup[] = [
  {
    heading: 'Visit',
    hrefs: [
      '/national-show/tickets',
      '/national-show/plan-your-visit',
      '/national-show/what-to-expect',
      '/national-show/programme',
      '/national-show/faq',
    ],
  },
  {
    heading: 'Take part',
    hrefs: [
      '/national-show/exhibitors',
      '/national-show/vendors',
      '/national-show/workshops',
      '/national-show/conferences',
    ],
  },
  {
    heading: 'The show',
    hrefs: [
      '/national-show/about',
      '/national-show/symposium',
      '/national-show/wosa-conference',
      '/national-show/sa-exhibitors',
      '/national-show/international-guests',
      '/national-show/sponsors',
      '/national-show/archive',
    ],
  },
];

/** First label nav-config carries for each href, depth first (a leaf is any {href, label} node). */
function collectLabels(node: unknown, into: Map<string, string>): void {
  if (!node || typeof node !== 'object') return;
  // Narrowing an arbitrary nav node to a string-keyed record; the typeof checks below guard every read.
  const record = node as Record<string, unknown>;
  if (typeof record.href === 'string' && typeof record.label === 'string' && !into.has(record.href)) {
    into.set(record.href, record.label);
  }
  for (const value of Object.values(record)) collectLabels(value, into);
}

const LABELS = (() => {
  const labels = new Map<string, string>();
  collectLabels(NAV, labels);
  for (const { hrefs } of GROUPS) {
    for (const href of hrefs) {
      if (!labels.has(href)) throw new Error(`NosShowIndex: nav-config has no label for ${href}`);
    }
  }
  return labels;
})();

export interface NosShowIndexProps {
  /** The pathname of the page rendering the index; its item is marked, not omitted. */
  current?: string;
  /**
   * How the current item is marked. `accent` (default) is the violet of the R69 hub index.
   * Ticket-flow routes (tickets, workshops, conferences) pass `ink`: F3-T keeps violet out of
   * every ticket surface, so the item is marked by an underline in ink instead.
   */
  currentTone?: 'accent' | 'ink';
}

export function NosShowIndex({ current, currentTone = 'accent' }: NosShowIndexProps) {
  return (
    <nav aria-label="Explore the show pages" className="nos-index">
      <div data-nos-wrap="">
        <h2 className="nos-index-eyebrow">{EYEBROW}</h2>
        <div className="nos-index-grid">
          {GROUPS.map(({ heading, hrefs }) => (
            <div key={heading} className="nos-index-group">
              <h3>{heading}</h3>
              <ul>
                {hrefs.map((href) => {
                  const isCurrent = href === current;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={isCurrent && currentTone === 'accent' ? 'text-accent' : undefined}
                        data-current-ink={isCurrent && currentTone === 'ink' ? '' : undefined}
                      >
                        {LABELS.get(href)}
                        <span aria-hidden="true" className="nos-index-arrow">
                          <svg
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

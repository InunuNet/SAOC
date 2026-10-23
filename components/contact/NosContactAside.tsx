// =============================================================
// NOS — components/contact/NosContactAside.tsx
// Server Component. The contact page's aside (NOS Design CT4): "Looking for something else?" and
// four routing links to the pages that answer the usual questions. Labels and hrefs are read from
// the show nav by leaf id, never retyped. Rows reuse the hub index's list rules and arrow glyph
// (nos-structure.css `.nos-index-group`); the gold ring is one scoped rule on `.nos-contact-aside`.
// =============================================================

import Link from 'next/link';

import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import type { NavLeaf } from '@/components/chrome/nav-config';
import { nosPath } from '@/lib/nos-paths';

const HEADING = 'Looking for something else?';
const SPONSOR_ENQUIRY_HASH = '#enquire';

interface AsideRow {
  id: string;
  /** Appended after the nav href, e.g. the sponsors page's enquiry section. */
  hash?: string;
}

// Order is the ruling's: FAQ, Plan your visit, Exhibitor entry guide, Show sponsors.
const ROWS: readonly AsideRow[] = [
  { id: 'faq' },
  { id: 'plan-your-visit' },
  { id: 'exhibitors' },
  { id: 'show-sponsors', hash: SPONSOR_ENQUIRY_HASH },
];

/** Every leaf in the nav tree, depth first (a leaf is any {id, label, href} node). */
function collectLeaves(node: unknown, into: Map<string, NavLeaf>): void {
  if (!node || typeof node !== 'object') return;
  // Narrowing an arbitrary nav node to a string-keyed record; the typeof checks below guard every read.
  const record = node as Record<string, unknown>;
  if (
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    typeof record.href === 'string' &&
    !into.has(record.id)
  ) {
    into.set(record.id, { id: record.id, label: record.label, href: record.href });
  }
  for (const value of Object.values(record)) collectLeaves(value, into);
}

const LEAVES = (() => {
  const leaves = new Map<string, NavLeaf>();
  collectLeaves(NOS_NAV, leaves);
  for (const { id } of ROWS) {
    if (!leaves.has(id)) throw new Error(`NosContactAside: the show nav has no leaf "${id}"`);
  }
  return leaves;
})();

export function NosContactAside() {
  return (
    <div className="nos-index-group nos-contact-aside">
      <h2 className="nos-index-eyebrow border-b border-rule pb-4">{HEADING}</h2>
      <ul>
        {ROWS.map(({ id, hash }) => {
          const leaf = LEAVES.get(id);
          if (!leaf) return null;
          return (
            <li key={id}>
              <Link href={`${nosPath(leaf.href)}${hash ?? ''}`}>
                {leaf.label}
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
  );
}

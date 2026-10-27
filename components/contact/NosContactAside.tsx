// =============================================================
// NOS — components/contact/NosContactAside.tsx
// Server Component. The contact page's aside (NOS Design CT4): "Looking for something else?" and
// three routing links to the pages that answer the usual questions. Labels and hrefs are read from
// the show nav by leaf id, never retyped. Rows reuse the hub index's list rules and arrow glyph
// (nos-structure.css `.nos-index-group`); the gold ring is one scoped rule on `.nos-contact-aside`.
// =============================================================

import Link from 'next/link';

import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import type { NavLeaf } from '@/components/chrome/nav-config';
import { nosPath } from '@/lib/nos-paths';

const HEADING = 'Looking for something else';

// Order is the ruling's (CT-G1): FAQ, Plan your visit, What to expect.
const ROWS: readonly { id: string }[] = [{ id: 'faq' }, { id: 'plan-your-visit' }, { id: 'what-to-expect' }];

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
    <nav aria-label={HEADING} className="nos-index-group nos-contact-aside">
      <h2 className="nos-ct-label">{HEADING}</h2>
      <ul>
        {ROWS.map(({ id }) => {
          const leaf = LEAVES.get(id);
          if (!leaf) return null;
          return (
            <li key={id}>
              <Link href={nosPath(leaf.href)}>
                {leaf.label}
                <span aria-hidden="true" className="nos-index-arrow">
                  &rarr;
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

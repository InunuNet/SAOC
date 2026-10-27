// =============================================================
// SAOC — components/ui/DocumentLayout.tsx
// Server Component — the 7fr/5fr body grid every document page is built against
// (mission saoc-content-standard). One prose column and at most ONE aside: either the page's own
// contextual card (`aside`) or the h2 index of a long document (`index`).
// =============================================================

import type { ReactNode } from 'react';

import { DocumentIndex, type DocumentIndexEntry } from './DocumentIndex';

export type { DocumentIndexEntry } from './DocumentIndex';

const INDEX_MIN_ENTRIES = 2;

export interface DocumentLayoutProps {
  /** The prose column (7fr). Wrap long copy in <div className="doc-prose"> (60-68ch). */
  children: ReactNode;
  /** CONTENT aside: the page's own contextual block (venue, contact, sponsor CTA). Mutually exclusive with `index`. */
  aside?: ReactNode;
  /** INDEX aside: the h2 index for long documents. Rendered only when it has >= 2 entries. Mutually exclusive with `aside`. */
  index?: readonly DocumentIndexEntry[];
  /** Hairline-free wrapper id for anchors; optional. */
  id?: string;
  /** The content aside comes before the prose in the DOM, so below 1024px it shows (and tabs) first; from 1024px it keeps the right column. Off by default. */
  asideFirst?: boolean;
  /** The aside without its card: no background, padding or shadow. Off by default. */
  asideBare?: boolean;
}

export function DocumentLayout({
  children,
  aside,
  index,
  id,
  asideFirst = false,
  asideBare = false,
}: DocumentLayoutProps) {
  if (aside && index) {
    // A caller bug: one page, one aside. Production keeps the content aside off the index's path.
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('DocumentLayout: pass either `aside` or `index`, not both');
    }
  }
  const indexEntries = !aside && index && index.length >= INDEX_MIN_ENTRIES ? index : null;
  const asideClass = `doc-aside${asideBare ? ' doc-aside--bare' : ''}`;
  const contentAside = aside ? (
    <aside data-doc-aside data-doc-aside-kind="content" className={asideClass}>
      {aside}
    </aside>
  ) : null;

  return (
    <div
      id={id}
      data-doc-layout
      className={`doc-layout saoc-container${indexEntries ? ' doc-layout--index' : ''}${
        asideFirst ? ' doc-layout--aside-first' : ''
      }`}
    >
      {indexEntries ? (
        <aside data-doc-aside data-doc-aside-kind="index" className={asideClass}>
          <DocumentIndex entries={indexEntries} />
        </aside>
      ) : null}
      {asideFirst ? contentAside : null}
      <div data-doc-main>{children}</div>
      {asideFirst ? null : contentAside}
    </div>
  );
}

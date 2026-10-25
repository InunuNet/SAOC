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
}

export function DocumentLayout({ children, aside, index, id }: DocumentLayoutProps) {
  if (aside && index) {
    // A caller bug: one page, one aside. Production keeps the content aside off the index's path.
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('DocumentLayout: pass either `aside` or `index`, not both');
    }
  }
  const indexEntries = !aside && index && index.length >= INDEX_MIN_ENTRIES ? index : null;

  return (
    <div
      id={id}
      data-doc-layout
      className={`doc-layout saoc-container${indexEntries ? ' doc-layout--index' : ''}`}
    >
      <div data-doc-main>{children}</div>
      {aside ? (
        <aside data-doc-aside data-doc-aside-kind="content" className="doc-aside">
          {aside}
        </aside>
      ) : null}
      {indexEntries ? (
        <aside data-doc-aside data-doc-aside-kind="index" className="doc-aside">
          <DocumentIndex entries={indexEntries} />
        </aside>
      ) : null}
    </div>
  );
}

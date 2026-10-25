import type { ReactNode } from 'react';

import type { DocumentIndexEntry } from '@/components/ui/DocumentLayout';

import type { LegalBlock, LegalDocument } from './types';

// =============================================================
// SAOC — components/legal/LegalBody.tsx
// Server Component — renders a LegalDocument's blocks. One renderer for
// Privacy, Terms and the company documents so the three pages cannot drift.
// It is the long-document base of the content standard: the prose column of a
// DocumentLayout, with doc-h2 headings and, for Privacy and Terms, an index.
// =============================================================

// A legal document's hero is as tall as its content: the first section heading must land in the first
// screen, so the 480px floor of the other heroes does not apply here.
export const LEGAL_HERO_MIN_HEIGHT = '0px';

const INLINE = /\*\*([^*]+)\*\*|<((?:https?:\/\/|mailto:)[^>]+)>/g;
const LINK_CLASS = 'text-ink underline underline-offset-2';
const PARAGRAPH_CLASS = 'font-sans text-[16px] leading-[1.55] text-ink/85';

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const [, bold, url] = match;
    if (bold !== undefined) {
      nodes.push(
        <strong key={match.index} className="font-medium text-ink">
          {bold}
        </strong>
      );
    } else {
      nodes.push(
        <a key={match.index} href={url} className={LINK_CLASS}>
          {url.replace(/^mailto:/, '')}
        </a>
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** The h2 anchors of a document by block position; a repeated heading takes its position as a suffix. */
function headingIds(document: LegalDocument): Map<number, string> {
  const ids = new Map<number, string>();
  const taken = new Set<string>();
  document.blocks.forEach((block, position) => {
    if (block.kind !== 'h2') return;
    const base = slugOf(block.text);
    const id = taken.has(base) ? `${base}-${position}` : base;
    taken.add(id);
    ids.set(position, id);
  });
  return ids;
}

/** The index aside's entries: one per h2, matching the ids LegalBody renders. */
export function legalIndex(document: LegalDocument): DocumentIndexEntry[] {
  const ids = headingIds(document);
  return document.blocks.flatMap((block, position) =>
    block.kind === 'h2' ? [{ id: ids.get(position) ?? '', label: block.text }] : [],
  );
}

function renderBlock(block: LegalBlock, index: number, ids: Map<number, string>): ReactNode {
  switch (block.kind) {
    case 'h2':
      return (
        <h2 key={index} id={ids.get(index)} className="doc-h2">
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={index} className="doc-h3">
          {block.text}
        </h3>
      );
    case 'p':
      return (
        <p key={index} className={PARAGRAPH_CLASS}>
          {renderInline(block.text)}
        </p>
      );
    case 'lines':
      return (
        <div key={index} className="space-y-1">
          {block.lines.map((line) => (
            <p key={line} className={PARAGRAPH_CLASS}>
              {renderInline(line)}
            </p>
          ))}
        </div>
      );
    case 'list':
      return (
        <ul key={index} className={`list-disc pl-5 space-y-2 ${PARAGRAPH_CLASS}`}>
          {block.items.map((item) => (
            <li key={item}>{renderInline(item)}</li>
          ))}
        </ul>
      );
  }
}

export function LegalBody({ document }: { document: LegalDocument }) {
  const ids = headingIds(document);
  return (
    <div className="doc-prose">
      {document.blocks.map((block, position) => renderBlock(block, position, ids))}
    </div>
  );
}

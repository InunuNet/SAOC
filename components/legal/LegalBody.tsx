import type { ReactNode } from 'react';

import type { LegalBlock, LegalDocument } from './types';

// =============================================================
// SAOC — components/legal/LegalBody.tsx
// Server Component — renders a LegalDocument's blocks. One renderer for
// Privacy, Terms and the company documents so the three pages cannot drift.
// =============================================================

const INLINE = /\*\*([^*]+)\*\*|<((?:https?:\/\/|mailto:)[^>]+)>/g;
const LINK_CLASS = 'text-ink underline underline-offset-2';
const PARAGRAPH_CLASS = 'font-sans text-[16px] leading-relaxed text-ink/80';

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

function renderBlock(block: LegalBlock, index: number): ReactNode {
  switch (block.kind) {
    case 'h2':
      return (
        <h2 key={index} className="pt-6 font-serif font-normal text-[22px] text-primary">
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={index} className="pt-2 font-serif font-normal text-[18px] text-primary">
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
  return (
    <div className="mx-auto max-w-[720px] px-8 py-20 space-y-4">
      {document.blocks.map(renderBlock)}
    </div>
  );
}

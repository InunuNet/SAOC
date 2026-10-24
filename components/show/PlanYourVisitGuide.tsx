// =============================================================
// NOS — components/show/PlanYourVisitGuide.tsx
// Server Component. Lee-Ann's Plan Your Visit guide (24 Oct 2026), rendered as one long-form element.
// The copy lives in content/plan-your-visit/guide.ts, word for word; this component adds no text of
// its own. Her links open in a new tab with rel="noopener noreferrer".
// =============================================================

import type { ReactNode } from 'react';

export type PlanGuideBlock =
  | { kind: 'h2' | 'h3' | 'lead' | 'p'; text: string }
  | { kind: 'list'; items: string[] };

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:[^)]+)\)/g;
const LINK_CLASS = 'text-primary underline underline-offset-2 hover:text-ink';
const BODY_CLASS = 'font-sans text-[length:var(--fs-body,1rem)] leading-[1.6] text-ink/80';

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const [, bold, italic, label, url] = match;
    if (bold !== undefined) {
      nodes.push(
        <strong key={match.index} className="font-semibold text-ink">
          {bold}
        </strong>
      );
    } else if (italic !== undefined) {
      nodes.push(<em key={match.index}>{italic}</em>);
    } else {
      nodes.push(
        <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {label}
        </a>
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderBlock(block: PlanGuideBlock, index: number): ReactNode {
  switch (block.kind) {
    case 'h2':
      return (
        <h2 key={index} className="pt-8 font-serif text-[28px] font-medium leading-tight text-primary">
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={index} className="pt-3 font-serif text-[20px] font-medium text-ink">
          {block.text}
        </h3>
      );
    case 'lead':
      return (
        <p key={index} className={`${BODY_CLASS} font-semibold text-ink`}>
          {block.text}
        </p>
      );
    case 'p':
      return (
        <p key={index} className={BODY_CLASS}>
          {renderInline(block.text)}
        </p>
      );
    case 'list':
      return (
        <ul key={index} className={`list-disc space-y-2 pl-5 ${BODY_CLASS}`}>
          {block.items.map((item) => (
            <li key={item}>{renderInline(item)}</li>
          ))}
        </ul>
      );
  }
}

export function PlanYourVisitGuide({ blocks }: { blocks: readonly PlanGuideBlock[] }) {
  return (
    <div data-plan-guide="" className="max-w-3xl space-y-4">
      {blocks.map(renderBlock)}
    </div>
  );
}

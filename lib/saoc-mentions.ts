// =============================================================
// lib/saoc-mentions.ts
// Pure helpers behind the NOS rule (Brad, 19 Nov 2026): every mention of "SAOC" or "South African
// Orchid Council" in NOS page copy links back to the SAOC site. Plain strings are split into
// segments; Sanity portable text gets the matches wrapped in a link mark.
// =============================================================

export const SAOC_MENTION_MARK = 'saocLink';
export { NEW_TAB_CUE } from './link-target.ts';

// The capturing group makes String.split keep the matched names at the odd indexes.
const MENTION_SPLIT = /\b(South African Orchid Council|SAOC)\b/;

export interface TextSegment {
  text: string;
  isSaoc: boolean;
}

/** Splits `text` into plain and SAOC-mention segments, in order, dropping empty pieces. */
export function splitSaocMentions(text: string): TextSegment[] {
  return text
    .split(MENTION_SPLIT)
    .map((piece, index) => ({ text: piece, isSaoc: index % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}

interface SpanLike {
  _type: 'span';
  text: string;
  marks?: string[];
}

interface BlockLike {
  _type: string;
  _key?: string;
  children?: unknown[];
  markDefs?: { _key: string; _type: string }[];
}

function isSpan(child: unknown): child is SpanLike {
  if (typeof child !== 'object' || child === null) return false;
  const candidate = child as { _type?: unknown; text?: unknown }; // narrowed by the checks below
  return candidate._type === 'span' && typeof candidate.text === 'string';
}

const LINK_MARK_TYPES = new Set(['link', SAOC_MENTION_MARK]);

/** True when the span already sits inside a link annotation, so a second link would nest anchors. */
function hasLinkMark(span: SpanLike, markDefs: BlockLike['markDefs']): boolean {
  return (span.marks ?? []).some((mark) =>
    (markDefs ?? []).some((def) => def._key === mark && LINK_MARK_TYPES.has(def._type)),
  );
}

/**
 * Returns the blocks with every SAOC mention in a span moved into its own span that carries a
 * `saocLink` mark. Blocks and spans without a mention, or already inside a link, are returned untouched.
 */
export function linkSaocInBlocks<T extends { _type: string }>(blocks: readonly T[]): T[] {
  return blocks.map((original) => {
    const block = original as unknown as BlockLike; // portable text blocks are open-shaped Sanity data
    if (block._type !== 'block' || !Array.isArray(block.children)) return original;
    const markDefs = [...(block.markDefs ?? [])];
    const children: unknown[] = [];
    block.children.forEach((child, childIndex) => {
      if (!isSpan(child) || !MENTION_SPLIT.test(child.text) || hasLinkMark(child, block.markDefs)) {
        children.push(child);
        return;
      }
      splitSaocMentions(child.text).forEach((segment, segmentIndex) => {
        const key = `${block._key ?? 'b'}-saoc-${childIndex}-${segmentIndex}`;
        if (segment.isSaoc) markDefs.push({ _key: key, _type: SAOC_MENTION_MARK });
        children.push({
          ...child,
          _key: key,
          text: segment.text,
          marks: segment.isSaoc ? [...(child.marks ?? []), key] : child.marks,
        });
      });
    });
    return { ...block, markDefs, children } as unknown as T; // same shape, mentions split into marked spans
  });
}

// lib/view-models/presenter-bio.ts
//
// nos-presenter-cards (F1) — splits a stored bio into paragraph and list blocks (golden §5).
// Bios are stored one block per line, with "• " marking list items. Text is returned exactly
// as stored: no trimming of inner spaces, no punctuation or typographic fixes.

export type BioBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

const BULLET_PREFIX = '• ';

export function parseBio(text: string | null): BioBlock[] {
  const blocks: BioBlock[] = [];
  if (!text) return blocks;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.trim() === '') continue;

    if (line.startsWith(BULLET_PREFIX)) {
      const item = line.slice(BULLET_PREFIX.length);
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(item);
      else blocks.push({ kind: 'ul', items: [item] });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }
  return blocks;
}

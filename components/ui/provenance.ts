// =============================================================
// SAOC — components/ui/provenance.ts
// Launch-weekend F19 (vote 1C). The text patterns of facts that the Council's Drive does not source
// (an invented editor, page count and ISSN, a society and judge count, the 1990 standardisation, the
// 100-point scale, award thresholds and criteria). Pages that render Sanity or fallback prose use
// `isUnsourced` to leave those blocks out on the public build; the beta preview shows them marked.
// Mirrors provenance.unsourced in
// .agent/memory/project/specs/launch-weekend/goldens/f19/tokens.json: keep the two in step.
// =============================================================

import type { PortableTextBlock } from '@portabletext/react';

const UNSOURCED_PATTERNS: readonly RegExp[] = [
  /Lindiwe|Khumalo/,
  /\b184\b/,
  /1816-0336|\bISSN\b/,
  /yearbook/i,
  /Orchids South Africa/,
  /federat/i,
  /standardis|overhaul|\b1990\b/i,
  /\b21\b|twenty-one/,
  /\b56\b/,
  /National Shows Hosted/,
  /Accredited Judges/,
  /100-point|100 point/,
  /triennial/i,
  /\bpts\b|point threshold|criteria|structured training/i,
  /partners behind SAOC/,
];

export function isUnsourced(text: string): boolean {
  return UNSOURCED_PATTERNS.some((pattern) => pattern.test(text));
}

function blockText(block: PortableTextBlock): string {
  const children = (block as { children?: { text?: string }[] }).children ?? [];
  return children.map((child) => child.text ?? '').join('');
}

/** The Sanity blocks that state no unsourced fact; `null` when none are left. */
export function sourcedBlocks(
  blocks: PortableTextBlock[] | null | undefined,
): PortableTextBlock[] | null {
  const kept = (blocks ?? []).filter((block) => !isUnsourced(blockText(block)));
  return kept.length > 0 ? kept : null;
}

// Society detail-page metadata. Pure: no Sanity or firebase-admin imports, so it is checkable
// against fixtures. The canonical and og:url come from buildPageMetadata, i.e. from the
// configured SAOC origin, never a hard-coded host.

import type { Metadata } from 'next';

import { buildPageMetadata, cutAtSentence, DESCRIPTION_MIN } from '@/lib/seo';

const DESCRIPTION_MAX = 160;

export interface SocietyMetadataInput {
  name: string;
  slug: string;
  description: string | null;
  region: string | null;
}

const ELLIPSIS = '…';
const TRAILING_BREAK = /[\s,;:-]+$/;

/** `text` with whitespace collapsed and, when over `max`, cut at its last whole sentence (if that
 *  leaves a usable description), else at the last whole word with an ellipsis. Every result is the
 *  source text or a prefix of it. */
export function fitSocietyDescription(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const sentence = cutAtSentence(flat, max);
  if (sentence && sentence.length >= DESCRIPTION_MIN) return sentence;
  const room = max - ELLIPSIS.length;
  const cut = flat.lastIndexOf(' ', room);
  const stem = (cut > 0 ? flat.slice(0, cut) : flat.slice(0, room)).replace(TRAILING_BREAK, '');
  return stem + ELLIPSIS;
}

export function buildSocietyMetadata(society: SocietyMetadataInput): Metadata {
  const trimmed = society.description ? fitSocietyDescription(society.description, DESCRIPTION_MAX) : '';
  const description =
    trimmed ||
    (society.region
      ? `${society.name} — affiliated SAOC society in ${society.region}.`
      : `${society.name} — an affiliated SAOC society.`);
  return buildPageMetadata({
    title: society.name,
    description,
    path: `/societies/${society.slug}`,
  });
}

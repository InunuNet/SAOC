// Society detail-page metadata. Pure: no Sanity or firebase-admin imports, so it is checkable
// against fixtures. The canonical and og:url come from buildPageMetadata, i.e. from the
// configured SAOC origin, never a hard-coded host.

import type { Metadata } from 'next';

import { buildPageMetadata } from '@/lib/seo';

const DESCRIPTION_MAX = 160;

export interface SocietyMetadataInput {
  name: string;
  slug: string;
  description: string | null;
  region: string | null;
}

/** `text` with whitespace collapsed, cut to the longest prefix of at most `max` chars that ends
 *  on a whole word. Unchanged when it already fits. */
export function trimAtWord(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.lastIndexOf(' ', max);
  return cut > 0 ? flat.slice(0, cut) : flat.slice(0, max);
}

export function buildSocietyMetadata(society: SocietyMetadataInput): Metadata {
  const description = society.description
    ? trimAtWord(society.description, DESCRIPTION_MAX)
    : society.region
      ? `${society.name} — affiliated SAOC society in ${society.region}.`
      : `${society.name} — an affiliated SAOC society.`;
  return buildPageMetadata({
    title: society.name,
    description,
    path: `/societies/${society.slug}`,
  });
}

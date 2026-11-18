/**
 * Global-search matching over the listed societies (the `societyListQuery` result). Pure so the
 * regression check can exercise it. Hidden societies never reach here: the query filters them.
 */

export interface SocietySearchHit {
  name: string;
  slug: string;
  province: string | null;
  region: string | null;
  meets?: string | null;
  venue?: string | null;
  description?: string | null;
}

export const MAX_SOCIETY_SEARCH_RESULTS = 5;

export function searchTokens(rawTerm: string): string[] {
  return rawTerm
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function societyMatches(society: SocietySearchHit, tokens: readonly string[]): boolean {
  const fields = [
    society.name,
    society.province,
    society.region,
    society.meets,
    society.venue,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  return tokens.every((token) => fields.some((field) => field.includes(token)));
}

export function matchSocieties(
  societies: readonly SocietySearchHit[],
  rawTerm: string,
): SocietySearchHit[] {
  const tokens = searchTokens(rawTerm);
  if (tokens.length === 0) return [];
  return societies
    .filter((s) => societyMatches(s, tokens))
    .slice(0, MAX_SOCIETY_SEARCH_RESULTS)
    .map((s) => ({ name: s.name, slug: s.slug, province: s.province, region: s.region }));
}

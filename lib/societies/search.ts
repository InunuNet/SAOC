/**
 * Global-search matching over the listed societies (the `societyListQuery` result). Pure so the
 * regression check can exercise it. Hidden societies never reach here: the query filters them.
 */

export interface SocietySearchHit {
  name: string;
  slug: string;
  province: string | null;
  region: string | null;
}

export const MAX_SOCIETY_SEARCH_RESULTS = 5;

export function matchSocieties(
  societies: readonly SocietySearchHit[],
  rawTerm: string,
): SocietySearchHit[] {
  const term = rawTerm.trim().toLowerCase();
  if (term.length === 0) return [];
  return societies
    .filter((s) =>
      [s.name, s.province, s.region].some((v) => v !== null && v.toLowerCase().includes(term)),
    )
    .slice(0, MAX_SOCIETY_SEARCH_RESULTS)
    .map((s) => ({ name: s.name, slug: s.slug, province: s.province, region: s.region }));
}

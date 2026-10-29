// Province chip counts for /societies. A society with no province counts only toward ALL.
export const ALL_PROVINCES = 'ALL';

export function provinceCounts(
  societies: { province: string | null }[],
  provinces: { code: string }[],
): Record<string, number> {
  const counts: Record<string, number> = { [ALL_PROVINCES]: societies.length };
  for (const p of provinces) counts[p.code] = 0;
  for (const s of societies) {
    if (!s.province) continue;
    const province = s.province.toUpperCase();
    const code = provinces.find((p) => p.code.toUpperCase() === province)?.code;
    if (code !== undefined) counts[code] += 1;
  }
  return counts;
}

type MaybeProvince = { province?: string | null };

// The province chip row is only truthful when every listed society carries a province: until
// then a chip filters to a subset and implies the rest do not exist. Null, undefined, empty and
// whitespace-only all count as missing.
export function allSocietiesHaveProvince(societies: MaybeProvince[]): boolean {
  return societies.every((s) => (s.province ?? '').trim() !== '');
}

// A stale ?province= param must never hide results behind a chip row the visitor cannot see.
export function effectiveProvinceFilter(requested: string, chipsVisible: boolean): string {
  return chipsVisible ? requested : ALL_PROVINCES;
}

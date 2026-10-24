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

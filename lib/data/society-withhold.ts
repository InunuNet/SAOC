// nos-critique-r15 F1 (lead ruling, F24 vote 1C): on the public build the unsourced per-society
// estimates are withheld in the server data, before anything reaches a client component, so the
// figures leave the HTML and the RSC payload as well as the rendered card. A field is withheld only
// when its own placeholder flag is true; sourced figures (flag false or absent) pass through.

interface EstimatedFigures {
  founded: number | null;
  memberCount: number | null;
  foundedPlaceholder?: boolean | null;
  memberCountPlaceholder?: boolean | null;
}

export function withholdSocietyEstimates<T extends EstimatedFigures>(society: T, withhold: boolean): T {
  if (!withhold) return society;
  const shown = { ...society };
  if (society.foundedPlaceholder === true) {
    shown.founded = null;
    shown.foundedPlaceholder = false;
  }
  if (society.memberCountPlaceholder === true) {
    shown.memberCount = null;
    shown.memberCountPlaceholder = false;
  }
  return shown;
}

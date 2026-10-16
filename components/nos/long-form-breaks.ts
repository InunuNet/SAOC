// =============================================================
// NOS — components/nos/long-form-breaks.ts
// The ONE map of which long-form route carries which image break, and after which paragraph
// (the lede counts as paragraph 1). A break is a SECOND role beside the five hero photographs
// (R29, hero-photos.ts): only the five rights-cleared production files may appear, each at most
// once as a break, and never the photograph that heads the same route.
// Mirrored in .agent/memory/project/specs/launch-weekend/goldens/f18/break-photo-map.json.
// =============================================================

export interface LongFormBreak {
  src: string;
  /** The break follows this many paragraphs, the lede included. */
  after: number;
}

export const LONG_FORM_BREAKS: Readonly<Record<string, LongFormBreak>> = {
  '/national-show/about': { src: '/images/orchid-violet.jpg', after: 3 },
  '/national-show/what-to-expect': { src: '/images/orchid-dark.jpg', after: 3 },
  '/national-show/vendors': { src: '/images/orchid-purple.jpg', after: 2 },
  '/national-show/sa-exhibitors': { src: '/images/orchid-yellow.jpg', after: 2 },
};

export function longFormBreakFor(route: string): LongFormBreak {
  const entry = LONG_FORM_BREAKS[route];
  if (!entry) throw new Error(`long-form-breaks: no image break mapped for ${route}`);
  return entry;
}

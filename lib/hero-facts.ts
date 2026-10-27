// =============================================================
// SAOC — lib/hero-facts.ts
// The facts row under a page hero (mission saoc-content-standard, DS-1 r2).
// Provenance of each value lives in the route's code comment, not in the type.
// =============================================================

export interface HeroFact {
  /** The label, rendered as <dt>. Sentence case, 15px sans. */
  term: string;
  /** The value, rendered as <dd>. Copied verbatim from the page's source record. */
  value: string;
}

export const HERO_FACTS_MIN = 2;
export const HERO_FACTS_MAX = 4;

/**
 * Drops any fact whose term or value is empty after trim (an absent field drops out; there is no
 * filler text and no placeholder field). Returns null when fewer than HERO_FACTS_MIN remain (one
 * fact is not a row). More than HERO_FACTS_MAX is a caller bug: throws outside production, where
 * it keeps the first HERO_FACTS_MAX.
 */
export function normaliseHeroFacts(
  facts: readonly HeroFact[] | undefined,
): readonly HeroFact[] | null {
  if (!facts) return null;
  const present = facts.filter((fact) => fact.term.trim() !== '' && fact.value.trim() !== '');
  if (present.length > HERO_FACTS_MAX) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`PageHero facts: ${present.length} facts, the most allowed is ${HERO_FACTS_MAX}`);
    }
    return present.slice(0, HERO_FACTS_MAX);
  }
  return present.length < HERO_FACTS_MIN ? null : present;
}

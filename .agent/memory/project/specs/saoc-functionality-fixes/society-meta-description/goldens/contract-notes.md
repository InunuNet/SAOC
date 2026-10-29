# society-meta-description goldens

Input: society.description (flattened whitespace). Limit: 160 chars (existing DESCRIPTION_MAX), unchanged.
1. Fits (<= 160): returned as written (whitespace collapsed), as today.
2. Longer: cut at the last sentence end (`. ! ?` followed by space or end) within 160 via `cutAtSentence` from lib/seo.ts, provided the
   result is >= 70 chars (the same floor lib/seo.ts uses for a usable description; DESCRIPTION_MIN there is module-private, so the dev
   may export it or restate it as a named constant).
3. Otherwise: cut at the last word boundary within 159 chars, strip trailing whitespace/`,;:-`, append a single `…` (U+2026). Total <= 160.
No new copy: every output is the source text or a prefix of it plus the ellipsis. Empty-description fallbacks unchanged.

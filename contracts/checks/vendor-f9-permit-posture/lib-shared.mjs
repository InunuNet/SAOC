// F9 (vendor-registration) — shared helpers for the permit-posture checks.
// Normalises whitespace before substring matching so JSX line-wrapping / prettier
// reformatting cannot defeat a check that is really about copy content, not layout.

export function normalize(source) {
  return source.replace(/\s+/g, ' ').trim();
}

export function containsNormalized(source, phrase) {
  return normalize(source).includes(normalize(phrase));
}

// Returns the 0-based line index of the first line containing `needle`, or -1.
export function firstLineIndexContaining(source, needle) {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return i;
  }
  return -1;
}

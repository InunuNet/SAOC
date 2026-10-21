// nos-critique-r6 f6 (Codi P1 + Codex P2): the ONE reference rule for "the first sentence of the exhibitors intro", shared by f6-static (unit cases) and
// f6-rendered (what the public lede must equal). The dev's firstSentence() in exhibitors/page.tsx implements the same rule.
//   boundary   [.!?] + optional closing chars ["'\u201d\u2019)\]]* + whitespace
//   skip       a '.' boundary whose preceding token is an honorific title (dr, mr, mrs, ms, prof, st; case-insensitive)
//   fail closed no boundary -> null (public mode then renders NO lede at all)
// Honorific titles ONLY: they never end a sentence. etc., vs., no., e.g. and i.e. CAN end one, so skipping them would leak the next sentence (Codex P2).
export const ABBREVIATIONS = ['dr', 'mr', 'mrs', 'ms', 'prof', 'st'];
export const NOT_ABBREVIATIONS = ['etc', 'vs', 'no', 'e.g', 'i.e'];
const BOUNDARY = /[.!?]["'\u201d\u2019)\]]*\s/g;

export function firstSentence(text) {
  for (const b of text.matchAll(BOUNDARY)) {
    const word = /([A-Za-z.]+)$/.exec(text.slice(0, b.index))?.[1]?.toLowerCase();
    if (b[0].startsWith('.') && word && ABBREVIATIONS.includes(word)) continue;
    return text.slice(0, b.index + b[0].trimEnd().length);
  }
  return null;
}

/** [input, expected] pairs; run by f6-static. */
export const CASES = [
  ['This page covers entry. Most of what follows is established practice.', 'This page covers entry.'],
  ['He said \u201center early.\u201d The rest is provenance.', 'He said \u201center early.\u201d'],
  ['See the rules (all of them.) Then more.', 'See the rules (all of them.)'],
  ['Dr. Smith chairs the committee. Provenance follows.', 'Dr. Smith chairs the committee.'],
  ['Fees apply for seniors, etc. Most of what follows is established practice.', 'Fees apply for seniors, etc.'],
  ['Entry is free for juniors, e.g. under twelve. Provenance.', 'Entry is free for juniors, e.g.'],
  ['Prof. Jones and Mrs. Lee judge. Provenance.', 'Prof. Jones and Mrs. Lee judge.'],
  ['Is it open? Not yet. More.', 'Is it open?'],
  ['A single sentence with no boundary', null],
  ['', null],
];

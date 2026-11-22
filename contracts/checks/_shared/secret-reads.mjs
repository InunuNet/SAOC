// Structural-lint helper (JS twin of secret_reads.py): find REAL getSecret('NAME') calls and direct
// process.env reads in a TypeScript source string.
//
// Comments are blanked and string/template-literal CONTENTS are masked to `_` in a second view; both
// views keep identical offsets. A call is matched on the MASKED text (so `console.error("getSecret('X')")`
// or a comment naming it never counts) and the NAME argument, itself a string literal and so masked,
// is read back from the CLEAN text.
//
// A secret in an apphosting.yaml bundle is only visible through getSecret() in production, so callers
// require a getSecret call and treat a direct process.env read of that name as a failure.

const QUOTES = new Set(["'", '"', '`']);
const CALL = /\bgetSecret\s*\(\s*(['"`])(_*)\1\s*[,)]/g;
const ENV_DOT = /\bprocess\s*\.\s*env\s*\.\s*([A-Za-z_]\w*)/g;
const ENV_BRACKET = /\bprocess\s*\.\s*env\s*\[\s*(['"`])(_*)\1\s*\]/g;

export function views(raw) {
  const clean = [];
  const masked = [];
  const blank = (ch) => (ch === '\n' ? '\n' : ' ');
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (ch === '/' && next === '*') {
      const end = raw.indexOf('*/', i + 2);
      const stop = end === -1 ? raw.length : end + 2;
      for (; i < stop; i++) {
        clean.push(blank(raw[i]));
        masked.push(blank(raw[i]));
      }
    } else if (ch === '/' && next === '/') {
      for (; i < raw.length && raw[i] !== '\n'; i++) {
        clean.push(' ');
        masked.push(' ');
      }
    } else if (QUOTES.has(ch)) {
      clean.push(ch);
      masked.push(ch);
      i++;
      for (; i < raw.length && raw[i] !== ch; i++) {
        if (raw[i] === '\\' && i + 1 < raw.length) {
          clean.push(raw[i], raw[i + 1]);
          masked.push('_', '_');
          i++;
        } else {
          clean.push(raw[i]);
          masked.push(raw[i] === '\n' ? '\n' : '_');
        }
      }
      if (i < raw.length) {
        clean.push(ch);
        masked.push(ch);
        i++;
      }
    } else {
      clean.push(ch);
      masked.push(ch);
      i++;
    }
  }
  return { clean: clean.join(''), masked: masked.join('') };
}

function nameOf(clean, match) {
  // match.indices is not used for portability; group 2 sits right after the opening quote.
  const start = match.index + match[0].indexOf(match[1]) + 1;
  return clean.slice(start, start + match[2].length);
}

/** Names passed to real getSecret('NAME') calls. */
export function secretCallNames(raw) {
  const { clean, masked } = views(raw);
  return [...masked.matchAll(CALL)].map((m) => nameOf(clean, m));
}

/** Names read directly from process.env (dot or bracket form). */
export function envReadNames(raw) {
  const { clean, masked } = views(raw);
  return [
    ...[...masked.matchAll(ENV_DOT)].map((m) => m[1]),
    ...[...masked.matchAll(ENV_BRACKET)].map((m) => nameOf(clean, m)),
  ];
}

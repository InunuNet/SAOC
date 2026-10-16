#!/usr/bin/env node
// F7a-A1 - static contrast rules on SAOC-owned components and routes. Token values are never edited; each rule bans a
// class combination whose measured ratio fails WCAG 1.4.3 and names the existing-token replacement.
//   bg-accent (#9e8c6b) with text-ivory 2.94:1 or text-primary 3.24:1  -> text-ink 5.40:1 (the handoff .btn--accent) or text-primary-800 4.61:1
//   text-ivory/N, N < 55 on a dark surface (ivory/45 = 3.92:1)        -> text-ivory/65 (the handoff --fg-on-dark-muted) or higher
//   text-ink/N, N < 65 on paper (ink/60 = 4.48:1)                      -> text-ink/70 or higher, or text-muted
// Brass text on paper (text-accent, 2.94:1) cannot be caught by a class rule (it passes on --primary-800), so the
// runtime axe check (F7a-A2) is the arbiter for it; see the DESIGN QUESTION in the spec.
import { read, walk, report } from './_lib.mjs';

const EXCLUDE = [
  /^components\/nos\//, /^components\/nos-chrome\//, /^components\/show\/nos\//,
  /^app\/\(marketing\)\/national-show\//, /^app\/admin\//, /^app\/studio\//, /^components\/admin\//,
];
const files = [...walk('app', ['.tsx']), ...walk('components', ['.tsx'])].filter((f) => !EXCLUDE.some((r) => r.test(f)));
// Single/double-quoted literals stay on one line (an apostrophe in JSX prose must not pair across lines); backticks may span lines.
// A literal only counts when every token looks like a class name, so prose can never be mistaken for one.
const LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;
const CLASSY = /^[\w:[\]/.\-%!#()&>*,=]+$/;
const BAD_ON_ACCENT = new Set(['text-ivory', 'text-primary', 'text-parchment', 'text-bone', 'text-white', 'text-accent']);
const OK_ON_ACCENT = new Set(['text-ink', 'text-primary-800']);
const problems = [];

for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(LITERAL)) {
    const tokens = (m[1] ?? m[2] ?? m[3]).split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || !tokens.every((t) => CLASSY.test(t))) continue;
    const line = src.slice(0, m.index).split('\n').length;
    if (tokens.includes('bg-accent')) {
      const bad = tokens.filter((t) => BAD_ON_ACCENT.has(t));
      if (bad.length) problems.push(`${f}:${line} bg-accent with ${bad.join(' ')} (fails 1.4.3)`);
      else if (!tokens.some((t) => OK_ON_ACCENT.has(t))) problems.push(`${f}:${line} bg-accent without an explicit text-ink or text-primary-800`);
    }
    for (const t of tokens) {
      const iv = /^text-ivory\/(\d+)$/.exec(t);
      if (iv && Number(iv[1]) < 55) problems.push(`${f}:${line} ${t} on a dark surface is below 4.5:1 (use /65 or higher)`);
      const ink = /^text-ink\/(\d+)$/.exec(t);
      if (ink && Number(ink[1]) < 65) problems.push(`${f}:${line} ${t} on paper is below 4.5:1 (use /70 or higher)`);
    }
  }
}
// NOS scope: --accent is violet (#7e3f97) inside .nos-theme, where text-ink is 2.25:1. The one sanctioned override keeps the ivory text
// the show pages already had (about 6.8:1); it must stay a token and stay scoped to .nos-theme.
const css = read('app/globals.css');
if (!/\.nos-theme\s+\.bg-accent\.text-ink\s*\{\s*color:\s*var\(--ivory\);?\s*\}/.test(css)) problems.push('app/globals.css: the scoped `.nos-theme .bg-accent.text-ink { color: var(--ivory) }` override is missing or not token-based');
report(problems, `${files.length} SAOC component/route files clean of failing accent, ivory and ink-opacity combinations`);

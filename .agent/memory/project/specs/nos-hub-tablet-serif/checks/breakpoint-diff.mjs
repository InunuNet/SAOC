// Pure check of the 768 cut's two-line diff (A20), shared by check-static.mjs and the selftest. `diff` is the `git diff -U0` output for one file.
// Rule: exactly one line removed and one added; the removed line holds `from`, the added line holds `to`. The match is on the breakpoint text itself
// (`media="(max-width: 779px)"`), NOT on the surrounding JSX, so a <source> reformatted across lines (one attribute per line) still matches.
export function breakpointFailures(file, diff, from, to) {
  const changed = diff.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  const removed = changed.filter((l) => l.startsWith('-')); const added = changed.filter((l) => l.startsWith('+'));
  const out = [];
  if (!(removed.length === 1 && added.length === 1)) out.push(`${file}: exactly one line removed and one added (got -${removed.length} +${added.length})`);
  if (!(removed.length === 1 && removed[0].includes(from))) out.push(`${file}: the removed line holds \`${from}\``);
  if (!(added.length === 1 && added[0].includes(to))) out.push(`${file}: the added line holds \`${to}\``);
  return out;
}

export function selftest() {
  const bad = [];
  const expect = (name, got) => { if (got.length !== 0) bad.push(`${name}: ${got.join('; ')}`); };
  const reject = (name, got) => { if (got.length === 0) bad.push(`${name}: expected a failure`); };
  const FROM = 'media="(max-width: 779px)"'; const TO = 'media="(max-width: 767px)"';
  const multi = '--- a/x\n+++ b/x\n@@ -246 +246 @@\n-                media="(max-width: 779px)"\n+                media="(max-width: 767px)"\n';
  const single = '@@ -1 +1 @@\n-<source media="(max-width: 779px)" srcSet={a} />\n+<source media="(max-width: 767px)" srcSet={a} />\n';
  expect('the multi-line <source> form (the attribute on its own line) is accepted', breakpointFailures('NosHeader.tsx', multi, FROM, TO));
  expect('the single-line <source> form is accepted', breakpointFailures('NosHeader.tsx', single, FROM, TO));
  reject('a second changed line is rejected', breakpointFailures('NosHeader.tsx', `${multi}-extra\n+extra\n`, FROM, TO));
  reject('no change is rejected', breakpointFailures('NosHeader.tsx', '', FROM, TO));
  reject('the wrong breakpoint is rejected', breakpointFailures('NosHeader.tsx', multi.replace('767', '800'), FROM, TO));
  return bad;
}

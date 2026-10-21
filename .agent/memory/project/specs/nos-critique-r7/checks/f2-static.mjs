// nos-critique-r7 f2 static (Codi P3): text-wrap: pretty on the NosHero lede, one property.
//   S1  the nos-theme.css diff vs BASE adds exactly one "text-wrap: pretty;" line and removes nothing; on the stacked branch F3's --gold token lines and their comment lines may ride along
//   S2  that line sits inside the .nos-theme .nos-hero-lede rule
//   S3  NosHero.tsx is unchanged vs BASE (the lede already carries .nos-hero-lede)
import { NS, finish, git, readBaseFile, readRepoFile } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const rel = `${NS}/nos-theme.css`;
const css = readRepoFile(rel);
const base = readBaseFile(rel);
if (css === null || base === null) fail(`${rel} is missing at HEAD or BASE`);
else {
  const lines = css.split('\n');
  const baseLines = base.split('\n');
  const baseSet = new Map();
  for (const l of baseLines) baseSet.set(l, (baseSet.get(l) ?? 0) + 1);
  const extra = [];
  for (const l of lines) { const n = baseSet.get(l) ?? 0; if (n > 0) baseSet.set(l, n - 1); else extra.push(l.trim()); }
  const removed = [...baseSet.values()].reduce((a, b) => a + b, 0);
  if (removed !== 0) fail(`nos-theme.css removes ${removed} BASE line(s) (S1)`);
  const wraps = extra.filter((l) => l === 'text-wrap: pretty;');
  if (wraps.length !== 1) fail(`want exactly one added "text-wrap: pretty;" line, got ${wraps.length} (S1)`);
  const F3_OK = /^(--gold(-100|-300)?:\s*#[0-9a-fA-F]{6};|\/\*.*|\*.*|.*\*\/|)$/; // F3 tokens, comment lines, blanks
  for (const l of extra) if (l !== 'text-wrap: pretty;' && !F3_OK.test(l)) fail(`unexpected added line in nos-theme.css: "${l.slice(0, 80)}" (S1)`);
  const m = css.match(/\.nos-theme \.nos-hero-lede \{([^}]*)\}/);
  if (!m || !/text-wrap:\s*pretty;/.test(m[1])) fail('text-wrap: pretty must sit inside the .nos-theme .nos-hero-lede rule (S2)');
}
const hero = 'components/nos/NosHero.tsx';
if (git('diff', '--name-only', '1f8ad3de', 'HEAD', '--', hero).trim() !== '') fail(`${hero} must be unchanged vs BASE (S3)`);

finish('f2-static.mjs', failures, 'nos-theme.css gains exactly one line, text-wrap: pretty, inside the .nos-hero-lede rule; NosHero.tsx untouched.');

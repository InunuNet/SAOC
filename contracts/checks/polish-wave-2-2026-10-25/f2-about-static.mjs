// F2 static (/about heritage stats). The bare "1968 Founded" stat sits beside "28 July 1968 Founding date,
// Bloemfontein", so it is removed; the other three stats and the verbatim prose stay. With three stats the
// grid is three columns on sm and up (no empty fourth cell).
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f2-about-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];
const src = read('app/(marketing)/about/page.tsx');
const block = src.match(/const HERITAGE_STATS = \[([\s\S]*?)\] as const/);
if (!block) failures.push('HERITAGE_STATS array not found');
else {
  const values = [...block[1].matchAll(/value:\s*'([^']*)'/g)].map((m) => m[1]);
  const labels = [...block[1].matchAll(/label:\s*'([^']*)'/g)].map((m) => m[1]);
  const wantValues = ['28 July 1968', '4', '15'];
  const wantLabels = ['Founding date, Bloemfontein', 'Founding societies', 'Accredited SAOC Judges, Sept 1968'];
  if (values.join('|') !== wantValues.join('|')) failures.push(`HERITAGE_STATS values are [${values.join(' | ')}], want [${wantValues.join(' | ')}]`);
  if (labels.join('|') !== wantLabels.join('|')) failures.push(`HERITAGE_STATS labels are [${labels.join(' | ')}], want [${wantLabels.join(' | ')}]`);
}
if (/label:\s*'Founded'/.test(src)) failures.push("the 'Founded' stat is still in the file");
const dl = src.match(/<dl\b[^>]*className="([^"]*)"/);
if (!dl) failures.push('stats <dl> not found');
else if (!/\bsm:grid-cols-3\b/.test(dl[1]) || /\bsm:grid-cols-4\b/.test(dl[1])) failures.push(`stats <dl> must be sm:grid-cols-3 and not sm:grid-cols-4 (found: ${dl[1]})`);
if (!/<strong>1968<\/strong>/.test(src)) failures.push('the verbatim About prose ("Established in 1968") must stay untouched');
finish('f2-about-static', failures);

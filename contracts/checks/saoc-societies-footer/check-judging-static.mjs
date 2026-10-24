// JU-1 (five headings are display h2s, no pill, no new copy) and JU-2 (Contact SAOC link 44px target).
// Source-level against the golden fixture contracts/golden/saoc-societies-footer/judging-headings.json;
// computed styles on the deployed page are recorded by the browser_deployed_check.
// Run as: node contracts/checks/saoc-societies-footer/check-judging-static.mjs
import { readFileSync } from 'node:fs';

const g = JSON.parse(readFileSync('contracts/golden/saoc-societies-footer/judging-headings.json', 'utf8'));
const read = (f) => readFileSync(f, 'utf8');
const page = read('app/(marketing)/judging/page.tsx');
const split = read('components/judging/JudgingSplit.tsx');
const css = read('app/globals.css');
const failures = [];

// The .h2 class the headings use still carries the golden values.
const h2 = css.match(/\n\.h2 \{([^}]*)\}/);
if (!h2) failures.push('app/globals.css has no .h2 rule');
else {
  if (!/font-family:\s*var\(--serif\)/.test(h2[1])) failures.push('.h2 is not the serif token');
  if (!/font-size:\s*var\(--display-md\)/.test(h2[1])) failures.push('.h2 is not --display-md');
  if (!/font-weight:\s*300/.test(h2[1])) failures.push('.h2 weight is not 300');
}
if (!/--display-md:\s*clamp\(34px,\s*4\.4vw,\s*54px\)/.test(css)) failures.push('--display-md changed from clamp(34px, 4.4vw, 54px)');

// JudgingSplit: heading is an h2 with the h2 class, not the eyebrow pill; stacked gap is 24px.
const splitH2 = split.match(/<h2 className="([^"]*)">\{heading\}<\/h2>/);
if (!splitH2) failures.push('JudgingSplit heading is not <h2 className="...">{heading}</h2>');
else {
  const t = splitH2[1].split(/\s+/);
  if (!t.includes('h2')) failures.push('JudgingSplit heading needs the h2 class');
  if (t.includes('eyebrow')) failures.push('JudgingSplit heading still uses the eyebrow pill');
}
const gap = css.match(/\[data-judging-split\] \{([^}]*)\}/);
if (!gap || !/gap:\s*var\(--space-5\)/.test(gap[1])) failures.push('[data-judging-split] row gap must stay var(--space-5) (24px)');

// page.tsx: the other two headings, and the strings.
for (const text of ['SAOC awards', 'Accredited judges']) {
  const m = page.match(new RegExp(`<h2 className="([^"]*)">${text}</h2>`));
  if (!m) failures.push(`page.tsx: <h2> "${text}" not found`);
  else {
    const t = m[1].split(/\s+/);
    if (!t.includes('h2')) failures.push(`"${text}" needs the h2 class`);
    if (t.includes('eyebrow')) failures.push(`"${text}" still uses the eyebrow pill`);
  }
}
for (const h of g.headings.filter((x) => !['SAOC awards', 'Accredited judges'].includes(x.text))) {
  if (!new RegExp(`heading: '${h.text}'`).test(page)) failures.push(`page.tsx: section heading string '${h.text}' missing or changed`);
}
for (const e of g.keepEyebrow) if (!page.includes(`eyebrow="${e}"`)) failures.push(`hero eyebrow "${e}" must stay`);
const all = page + split + read('components/judging/JudgesDirectory.tsx') + read('components/judging/AwardsGrid.tsx');
for (const bad of g.forbiddenText) if (all.includes(bad)) failures.push(`design placeholder copy used: "${bad}"`);
// h2 to body 24px on the stacked awards/judges sections: heading wrapper margin is mb-6.
for (const text of ['SAOC awards', 'Accredited judges']) {
  const at = page.indexOf(`>${text}</h2>`);
  const wrapper = page.slice(Math.max(0, at - 200), at).match(/<div className="([^"]*)">\s*<h2[^>]*$/);
  if (!wrapper || !wrapper[1].split(/\s+/).includes('mb-6')) failures.push(`"${text}" heading wrapper must be mb-6 (24px to body)`);
}

// JU-2.
const cl = g.contactLink;
const dir = read(cl.file);
const link = dir.match(new RegExp(`<Link[^>]*className="([^"]*)"[^>]*>\\s*Contact SAOC \\u2192`));
if (!link) failures.push('Contact SAOC link not found');
else {
  const t = link[1].split(/\s+/);
  for (const c of [...cl.mustHave, ...cl.keepLook]) if (!t.includes(c)) failures.push(`Contact SAOC link missing ${c}`);
  for (const c of cl.mustNotHave) if (t.includes(c)) failures.push(`Contact SAOC link still has ${c}`);
}

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log('PASS: five display h2s, no pill, no new copy, 44px Contact link');

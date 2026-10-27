// Finding (i) FT-1 (Lee-Ann: "SANBI and Kirstenbosch are not partners / WOSA is a Partner"): the SAOC footer
// loses its Partners column; the WOSA link sits under the lockup column below REG#/NPO exactly as in the NOS
// footer (components/nos-chrome/NosFooter.tsx, #77); three columns with equal gaps; no SANBI or
// Kirstenbosch partner anywhere on the SAOC pages. Source-level: Footer.tsx imports next/font, so it cannot be
// rendered offline; the rendered footer is proven by the post-deploy browser check.
// Run as: node contracts/checks/saoc-societies-footer/check-footer-static.mjs
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (f) => readFileSync(f, 'utf8');
const footer = read('components/chrome/Footer.tsx');
const data = read('components/chrome/footer-data.ts');
const nos = read('components/nos-chrome/NosFooter.tsx');

// No Partners column.
if (/from '@\/lib\/data'/.test(footer) || /\bpartners\b/.test(footer.replace(/FOOTER_[A-Z_]+/g, ''))) failures.push('Footer.tsx still reads the partners list');
if (/FOOTER_HEADINGS\.partners/.test(footer) || /\bpartners:/.test(data)) failures.push('the Partners heading is still defined or used');
if ((footer.match(/FOOTER_HEADINGS\./g) ?? []).length !== 2) failures.push('Footer.tsx should render exactly two column headings (Explore, Stay in touch); the brand column has none');
if (/Col 3 — Partners|Partners/.test(footer)) failures.push('Footer.tsx still mentions Partners');

// WOSA: once, under REG#/NPO in the brand column, before the Explore column, same markup as the NOS footer.
const wosaUses = footer.match(/FOOTER_WOSA\.(label|href)/g) ?? [];
if (wosaUses.length !== 2) failures.push(`FOOTER_WOSA label+href should each be used once, found ${wosaUses.length} uses`);
const reg = footer.indexOf('{FOOTER_REG}');
const wosa = footer.indexOf('FOOTER_WOSA.href');
const explore = footer.indexOf('FOOTER_HEADINGS.explore');
if (!(reg > -1 && wosa > reg && explore > wosa)) failures.push('WOSA link must come after FOOTER_REG and before the Explore column');
const anchor = footer.slice(wosa - 200, wosa + 700);
for (const needle of ['target="_blank"', 'rel="noopener noreferrer"', '<ExternalArrow />', 'FOOTER_NEW_TAB_CUE', 'FOOTER_RHYTHM.row} gap-1']) {
  if (!anchor.includes(needle)) failures.push(`WOSA anchor is missing ${needle} (NOS pattern)`);
  if (!nos.includes(needle)) failures.push(`reference NosFooter no longer contains ${needle}; update this check`);
}
if (!/FOOTER_RHYTHM\.list/.test(footer.slice(reg, explore))) failures.push('WOSA must sit in a FOOTER_RHYTHM.list <ul> like the NOS footer');

// Three columns, equal gaps, NOS grid untouched.
if (!/FOOTER_LAYOUT\.gridSaoc/.test(footer)) failures.push('Footer.tsx must use FOOTER_LAYOUT.gridSaoc');
const g3 = data.match(/gridSaoc:\s*'([^']*)'/);
if (!g3) failures.push('footer-data.ts must define FOOTER_LAYOUT.gridSaoc');
else if (!g3[1].includes('xl:grid-cols-[auto_auto_300px]') || !g3[1].includes('xl:justify-between') || /auto_auto_auto/.test(g3[1])) failures.push(`gridSaoc must be three tracks, [auto_auto_300px] with justify-between: ${g3[1]}`);
if (!/grid:\s*'[^']*xl:grid-cols-\[auto_auto_auto_300px\]/.test(data)) failures.push('the shared four-track FOOTER_LAYOUT.grid (used by NosFooter) must be unchanged');
if (!/FOOTER_LAYOUT\.grid\}/.test(nos)) failures.push('NosFooter must still use FOOTER_LAYOUT.grid');

// No SANBI / Kirstenbosch partner left on the SAOC pages.
const partnersHome = read('components/home/PartnersSection.tsx');
if (/sanbi|kirstenbosch|biodiversity/i.test(partnersHome)) failures.push('PartnersSection.tsx still names SANBI or Kirstenbosch');
if ((partnersHome.match(/_id: '/g) ?? []).length !== 1 || !/_id: 'wosa'/.test(partnersHome)) failures.push('STATIC_PARTNERS must hold only the WOSA entry');
if (existsSync('lib/data/partners.ts')) {
  const p = read('lib/data/partners.ts');
  if (/sanbi|kirstenbosch|biodiversity/i.test(p)) failures.push('lib/data/partners.ts still lists SANBI or Kirstenbosch');
}

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log('PASS: footer is three columns, WOSA under REG/NPO, no SANBI/Kirstenbosch partner');

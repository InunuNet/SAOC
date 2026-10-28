// Static checks for nos-footer-colour-logos. Usage: node check-static.mjs <pins|alt|copies|dims|banned|prereq|retired>
//   pins     NosFooter.tsx names the two pinned ladder sources, the credit alt, and builds both marks with getImageProps + sizes
//   alt      the credit alt is SaocLockup's exported ACCESSIBLE_LABEL, imported not retyped; values.json matches the source
//   copies   the two public/images sources are byte-identical to their media-kit masters
//   dims     the two sources are the pinned size, RGBA PNGs
//   banned   no OfficialMonoLockup, <SaocLockup (only the ACCESSIBLE_LABEL import is allowed), Lora, JetBrains Mono or Manrope reference in the NOS footer source or chrome css
//   prereq   nos-type-tokens has landed: .nf sets --font-sans to the Karla token (TYPE-11 CSS route)
//   retired  the reversed-gold copy under public/images is gone and nothing references it
import { existsSync, readFileSync } from 'node:fs';
import { VALUES } from './_lib.mjs';

const mode = process.argv[2];
const failures = [];
const need = (ok, msg) => { if (!ok) failures.push(msg); };
const read = (p) => readFileSync(p, 'utf8');
const FOOTER = 'components/nos-chrome/NosFooter.tsx';
const CSS = 'components/nos-chrome/nos-chrome.css';
const { nosLockup: nos, credit } = VALUES;

if (mode === 'pins') {
  const src = read(FOOTER);
  need(src.includes(`const LOCKUP_SRC = '${nos.src}';`), `LOCKUP_SRC must be '${nos.src}'`);
  need(src.includes(`'${credit.src}'`), `the credit source '${credit.src}' must be pinned in ${FOOTER}`);
  need(src.includes(`data-testid="${credit.testId}"`) || src.includes(`testId="${credit.testId}"`), `credit link must keep data-testid ${credit.testId}`);
  need((src.match(/getImageProps\(/g) ?? []).length >= 2, 'both marks must be built with getImageProps');
  need((src.match(/sizes:/g) ?? []).length >= 2, 'both marks must pass sizes (the LG-1 ladder)');
  need(src.includes(`LOCKUP_WIDTH = ${nos.width}`) && src.includes(`LOCKUP_HEIGHT = ${nos.height}`), 'LOCKUP_WIDTH/HEIGHT must stay 3272/2876');
} else if (mode === 'alt') {
  const foot = read(FOOTER);
  const lockup = read('components/chrome/SaocLockup.tsx');
  need(/export const ACCESSIBLE_LABEL\b/.test(lockup), 'SaocLockup.tsx must export ACCESSIBLE_LABEL (the single permitted edit to that file)');
  need(/import\s*\{[^}]*\bACCESSIBLE_LABEL\b[^}]*\}\s*from\s*'@\/components\/chrome\/SaocLockup'/.test(foot), 'NosFooter must import ACCESSIBLE_LABEL from @/components/chrome/SaocLockup');
  need(/alt(:|=\{?)\s*ACCESSIBLE_LABEL/.test(foot), 'the credit alt must be the ACCESSIBLE_LABEL identifier');
  need(!foot.includes('Making a difference since 1968'), 'the label must never be retyped in NosFooter.tsx');
  const tag = /const TAGLINE = '([^']+)'/.exec(lockup)?.[1];
  need(Boolean(tag) && credit.alt === `South African Orchid Council \u2014 ${tag}`, `values.json credit.alt must equal SaocLockup's label, got "${credit.alt}"`);
} else if (mode === 'copies') {
  for (const m of [nos, credit]) {
    const served = `public${m.src}`;
    need(existsSync(served), `${served} missing`);
    need(existsSync(m.master), `${m.master} missing`);
    if (existsSync(served) && existsSync(m.master)) need(readFileSync(served).equals(readFileSync(m.master)), `${served} must be byte-identical to ${m.master}`);
  }
} else if (mode === 'dims') {
  for (const m of [nos, credit]) {
    if (!existsSync(`public${m.src}`)) { need(false, `public${m.src} missing`); continue; }
    const buf = readFileSync(`public${m.src}`);
    need(buf.subarray(1, 4).toString() === 'PNG', `${m.src} is not a PNG`);
    need(buf.readUInt32BE(16) === m.width && buf.readUInt32BE(20) === m.height, `${m.src} must be ${m.width}x${m.height}, got ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`);
    need(buf[24] === 8 && buf[25] === 6, `${m.src} must be 8-bit RGBA (colour type 6)`);
  }
} else if (mode === 'banned') {
  const text = `${read(FOOTER)}\n${read(CSS)}`;
  for (const re of [/OfficialMono/i, /official-mono/i, /<SaocLockup/, /SaocLockup\s*\{/, /\bLora\b/i, /JetBrains/i, /Manrope/i, /font-mono/, /var\(--font-mono\)/, /--lockup-rule-on-royal/]) need(!re.test(text), `${re} must not appear in ${FOOTER} or ${CSS}`);
} else if (mode === 'prereq') {
  need(/\.nf\s*\{[^}]*--font-sans:\s*var\(--nc-sans\)/.test(read(CSS)), `${CSS}: .nf must set --font-sans: var(--nc-sans) (nos-type-tokens A16); merge feat/nos-type-tokens first`);
} else if (mode === 'retired') {
  need(!existsSync(nos.retiredCopy), `${nos.retiredCopy} must be removed`);
  need(!read(FOOTER).includes('reversed-gold'), `${FOOTER} must not reference the reversed-gold file`);
} else {
  console.error('usage: check-static.mjs <pins|alt|copies|dims|banned|prereq|retired>');
  process.exit(2);
}
if (failures.length) { console.error(`static ${mode} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`static ${mode} pass`);

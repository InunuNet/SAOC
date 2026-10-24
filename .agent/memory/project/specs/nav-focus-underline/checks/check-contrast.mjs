// nav-focus-underline -- WCAG 1.4.11: the focus indicator colours reach 3:1 against the ground they sit on. Run: node <this file>
// Reads the real tokens from the CSS files; a missing token fails (no silent pass).
import { readFileSync } from 'node:fs';

if (process.env.CHECK_ROOT) process.chdir(process.env.CHECK_ROOT); // only for running outside the project root (e.g. from another worktree)
const globals = readFileSync('app/globals.css', 'utf8');
const nos = readFileSync('components/nos-chrome/nos-chrome.css', 'utf8');
const token = (css, name) => {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) { console.error(`FAIL: token ${name} not found as a 6-digit hex`); process.exit(1); }
  return m[1];
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const pairs = [
  ['SAOC --primary on --parchment (header nav, focus underline + text)', token(globals, '--primary'), token(globals, '--parchment')],
  ['SAOC --primary on --bone (mobile menu hover/focus row)', token(globals, '--primary'), token(globals, '--bone')],
  ['SAOC --ivory on --primary-800 (footer link focus)', token(globals, '--ivory'), token(globals, '--primary-800')],
  ['NOS --nc-royal on --nc-ground (header nav, focus underline + text)', token(nos, '--nc-royal'), token(nos, '--nc-ground')],
  ['NOS --nc-royal on --nc-gold (header hover/focus background)', token(nos, '--nc-royal'), token(nos, '--nc-gold')],
  ['NOS --nc-ground on --nc-royal (footer link focus)', token(nos, '--nc-ground'), token(nos, '--nc-royal')],
];
let bad = 0;
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  console.log(`${r.toFixed(2)}:1  ${name}`);
  if (r < 3) { bad += 1; console.error(`FAIL: ${name} is ${r.toFixed(2)}:1, below 3:1`); }
}
process.exit(bad ? 1 : 0);

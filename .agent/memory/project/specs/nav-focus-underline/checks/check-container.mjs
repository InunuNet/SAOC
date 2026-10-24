// nav-focus-underline HD-1b -- one container width on both hosts. Run from the project root: node <this file> <mode>
// Modes: tokens | no-literals
import { readFileSync } from 'node:fs';

if (process.env.CHECK_ROOT) process.chdir(process.env.CHECK_ROOT); // only for running outside the project root
const mode = process.argv[2];
const failures = [];
const read = (p) => readFileSync(p, 'utf8');
const norm = (v) => v.replace(/\s+/g, ' ').trim();
const decl = (css, name) => {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? norm(m[1]) : null;
};
const WIDE = 'calc(1320px + 2 * clamp(16px, 2.5vw, 32px))';
const GUTTER = 'clamp(16px, 2.5vw, 32px)';

if (mode === 'tokens') {
  const g = read('app/globals.css');
  const n = read('components/nos-chrome/nos-chrome.css');
  const checks = [
    ['app/globals.css --container-max', decl(g, '--container-max'), WIDE],
    ['app/globals.css --container-pad', decl(g, '--container-pad'), GUTTER],
    ['nos-chrome.css --nc-wide', decl(n, '--nc-wide'), '1320px'],
    ['nos-chrome.css --nc-gutter', decl(n, '--nc-gutter'), GUTTER],
  ];
  for (const [name, got, want] of checks) if (got !== want) failures.push(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  const rule = g.match(/\.saoc-container\s*\{([^}]*)\}/);
  if (!rule || !/max-width\s*:\s*var\(--container-max\)/.test(rule[1]) || !/padding-inline\s*:\s*var\(--container-pad\)/.test(rule[1])) failures.push('app/globals.css: .saoc-container must still be driven by var(--container-max) and var(--container-pad) (the single class the change goes through)');
} else if (mode === 'no-literals') {
  // Public SAOC files that hard-coded the old 1280 box. They move onto .saoc-container (same box, via the token).
  const files = ['components/chrome/Header.tsx', 'components/chrome/Breadcrumb.tsx', 'components/ui/PageHero.tsx', 'app/(marketing)/societies/[slug]/page.tsx', 'app/not-found.tsx'];
  for (const f of files) if (/max-w-\[1280px\]/.test(read(f))) failures.push(`${f} still hard-codes max-w-[1280px]; use the container token (.saoc-container)`);
} else {
  failures.push(`unknown mode '${mode}'`);
}
if (failures.length) { console.error(`FAIL (${mode})\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`container ${mode} pass`);

// nos-presenter-cards F1 — presenter section components (golden §2, §7, §8). Static source
// check of components/nos/PresenterSection.tsx (server) and components/nos/PresenterGrid.tsx
// (client): copy strings, empty state, order note, clamp/measure wiring, dialog wiring, and
// the excluded reference-render parts (hero, content flags, draft-roles note, drafted roles).
//
// Run as: node contracts/checks/nos-presenter-cards/check-section-source.mjs
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { finish, readRepoFile, repoPath } from './_lib.mjs';

const SECTION = 'components/nos/PresenterSection.tsx';
const GRID = 'components/nos/PresenterGrid.tsx';
const failures = [];
const expect = (ok, msg) => {
  if (!ok) failures.push(msg);
};

const section = readRepoFile(SECTION);
const grid = readRepoFile(GRID);
if (!section || !grid) finish('check-section-source.mjs', [`missing ${!section ? SECTION : GRID}`]);

// --- PresenterSection (server component) ---
expect(!/^\s*['"]use client['"]/.test(section), `${SECTION} must be a server component (no 'use client')`);
expect(/export function PresenterSection\(/.test(section), `${SECTION} must export function PresenterSection`);
expect(/presenters\.length\s*===\s*0\)\s*return null;/.test(section), `${SECTION} must \`if (presenters.length === 0) return null;\` (empty state renders nothing)`);
expect(/orderPresenters\(presenters\)/.test(section) && /hasProvisionalOrder\(presenters\)/.test(section), `${SECTION} must call orderPresenters(presenters) and hasProvisionalOrder(presenters)`);
expect(/<section\b[^>]*className="nos-presenters"[^>]*aria-labelledby=\{/.test(section.replace(/\s+/g, ' ')), `${SECTION} must render <section className="nos-presenters" aria-labelledby={...}>`);
expect(/<p className="pc-eyebrow">\{eyebrow\}<\/p>/.test(section), `${SECTION} must render <p className="pc-eyebrow">{eyebrow}</p>`);
expect(/<h2 id=\{[^}]+\} className="pc-title">\s*Presenters\s*<\/h2>/.test(section), `${SECTION} must render <h2 id={...} className="pc-title">Presenters</h2>`);
expect(
  /\{\w+ \? \(?\s*<p className="pc-order-note">\s*Sample sequence\. Lee-Ann will confirm the order\.\s*<\/p>\s*\)? : null\}/.test(section),
  `${SECTION} must render the order note <p className="pc-order-note">Sample sequence. Lee-Ann will confirm the order.</p> only when provisional`,
);
expect(/<PresenterGrid\b/.test(section), `${SECTION} must render <PresenterGrid>`);

// --- PresenterGrid (client component) ---
expect(/^\s*['"]use client['"];/.test(grid), `${GRID} must start with 'use client'`);
expect(/export function PresenterGrid\(/.test(grid), `${GRID} must export function PresenterGrid`);
expect(/<ul\b[^>]*className="pc-grid"/.test(grid), `${GRID} must render <ul className="pc-grid">`);
expect(/<li\b[^>]*className="pc-card"/.test(grid), `${GRID} must render <li className="pc-card">`);
expect(/<h3 className="pc-name">\s*\{[\w.]+\.name\}\s*<\/h3>/.test(grid), `${GRID} must render <h3 className="pc-name">{presenter.name}</h3>`);
expect(/\.role \? <p className="pc-role">\{[\w.]+\.role\}<\/p> : null/.test(grid), `${GRID} must render the role only when present: {p.role ? <p className="pc-role">{p.role}</p> : null}`);
expect(/alt=\{`Portrait of \$\{[\w.]+\.name\}`\}/.test(grid), `${GRID} photo alt must be \`Portrait of \${name}\``);
expect(/parseBio\(/.test(grid), `${GRID} must render bios through parseBio()`);
expect(!/dangerouslySetInnerHTML/.test(grid + section), 'bios must render as text nodes, never dangerouslySetInnerHTML');
expect(/new ResizeObserver\(/.test(grid) && /\.observe\(/.test(grid), `${GRID} must re-measure on a ResizeObserver observing the grid`);
expect(/document\.fonts\.ready\.then\(/.test(grid), `${GRID} must re-measure after document.fonts.ready`);
expect(/scrollHeight/.test(grid) && /Math\.min\(/.test(grid), `${GRID} must clamp to Math.min of the bios' scrollHeight`);
expect(/['"]--bio-h['"]/.test(grid), `${GRID} must set the --bio-h custom property on the grid`);
expect(/is-clipped/.test(grid), `${GRID} must toggle the is-clipped class on clipped bios`);
expect(/\.disconnect\(\)/.test(grid), `${GRID} must disconnect the ResizeObserver on unmount`);
expect(/className="pc-more"/.test(grid) && /aria-haspopup="dialog"/.test(grid), `${GRID} must render <button className="pc-more" aria-haspopup="dialog">`);
expect(/Read full bio\s*<span className="sr-only">\s*of \{[\w.]+\.name\}\s*<\/span>/.test(grid.replace(/\{' '\}/g, ' ')), `${GRID} button text must be "Read full bio" + <span className="sr-only"> of {name}</span>`);
expect(/hidden=\{!/.test(grid), `${GRID} must hide the button on unclipped cards (hidden={!clipped...})`);
expect(/<dialog\b[^>]*className="pc-modal"/.test(grid.replace(/\s+/g, ' ')), `${GRID} must render a native <dialog className="pc-modal">`);
expect(/\.showModal\(\)/.test(grid), `${GRID} must open the dialog with showModal()`);
expect(/aria-labelledby=\{/.test(grid) && /className="pc-sheet-title"/.test(grid), `${GRID} dialog must be aria-labelledby its <h2 className="pc-sheet-title">`);
expect(/<span className="sr-only">Close<\/span>/.test(grid), `${GRID} close button must carry <span className="sr-only">Close</span>`);
expect((grid.match(/\.focus\(\)/g) ?? []).length >= 2, `${GRID} must focus the close button on open and return focus to the opener on close`);
expect(/['"]close['"]|onClose=/.test(grid), `${GRID} must handle the dialog close event (Esc + button + backdrop) to restore focus`);

// --- excluded parts of the reference render, and no invented roles, anywhere in the build ---
const BANNED = [
  'Presenter Profiles',
  'Content flags',
  'drafted from their bios',
  'Founder, Cape Institute of Micropropagation',
  'Owner, The Exotic Plant Company',
  'Owner, R.F. Orchids',
];
function walk(rel, out = []) {
  for (const name of readdirSync(repoPath(rel))) {
    const child = path.join(rel, name);
    if (statSync(repoPath(child)).isDirectory()) walk(child, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(child);
  }
  return out;
}
for (const file of [...walk('app'), ...walk('components'), ...walk('lib')]) {
  const text = readRepoFile(file);
  for (const phrase of BANNED) {
    if (text.includes(phrase)) failures.push(`${file} contains excluded/invented text "${phrase}"`);
  }
}

finish('check-section-source.mjs', failures, 'PresenterSection/PresenterGrid match the golden structure, copy, clamp and dialog wiring.');

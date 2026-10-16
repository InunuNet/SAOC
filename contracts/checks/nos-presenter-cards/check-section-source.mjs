// nos-presenter-cards F1 — presenter section components (golden §2, §7, §8). Static source
// check of components/nos/PresenterSection.tsx (server) and components/nos/PresenterGrid.tsx
// (client): copy strings, empty state, order note, clamp/measure wiring, disclosure wiring, and
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
// R43 (NOS Design via the lead, 2026-10-16, nos-critique-r3) supersedes: the internal "Sample sequence. Lee-Ann will confirm the
// order." note is gone; a provisional order shows the existing R11 chip instead (see nos-critique-r3/check-static-f2.mjs).
expect(!/Sample sequence|pc-order-note/.test(section), `${SECTION} must not render the internal order note any more (R43)`);
expect(/<ConfirmationBadge\b[^>]*status="pending"[^>]*pendingLabel="To be confirmed by the show committee"/.test(section.replace(/\s+/g, ' ')), `${SECTION} must render the R11 <ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" /> when the order is provisional`);
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
// R39 (NOS Design via the lead, 2026-10-16, nos-critique-r3) supersedes the shortest-bio equal-height clamp and the full-bio
// dialog: bios clamp to 4 lines and "Read full bio" is an inline aria-expanded disclosure. The detailed pins live in
// contracts/checks/nos-critique-r3/check-static.mjs; this file keeps the card structure and the button's accessible name.
expect(/new ResizeObserver\(/.test(grid) && /\.observe\(/.test(grid), `${GRID} must re-measure on a ResizeObserver observing the grid`);
expect(/document\.fonts\.ready\.then\(/.test(grid), `${GRID} must re-measure after document.fonts.ready`);
expect(/scrollHeight/.test(grid), `${GRID} must measure overflow with scrollHeight`);
expect(/is-clipped/.test(grid), `${GRID} must toggle the is-clipped class on clipped bios`);
expect(/\.disconnect\(\)/.test(grid), `${GRID} must disconnect the ResizeObserver on unmount`);
expect(/className="pc-more"/.test(grid) && /aria-expanded=\{/.test(grid) && /aria-controls=\{/.test(grid), `${GRID} must render <button className="pc-more" aria-expanded aria-controls>`);
expect(!/aria-haspopup|<dialog\b|showModal/.test(grid), `${GRID} must not open a dialog (R39)`);
expect(/Read full bio\s*<span className="sr-only">\s*of \{[\w.]+\.name\}\s*<\/span>/.test(grid.replace(/\{' '\}/g, ' ')), `${GRID} button text must be "Read full bio" + <span className="sr-only"> of {name}</span>`);
expect(/hidden=\{!/.test(grid), `${GRID} must hide the button on cards whose bio fits (hidden={!...})`);

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

finish('check-section-source.mjs', failures, 'PresenterSection/PresenterGrid match the golden structure, copy, clamp and disclosure wiring.');

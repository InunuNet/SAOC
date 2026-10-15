// nos-critique-r1 F1 — presenters focus per R9/3, Codi's CORRECTED ruling 2026-10-16:
// "R9/3 stands: violet #7E3F97 on pale-gold grounds (~6.6:1), and pale gold #fbfaf0 on
// royal/dark grounds. ... Presenters should be the theme violet ring at 2px solid with a 2px
// offset, i.e. what was already rendering." (golden §4)
//
// The ring is painted by `.nos-theme :focus-visible:not(.group)` (nos-theme.css:245, 0,3,0),
// which already beats `.nos-presenters :focus-visible` (0,2,0). The presenters rule's
// `outline: 2px solid var(--pc-violet); outline-offset: 3px` is therefore dead and is removed
// as dead code (render unchanged — A9 proves it); its `border-radius: 4px` (live) stays.
// presenters.css must NOT re-point --ring-focus or redefine any theme ring token.
//
// Run as: node contracts/checks/nos-critique-r1/check-presenters-focus.mjs
import { FILES, finish, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'check-presenters-focus.mjs';
const failures = [];
const rel = FILES.presenters;
const raw = readRepoFile(rel);
if (!raw) finish(NAME, [`missing ${rel}`]);
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const FOCUS_LINE = '.nos-presenters :focus-visible { border-radius: 4px; }';

if (/--ring-focus/.test(css)) failures.push('presenters.css must not declare or re-point --ring-focus* (the theme violet ring stands)');
if (/outline/.test(css)) failures.push('presenters.css must declare no outline* — the .nos-theme ring paints it');
const focusRules = css.match(/[^{}]*:focus[^{}]*\{[^{}]*\}/g) || [];
if (focusRules.length !== 1 || focusRules[0].trim().replace(/\s+/g, ' ') !== FOCUS_LINE) {
  failures.push(`the only focus rule must be exactly "${FOCUS_LINE}" (got ${JSON.stringify(focusRules.map((r) => r.trim()))})`);
}
if (!/--pc-violet\s*:\s*#7E3F97\s*;/i.test(css)) failures.push('--pc-violet stays declared (#7E3F97) for .pc-role/.pc-more');

// Exactly one line differs from base: the dead outline/offset removed from line 58.
const lines = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean);
const before = lines(readBaseFile(rel));
const after = lines(raw);
const added = after.filter((l) => !before.includes(l));
const removed = before.filter((l) => !after.includes(l));
const OLD = '.nos-presenters :focus-visible { outline: 2px solid var(--pc-violet); outline-offset: 3px; border-radius: 4px; }';
for (const l of added) if (l !== FOCUS_LINE) failures.push(`unexpected added line: ${JSON.stringify(l)}`);
for (const l of removed) if (l !== OLD) failures.push(`unexpected removed line: ${JSON.stringify(l)}`);
if (!added.includes(FOCUS_LINE) || !removed.includes(OLD)) failures.push('line 58 must become exactly the dead-code-free focus rule');

finish(NAME, failures, 'presenters.css drops only the dead outline/3px offset (border-radius kept); no ring re-point — the theme violet ring renders.');

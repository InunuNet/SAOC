// nos-critique-r3 — presenters focus rule unchanged (replaces nos-critique-r1/check-presenters-focus.mjs in F1's
// gate: that check rejects ANY added presenters.css line vs its own base, so no R39/R43/R44 CSS can pass it).
// Same R9/3 contract: the only focus rule is `.nos-presenters :focus-visible { border-radius: 4px; }`, no outline*,
// no --ring-focus re-point, --pc-violet stays #7E3F97, and the focus rule is byte-identical to the base's.
// Run as: node contracts/checks/nos-critique-r3/check-focus.mjs
import { CSS, finish, readBaseFile, readRepoFile } from './_lib.mjs';

const failures = [];
const raw = readRepoFile(CSS);
if (!raw) finish('check-focus.mjs', [`missing ${CSS}`]);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const css = strip(raw);
const FOCUS_LINE = '.nos-presenters :focus-visible { border-radius: 4px; }';
const focusRules = (c) => (c.match(/[^{}]*:focus[^{}]*\{[^{}]*\}/g) || []).map((r) => r.trim().replace(/\s+/g, ' '));
if (/--ring-focus/.test(css)) failures.push('presenters.css must not declare or re-point --ring-focus*');
if (/outline/.test(css)) failures.push('presenters.css must declare no outline* (the .nos-theme ring paints it)');
const rules = focusRules(css);
if (rules.length !== 1 || rules[0] !== FOCUS_LINE) failures.push(`the only focus rule must be exactly "${FOCUS_LINE}" (got ${JSON.stringify(rules)})`);
const base = focusRules(strip(readBaseFile(CSS)));
if (JSON.stringify(base) !== JSON.stringify(rules)) failures.push(`focus rule differs from base: ${JSON.stringify(base)} vs ${JSON.stringify(rules)}`);
if (!/--pc-violet\s*:\s*#7E3F97\s*;/i.test(css)) failures.push('--pc-violet stays declared (#7E3F97)');
finish('check-focus.mjs', failures, 'presenters.css focus rule unchanged from base; no outline, no ring re-point.');

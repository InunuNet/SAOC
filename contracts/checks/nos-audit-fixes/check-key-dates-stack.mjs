// nos-audit-fixes item 2 — /national-show/exhibitors key-dates table stacks below `sm` (golden §2).
// Static check of components/show/ExhibitorKeyDates.tsx:
//   - no unconditional inner horizontal scroll and no unconditional 560px floor (both only
//     from `sm:` up), so nothing is clipped at 390px;
//   - below `sm`, table/tbody/body rows/cells are `max-sm:block` and the thead is
//     `max-sm:sr-only` (column headers stay in the accessibility tree);
//   - one breakpoint only (`sm`, Tailwind's default 640px): no md/lg stacking variants;
//   - table semantics and the existing type/colour classes are kept; no new colour or inline style.
//
// Run as: node contracts/checks/nos-audit-fixes/check-key-dates-stack.mjs
import { finish, openingTags, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-key-dates-stack.mjs';
const REL = 'components/show/ExhibitorKeyDates.tsx';
const failures = [];
const raw = readRepoFile(REL);
if (!raw) finish(NAME, [`missing ${REL}`]);
const src = stripComments(raw);

const has = (tag, token) => tag.tokens.includes(token);

// ---- inner scroll + width floor are sm-and-up only ----
for (const t of openingTags(src, 'div')) {
  if (has(t, 'overflow-x-auto') || has(t, 'overflow-x-scroll') || has(t, 'overflow-auto')) {
    failures.push(`a <div> applies inner horizontal scroll at every width (${t.className}); only sm:overflow-x-auto is allowed`);
  }
}
const tables = openingTags(src, 'table');
if (tables.length !== 1) failures.push(`expected exactly one <table>, found ${tables.length}`);
const table = tables[0];
if (table) {
  if (table.tokens.some((k) => /^min-w-/.test(k))) {
    failures.push(`<table> keeps an unconditional min-width (${table.className}); use sm:min-w-[560px] or none`);
  }
  if (!has(table, 'max-sm:block')) failures.push('<table> must carry max-sm:block');
  for (const k of ['w-full', 'border-collapse', 'text-left']) {
    if (!has(table, k)) failures.push(`<table> lost existing class ${k}`);
  }
}

// ---- thead hidden visually, kept for AT; tbody/rows/cells stack ----
const theads = openingTags(src, 'thead');
if (theads.length !== 1 || !has(theads[0], 'max-sm:sr-only')) failures.push('<thead> must carry max-sm:sr-only');
const tbodies = openingTags(src, 'tbody');
if (tbodies.length !== 1 || !has(tbodies[0], 'max-sm:block')) failures.push('<tbody> must carry max-sm:block');

const tbodyStart = tbodies[0] ? tbodies[0].start : src.length;
const bodyRows = openingTags(src, 'tr').filter((t) => t.start > tbodyStart);
if (bodyRows.length !== 1) failures.push(`expected one body <tr> (mapped), found ${bodyRows.length}`);
for (const r of bodyRows) if (!has(r, 'max-sm:block')) failures.push('body <tr> must carry max-sm:block');

const rowHeads = openingTags(src, 'th').filter((t) => /scope="row"/.test(t.text));
if (rowHeads.length !== 1) failures.push(`expected one <th scope="row">, found ${rowHeads.length}`);
for (const h of rowHeads) {
  if (!has(h, 'max-sm:block')) failures.push('<th scope="row"> must carry max-sm:block');
  for (const k of ['font-serif', 'text-[17px]', 'font-medium', 'text-ink']) {
    if (!has(h, k)) failures.push(`<th scope="row"> lost existing class ${k}`);
  }
}
const cells = openingTags(src, 'td');
if (cells.length !== 2) failures.push(`expected two <td> (When, Detail), found ${cells.length}`);
for (const c of cells) {
  if (!has(c, 'max-sm:block')) failures.push(`<td> must carry max-sm:block (${c.className})`);
  if (!has(c, 'font-sans') || !has(c, 'text-[15px]')) failures.push(`<td> lost existing type classes (${c.className})`);
}

// ---- semantics kept ----
if ((src.match(/scope="col"/g) || []).length !== 3) failures.push('the three scope="col" headers must stay');
if (!/<caption/.test(src)) failures.push('<caption> must stay');
if (!/<ExhibitorStatusBadge/.test(src)) failures.push('ExhibitorStatusBadge must still render in the When cell');

// ---- one breakpoint, no new design ----
const offBreakpoint = src.match(/\b(?:max-)?(?:md|lg|xl|2xl):[\w[\]./-]+/g) || [];
if (offBreakpoint.length) failures.push(`stacking must use the sm breakpoint only; found ${[...new Set(offBreakpoint)].join(', ')}`);
if (/max-\[\d+px\]:|min-\[\d+px\]:/.test(src)) failures.push('no arbitrary breakpoint (max-[..px]: / min-[..px]:); use sm');
if (/#[0-9a-fA-F]{3,8}\b/.test(src)) failures.push('no literal hex colour may be introduced');
if (/style=\{\{/.test(src)) failures.push('no inline style may be introduced');

finish(NAME, failures, 'key-dates table stacks below sm (block rows, sr-only thead), no inner scroll or 560px floor under 640px, existing classes kept.');

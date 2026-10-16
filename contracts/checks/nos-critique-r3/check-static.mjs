// nos-critique-r3 F1 — static source check (golden spec §2, §3). R39: bios clamp to 4 lines and
// "Read full bio" is an inline disclosure (<button aria-expanded aria-controls>), not a modal.
//   - the pc-more button carries type="button", aria-expanded={..}, aria-controls={..}, keeps its
//     accessible name "Read full bio" + sr-only " of {name}", stays `hidden` unless the bio overflows
//   - no <dialog>, showModal, aria-haspopup, closeRef/openerRef, --bio-h, Math.min clamp, dialogIdBase
//   - clamp is progressive enhancement: the grid carries data-clamp only once mounted; the open state
//     is the `is-open` class; ResizeObserver + fonts.ready + disconnect remain
//   - focus is never moved, nothing scrolls (no .focus(), scrollTo, scrollIntoView, smooth behaviour)
//   - no new copy: every copy string is already in the base file; no collapse label is invented
//   - PresenterSection passes idBase and nothing else changed shape
//   - docs/nos-critique-r3.md exists and records R39, the 17px source and the aria-expanded contract
// Run as: node contracts/checks/nos-critique-r3/check-static.mjs
import { GRID, SECTION, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };

const gridRaw = readRepoFile(GRID);
const sectionRaw = readRepoFile(SECTION);
if (!gridRaw || !sectionRaw) finish('check-static.mjs', [`missing ${GRID} or ${SECTION}`]);
const grid = stripComments(gridRaw);
const section = stripComments(sectionRaw);

// ---- the disclosure button ----
const nameAt = grid.indexOf('className="pc-more"');
expect(nameAt !== -1, `${GRID} must render className="pc-more"`);
const btnStart = grid.lastIndexOf('<button', nameAt);
const btnEnd = grid.indexOf('</button>', nameAt);
const btn = btnStart !== -1 && btnEnd !== -1 ? grid.slice(btnStart, btnEnd) : '';
expect(btn !== '', `${GRID} pc-more must be a <button>`);
expect(/type="button"/.test(btn), 'pc-more button must be type="button"');
expect(/aria-expanded=\{/.test(btn), 'pc-more button must bind aria-expanded={...} to state');
expect(/aria-controls=\{/.test(btn), 'pc-more button must bind aria-controls={...} to the bio region id');
expect(!/aria-haspopup/.test(grid), 'aria-haspopup must be gone (no dialog)');
expect(/hidden=\{!/.test(btn), 'pc-more button must stay hidden={!...} unless the bio overflows 4 lines');
expect(/Read full bio\s*<span className="sr-only">\s*of \{[\w.]+\.name\}\s*<\/span>/.test(btn.replace(/\{' '\}/g, ' ')),
  'accessible name must stay "Read full bio" + <span className="sr-only"> of {name}</span> (R39: keep existing names)');
expect(!/<(a|summary|details)\b/.test(grid), 'the disclosure is a <button>, not <a>/<details>/<summary>');

// ---- the region it controls ----
expect(/className=\{`pc-clip[^`]*`\}/.test(grid) || /className=\{\[?['"]pc-clip/.test(grid), 'pc-clip className must stay dynamic (is-clipped / is-open)');
expect(/is-open/.test(grid) && /is-clipped/.test(grid), 'pc-clip must toggle is-clipped (overflowing) and is-open (expanded)');
expect(/\bid=\{[^}]+\}/.test(grid.slice(grid.indexOf('pc-clip') - 80, grid.indexOf('pc-clip') + 400)), 'pc-clip must carry the id that aria-controls points at');
expect(/data-clamp/.test(grid), 'the grid must set data-clamp only after mount (progressive enhancement, no-JS shows full bios)');
expect(/useEffect\(/.test(grid) && /useSyncExternalStore\(/.test(grid), 'data-clamp is false on the server (useSyncExternalStore server snapshot) and true on the client; useEffect drives the ResizeObserver');
expect(/new ResizeObserver\(/.test(grid) && /\.observe\(/.test(grid) && /\.disconnect\(\)/.test(grid), 'must keep a ResizeObserver, observed and disconnected');
expect(/document\.fonts\.ready\.then\(/.test(grid), 'must re-measure after document.fonts.ready');
expect(/scrollHeight/.test(grid), 'overflow is measured with scrollHeight');
expect(/parseBio\(/.test(grid) && !/dangerouslySetInnerHTML/.test(grid + section), 'bios render through parseBio as text nodes');

// ---- the modal is gone, completely ----
for (const [re, what] of [
  [/<dialog\b/, '<dialog>'], [/showModal/, 'showModal'], [/closeRef|openerRef|dialogRef|sheetBodyRef/, 'dialog refs'],
  [/pc-modal|pc-sheet/, 'pc-modal / pc-sheet classes'], [/--bio-h|BIO_HEIGHT_VAR/, '--bio-h equal-height variable'],
  [/Math\.min\(/, 'shortest-bio Math.min clamp'], [/CLIP_TOLERANCE_PX/, 'CLIP_TOLERANCE_PX'], [/dialogIdBase|dialog-title|dialogTitleId/, 'dialog id plumbing'],
  [/handleDialogClose|openBio\b/, 'dialog handlers'], [/activeId|setActiveId/, 'active-dialog state'], [/PresenterImage[^>]*\beager\b/, 'eager dialog image'],
]) expect(!re.test(grid + section), `leftover from the modal: ${what}`);

// ---- focus stays on the button; nothing scrolls or animates in JS ----
expect(!/\.focus\(/.test(grid), 'focus must stay on the button: no .focus() calls');
expect(!/scrollTo|scrollIntoView|behavior\s*:/.test(grid), 'no JS scrolling or smooth behaviour');

// ---- no invented copy ----
const baseCopy = new Set(copyStrings(readBaseFile(GRID)));
for (const c of copyStrings(gridRaw)) expect(baseCopy.has(c), `new copy string not in the base file: ${JSON.stringify(c)}`);
expect(!/(['"`>])\s*(Show less|Read less|Show more|Read more|Collapse|Hide (full )?bio|Close)\b/i.test(grid), 'no collapse/close label may be invented (R39 gives none; the name stays, aria-expanded flips)');

// ---- PresenterSection ----
expect(/idBase/.test(section) && /<PresenterGrid\b[^>]*idBase=\{idBase\}/.test(section.replace(/\s+/g, ' ')), `${SECTION} must pass idBase={idBase} to <PresenterGrid>`);
expect(!/dialog/i.test(section), `${SECTION} must not mention a dialog any more`);
expect(/Presenters/.test(section), `${SECTION} heading copy unchanged (the order note is replaced by the R11 chip in F2)`);

// ---- docs ----
const docs = readRepoFile('docs/nos-critique-r3.md');
expect(docs !== null, 'docs/nos-critique-r3.md must exist');
if (docs) {
  expect(/R39/.test(docs), 'docs must record R39');
  expect(/17px|1\.0625rem/.test(docs) && /nos-theme\.css/.test(docs), 'docs must cite the 17px body role and nos-theme.css as its source');
  expect(/aria-expanded/.test(docs) && /aria-controls/.test(docs), 'docs must record the aria-expanded / aria-controls disclosure contract');
  expect(/no-JS|without JS|progressive/i.test(docs), 'docs must record the no-JS behaviour');
}

finish('check-static.mjs', failures, 'PresenterGrid/PresenterSection are an inline aria-expanded disclosure, modal fully removed, no new copy, docs present.');

// nos-presenter-cards F1 — presenter stylesheet vs Codi's approved CSS (golden §7). Static.
// Parses app/(marketing)/national-show/presenters.css into rules (selector, @media, decls),
// resolves var(--x) against custom properties declared in the same file, normalises
// whitespace/leading zeros, and compares each pinned value from the golden. Also asserts
// every selector is scoped under .nos-presenters and that animation only appears inside
// @media (prefers-reduced-motion: no-preference).
//
// Run as: node contracts/checks/nos-presenter-cards/check-styles.mjs
import { finish, readRepoFile } from './_lib.mjs';

const REL = 'app/(marketing)/national-show/presenters.css';
const failures = [];
const css = readRepoFile(REL);
if (!css) finish('check-styles.mjs', [`missing ${REL}`]);

// ---- tiny parser: top-level rules, @media blocks (one level), @keyframes skipped ----
const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [];
const vars = {};
function parseBlock(text, media) {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open === -1) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth += 1;
      else if (text[j] === '}') depth -= 1;
      j += 1;
    }
    const body = text.slice(open + 1, j - 1);
    if (prelude.startsWith('@media')) parseBlock(body, norm(prelude.slice(6)));
    else if (prelude.startsWith('@keyframes')) rules.push({ keyframes: true, media, selectors: [], decls: {} });
    else if (!prelude.startsWith('@')) {
      const decls = {};
      for (const part of body.split(';')) {
        const k = part.indexOf(':');
        if (k === -1) continue;
        const prop = part.slice(0, k).trim().toLowerCase();
        const value = part.slice(k + 1).trim();
        decls[prop] = value;
        if (prop.startsWith('--') && !(prop in vars)) vars[prop] = value;
      }
      rules.push({ media, selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), decls });
    }
    i = j;
  }
}
function norm(v) {
  return String(v)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([,/()])\s*/g, '$1')
    .replace(/(^|[^\d.])0+\.(\d)/g, '$1.$2')
    .replace(/#ffffff\b|\bwhite\b/g, '#fff')
    .replace(/#000000\b|\bblack\b/g, '#000')
    .trim();
}
function resolve(v, depth = 0) {
  if (depth > 10) return v;
  return v.replace(/var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (m, name) =>
    name in vars ? resolve(vars[name], depth + 1) : m,
  );
}
parseBlock(src, null);

function lookup(selectorEnd, prop, media = null) {
  let value;
  for (const r of rules) {
    if (r.keyframes || r.media !== (media ? norm(media) : null)) continue;
    if (r.selectors.some((s) => s.endsWith(selectorEnd)) && prop in r.decls) value = r.decls[prop];
  }
  return value === undefined ? undefined : norm(resolve(value));
}
function want(selectorEnd, prop, expected, media = null) {
  const got = lookup(selectorEnd, prop, media);
  const ok = Array.isArray(expected) ? expected.some((e) => norm(e) === got) : norm(expected) === got;
  if (!ok) {
    failures.push(`${media ? `@media ${media} ` : ''}${selectorEnd} { ${prop} } want ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
}
function wantIncludes(selectorEnd, prop, fragment, media = null) {
  const got = lookup(selectorEnd, prop, media);
  if (!got || !got.includes(norm(fragment))) failures.push(`${selectorEnd} { ${prop} } must include ${JSON.stringify(fragment)}, got ${JSON.stringify(got)}`);
}

// ---- scope: every selector under .nos-presenters ----
for (const r of rules) {
  if (r.keyframes) continue;
  for (const s of r.selectors) {
    // One sanctioned exception: Codi's page scroll lock while the bio dialog is open.
    if (!s.startsWith('.nos-presenters') && s !== 'html:has(.nos-presenters .pc-modal[open])') {
      failures.push(`selector "${s}" is not scoped under .nos-presenters`);
    }
  }
}

// ---- tokens ----
const SHADOW_MD = '0 4px 10px rgba(33, 26, 87, 0.08), 0 2px 4px rgba(33, 26, 87, 0.06)';
const LINE = '1px solid #DAD7C8';
const FRAUNCES = 'var(--font-nos-fraunces)';
const KARLA = 'var(--font-nos-karla)';

// section + head
want('.nos-presenters', 'font-family', [`${KARLA}, "Helvetica Neue", Arial, sans-serif`]);
want('.nos-presenters', 'color', '#3A3654');
want('.pc-wrap', 'max-width', 'calc(1320px + 2 * clamp(16px, 4vw, 48px))');
want('.pc-wrap', 'padding-inline', 'clamp(16px, 4vw, 48px)');
want('.pc-eyebrow', 'color', '#6A6829');
want('.pc-eyebrow', 'font-size', '0.8rem');
want('.pc-eyebrow', 'font-weight', '700');
want('.pc-eyebrow', 'letter-spacing', '0.14em');
want('.pc-eyebrow', 'text-transform', 'uppercase');
wantIncludes('.pc-title', 'font-family', FRAUNCES);
want('.pc-title', 'font-weight', '400');
want('.pc-title', 'font-size', '1.953rem');
want('.pc-title', 'color', '#211A57');
want('.pc-order-note', 'font-size', '0.9rem');
want('.pc-order-note', 'font-weight', '600');
want('.pc-order-note', 'color', '#6A6780');
// grid
want('.pc-grid', 'grid-template-columns', 'minmax(0, 1fr)');
want('.pc-grid', 'gap', '32px');
want('.pc-grid', 'list-style', 'none');
want('.pc-grid', 'grid-template-columns', 'repeat(2, minmax(0, 1fr))', '(min-width: 1120px)');
// card
want('.pc-card', 'background', '#FFFFFF');
want('.pc-card', 'border', LINE);
want('.pc-card', 'border-radius', '16px');
want('.pc-card', 'box-shadow', SHADOW_MD);
want('.pc-card', 'padding', '32px');
want('.pc-card', 'gap', '28px');
want('.pc-head', 'grid-template-columns', '160px minmax(0, 1fr)');
want('.pc-head', 'gap', '24px');
want('.pc-head', 'align-items', 'center');
want('.pc-photo', 'aspect-ratio', '4 / 5');
want('.pc-photo', 'border-radius', '10px');
want('.pc-photo', 'background', '#0B0A14');
want('.pc-photo img', 'object-fit', 'cover');
want('.pc-id', 'gap', '10px');
wantIncludes('.pc-name', 'font-family', FRAUNCES);
want('.pc-name', 'font-weight', '300');
want('.pc-name', 'font-size', 'clamp(2rem, 1.5rem + 1.1vw, 2.6rem)');
want('.pc-name', 'line-height', '1.04');
want('.pc-name', 'letter-spacing', '-0.01em');
want('.pc-name', 'color', '#211A57');
want('.pc-name', 'text-wrap', 'balance');
want('.pc-name', 'font-variation-settings', '"opsz" 24');
want('.pc-role', 'font-size', '0.8rem');
want('.pc-role', 'font-weight', '600');
want('.pc-role', 'letter-spacing', '0.08em');
want('.pc-role', 'text-transform', 'uppercase');
want('.pc-role', 'color', '#7E3F97');
want('.pc-role', 'line-height', '1.45');
want('.pc-role', 'text-wrap', 'balance');
// bio + clamp
want('.pc-bio', 'padding-top', '24px');
want('.pc-bio', 'border-top', LINE);
want('.pc-clip', 'max-height', 'var(--bio-h, none)');
want('.pc-clip', 'overflow', 'hidden');
wantIncludes('.pc-clip.is-clipped', 'mask-image', 'linear-gradient(to bottom, #000 calc(100% - 5.5em), transparent)');
wantIncludes('.pc-clip.is-clipped', '-webkit-mask-image', 'linear-gradient(to bottom, #000 calc(100% - 5.5em), transparent)');
want('.pc-body', 'gap', '14px');
want('.pc-body ul', 'list-style', 'none');
want('.pc-body li::before', 'width', '8px');
want('.pc-body li::before', 'height', '2px');
want('.pc-body li::before', 'top', '0.8em');
want('.pc-body li::before', 'background', '#A7A841');
want('.pc-foot', 'min-height', '44px');
want('.pc-more', 'font-weight', '700');
want('.pc-more', 'color', '#7E3F97');
want('.pc-more', 'text-decoration-thickness', '1.5px');
want('.pc-more', 'text-underline-offset', '6px');
want('.pc-more', 'min-height', '44px');
want(':focus-visible', 'outline', '2px solid #7E3F97');
want(':focus-visible', 'outline-offset', '3px');
// small screens
want('.pc-card', 'padding', '20px', '(max-width: 560px)');
want('.pc-card', 'gap', '20px', '(max-width: 560px)');
want('.pc-head', 'grid-template-columns', '104px minmax(0, 1fr)', '(max-width: 560px)');
want('.pc-head', 'gap', '16px', '(max-width: 560px)');
want('.pc-name', 'font-size', '1.85rem', '(max-width: 560px)');
// dialog
want('.pc-modal', 'width', 'min(760px, calc(100vw - 32px))');
want('.pc-modal', 'max-height', 'min(88vh, 900px)');
want('.pc-modal', 'border-radius', '16px');
want('.pc-modal', 'box-shadow', '0 24px 60px rgba(33, 26, 87, 0.16)');
want('.pc-modal', 'background', '#FBFAF0');
want('.pc-modal::backdrop', 'background', 'rgba(11, 10, 20, 0.62)');
want('.pc-sheet-head', 'grid-template-columns', '96px minmax(0, 1fr)');
want('.pc-sheet-head', 'grid-template-columns', '72px minmax(0, 1fr)', '(max-width: 600px)');
want('.pc-sheet-face', 'aspect-ratio', '4 / 5');
want('.pc-sheet-title', 'font-weight', '300');
want('.pc-sheet-title', 'font-size', '1.953rem');
want('.pc-sheet-body', 'overflow-y', 'auto');
want('.pc-sheet-close', 'width', '44px');
want('.pc-sheet-close', 'height', '44px');
want('.pc-sheet-close', 'border', LINE);
want('.pc-sheet-close', 'border-radius', '10px');
want('.pc-sheet-close', 'background', '#FFFFFF');

// ---- motion only under prefers-reduced-motion: no-preference ----
const MOTION_OK = norm('(prefers-reduced-motion: no-preference)');
let animatedOpen = false;
for (const r of rules) {
  if (r.keyframes) continue;
  if ('animation' in r.decls || 'animation-name' in r.decls) {
    if (r.media !== MOTION_OK) failures.push(`animation on "${r.selectors.join(', ')}" outside @media (prefers-reduced-motion: no-preference)`);
    else if (r.selectors.some((s) => s.endsWith('.pc-modal[open]'))) animatedOpen = true;
  }
}
if (!animatedOpen) failures.push('.pc-modal[open] must animate inside @media (prefers-reduced-motion: no-preference)');
if (lookup('html:has(.nos-presenters .pc-modal[open])', 'overflow') !== 'hidden') {
  failures.push('html:has(.nos-presenters .pc-modal[open]) { overflow: hidden } (scroll lock) is missing');
}

finish('check-styles.mjs', failures, 'presenters.css matches the pinned values from Codi\'s approved CSS, scoped under .nos-presenters.');

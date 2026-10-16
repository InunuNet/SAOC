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
  const ok = expected === undefined ? got === undefined : Array.isArray(expected) ? expected.some((e) => norm(e) === got) : norm(expected) === got;
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
    // R44 A5 (nos-critique-r3): the symposium jump link sits outside the section, so .pc-jump is the one other sanctioned root.
    if (!s.startsWith('.nos-presenters') && !s.startsWith('.pc-jump')) {
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
// R36 (NOS Design via the lead, 2026-10-16) corrects R35: .pc-title ("Presenters") is a section heading and takes the
// nos-theme section-h2 role (nos-theme.css `.nos-theme h2`), not card-title.
// R36 (F2 architect) supersedes the clamp above: nos-theme's section-h2 role is clamp(2rem, 1.2rem + 2.667vw, 3rem) (nos-theme.css:332-340,
// as corrected by the F2 branch); the old clamp topped out at 39px and this rule wins on specificity. Margin stays 0 (spacing is .pc-sec-head/.pc-sec-top).
want('.pc-title', 'font-size', 'clamp(2rem, 1.2rem + 2.667vw, 3rem)');
want('.pc-title', 'margin', '0');
want('.pc-title', 'line-height', '1.15');
want('.pc-title', 'letter-spacing', '-0.01em');
want('.pc-title', 'font-variation-settings', '"opsz" 48');
want('.pc-title', 'color', '#211A57');
// R43 (NOS Design via the lead, 2026-10-16, nos-critique-r3) supersedes: .pc-order-note is gone with the internal note; the R11
// ConfirmationBadge carries its own Tailwind styling.
if (src.includes('pc-order-note')) failures.push('.pc-order-note CSS must be deleted (R43)');
// grid
want('.pc-grid', 'grid-template-columns', 'minmax(0, 1fr)');
want('.pc-grid', 'gap', '32px');
want('.pc-grid', 'list-style', 'none');
// R44 A5 (NOS Design via the lead, 2026-10-16, nos-critique-r3) supersedes: the grid is 2-up from 768px (was min-width: 1120px).
want('.pc-grid', 'grid-template-columns', 'repeat(2, minmax(0, 1fr))', '(min-width: 768px)');
want('.pc-grid', 'grid-template-columns', undefined, '(min-width: 1120px)');
// 2-up between 768 and 1119 the card is ~337px wide, so it takes the small-screen card geometry (head 104px photo) to keep the name column >= 150px.
want('.pc-card', 'padding', '24px', '(min-width: 768px) and (max-width: 1119px)');
want('.pc-card', 'gap', '24px', '(min-width: 768px) and (max-width: 1119px)');
want('.pc-head', 'grid-template-columns', '104px minmax(0, 1fr)', '(min-width: 768px) and (max-width: 1119px)');
want('.pc-head', 'gap', '16px', '(min-width: 768px) and (max-width: 1119px)');
// R44 A5: the jump link target clears the sticky header (74px at 1280 + 16px air); the link is a 44px target in the pc-more style.
want('.pc-sec-top', 'scroll-margin-top', '90px');
want('.pc-jump', 'padding-block', '24px 0');
want('.pc-jump-link', 'display', 'inline-flex');
want('.pc-jump-link', 'min-height', '44px');
want('.pc-jump-link', 'font-weight', '700');
want('.pc-jump-link', 'color', '#7E3F97');
want('.pc-jump-link', 'text-decoration-thickness', '1.5px');
want('.pc-jump-link', 'text-underline-offset', '6px');
want('.pc-jump-link', 'font-size', 'var(--fs-body, 1.0625rem)');

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
// R35 (NOS Design via the lead, 2026-10-16, nos-critique-r2 item 4) supersedes: .pc-name meets the card-title role,
// Fraunces 400 22/1.25, opsz 24 (was 300, clamp(2rem..2.6rem), 1.04).
want('.pc-name', 'font-weight', '400');
want('.pc-name', 'font-size', '1.375rem');
want('.pc-name', 'line-height', '1.25');
want('.pc-name', 'letter-spacing', '-0.01em');
want('.pc-name', 'color', '#211A57');
want('.pc-name', 'text-wrap', 'balance');
want('.pc-name', 'font-variation-settings', '"opsz" 24');
// R35 (NOS Design via the lead, 2026-10-16, nos-critique-r2 item 4) supersedes: .pc-role is uppercase, so it takes the label
// role, Karla 700 12px .14em (was 0.8rem 600 .08em).
want('.pc-role', 'font-size', '0.75rem');
want('.pc-role', 'font-weight', '700');
want('.pc-role', 'letter-spacing', '0.14em');
want('.pc-role', 'text-transform', 'uppercase');
want('.pc-role', 'color', '#7E3F97');
want('.pc-role', 'line-height', '1.45');
want('.pc-role', 'text-wrap', 'balance');
// bio + clamp
want('.pc-bio', 'padding-top', '24px');
want('.pc-bio', 'border-top', LINE);
// R39 (NOS Design via the lead, 2026-10-16, nos-critique-r3) supersedes: the --bio-h "clamp to the shortest full bio" equal-height
// script is gone. Bios clamp to 4 lines (--pc-bio-lines x --pc-bio-lh em) once the grid is data-clamp (set after mount, so no-JS
// shows full bios), and the 17px body role (nos-theme.css --fs-body 1.0625rem) sits on .pc-clip so em is the bio's own size.
want('.nos-presenters', '--pc-bio-lines', '4');
want('.nos-presenters', '--pc-bio-lh', '1.68');
want('.pc-clip', 'font-size', 'var(--fs-body, 1.0625rem)');
want('.pc-clip', 'max-height', undefined);
want('.pc-clip', 'overflow', undefined);
want('.pc-clip:not(.is-open)', 'max-height', 'calc(4 * 1.68 * 1em)');
want('.pc-clip:not(.is-open)', 'overflow', 'hidden');
wantIncludes('.pc-clip.is-clipped:not(.is-open)', 'mask-image', 'linear-gradient(to bottom, #000 calc(100% - 1.7em), transparent)');
wantIncludes('.pc-clip.is-clipped:not(.is-open)', '-webkit-mask-image', 'linear-gradient(to bottom, #000 calc(100% - 1.7em), transparent)');
if (!rules.some((r) => r.selectors.some((x) => x.endsWith('.pc-clip:not(.is-open)') && x.includes('.pc-grid[data-clamp]')))) {
  failures.push('the 4-line clamp must be scoped to .pc-grid[data-clamp] .pc-clip:not(.is-open) (progressive enhancement)');
}
// R39 P2: bio text is 17px (body role), not 16px; the 68ch bio measure stays.
want('.pc-body li', 'max-width', '68ch');
want('.pc-body li', 'line-height', '1.68');
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
want('.pc-more', 'display', 'inline-flex');
// Focus: Codi's corrected R9/3 ruling, 2026-10-16 (nos-critique-r1 golden §4) — presenters take
// the theme violet ring (2px solid, 2px offset) painted by `.nos-theme :focus-visible:not(.group)`,
// which already outranked this file's rule. The dead outline/3px offset is removed; the live
// border-radius stays; --ring-focus is never re-pointed here.
want(':focus-visible', 'outline', undefined);
want(':focus-visible', 'outline-offset', undefined);
want(':focus-visible', 'border-radius', '4px');
want('.nos-presenters', '--ring-focus', undefined);
// small screens
want('.pc-card', 'padding', '20px', '(max-width: 560px)');
want('.pc-card', 'gap', '20px', '(max-width: 560px)');
want('.pc-head', 'grid-template-columns', '104px minmax(0, 1fr)', '(max-width: 560px)');
want('.pc-head', 'gap', '16px', '(max-width: 560px)');
// R35 (NOS Design via the lead, 2026-10-16, nos-critique-r2 item 4) supersedes: the card-title size holds on small screens; no
// .pc-name font-size override (was 1.85rem).
want('.pc-name', 'font-size', undefined, '(max-width: 560px)');
// R39 (NOS Design via the lead, 2026-10-16, nos-critique-r3) supersedes: "Read full bio" is an inline aria-expanded disclosure, so
// the full-bio dialog and every rule for it are gone, with the tokens only it used.
for (const dead of ['.pc-modal', '.pc-sheet', '--bio-h', '@keyframes', 'pc-rise', 'pc-fade', 'html:has']) {
  if (src.includes(dead)) failures.push(`dead dialog/equal-height CSS left behind: ${dead}`);
}
for (const token of ['--pc-gold-100', '--pc-gold-300', '--pc-backdrop', '--pc-shadow-xl', '--pc-t-slow', '--pc-fs-lg', '--pc-fs-xl']) {
  if (token in vars) failures.push(`token ${token} was only used by the dialog and must be removed`);
}
want('.pc-more', 'transition', undefined);

// ---- motion only under prefers-reduced-motion: no-preference (R39: nothing animates the toggle unless allowed) ----
const MOTION_OK = norm('(prefers-reduced-motion: no-preference)');
for (const r of rules) {
  if (r.keyframes) continue;
  for (const prop of ['animation', 'animation-name', 'transition', 'transition-property']) {
    if (prop in r.decls && r.media !== MOTION_OK) failures.push(`${prop} on "${r.selectors.join(', ')}" outside @media (prefers-reduced-motion: no-preference)`);
  }
}
if (/scroll-behavior/.test(src)) failures.push('scroll-behavior must not be set (no smooth scrolling)');

finish('check-styles.mjs', failures, 'presenters.css matches the pinned values from Codi\'s approved CSS, scoped under .nos-presenters.');

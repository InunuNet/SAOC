// nav-focus-underline HD-1 -- static checks that the two headers share one structure. Run from the project root: node <this file> <mode>
// Modes: menu-border | drawer-search | hooks | saoc-header | breakpoints | states-saoc | states-nos | nos-values | banner-footer
// The measured parity (checks/compare-geometry.mjs) is the real gate; these catch what a measurement cannot name.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

if (process.env.CHECK_ROOT) process.chdir(process.env.CHECK_ROOT); // only for running outside the project root
const SAOC = 'components/chrome/Header.tsx';
const NOS = 'components/nos-chrome/NosHeader.tsx';
const NOS_CSS = 'components/nos-chrome/nos-chrome.css';
const mode = process.argv[2];
const failures = [];
const fail = (m) => failures.push(m);
const read = (p) => readFileSync(p, 'utf8');

function parse(path) { return ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function literals(node) {
  const out = [];
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    else if (ts.isJsxText(n)) out.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out.join(' ');
}
function elements(path) {
  const list = [];
  const walk = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const opening = ts.isJsxElement(n) ? n.openingElement : n;
      const attrs = new Map();
      for (const a of opening.attributes.properties) if (ts.isJsxAttribute(a)) attrs.set(a.name.getText(), a.initializer ?? null);
      const cls = attrs.get('className');
      list.push({ tag: opening.tagName.getText(), attrs, cls: cls ? literals(cls) : '', text: literals(n), hd: attrs.has('data-hd') && attrs.get('data-hd') ? literals(attrs.get('data-hd')).trim() : null });
    }
    ts.forEachChild(n, walk);
  };
  walk(parse(path));
  return list;
}
const withHd = (els, name) => els.filter((e) => e.hd === name);

function cssRules() {
  const raw = read(NOS_CSS).replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  const rules = [];
  for (const m of raw.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector && !selector.startsWith('@')) rules.push({ selector, parts: selector.split(',').map((s) => s.trim()), decl: m[2] });
  }
  return { raw, rules };
}

if (mode === 'hooks') {
  // The same data-hd hooks on both headers, so one measurement script reads both.
  const need = { bar: 1, brand: 1, nav: 1, item: 2, label: 2, cta: 1, menu: 1 };
  const s = elements(SAOC);
  const n = elements(NOS);
  for (const [name, min] of Object.entries(need)) {
    if (withHd(s, name).length < min) fail(`${SAOC}: needs ${min}+ data-hd="${name}" (found ${withHd(s, name).length})`);
    if (withHd(n, name).length < min) fail(`${NOS}: needs ${min}+ data-hd="${name}" (found ${withHd(n, name).length})`);
  }
  if (!withHd(s, 'search').length) fail(`${SAOC}: needs data-hd="search" on the search button`);
  if (withHd(n, 'label').length < 3) fail(`${NOS}: trigger, plain links and Contact each need a data-hd="label" span (the bar slot); found ${withHd(n, 'label').length}`);
} else if (mode === 'menu-border') {
  // NOS Design ruling: the MENU button border is 1.5px solid, nav ink at 28% over the ground, as one solid named token per host.
  const spec = JSON.parse(read(new URL('../goldens/header-geometry.json', import.meta.url).pathname)).menuButton;
  const g = read('app/globals.css');
  const n = read(NOS_CSS);
  const hex = (css, name) => { const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`)); return m ? m[1] : null; };
  const mix = (ink, ground) => [1, 3, 5].map((i) => Math.round(0.28*parseInt(ink.slice(i, i + 2), 16) + 0.72*parseInt(ground.slice(i, i + 2), 16)));
  const near = (a, b) => a && b && [1, 3, 5].every((i, k) => Math.abs(parseInt(a.slice(i, i + 2), 16) - b[k]) <= spec.channelTolerance);
  const sInk = hex(g, '--ink'), sGround = hex(g, '--parchment'), nInk = hex(n, '--nc-royal'), nGround = hex(n, '--nc-ground');
  if (!near(hex(g, spec.token), mix(sInk, sGround))) fail(`app/globals.css: ${spec.token} must be solid ${spec.saoc.composite} (--ink 28% over --parchment, recomputed from the file's own tokens)`);
  if (!near(hex(n, spec.token), mix(nInk, nGround))) fail(`${NOS_CSS}: ${spec.token} must be solid ${spec.nos.composite} (--nc-royal 28% over --nc-ground)`);
  const { rules } = cssRules();
  const burger = rules.filter((r) => r.parts.includes('.nh-burger')).map((r) => r.decl).join(' ');
  if (!/border\s*:\s*1\.5px solid var\(--nh-control-border\)/.test(burger)) fail(`${NOS_CSS}: .nh-burger border must be 1.5px solid var(--nh-control-border) (no rgba)`);
  const menu = withHd(elements(SAOC), 'menu');
  if (menu.length !== 1 || !/nh-control-border/.test(menu[0].cls) || !/1\.5px/.test(menu[0].cls)) fail(`${SAOC}: the MENU button border is 1.5px with var(--nh-control-border)`);
  if (menu.length === 1 && /--rule|border-rule/.test(menu[0].cls)) fail(`${SAOC}: --rule does not match the composite (dE 12.6 > 2); use the token`);
} else if (mode === 'drawer-search') {
  // NOS Design ruling: below breakpoints.full the drawer's FIRST row is a full-width 44px search row, existing icon and the dialog's own label.
  const path = 'components/chrome/MobileMenu.tsx';
  const text = read(path);
  const els = elements(path);
  const row = els.filter((e) => e.hd === 'drawer-search');
  if (row.length !== 1) { fail(`${path}: exactly one data-hd="drawer-search" row (found ${row.length})`); }
  else {
    if (!/Search SAOC/.test(row[0].text)) fail(`${path}: the visible label is "Search SAOC" (SearchOverlay's own aria-label, no new string)`);
    if (/Open search/.test(row[0].text)) fail(`${path}: "Open search" is the header icon's aria-label, not the drawer label`);
    if (!/min-h-11|h-11|min-h-\[44px\]|h-\[44px\]/.test(row[0].cls)) fail(`${path}: the row is 44px tall`);
    if (!/w-full|flex-1|block/.test(row[0].cls)) fail(`${path}: the row is full width`);
    if (!/size=\{18\}/.test(text)) fail(`${path}: the existing 18px Search icon (size={18})`);
    if (!row[0].attrs.has('onClick')) fail(`${path}: the row opens the search dialog (onClick)`);
  }
  const at = text.indexOf('data-hd="drawer-search"');
  const items = text.search(/nav\.map\(/);
  if (at === -1 || items === -1 || at > items) fail(`${path}: the search row comes before the nav items`);
  if (!/Open search/.test(read(SAOC))) fail(`${SAOC}: the header icon keeps aria-label "Open search"`);
  if (!/onSearch/.test(read(SAOC)) || !/onSearch/.test(text)) fail('Header.tsx passes onSearch to MobileMenu, which calls it');
} else if (mode === 'saoc-header') {
  const s = elements(SAOC);
  const cta = withHd(s, 'cta');
  if (cta.length !== 1) fail(`${SAOC}: exactly one data-hd="cta" (found ${cta.length})`);
  else {
    if (!/Join a society/.test(cta[0].text)) fail(`${SAOC}: the CTA reads "Join a society" (the utility bar's own string, not invented)`);
    const href = cta[0].attrs.get('href');
    if (!href || !/\/societies/.test(literals(href))) fail(`${SAOC}: the CTA links to /societies (as the utility bar pill did)`);
  }
  const menu = withHd(s, 'menu');
  if (menu.length !== 1 || !/\bMenu\b/.test(menu[0].text)) fail(`${SAOC}: data-hd="menu" is a labelled button reading "Menu" (the NOS string), not icon-only`);
  const logo = s.filter((e) => e.tag === 'Image' && /saoc-lockup-horizontal-full-name\.png/.test(e.attrs.get('src') ? literals(e.attrs.get('src')) : ''));
  if (logo.length !== 1) fail(`${SAOC}: the supplied full-name lockup file must stay the header lockup`);
  else if (/(object-|filter|brightness|grayscale|invert|hue-rotate|clip|mask|contrast|saturate)/.test(logo[0].cls)) fail(`${SAOC}: the lockup is scaled only (no crop, filter or recolour classes): ${logo[0].cls}`);
  const search = read('components/chrome/MobileMenu.tsx');
  if (!/search/i.test(search)) fail('components/chrome/MobileMenu.tsx: SAOC search moves into the drawer below 1260 and must be reachable there');
} else if (mode === 'breakpoints') {
  // Shared breakpoints live in goldens/header-geometry.json (breakpoints.full / .row) and apply to BOTH hosts together.
  const { full, row } = JSON.parse(read(new URL('../goldens/header-geometry.json', import.meta.url).pathname)).breakpoints;
  const need = (text, label, re) => { if (!re.test(text)) fail(`${label}: missing ${re}`); };
  const s = read(SAOC);
  need(s, SAOC, new RegExp(`min-\\[${full}px\\]`));
  need(s, SAOC, new RegExp(`(min|max)-\\[(${row}|${row - 1})px\\]`));
  if (/1240|1239|1260|699/.test(s) && !(row - 1 === 699 || full === 1260)) fail(`${SAOC}: an old breakpoint (1240/1239/1260/699) remains; use ${full} and ${row}`);
  const { raw } = cssRules();
  need(raw, NOS_CSS, new RegExp(`@media \\(min-width: ${full}px\\)`));
  need(raw, NOS_CSS, new RegExp(`@media \\(max-width: ${row - 1}px\\)`));
  if (/min-width: 1260px|max-width: 699px/.test(raw) && full !== 1260 && row !== 700) fail(`${NOS_CSS}: the old 1260/699 media queries remain; both hosts move to ${full}/${row} together`);
  need(read(NOS), NOS, new RegExp(`\\(min-width: ${full}px\\)`));
  if (/699px/.test(read(NOS))) fail(`${NOS}: the lockup <picture> source media still uses 699px; follow breakpoints.row (${row - 1}px)`);
  if (/\(min-width: 1260px\)/.test(read(NOS)) && full !== 1260) fail(`${NOS}: PANEL_BREAKPOINT_QUERY still 1260px`);
} else if (mode === 'states-saoc') {
  const items = withHd(elements(SAOC), 'item');
  if (!items.length) fail(`${SAOC}: no data-hd="item" elements`);
  for (const it of items) {
    if (/hover:bg-|focus-visible:bg-/.test(it.cls)) fail(`${SAOC}: a menu item has a hover/focus fill (${it.cls.split(/\s+/).filter((t) => /bg-/.test(t)).join(' ')}); HD-1 #7 allows underline only`);
  }
  const all = elements(SAOC).filter((e) => e.hd === 'item' || e.hd === 'label').map((e) => e.cls).join(' ');
  if (!/-bottom-2\b|bottom-\[-8px\]/.test(all)) fail(`${SAOC}: the bar slot is the label's -8px (-bottom-2); not found on items or labels`);
  if (/-bottom-1\b/.test(all)) fail(`${SAOC}: the old -bottom-1 bar slot remains on a menu item`);
  if (!/aria-\[current|aria-current:/.test(all)) fail(`${SAOC}: the active bar is not driven by aria-current variants`);
  if (!/(h-0\.5|h-\[2px\])/.test(all)) fail(`${SAOC}: the bar is not 2px (h-0.5 / h-[2px])`);
  if (!/(^|\s)(group-)?hover:(after:)?(h-0\.5|h-\[2px\])|(group-)?hover:after:/.test(all)) fail(`${SAOC}: hover draws no 2px bar in the slot (group-hover:after:h-0.5 or similar)`);
} else if (mode === 'states-nos') {
  const { raw, rules } = cssRules();
  for (const r of rules) {
    const hovers = r.parts.some((p) => /^\.nh-(link|trigger):hover$/.test(p));
    if (hovers && /background/.test(r.decl)) fail(`${NOS_CSS}: '${r.selector}' still fills on hover (HD-1 #7: underline only)`);
  }
  if (!rules.some((r) => /\.nh-trigger\[aria-expanded="true"\]/.test(r.selector) && /background\s*:/.test(r.decl))) fail(`${NOS_CSS}: the open mega-menu trigger (aria-expanded) must keep its fill`);
  for (const [fam, state] of [['.nh-link', ':hover'], ['.nh-trigger', ':hover'], ['.nh-link', '[aria-current'], ['.nh-trigger', '[aria-current']]) {
    const ok = rules.some((r) => r.parts.some((p) => p.includes(fam) && p.includes(state) && p.includes('.nh-label::after')) && /\b2px\b/.test(r.decl));
    if (!ok) fail(`${NOS_CSS}: no 2px .nh-label::after bar for ${fam}${state}`);
  }
  if (!rules.some((r) => r.parts.some((p) => p.includes('.nh-label::after')) && /bottom\s*:\s*-8px/.test(r.decl) && /position\s*:\s*absolute/.test(r.decl))) fail(`${NOS_CSS}: the shared bar slot (.nh-label::after, bottom: -8px) is gone`);
} else if (mode === 'nos-values') {
  // The reference numbers: moving SAOC to NOS v4 must not move NOS.
  const { rules } = cssRules();
  const decl = (sel) => rules.filter((r) => r.parts.includes(sel)).map((r) => r.decl).join(' ');
  const want = [
    ['.nh-bar', [/gap\s*:\s*24px/, /padding\s*:\s*13px var\(--nc-gutter\)/, /max-width\s*:\s*calc\(var\(--nc-wide\) \+ 2 \* var\(--nc-gutter\)\)/]],
    ['.nh-link, .nh-trigger', [/min-height\s*:\s*44px/, /padding\s*:\s*0 9px/, /font\s*:\s*600 14\.5px\/1/, /gap\s*:\s*6px/]],
    ['.nh-nav > ul', [/gap\s*:\s*2px/]],
    ['.nh-cta', [/min-height\s*:\s*44px/, /padding\s*:\s*10px 24px/, /border-radius\s*:\s*10px/, /font\s*:\s*700 13px\/1/, /letter-spacing\s*:\s*0\.12em/, /text-transform\s*:\s*uppercase/]],
  ];
  for (const [sel, res] of want) {
    const joined = rules.filter((r) => r.selector.replace(/\s+/g, ' ') === sel).map((r) => r.decl).join(' ') || decl(sel);
    for (const re of res) if (!re.test(joined)) fail(`${NOS_CSS}: '${sel}' lost ${re}`);
  }
} else if (mode === 'banner-footer') {
  if (/TicketingTestBar/.test(read('components/site-chrome/SaocFrame.tsx'))) fail('SaocFrame mounts the ticketing preview banner; it must stay NOS-only (HD-1 #10: same on both hosts, or neither)');
  const { raw } = cssRules();
  if (!/data-ticketing-test-bar[\s\S]{0,60}top: calc\(44px/.test(raw) || !/top: calc\(48px/.test(raw)) fail(`${NOS_CSS}: the 44px/48px banner offsets are the reference and must stay`);
  const f = read('components/chrome/Footer.tsx');
  const reg = f.indexOf('FOOTER_REG');
  // The address may be a literal in Footer.tsx or an exported constant in footer-data.ts (F2 may edit it) that Footer.tsx renders.
  const constant = read('components/chrome/footer-data.ts').match(/export const (\w+)\s*=\s*['"`]info@saoc\.co\.za['"`]/);
  const mail = constant ? f.indexOf(constant[1], f.indexOf('import')) === -1 ? -1 : f.lastIndexOf(constant[1]) : f.indexOf('info@saoc.co.za');
  if (mail === -1) fail('components/chrome/Footer.tsx: info@saoc.co.za (literal, or a footer-data constant) moves into the brand column under the REG/NPO line');
  else if (reg === -1 || mail < reg) fail('components/chrome/Footer.tsx: the email sits after FOOTER_REG in the brand column');
  if (!/mailto:/.test(f)) fail('components/chrome/Footer.tsx: the email is a mailto link, as in the utility bar');
  for (const p of ['components/chrome/Header.tsx', 'components/chrome/MobileMenu.tsx', 'components/chrome/Footer.tsx']) {
    if (/showLabelWithEdition|formatShowShortMonthYear/.test(read(p))) fail(`${p}: the "19th National Show · Sept 2027" pill is removed everywhere in the SAOC chrome`);
  }
} else {
  fail(`unknown mode '${mode}'`);
}

if (failures.length) { console.error(`FAIL (${mode})\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`header-spec ${mode} pass`);

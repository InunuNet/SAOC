// nav-focus-underline HD-1 -- static checks that the two headers share one structure. Run from the project root: node <this file> <mode>
// Modes: hooks | saoc-header | breakpoints | states-saoc | states-nos | nos-values | banner-footer
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
  const s = read(SAOC);
  if (!/1260px/.test(s)) fail(`${SAOC}: full nav from 1260px (NOS .nh-nav breakpoint)`);
  if (/1240|1239/.test(s)) fail(`${SAOC}: 1240/1239 breakpoint text remains (identical breakpoints, 1260)`);
  if (!/699|700/.test(s)) fail(`${SAOC}: no 700/699 phone breakpoint (lockup row one, header scrolls)`);
  const { raw } = cssRules();
  if (!/@media \(min-width: 1260px\)/.test(raw) || !/@media \(max-width: 699px\)/.test(raw)) fail(`${NOS_CSS}: the 1260 / 699 media queries are the reference and must stay`);
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
  const mail = f.indexOf('info@saoc.co.za');
  if (mail === -1) fail('components/chrome/Footer.tsx: info@saoc.co.za moves into the brand column under the REG/NPO line');
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

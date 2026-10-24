// nav-focus-underline -- static checks on the nav/footer focus + aria-current rules. Run: node <this file> <mode>
// Modes: tsx-rings | tsx-links | tsx-aria-current | tsx-buttons | css-rings | css-underline | css-aria-current | css-keepers | tokens
// Run from the project root. Parses JSX with the TypeScript compiler API so a class on the wrong element cannot hide in a regex.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

if (process.env.CHECK_ROOT) process.chdir(process.env.CHECK_ROOT); // only for running outside the project root (e.g. from another worktree)
const SAOC_TSX = ['components/chrome/Header.tsx', 'components/chrome/MobileMenu.tsx', 'components/chrome/Footer.tsx'];
const NOS_TSX = ['components/nos-chrome/NosHeader.tsx', 'components/nos-chrome/NosFooter.tsx'];
const ALL_TSX = [...SAOC_TSX, ...NOS_TSX];
const NOS_CSS = 'components/nos-chrome/nos-chrome.css';
const LINK_TAGS = new Set(['Link', 'a', 'NavLink', 'MediaKitFooterLink']);
const FORM_TAGS = new Set(['button', 'input', 'textarea', 'select']);
// Not a link-list item: the brand lockup link (href "/" or HUB_HREF). Skip links are not in these files.
const BRAND_HREF_IDENTIFIERS = new Set(['HUB_HREF']);

const mode = process.argv[2];
const failures = [];
const fail = (m) => failures.push(m);

function parse(path) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function literalText(node) {
  const parts = [];
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) parts.push(n.text);
    else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) parts.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return parts.join(' ');
}
function attrs(opening) {
  const out = new Map();
  for (const a of opening.attributes.properties) if (ts.isJsxAttribute(a)) out.set(a.name.getText(), a.initializer ?? null);
  return out;
}
function tagOf(opening) { return opening.tagName.getText(); }
// Every JSX element: { path, tag, attrs, cls (own class text), subtreeCls (own + descendants) }.
function elements(path) {
  const sf = parse(path);
  const list = [];
  const walk = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const opening = ts.isJsxElement(n) ? n.openingElement : n;
      const a = attrs(opening);
      const clsNode = a.get('className');
      let subtreeCls = '';
      const collect = (m) => {
        if (ts.isJsxAttribute(m) && m.name.getText() === 'className' && m.initializer) subtreeCls += ' ' + literalText(m.initializer);
        ts.forEachChild(m, collect);
      };
      collect(n);
      list.push({ path, tag: tagOf(opening), attrs: a, cls: clsNode ? literalText(clsNode) : '', subtreeCls, line: sf.getLineAndCharacterOfPosition(opening.getStart()).line + 1 });
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return list;
}
function isBrand(el) {
  const href = el.attrs.get('href');
  if (!href) return false;
  if (ts.isStringLiteral(href)) return href.text === '/';
  if (ts.isJsxExpression(href) && href.expression) {
    const t = href.expression.getText();
    return t === "'/'" || t === '"/"' || BRAND_HREF_IDENTIFIERS.has(t);
  }
  return false;
}
const isKeeper = (el) => FORM_TAGS.has(el.tag) || isBrand(el);
const tokens = (cls) => cls.split(/\s+/).filter(Boolean);
const base = (t) => t.slice(t.lastIndexOf(':') + 1);
// A ring/outline utility other than the explicit "none/hidden" resets. forced-colors variants are the sanctioned fallback.
function isRingToken(t) {
  if (t.includes('forced-colors:')) return false;
  const b = base(t);
  if (b === 'outline-none' || b === 'outline-hidden') return false;
  return /^(ring($|-)|outline($|-))/.test(b);
}
const allLinks = (files) => files.flatMap(elements).filter((el) => LINK_TAGS.has(el.tag) && !isBrand(el));

if (mode === 'tsx-rings') {
  // No ring/outline utility on anything in these files except form controls (buttons, inputs) and the brand lockup link.
  for (const path of ALL_TSX) {
    for (const el of elements(path)) {
      if (isKeeper(el)) continue;
      const bad = tokens(el.cls).filter(isRingToken);
      if (bad.length) fail(`${path}:${el.line} <${el.tag}> carries ${bad.join(' ')} (rings are for buttons and fields only)`);
    }
  }
  if (readFileSync('components/chrome/footer-data.ts', 'utf8').includes('focus-visible')) fail('components/chrome/footer-data.ts must not carry focus classes (shared with the NOS footer); put them on Footer.tsx');
} else if (mode === 'tsx-links') {
  // Every nav/footer link on the SAOC side suppresses the UA outline, carries a focus-visible underline, and a forced-colors fallback.
  const INDICATOR = /(^|\s)(group-)?focus-visible:(after:)?(underline|decoration-2|h-0\.5|h-\[2px\]|border-b-2)/;
  let seen = 0;
  for (const el of allLinks(SAOC_TSX)) {
    seen += 1;
    if (!tokens(el.cls).some((t) => base(t) === 'outline-none' && t.includes('focus-visible:'))) fail(`${el.path}:${el.line} <${el.tag}> lacks focus-visible:outline-none (the UA focus outline would show)`);
    if (!INDICATOR.test(el.subtreeCls)) fail(`${el.path}:${el.line} <${el.tag}> has no focus-visible underline utility on itself or a descendant`);
    if (!el.subtreeCls.includes('forced-colors:')) fail(`${el.path}:${el.line} <${el.tag}> has no forced-colors: fallback for the focus indicator`);
  }
  if (seen < 10) fail(`expected at least 10 SAOC nav/footer link elements, found ${seen} (parse problem or links removed)`);
} else if (mode === 'tsx-aria-current') {
  // aria-current on the nav links of both headers and the mobile menu; the shared matcher is used; the old class-driven active state is gone.
  const need = { 'components/chrome/Header.tsx': 2, 'components/chrome/MobileMenu.tsx': 2, 'components/nos-chrome/NosHeader.tsx': 9 };
  for (const [path, min] of Object.entries(need)) {
    const n = elements(path).filter((el) => el.attrs.has('aria-current')).length;
    if (n < min) fail(`${path}: ${n} elements carry aria-current, need at least ${min}`);
    if (!/from '@\/lib\/nav-current'/.test(readFileSync(path, 'utf8'))) fail(`${path} does not import the shared matcher from '@/lib/nav-current'`);
  }
  // MobileMenu legitimately passes `active: open` to useFocusTrap, so only the matcher-era name is banned there.
  for (const [path, banned] of [['components/chrome/Header.tsx', ['active', 'isActive']], ['components/chrome/MobileMenu.tsx', ['isActive']]]) {
    const sf = parse(path);
    const bad = [];
    const walk = (n) => { if (ts.isIdentifier(n) && banned.includes(n.text)) bad.push(n.text); ts.forEachChild(n, walk); };
    walk(sf);
    if (bad.length) fail(`${path} still has the class-driven active state (${bad.length} identifier(s): ${[...new Set(bad)].join(', ')})`);
  }
  if (/data-current/.test(readFileSync('components/nos-chrome/NosHeader.tsx', 'utf8'))) fail('NosHeader.tsx still uses data-current (the active visual must hang off aria-current)');
} else if (mode === 'tsx-buttons') {
  // Buttons and the SAOC brand link keep their rings.
  for (const path of SAOC_TSX) {
    for (const el of elements(path)) {
      if (el.tag === 'button' && !/focus-visible:ring/.test(el.cls)) fail(`${path}:${el.line} <button> lost its focus-visible ring`);
    }
  }
  const brand = elements('components/chrome/Header.tsx').filter((el) => el.tag === 'Link' && isBrand(el));
  if (brand.length !== 1 || !/focus-visible:ring-2/.test(brand[0].cls)) fail('Header.tsx brand link must keep its focus-visible ring');
} else if (['css-rings', 'css-underline', 'css-aria-current', 'css-keepers', 'tokens'].includes(mode)) {
  const raw = readFileSync(NOS_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  // forced-colors @media blocks are the sanctioned place for outlines; find their spans by brace matching.
  const forced = [];
  for (const m of raw.matchAll(/@media\s*\(forced-colors:\s*active\)\s*\{/g)) {
    let depth = 1; let i = m.index + m[0].length;
    while (i < raw.length && depth) { if (raw[i] === '{') depth += 1; else if (raw[i] === '}') depth -= 1; i += 1; }
    forced.push([m.index, i]);
  }
  const rules = [];
  for (const m of raw.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/@media[^{]*$/, '').trim();
    if (!selector || selector.startsWith('@')) continue;
    rules.push({ selector, parts: selector.split(',').map((s) => s.trim()), decl: m[2], inForced: forced.some(([a, b]) => m.index >= a && m.index < b) });
  }
  const KEEPER = /\.(nh-brand|nh-cta|nh-burger|nh-skip|nf-lockup|nf-form)\b/;
  // (?=[^\s;]) forces \s* to consume the space, so "outline: none" cannot backtrack into a false match.
  const ringish = (decl) => /outline(-width|-color|-style)?\s*:\s*(?=[^\s;])(?!none\b|0\b)/.test(decl) || /box-shadow\s*:\s*(?=[^\s;])(?!none\b)/.test(decl);
  const focusRules = rules.filter((r) => /:focus-visible/.test(r.selector));
  const covers = (family) => focusRules.filter((r) => !r.inForced && r.parts.some((p) => p.includes(family)));

  if (mode === 'css-rings') {
    for (const r of focusRules) {
      if (r.inForced || !ringish(r.decl)) continue;
      const bad = r.parts.filter((p) => !KEEPER.test(p));
      if (bad.length) fail(`${NOS_CSS}: focus-visible rule '${bad.join(', ')}' draws a ring/outline on a non-control (nav/footer links take the underline)`);
    }
  }
  if (mode === 'css-underline') {
    const header = ['.nh-link', '.nh-trigger', '.nh-mega-list a', '.nd-item', '.nd-group a', '.nd-credit a'];
    const footer = ['.nf-list a', '.nf-legal a'];
    for (const [families, colour] of [[header, 'var(--nc-royal)'], [footer, 'var(--nc-ground)']]) {
      for (const f of families) {
        const rs = covers(f);
        const decl = rs.map((r) => r.decl).join(' ');
        if (!rs.length) { fail(`${NOS_CSS}: no :focus-visible rule for ${f}`); continue; }
        if (!/outline\s*:\s*(none|0)\b/.test(decl)) fail(`${NOS_CSS}: ${f}:focus-visible does not clear the UA outline (outline: none)`);
        if (!/\b2px\b/.test(decl) || !/(text-decoration|height|border)/.test(decl)) fail(`${NOS_CSS}: ${f}:focus-visible has no 2px underline`);
        if (!decl.includes(colour)) fail(`${NOS_CSS}: ${f}:focus-visible does not use ${colour}`);
      }
    }
    if (!forced.some(([a, b]) => /:focus-visible/.test(raw.slice(a, b)))) fail(`${NOS_CSS}: no @media (forced-colors: active) block carrying a :focus-visible indicator`);
  }
  if (mode === 'css-aria-current') {
    if (/data-current/.test(raw)) fail(`${NOS_CSS} still styles [data-current] (the active visual must hang off [aria-current])`);
    for (const f of ['.nh-link', '.nh-trigger', '.nd-item']) {
      if (!rules.some((r) => !/:focus-visible/.test(r.selector) && r.parts.some((p) => p.includes(f) && /\[aria-current/.test(p)))) fail(`${NOS_CSS}: no [aria-current] rule for ${f}`);
    }
  }
  if (mode === 'css-keepers') {
    for (const f of ['.nh-brand', '.nh-cta', '.nh-burger', '.nf-lockup', '.nh-skip']) {
      const rs = covers(f);
      if (!rs.some((r) => /outline\s*:\s*2px/.test(r.decl))) fail(`${NOS_CSS}: ${f} lost its 2px :focus-visible outline`);
    }
    const form = covers('.nf-form');
    const generic = form.some((r) => r.parts.some((p) => /\.nf-form\s*:focus-visible/.test(p)));
    for (const [what, re] of [['button', /button/], ['checkbox', /checkbox/], ['email field', /email/]]) {
      if (!generic && !form.some((r) => r.parts.some((p) => re.test(p) && /outline\s*:\s*2px/.test(r.decl)))) fail(`${NOS_CSS}: newsletter ${what} lost its :focus-visible outline`);
    }
  }
  if (mode === 'tokens') {
    for (const r of rules) {
      if (!/:focus-visible|\[aria-current/.test(r.selector)) continue;
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(r.decl)) fail(`${NOS_CSS}: '${r.selector}' uses a bare colour value (tokens only)`);
    }
    for (const path of ALL_TSX) {
      for (const el of elements(path)) {
        const bad = tokens(el.cls).filter((t) => /(focus-visible|aria-current|aria-\[current)/.test(t) && /\[#|#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(t));
        if (bad.length) fail(`${path}:${el.line} <${el.tag}> uses a bare colour in ${bad.join(' ')} (tokens only)`);
      }
    }
  }
} else {
  fail(`unknown mode '${mode}'`);
}

if (failures.length) { console.error(`FAIL (${mode})\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`focus-static ${mode} pass`);

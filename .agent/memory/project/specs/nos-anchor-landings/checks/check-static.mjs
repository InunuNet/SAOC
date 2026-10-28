// Static pins for nos-anchor-landings. Usage: node check-static.mjs <bp768|token-def|token-use|no-literals|comment>   (exit 0 pass, 1 fail)
import { readFileSync } from 'node:fs';
const STRUCT = readFileSync('app/(nos)/national-show/nos-structure.css', 'utf8');
const CHROME = readFileSync('components/nos-chrome/nos-chrome.css', 'utf8');
const GLOBALS = readFileSync('app/globals.css', 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const region = (s, from, to) => { const a = s.indexOf(from); const b = s.indexOf(to, a + 1); if (a < 0 || b < 0) fail(`region markers not found: ${from} .. ${to}`); return s.slice(a, b); };
// Region A: the doc variables block. Region B: the generic hash-target rules (data-nos-group, [id], and the two ticketing-bar variants).
const A = region(STRUCT, '/* Sticky values the shared CSS reads', "/* One container: the header's own axis");
const bStart = STRUCT.indexOf('.nos-theme [data-nos-group]');
const TB = 'body:has([data-ticketing-test-bar]) .nos-theme [id]';
const bFirst = STRUCT.indexOf(TB, bStart);
const bLast = bFirst < 0 ? -1 : STRUCT.indexOf(TB, bFirst + 1); // the >=768 variant is the second ticketing-bar rule
if (bStart < 0 || bLast < 0) fail('generic hash-target rules not found in nos-structure.css');
const B = STRUCT.slice(bStart, STRUCT.indexOf('}\n}', bLast) + 3);
const cardRules = () => {
  const out = []; const lines = STRUCT.split('\n'); let depth = 0; let cur = null;
  lines.forEach((l, i) => {
    if (depth === 0 && l.includes('{')) cur = { start: i + 1, text: '' };
    if (cur) cur.text += l + '\n';
    depth += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
    if (depth === 0 && cur) { if (cur.text.includes("data-sponsor-enquiry='nos'") && cur.text.includes('scroll-margin-top')) out.push({ ...cur, end: i + 1 }); cur = null; }
  });
  return out;
};
const checks = {
  'sponsor-card'() {
    const rules = cardRules();
    if (rules.length < 2) fail('expected the card base rule and its >=768 media rule to declare scroll-margin-top');
    const decls = rules.flatMap((r) => noComments(r.text).match(/scroll-margin-top:[^;]*;/g) ?? []);
    if (decls.some((d) => /\d{2,}px/.test(d.replace(/var\([^)]*\)/g, '')))) fail(`a literal length remains in the card scroll-margin: ${decls.join(' ')}`);
    if (!decls.includes('scroll-margin-top: var(--nos-landing-air);')) fail('card base margin must be var(--nos-landing-air)');
    if (!decls.includes('scroll-margin-top: calc(var(--nos-header-h) + var(--nos-landing-air));')) fail('card >=768 margin must be calc(var(--nos-header-h) + var(--nos-landing-air))');
    if (rules.some((r) => /min-width:\s*700px/.test(r.text))) fail('a 700px card media block remains');
  },
  bp768() {
    const a = noComments(A);
    if (/780px/.test(a)) fail('780px still present in the doc-variable block');
    if (!/@media \(min-width: 768px\)\s*\{\s*\.nos-theme\s*\{[^}]*--doc-index-top:/.test(a)) fail('--doc-index-top is not switched in a min-width: 768px block');
    if (!/\(max-width: 1023\.98px\)/.test(a)) fail('missing the max-width: 1023.98px index-band heading override');
  },
  'token-def'() {
    if ((CHROME.match(/--nos-header-h:\s*97px;/g) ?? []).length !== 1) fail('--nos-header-h: 97px must be declared exactly once in nos-chrome.css');
    if (!/:root\s*\{[^}]*--nos-header-h:/.test(CHROME)) fail('--nos-header-h must sit in the :root block of nos-chrome.css');
    if ((CHROME.match(/--nos-landing-air:\s*24px;/g) ?? []).length !== 1) fail('--nos-landing-air: 24px must be declared exactly once in nos-chrome.css');
    if (!/--doc-index-bar-h:\s*48px;/.test(GLOBALS)) fail('--doc-index-bar-h: 48px missing from globals.css');
    if (!/height:\s*var\(--doc-index-bar-h/.test(GLOBALS)) fail('the index bar height in globals.css does not use --doc-index-bar-h');
    for (const f of ['--nos-header-h', '--nos-landing-air']) if ((STRUCT.match(new RegExp(`${f}:\\s*\\d`, 'g')) ?? []).length) fail(`${f} is redefined with a literal in nos-structure.css`);
  },
  'token-use'() {
    const a = noComments(A); const b = noComments(B);
    if (!/--doc-index-top:\s*calc\([^;]*var\(--nos-header-h\)/.test(a)) fail('--doc-index-top does not derive from var(--nos-header-h)');
    if (!/--doc-scroll-margin:[^;]*var\(--nos-landing-air\)/.test(a)) fail('--doc-scroll-margin does not use var(--nos-landing-air)');
    if (!/var\(--doc-index-bar-h\)/.test(a)) fail('the <1024 margin does not use var(--doc-index-bar-h)');
    if (!/@media \(min-width: 768px\)\s*\{\s*\.nos-theme\s*\{[^}]*--doc-scroll-margin:\s*calc\(var\(--nos-header-h\) \+ var\(--doc-index-bar-h\) \+ var\(--nos-landing-air\)\);/.test(a)) fail('768-1023 --doc-scroll-margin must be the composed calc(var(--nos-header-h) + var(--doc-index-bar-h) + var(--nos-landing-air)) inside the min-width: 768px block (NOS Design 2026-10-29)');
    if (!/\.nos-theme \.doc-layout--index \[data-doc-main\] \.doc-h2\[id\]\s*\{\s*scroll-margin-top:\s*calc\(var\(--doc-scroll-margin\)/.test(a)) fail('index-band heading override must use var(--doc-scroll-margin)');
    if ((b.match(/var\(--nos-header-h\)/g) ?? []).length < 2) fail('generic hash-target rules must use var(--nos-header-h) at >=768 (plain and ticketing-bar variants)');
    if ((b.match(/var\(--nos-landing-air\)/g) ?? []).length < 4) fail('generic hash-target rules must use var(--nos-landing-air) in every rule');
  },
  'no-literals'() {
    for (const [name, text] of [['doc-variable block', A], ['generic hash-target rules', B]]) {
      const hit = noComments(text).match(/(?<![\w.-])(97|121|112|136|80)(px)?(?![\w.%-])/);
      if (hit) fail(`literal ${hit[0]} in the ${name}`);
    }
  },
  comment() {
    if (/not sticky under 780/.test(STRUCT)) fail('the wrong "not sticky under 780" comment is still present');
    const c = A.slice(0, A.indexOf('.nos-theme {'));
    if (!/768/.test(c) || !/--nos-header-h/.test(c)) fail('the corrected comment must name 768 and --nos-header-h');
  },
};
const name = process.argv[2];
if (!checks[name]) fail(`unknown check ${name}`);
checks[name]();
console.log(`ok ${name}`);

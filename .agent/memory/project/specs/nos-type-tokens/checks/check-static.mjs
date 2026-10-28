// Source-level assertions for nos-type-tokens. Each one is cheap, single-purpose and named so a contract assertion can run one: node check-static.mjs <name>
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');
const FONTS = ['components/nos-chrome/fonts.ts', 'components/nos/NosThemeScope.tsx'];
const CSS = ['app/(nos)/national-show/nos-theme.css', 'app/(nos)/national-show/nos-structure.css', 'components/nos-chrome/nos-chrome.css'];
const checks = {
  // NR-6: one Karla declaration with a wght range, in both files. A quartet of discrete 400/500/600/700 faces makes 450 render as 500.
  'karla-range': () => FONTS.every((f) => {
    const src = read(f);
    const block = src.slice(src.indexOf('const karla'), src.indexOf('variable: \'--font-nos-karla\''));
    return (block.match(/Karla-latin-normal\.woff2/g) ?? []).length === 1 && /weight:\s*'400 700'/.test(block);
  }),
  // R-M: the one prose measure token, 38rem, defined once and used; the per-size 60ch cap on bare p is gone.
  'measure-token': () => CSS.slice(0, 2).some((f) => /--nos-measure:\s*38rem/.test(read(f))) && CSS.slice(0, 2).some((f) => /var\(--nos-measure\)/.test(read(f))),
  'no-60ch': () => !/\.nos-theme p\s*\{[^}]*60ch/.test(read(CSS[1])),
  // NR-7 hook classes the gate keys the Title and H3-visual roles on.
  'role-hooks': () => ['nos-card-title', 'nos-h3-visual'].every((k) => CSS.slice(0, 2).some((f) => read(f).includes(`.${k}`))),
  // The italic theme line moves to the main variable italic at 400; the second 300-only italic file and its scope are retired from the two layouts.
  'no-lede-scope': () => ['app/(nos)/national-show/about/layout.tsx', 'app/(nos)/national-show/symposium/layout.tsx'].every((f) => !read(f).includes('FrauncesLedeScope')),
  // The old olive (S-2): no #7F7D33 numeral colour left on .nos-num.
  'num-colour': () => { const m = /\.nos-theme \.nos-num\s*\{[^}]*\}/.exec(read(CSS[1])); return !!m && !/olive-deep/.test(m[0]) && /#6A6829|var\(--[a-z-]*olive[a-z-]*\)/i.test(m[0]); },
};
// Scope: the change stays inside the NOS surface. SAOC routes, the SAOC chrome, the shared newsletter component and shared legal body are other lanes.
const ALLOWED = [/^app\/\(nos\)\//, /^components\/nos\//, /^components\/nos-chrome\//, /^components\/show\//, /^components\/contact\/NosContactAside\.tsx$/, /^e2e\//, /^docs\//, /^\.agent\/memory\//, /^README\.md$/];
checks.scope = () => {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).split('\n').filter(Boolean);
  // The branch is based on #133's head (f22e989a), so its files are not this PR's diff; the base is that commit while it is an ancestor of HEAD.
  const PR133 = 'f22e989a';
  const isAncestor = (() => { try { execFileSync('git', ['merge-base', '--is-ancestor', PR133, 'HEAD']); return true; } catch { return false; } })();
  const base = process.env.NOS_TYPE_BASE_REF ?? (isAncestor ? PR133 : git('merge-base', 'HEAD', 'origin/main')[0]);
  const files = [...new Set([...git('diff', '--name-only', base), ...git('ls-files', '--others', '--exclude-standard')])];
  const out = files.filter((f) => !ALLOWED.some((re) => re.test(f)));
  if (out.length) console.error(`outside the NOS surface:\n${out.join('\n')}`);
  return out.length === 0;
};
// NOS Design's R-W walk wants renders at 390, 1440 and 2056 for every walked route: 24 routes x 3 viewports.
checks.shots = () => {
  const dir = '.agent/memory/project/specs/nos-type-tokens/evidence/shots';
  const have = new Set(readdirSync(dir).filter((f) => f.endsWith('.png')));
  const need = [];
  const routes = JSON.parse(read('.agent/memory/project/specs/nos-type-tokens/goldens/sweep-routes.json')).required;
  for (const r of [...routes, '/archive', '/zz-not-a-route-type-gate']) for (const vw of [390, 1440, 2056]) need.push(`${r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '_')}-${vw}.png`);
  const missing = need.filter((f) => !have.has(f));
  if (missing.length) console.error(`missing renders: ${missing.slice(0, 6).join(', ')} (${missing.length})`);
  return missing.length === 0;
};
// TYPE-11, CSS-only route: the chrome scope re-points the Tailwind --font-sans (and --font-serif) at the NOS faces, and the SAOC-lane NewsletterSignup.tsx is not edited.
checks['footer-font-var'] = () => /\.nf[^{]*\{[^}]*--font-sans:\s*var\(--nc-sans\)/.test(read(CSS[2])) && !execFileSync('git', ['diff', '--name-only', process.env.NOS_TYPE_BASE_REF ?? 'f22e989a'], { encoding: 'utf8' }).includes('NewsletterSignup.tsx');
const name = process.argv[2];
if (!name || !checks[name]) { console.error(`usage: check-static.mjs <${Object.keys(checks).join('|')}>`); process.exit(2); }
if (!checks[name]()) { console.error(`check-static ${name} FAILED`); process.exit(1); }
console.log(`check-static ${name} pass`);

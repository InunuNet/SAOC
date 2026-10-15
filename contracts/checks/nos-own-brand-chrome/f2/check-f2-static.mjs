// F2 static guards (no browser):  node contracts/checks/nos-own-brand-chrome/f2/check-f2-static.mjs <type-clean|theme-tokens|layout-fonts|colour-by-class|heading-markup|no-photo-swap|logo-orphan>
//  type-clean   : the NOS sources reference no Cormorant / Jost / JetBrains / Crimson / Manrope, no Tailwind font-mono, no var(--mono)
//                 or var(--font-mono) (comments stripped). components/nos/Logo.tsx is exempt: it is the typeset logo artwork, the one
//                 place R14 reserves Cormorant/Jost for; logo-orphan proves nothing imports it.
//  theme-tokens : nos-theme.css remaps --font-serif/--serif to Fraunces, --font-sans/--sans to Karla and --font-mono/--mono to Karla
//                 on .nos-theme (the scope element; `--font-mono: var(--mono)` is resolved at :root, so the shared SAOC components that
//                 use font-mono/var(--mono) only re-skin if the NAME is redeclared here), and no longer defines the Cormorant/Jost vars.
//  layout-fonts : national-show/layout.tsx imports only Fraunces and Karla from next/font/google.
//  logo-orphan  : nothing under app/ or components/ imports components/nos/Logo.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fails = [];
const need = (ok, msg) => { if (!ok) fails.push(msg); };
const LAYOUT = 'app/(marketing)/national-show/layout.tsx';
const THEME = 'app/(marketing)/national-show/nos-theme.css';
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\w])\/\/.*$/gm, '$1');
const EXEMPT = new Set(['components/nos/Logo.tsx']);
// `--font-mono:` / `--mono:` DECLARATIONS are required by theme-tokens (the remap to Karla); only a `font-mono` class use or a var() read is forbidden.
const BAD = /cormorant|\bjost\b|jetbrains|crimson|manrope|font-nos-(cormorant|jost)|(?<!-)\bfont-mono\b|var\(--mono\)|var\(--font-mono\)/i;

const IMG_RE = /[\w@%/.\-]+\.(?:jpe?g|png|webp|avif)\b/gi;
function scanPhotoRefs() {
  const dirs = ['app/(marketing)/national-show', 'components/nos', 'components/show', 'components/nos-chrome', 'components/tickets'];
  const refs = new Set();
  for (const f of dirs.flatMap((d) => walk(d)).filter((p) => /\.(tsx?|css)$/.test(p))) for (const t of readFileSync(f, 'utf8').match(IMG_RE) ?? []) refs.add(t);
  return { refs: [...refs].sort(), files: walk('public/images').map((p) => p.replace(/^public\/images\//, '')).sort() };
}

const modes = {
  'type-clean'() {
    const files = [
      ...walk('app/(marketing)/national-show').filter((f) => /\.(tsx?|css)$/.test(f)),
      ...walk('components/nos').filter((f) => /\.(tsx?|css)$/.test(f)),
      ...walk('components/show').filter((f) => /\.(tsx?|css)$/.test(f)),
      ...walk('components/nos-chrome').filter((f) => /\.(tsx?|css)$/.test(f)),
      'components/tickets/CategoryTicketsPage.tsx',
    ].filter((f) => !EXEMPT.has(f));
    for (const f of files) {
      // In a .css file a `.font-mono` SELECTOR is a re-skin of the shared utility (e.g. `.nos-theme .font-mono { font-family: Karla }`), not a use of it; F2-T1 still fails if anything computes to mono.
      let text = strip(readFileSync(f, 'utf8'));
      if (f.endsWith('.css')) text = text.replace(/\.font-mono\b/g, '');
      const m = BAD.exec(text);
      need(!m, `${f}: references "${m?.[0]}" (R14: Fraunces/Karla only)`);
    }
  },
  'theme-tokens'() {
    const css = strip(readFileSync(THEME, 'utf8'));
    const decl = (name) => new RegExp(`(^|[;{\\s])${name}\\s*:\\s*([^;]+);`, 'm').exec(css)?.[2] ?? null;
    for (const [name, face] of [['--font-serif', 'fraunces'], ['--serif', 'fraunces'], ['--font-sans', 'karla'], ['--sans', 'karla'], ['--font-mono', 'karla'], ['--mono', 'karla']]) {
      const v = decl(name);
      need(v && new RegExp(`--font-nos-${face}`).test(v), `${THEME}: ${name} must be declared on .nos-theme and lead with var(--font-nos-${face}) (got ${v ?? 'nothing'})`);
    }
    need(!/--font-nos-(cormorant|jost)/.test(css), `${THEME}: still references the Cormorant/Jost font variables`);
  },
  'layout-fonts'() {
    const src = readFileSync(LAYOUT, 'utf8');
    const imp = /import\s*\{([^}]+)\}\s*from\s*'next\/font\/google'/.exec(src)?.[1].split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    need(imp.length === 2 && imp.includes('Fraunces') && imp.includes('Karla'), `${LAYOUT}: next/font/google imports are [${imp}], want exactly Fraunces and Karla`);
    need(!/cormorant|jost/i.test(strip(src)), `${LAYOUT}: still mentions Cormorant/Jost`);
  },
  // R25 item 3: colour comes from a class, never from a bare text-bearing element selector (p, a, div, span, li); headings keep their role colour in nos-theme.css.
  'colour-by-class'() {
    const css = strip(readFileSync(THEME, 'utf8'));
    const BARE = /^(\.nos-theme\s+)?(p|a|div|span|li)(:[\w-]+(\([^)]*\))?)*$/;
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/(^|[;\s{])color\s*:/.test(m[2])) continue;
      for (const sel of m[1].split(',').map((x) => x.trim().replace(/^@media[^]*?\)\s*/, '')).filter(Boolean)) {
        need(!BARE.test(sel), `${THEME}: "${sel}" sets color on a bare element; put the colour on a class (R25)`);
      }
    }
  },
  // R25 items 2-3, markup that no seeded route may render yet (AccommodationList shows only when accommodation data exists): the FAQ category
  // head and the accommodation group label are h2/h3, and the accommodation card name is a heading one level below its group label.
  'heading-markup'() {
    const faq = 'components/show/ShowFaqList.tsx';
    const acc = 'components/show/AccommodationList.tsx';
    need(/<h[23]\b[^>]*>\s*\{CATEGORY_LABELS\[category\]\}/.test(readFileSync(faq, 'utf8')), `${faq}: the FAQ category head ({CATEGORY_LABELS[category]}) must be an h2 or h3, not a <p>`);
    const a = readFileSync(acc, 'utf8');
    const grp = /<h([23])\b[^>]*>\s*\{BAND_LABELS\[band\]\}/.exec(a);
    need(!!grp, `${acc}: the group label ({BAND_LABELS[band]}) must be an h2 or h3, not a <p>`);
    const card = /<h([34])\b[^>]*>\s*\{option\.name\}/.exec(a);
    need(!!card, `${acc}: the card name ({option.name}) must be an h3 or h4, not a <div>`);
    if (grp && card) need(Number(card[1]) > Number(grp[1]), `${acc}: card name h${card[1]} must sit below the group label h${grp[1]} (no level skip, no inversion)`);
  },
  // R15/9: any route still failing contrast goes to NOS Design before a photo swap (R16). Photo references (image paths in the NOS sources, plus the
  // public/images tree) must equal goldens/f2/photo-refs.json, captured at F2 start (F1 complete), unless goldens/f2/r16-photo-swap-ruling.md exists;
  // the lead writes that file from NOS Design's R16. `capture-photo-refs` regenerates the golden and is for the architect/lead only.
  'no-photo-swap'() {
    const dir = '.agent/memory/project/specs/nos-own-brand-chrome/goldens/f2';
    if (existsSync(`${dir}/r16-photo-swap-ruling.md`)) return;
    const gold = JSON.parse(readFileSync(`${dir}/photo-refs.json`, 'utf8'));
    const now = scanPhotoRefs();
    for (const t of now.refs) need(gold.refs.includes(t), `image reference "${t}" is new since F2 start; a hero photo swap needs NOS Design's R16 ruling (goldens/f2/r16-photo-swap-ruling.md)`);
    for (const t of gold.refs) need(now.refs.includes(t), `image reference "${t}" was removed since F2 start; a hero photo swap needs NOS Design's R16 ruling`);
    for (const t of now.files) need(gold.files.includes(t), `public/images file "${t}" is new since F2 start; needs NOS Design's R16 ruling`);
    for (const t of gold.files) need(now.files.includes(t), `public/images file "${t}" was removed or renamed since F2 start; needs NOS Design's R16 ruling`);
  },
  'capture-photo-refs'() {
    writeFileSync('.agent/memory/project/specs/nos-own-brand-chrome/goldens/f2/photo-refs.json', JSON.stringify(scanPhotoRefs(), null, 1) + '\n');
  },
  'logo-orphan'() {
    for (const f of [...walk('app'), ...walk('components')].filter((p) => /\.(tsx?)$/.test(p))) {
      need(!/from\s+['"][^'"]*\/nos\/Logo['"]|from\s+['"]\.\/Logo['"]/.test(readFileSync(f, 'utf8')), `${f}: imports components/nos/Logo (typeset Cormorant/Jost logo); it must stay orphaned`);
    }
  },
};

const mode = process.argv[2];
if (!modes[mode]) { console.error(`usage: check-f2-static.mjs <${Object.keys(modes).join('|')}>`); process.exit(2); }
modes[mode]();
if (fails.length) { console.error(`FAIL F2 static ${mode}: ${fails.length} problem(s)`); for (const f of fails) console.error(`  - ${f}`); process.exit(1); }
console.log(`PASS F2 static ${mode}`);

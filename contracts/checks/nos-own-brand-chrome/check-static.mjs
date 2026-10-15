// Static (no server) checks for the nos-own-brand-chrome F1 contract.
//   node contracts/checks/nos-own-brand-chrome/check-static.mjs <fonts|dates|fonts-clean|exclusions|footer-data|mount|css>
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { GOLDEN_DIR } from './_lib.mjs';

const CHROME_DIR = 'components/nos-chrome';
const NOS_LAYOUT = 'app/(marketing)/national-show/layout.tsx';
const MARKETING_LAYOUT = 'app/(marketing)/layout.tsx';

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const chromeFiles = () => walk(CHROME_DIR);
const chromeSrc = () => chromeFiles().filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')]);
const fails = [];
const need = (cond, msg) => { if (!cond) fails.push(msg); };
const block = (src, name) => { const i = src.indexOf(`${name}({`); if (i < 0) return null; const j = src.indexOf('});', i); return src.slice(i, j + 3).replace(/\s+/g, ' '); };

const modes = {
  fonts() {
    const lay = readFileSync(NOS_LAYOUT, 'utf8');
    const fr = block(lay, 'Fraunces');
    const ka = block(lay, 'Karla');
    need(fr && /axes: \['opsz'\]/.test(fr), `${NOS_LAYOUT}: Fraunces must use axes: ['opsz']`);
    need(fr && !/weight:/.test(fr), `${NOS_LAYOUT}: Fraunces must not pin weight (variable, opsz axis)`);
    need(fr && /variable: '--font-nos-fraunces'/.test(fr), `${NOS_LAYOUT}: Fraunces variable must stay --font-nos-fraunces`);
    need(ka && /weight: \['400', '500', '600', '700'\]/.test(ka), `${NOS_LAYOUT}: Karla weight must be ['400', '500', '600', '700']`);
    need(ka && /variable: '--font-nos-karla'/.test(ka), `${NOS_LAYOUT}: Karla variable must stay --font-nos-karla`);
    const mod = chromeSrc().find(([, s]) => /Fraunces\(\{/.test(s));
    need(!!mod, `${CHROME_DIR}: no file declares Fraunces via next/font (the chrome sits outside .nos-theme and needs its own identical declaration)`);
    if (mod) {
      need(block(mod[1], 'Fraunces') === fr, `${mod[0]}: Fraunces config differs from ${NOS_LAYOUT} (must be identical so next/font emits one set of files)`);
      need(block(mod[1], 'Karla') === ka, `${mod[0]}: Karla config differs from ${NOS_LAYOUT}`);
    }
  },
  dates() {
    need(existsSync(CHROME_DIR) && chromeFiles().length > 0, `${CHROME_DIR} does not exist or is empty`);
    for (const [f, s] of chromeSrc()) {
      const t = s.replace(/National Orchid Show, Western Cape 2027(, National Show home)?/g, '');
      const m = t.match(/\b\d{1,2}\s*[–-]\s*\d{1,2}\b|Septem|\b20(2|3)\d\b|19th|Stellenbosch|Hangar/);
      need(!m, `${f}: hard-coded show fact "${m?.[0]}" (dates, venue and edition come from Sanity / nav-config)`);
    }
  },
  'fonts-clean'() {
    need(chromeFiles().length > 0, `${CHROME_DIR} does not exist or is empty`);
    for (const [f, s] of chromeSrc()) {
      const m = s.match(/Cormorant|Jost|Crimson|Manrope|JetBrains|\bfont-(mono|serif|sans)\b/);
      need(!m, `${f}: references "${m?.[0]}" (chrome type is Fraunces / Karla only)`);
    }
  },
  exclusions() {
    need(chromeFiles().length > 0, `${CHROME_DIR} does not exist or is empty`);
    for (const [f, s] of chromeSrc()) {
      if (!f.endsWith('.tsx') && !f.endsWith('.ts')) continue;
      const m = s.match(/UtilityBar|SearchOverlay|SaocLockup|ShowBand|from 'next\/image'|<picture|onMouseEnter|onMouseOver|onPointerEnter|lucide-react/);
      need(!m, `${f}: forbidden "${m?.[0]}" (no Search / UtilityBar / SAOC logo, no next/image (bytes shipped unaltered), no <picture>, no hover-open)`);
    }
    const lay = readFileSync(NOS_LAYOUT, 'utf8');
    need(!/NosMasthead|data-nos-colophon|components\/nos\/Logo/.test(lay), `${NOS_LAYOUT}: the old masthead / colophon logo must be removed`);
  },
  'footer-data'() {
    const data = existsSync('components/chrome/footer-data.ts') ? readFileSync('components/chrome/footer-data.ts', 'utf8') : '';
    const footer = readFileSync('components/chrome/Footer.tsx', 'utf8');
    for (const phrase of ['national coordinating body', 'Quarterly bulletin', 'Looking for wild orchids?', 'Visit Wild Orchids of Southern Africa', 'REG# 1978/004040/08', 'Media kit']) {
      need(data.includes(phrase), `components/chrome/footer-data.ts must own "${phrase}"`);
      need(!footer.includes(phrase), `components/chrome/Footer.tsx still inlines "${phrase}" (import it from footer-data)`);
      for (const [f, s] of chromeSrc()) need(!s.includes(phrase), `${f}: forks the footer copy "${phrase}" (import footer-data)`);
    }
    need(/from '\.\/footer-data'/.test(footer), 'Footer.tsx must import ./footer-data');
    need(chromeSrc().some(([, s]) => /chrome\/footer-data/.test(s)), `${CHROME_DIR} must import components/chrome/footer-data`);
  },
  mount() {
    const m = readFileSync(MARKETING_LAYOUT, 'utf8');
    need(/nos-chrome/.test(m), `${MARKETING_LAYOUT} must mount the NOS chrome`);
    need(/UtilityBar/.test(m) && /Footer/.test(m) && /Header/.test(m), `${MARKETING_LAYOUT} must still render the SAOC chrome for every other route`);
  },
  css() {
    const sheets = chromeSrc().filter(([f]) => f.endsWith('.css'));
    need(sheets.length > 0, `${CHROME_DIR}: no stylesheet shipped`);
    const dev = sheets.map(([, s]) => s).join('\n');
    const golden = readFileSync(`${GOLDEN_DIR}/chrome.css`, 'utf8');
    const decls = (css) => {
      const out = new Set();
      const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const walkRules = (text, ctx) => {
        let i = 0;
        while (i < text.length) {
          const open = text.indexOf('{', i);
          if (open < 0) break;
          const sel = text.slice(i, open).replace(/\s+/g, ' ').trim();
          let depth = 1; let j = open + 1;
          while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
          const body = text.slice(open + 1, j - 1);
          if (sel.startsWith('@media') || sel.startsWith('@supports')) walkRules(body, `${ctx}${sel} >> `);
          else if (!sel.startsWith('@')) for (const d of body.split(';')) { const dd = d.replace(/\s+/g, ' ').trim(); if (dd) for (const s of sel.split(',')) out.add(`${ctx}${s.trim()} | ${dd}`); }
          i = j;
        }
      };
      walkRules(src, '');
      return out;
    };
    const want = decls(golden);
    const have = decls(dev);
    for (const d of want) {
      if (/^(\.np\b|\.np )|--nc-serif|--nc-sans/.test(d.split(' | ')[0].replace(/^.*>> /, '')) || /--nc-serif|--nc-sans/.test(d)) continue;
      if (d.split(' | ')[0].replace(/^.*>> /, '').startsWith('.np')) continue;
      need(have.has(d), `stylesheet lacks the approved declaration: ${d}`);
    }
    need(/--nc-serif:[^;]*var\(--font-nos-fraunces\)/.test(dev), '--nc-serif must lead with var(--font-nos-fraunces)');
    need(/--nc-sans:[^;]*var\(--font-nos-karla\)/.test(dev), '--nc-sans must lead with var(--font-nos-karla)');
    need(!/\.np\b|\.tweak-open/.test(dev), 'proposal pill (.np) / tweak panel must not ship');
  },
};

const mode = process.argv[2];
if (!modes[mode]) { console.error(`unknown mode ${mode}`); process.exit(2); }
modes[mode]();
if (fails.length) { console.error(`FAIL static:${mode}`); for (const f of fails.slice(0, 40)) console.error(`  - ${f}`); process.exit(1); }
console.log(`PASS static:${mode}`);

// Static rules for the SAOC PageHero mirror, read from the source. Usage: node check-static.mjs
// Every rule names the ruling it comes from (spec.md sections 1 and 4). A rule that cannot be shown from source is a gate, not a static check.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { GOLDEN } from './_lib.mjs';

const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const walk = (dir, out = []) => { for (const n of readdirSync(dir)) { const p = `${dir}/${n}`; if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };

const hero = read('components/ui/PageHero.tsx');
check('PageHero.tsx exists', hero.length > 0);
for (const marker of ['data-page-hero', 'data-page-hero-media', 'data-page-hero-copy', 'data-page-hero-eyebrow', 'data-page-hero-lede', 'data-page-hero-variant', 'data-hero-scrim="copy"', 'imagePosition']) check(`PageHero.tsx carries ${marker}`, hero.includes(marker));
check('PageHero.tsx: image is optional (no image = the typographic hero, ruled for legal pages, /members and /media-kit)', /image\?\s*:/.test(hero));
check('PageHero.tsx: the old full-wash gradient is gone (bg-gradient-to / via-[var(--primary-800)])', !/bg-gradient-to|via-\[var\(--primary-800\)\]|from-\[var\(--primary-800\)\]/.test(hero));
check('PageHero.tsx: the copy is not centred (no text-center)', !/text-center/.test(hero));
check('PageHero.tsx: the lede is solid ivory (no text-ivory/NN opacity)', !/text-ivory\/\d+/.test(hero) && /text-ivory/.test(hero));
check('PageHero.tsx: stacked band is aspect 2/1 (ruled for SAOC)', /aspect-\[2\s*\/\s*1\]|aspect-2\/1|aspect-ratio:\s*2\s*\/\s*1/.test(hero));
check('PageHero.tsx: the photograph keeps quality 88 for a listed source', /quality=\{[^}]*88[^}]*\}/.test(hero) && hero.includes('hero-source-widths'));
check('PageHero.tsx: sizes stays 100vw', hero.includes('sizes="100vw"'));
check('PageHero.tsx: eyebrow is optional (SAOC polish F4 merge requirement): `eyebrow?:` prop, the pill rendered only when set', /eyebrow\?\s*:/.test(hero) && /eyebrow\s*(\?|&&)/.test(hero));
check('PageHero.tsx: the h1 top margin is conditional on the eyebrow (no unconditional mt-5 on the h1)', !/<h1[^>]*className="[^"]*\bmt-5\b/.test(hero));
check('PageHero.tsx: no hex colour literal (no new colours)', !/#[0-9a-fA-F]{3,8}\b/.test(hero));
check('PageHero.tsx: the scrim colour is the existing sage rgb(34 40 31 / n)', !/rgba?\((?!\s*34[ ,]+40[ ,]+31)/.test(hero));
check('PageHero.tsx: 52% copy start is expressed', /52%/.test(hero));


// RouteHero retarget (10-26): the per-route photograph and crop live in lib/data/saoc-hero-photos.ts, applied by RouteHero.
const photos = read('lib/data/saoc-hero-photos.ts');
const routeHero = read('components/ui/RouteHero.tsx');
const routeCss = read('components/ui/RouteHero.module.css');
check('RouteHero.tsx passes imagePosition to PageHero', /imagePosition/.test(routeHero));
check('RouteHero.module.css: the native-source width cap is gone (HM-1: no native-cap exception)', !/--hero-src-w/.test(routeCss) && !/translate:\s*-50%/.test(routeCss));
check('RouteHero.tsx: no heroSourceWidth cap', !/heroSourceWidth/.test(routeHero));
for (const r of GOLDEN.heroRoutes.filter((x) => x.variant === 'type')) {
  const key = r.path.replace(/[\[\]]/g, '\\$&');
  check(`saoc-hero-photos.ts: ${r.path} is typographic (no photograph)`, new RegExp(`'${key}':\\s*\\{[^}]*typographic:\\s*true`).test(photos));
}
for (const r of GOLDEN.heroRoutes.filter((x) => x.position && x.position !== 'gap' && x.image)) {
  const key = r.path.replace(/[\[\]]/g, '\\$&');
  const entry = (photos.match(new RegExp(`'${key}':\\s*\\{[^}]*\\}`)) ?? [''])[0];
  check(`saoc-hero-photos.ts: ${r.path} is ${r.image} at ${r.position}`, entry.includes(r.image) && entry.includes(r.position));
}

// A flip is a build-time file, never a CSS transform (NOS Design: "NEVER a CSS transform").
const FLIP_CSS = /scale-x-\[?-|-scale-x|scaleX\(\s*-|scale\(\s*-1|rotateY\(|\bscale-\[-/;
for (const f of ['components/ui/PageHero.tsx', 'components/ui/PhotoBand.tsx', 'components/home/Hero.tsx', 'components/home/ShowBand.tsx', 'app/globals.css']) check(`${f}: no CSS flip or mirror transform`, !FLIP_CSS.test(read(f)));

const band = read('components/ui/PhotoBand.tsx');
check('PhotoBand.tsx: <figure data-photo-band> (the served-width gate hooks it)', /<figure[^>]*data-photo-band/.test(band) || /data-photo-band/.test(band));
check('PhotoBand.tsx: passes quality 88 for a source listed in hero-source-widths (else the 2048 cap fails the band at 2056@2)', /quality=\{[^}]*88[^}]*\}/.test(band) && band.includes('hero-source-widths'));
const aboutPage = read('app/(marketing)/about/page.tsx');
check('about PhotoBand uses the purple band cut at 50% 45%', /orchid-purple-band\.jpg/.test(aboutPage) && /50% 45%/.test(aboutPage));
check('judging PhotoBand stays orchid-dark native (no purple band cut)', /orchid-dark\.jpg/.test(read('app/(marketing)/judging/page.tsx')) && !/orchid-purple-band/.test(read('app/(marketing)/judging/page.tsx')));
check('PhotoBand.tsx takes an imagePosition prop and applies it as object-position', /imagePosition/.test(band) && /objectPosition/.test(band));

const home = read('components/home/Hero.tsx');
check('Hero.tsx: carousel images are decorative, alt=""  (HS-2)', /alt=""/.test(home) && !/alt=\{slide\.alt\}/.test(home));
const slides = read('lib/data/home-hero-slides.ts');
const iDark = slides.indexOf("key: 'orchid-dark'"); const iPurple = slides.indexOf("key: 'orchid-purple'");
check('home-hero-slides.ts: slides are dark then purple, violet retired', iDark !== -1 && iPurple > iDark && !slides.includes("key: 'orchid-violet'"));
check('home-hero-slides.ts: the purple slide uses the derived cut /images/orchid-purple-home.jpg', slides.includes('/images/orchid-purple-home.jpg'));

// Pink and yellow retire from every hero box (ruling 3); typographic pages pass no image.
const heroFiles = [...walk('app/(marketing)').filter((f) => /page\.tsx$/.test(f)), ...walk('app/(shared)').filter((f) => /page\.tsx$/.test(f)), 'components/ui/PageHero.tsx', 'components/ui/PhotoBand.tsx', 'components/home/ShowBand.tsx', 'lib/data/home-hero-slides.ts', 'lib/data/saoc-hero-photos.ts', ...(existsSync('components/nos/LegalHero.tsx') ? ['components/nos/LegalHero.tsx'] : [])];
for (const f of heroFiles) check(`${f}: no orchid-pink or orchid-yellow`, !/orchid-(pink|yellow)/.test(read(f)));
for (const r of GOLDEN.heroRoutes.filter((x) => x.variant === 'type')) {
  const file = ['/members', '/media-kit', '/memorandum-of-incorporation'].includes(r.path) ? `app/(marketing)${r.path}/page.tsx` : `app/(shared)${r.path}/page.tsx`;
  if (existsSync(file)) check(`${file}: typographic page passes no image to the hero`, !/\bimage=/.test(read(file)));
}
if (existsSync('components/nos/LegalHero.tsx')) check('components/nos/LegalHero.tsx: the SAOC branch passes no image (typographic PageHero)', !/<PageHero[^>]*\bimage=/.test(read('components/nos/LegalHero.tsx')));

check('ShowBand.tsx: data-show-band-image hook present and the image is /images/orchid-dark-showband.jpg', read('components/home/ShowBand.tsx').includes('data-show-band-image') && read('components/home/ShowBand.tsx').includes('/images/orchid-dark-showband.jpg'));

// Height-driven cover boxes need sizes = max(100vw, boxH x aspect); a bare sizes="100vw" under-requests (SAOC QA, HM-1).
for (const f of ['components/ui/PageHero.tsx', 'components/home/Hero.tsx', 'components/ui/PhotoBand.tsx']) {
  const src = read(f);
  check(`${f}: sizes is computed from the file aspect (max(100vw, boxH x aspect)), not a bare "100vw"`, !/sizes=(\{\s*)?['"`]100vw['"`]/.test(src) && /sizes/.test(src) && /max\(/.test(src) && /aspect/i.test(src));
}

check('Hero.tsx: the interim home sizes value (1350px, SAOC P0) is replaced by the aspect-derived sizes', !/1350px/.test(read('components/home/Hero.tsx')));

check('ShowBand.tsx: the photo sizes is not the 48vw of the 620 floor (the real row is 762 high, height-driven)', !/48vw/.test(read('components/home/ShowBand.tsx')));

// The pipeline: derived sources are emitted by the generator as build-time variants.
const gen = read('scripts/generate-image-variants.mjs');
check('generate-image-variants.mjs reads lib/hero-derived-sources.json', gen.includes('hero-derived-sources'));
check('generate-image-variants.mjs flips with sharp .flop()', /\.flop\(\)/.test(gen));
const loader = read('lib/image-loader.ts');
check('lib/image-loader.ts still gates only quality 88 on the listed sources', /HERO_QUALITY\s*=\s*88/.test(loader));
const imageWidths = JSON.parse(read('lib/image-widths.json') || '{}');
for (const w of [2560, 2880, 4160]) check(`lib/image-widths.json has the audit width ${w} (the audit branch must have merged first)`, (imageWidths.deviceSizes ?? []).includes(w));

if (failures.length) { console.error(`check-static FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('check-static pass');

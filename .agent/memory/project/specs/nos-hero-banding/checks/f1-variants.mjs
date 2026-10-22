// nos-hero-banding F1 variants + loader (QA input, hash-locked). Golden: goldens/f1-edits.json (heroSources, heroQuality, defaultQuality).
// Runs the build's own variant generator (scripts/generate-image-variants.mjs, output in the gitignored public/images/_opt), then checks
// the bytes against sharp encodes made here with the golden settings, and runs lib/image-loader.ts (transpiled with the repo's TypeScript).
//   V1  every hero fallback source has a -q88 variant at every width, byte-equal to sharp webp { quality: 88, smartSubsample: true }.
//   V2  every hero source's plain variant, and the plain variant of orchid-yellow.jpg and of a non-hero source, stays byte-equal to
//       sharp webp { quality: 75 } (every other image stays at 75); no source outside the fallback list has a -q88 variant.
//   V3  the loader: an /images/ source with quality 88 maps to the -q88 variant, without a quality (or with 75) to BASE's plain name; a
//       cdn.sanity.io source carries q=88 with quality 88 and q=75 without.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, readRepoFile, repoRoot } from './_lib.mjs';
import { require } from './_server.mjs';

const NAME = 'f1-variants.mjs';
const G = goldenJson('f1-edits.json');
const failures = [];
const sharp = require('sharp');
const ts = require('typescript');
const OPT = path.join(repoRoot, 'public', 'images', '_opt');
const { deviceSizes, imageSizes } = JSON.parse(readFileSync(path.join(repoRoot, 'lib', 'image-widths.json'), 'utf8'));
const WIDTHS = [...new Set([...deviceSizes, ...imageSizes])].sort((a, b) => a - b);
const Q = `-q${G.heroQuality}`;
const OTHER = ['orchid-yellow.jpg', 'orchid-purple.jpg'];

const gen = spawnSync(process.execPath, ['scripts/generate-image-variants.mjs'], { cwd: repoRoot, env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', maxBuffer: 67108864 });
if (gen.status !== 0) failures.push(`variant generator failed: ${`${gen.stdout}${gen.stderr}`.slice(-2000)} (INFRA)`);
else {
  const encode = (src, width, opts) => sharp(path.join(repoRoot, 'public', 'images', src)).resize({ width, withoutEnlargement: true }).webp(opts).toBuffer();
  const same = async (file, src, width, opts, tag) => {
    const at = path.join(OPT, file);
    if (!existsSync(at)) { failures.push(`${file}: missing (${tag})`); return; }
    const want = await encode(src, width, opts);
    if (!want.equals(readFileSync(at))) failures.push(`${file}: not sharp webp ${JSON.stringify(opts)} of ${src} at ${width} (${tag})`);
  };
  for (const src of G.heroSources) for (const w of WIDTHS) {
    await same(`${src}-${w}${Q}.webp`, src, w, { quality: G.heroQuality, smartSubsample: true }, 'V1');
    await same(`${src}-${w}.webp`, src, w, { quality: G.defaultQuality }, 'V2');
  }
  for (const src of OTHER) for (const w of [640, 1920]) await same(`${src}-${w}.webp`, src, w, { quality: G.defaultQuality }, 'V2');
  const strays = readdirSync(OPT, { recursive: true }).map(String).filter((f) => f.endsWith(`${Q}.webp`) && !G.heroSources.some((s) => WIDTHS.some((w) => f === `${s}-${w}${Q}.webp`)));
  if (strays.length) failures.push(`-q${G.heroQuality} variants outside the hero sources: ${strays.slice(0, 5).join(', ')} (V2)`);
}

// V3
const src = readRepoFile('lib/image-loader.ts');
if (src === null) failures.push('lib/image-loader.ts: missing (V3)');
else {
  const js = ts.transpileModule(src.replace(/^import widths from '\.\/image-widths\.json';$/m, `const widths = ${JSON.stringify({ deviceSizes, imageSizes })};`), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loader = (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)).default;
  const cases = [
    [{ src: '/images/orchid-pink.jpg', width: 1920, quality: G.heroQuality }, `/images/_opt/orchid-pink.jpg-1920${Q}.webp`],
    [{ src: '/images/orchid-pink.jpg', width: 1920 }, '/images/_opt/orchid-pink.jpg-1920.webp'],
    [{ src: '/images/orchid-pink.jpg', width: 1900, quality: G.defaultQuality }, '/images/_opt/orchid-pink.jpg-1920.webp'],
    [{ src: '/images/orchid-yellow.jpg', width: 640 }, '/images/_opt/orchid-yellow.jpg-640.webp'],
    [{ src: 'https://cdn.sanity.io/images/p/d/abc-10x10.jpg?w=1600', width: 1920, quality: G.heroQuality }, 'https://cdn.sanity.io/images/p/d/abc-10x10.jpg?w=1920&auto=format&q=88'],
    [{ src: 'https://cdn.sanity.io/images/p/d/abc-10x10.jpg?w=1600', width: 1920 }, 'https://cdn.sanity.io/images/p/d/abc-10x10.jpg?w=1920&auto=format&q=75'],
  ];
  for (const [args, want] of cases) { const got = loader(args); if (got !== want) failures.push(`loader(${JSON.stringify(args)}) = ${got}, want ${want} (V3)`); }
}

finish(NAME, failures, `F1 variants: q${G.heroQuality} smartSubsample sets for ${G.heroSources.join(', ')}, every plain variant still q${G.defaultQuality}, the loader maps quality ${G.heroQuality} to them.`);

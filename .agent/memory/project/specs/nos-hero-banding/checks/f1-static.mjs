// nos-hero-banding F1 static (QA input, hash-locked). Goldens: goldens/f1-edits.json, f1-footprint.json, f1-spec.md.
//   S1  exact edits: each footprint file equals its BASE (1a7479f1) text with exactly the golden lineEdits applied (BASE numbering).
//   S2  quality: in app/ and components/ exactly one Image passes `quality`, and it is quality={88} on the hero slide Image in
//       components/home/Hero.tsx; lib/image-loader.ts keeps DEFAULT_QUALITY = 75.
//   S3  scrims (app/globals.css): the veil <768 and >=768 and the pull carry exactly the golden stops; the diagonal is BASE's, once; no
//       dither, noise, filter or image layer on any hero scrim rule.
//   S4  fallback: lib/data/heroImages.ts lists violet, pink, dark in that order, no orchid-yellow entry, and the return comment;
//       public/images/orchid-yellow.jpg is still there, unchanged.
//   S5  variants: HERO_SOURCES in scripts/generate-image-variants.mjs names exactly the fallback list's files.
//   S6  NO INVENTION: no new prose literal in Hero.tsx or heroImages.ts; no new token definition, hex colour, or colour triple in the added
//       CSS other than the veil's BASE rgb(34 40 31) and --parchment's own value (#f4f3ec = 244 243 236).
//   S7  the drop-listed asset id (a620a97f) appears in no shipped file: the yellow removal happens in Sanity, never in code.
//   S8  the pull's end colour is the next section's ground: MissionBlock's section is still bg-parchment and --parchment is #f4f3ec.
//   S10 next.config.ts images.qualities lists the default (75) and the hero's (88), so Next does not warn on quality={88}.
//   S9  docs/nos-hero-banding.md exists and covers the quality, smartSubsample, the parchment pull, the <768 derivation, the 2560
//       decision, the yellow removal and the harness filter.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { BASE, DOC, finish, git, goldenJson, readBaseFile, readRepoFile, repoRoot } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f1-static.mjs';
const G = goldenJson('f1-edits.json');
const failures = [];
const count = (text, needle) => text.split(needle).length - 1;

// S1
for (const k of ['hero', 'fallback', 'loader', 'variants', 'config', 'css']) failures.push(...exactEdits(G[k].file, G[k].lineEdits, G[k].drops, 'S1'));

// S2
const tracked = git('ls-files', '--', 'app', 'components').split('\n').filter((f) => /\.(t|j)sx$/.test(f));
const withQuality = [];
for (const f of tracked) {
  const text = readRepoFile(f);
  if (text === null) continue;
  for (const m of text.matchAll(/\bquality=\{([^}]*)\}|\bquality="([^"]*)"/g)) withQuality.push(`${f}: quality=${m[1] ?? m[2]}`);
}
const hero = readRepoFile(G.hero.file) ?? '';
const heroQ = `quality={${G.heroQuality}}`;
if (withQuality.length !== 1 || withQuality[0] !== `${G.hero.file}: quality=${G.heroQuality}`) failures.push(`want exactly one quality prop, ${heroQ} in ${G.hero.file}; found ${JSON.stringify(withQuality)} (S2)`);
const slideImage = hero.match(/\{slides\.map\(\(slide, i\) => \([\s\S]*?<Image\b([\s\S]*?)\/>/);
if (!slideImage || count(slideImage[1], heroQ) !== 1) failures.push(`${G.hero.file}: the slide <Image> in slides.map does not pass ${heroQ} (S2)`);
if (count(readRepoFile('lib/image-loader.ts') ?? '', `const DEFAULT_QUALITY = ${G.defaultQuality};`) !== 1) failures.push(`lib/image-loader.ts: DEFAULT_QUALITY is not ${G.defaultQuality} (S2)`);

// S3
const css = readRepoFile(G.css.file) ?? '';
const rules = [...css.matchAll(/\[data-hero-scrim='(diagonal|veil|bone)'\]\s*\{([^}]*)\}/g)].map((m) => ({ name: m[1], body: m[2] }));
const stops = (body) => { const g = body.match(/gradient\(\s*([\s\S]*?)\s*\);/); return g ? g[1].split(/,\s*(?![^()]*\))/).map((s) => s.trim()).filter((s) => !/^(ellipse|to |\d+deg)/.test(s)) : null; };
const veils = rules.filter((r) => r.name === 'veil');
const pulls = rules.filter((r) => r.name === 'bone');
const diag = rules.filter((r) => r.name === 'diagonal');
if (veils.length !== 2) failures.push(`${G.css.file}: ${veils.length} veil rules, want 2 (<768 and >=768) (S3)`);
else {
  if (JSON.stringify(stops(veils[0].body)) !== JSON.stringify(G.scrims.veilMobile)) failures.push(`${G.css.file}: veil <768 stops ${JSON.stringify(stops(veils[0].body))}, want ${JSON.stringify(G.scrims.veilMobile)} (S3)`);
  if (JSON.stringify(stops(veils[1].body)) !== JSON.stringify(G.scrims.veilDesktop)) failures.push(`${G.css.file}: veil >=768 stops ${JSON.stringify(stops(veils[1].body))}, want ${JSON.stringify(G.scrims.veilDesktop)} (S3)`);
}
if (pulls.length !== 1 || JSON.stringify(stops(pulls[0].body)) !== JSON.stringify(G.scrims.pull)) failures.push(`${G.css.file}: pull stops ${pulls.length === 1 ? JSON.stringify(stops(pulls[0].body)) : `(${pulls.length} rules)`}, want ${JSON.stringify(G.scrims.pull)} (S3)`);
if (diag.length !== 1 || count(css, G.scrims.diagonal) !== 1) failures.push(`${G.css.file}: the diagonal is not BASE's, once (S3)`);
for (const r of rules) if (/noise|dither|turbulence|filter|url\(|image-set|mix-blend|opacity/i.test(r.body)) failures.push(`${G.css.file}: hero scrim ${r.name} has a dither/noise/filter layer (S3)`);

// S4
const fallback = readRepoFile(G.fallback.file) ?? '';
const names = [...fallback.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
if (JSON.stringify(names) !== JSON.stringify(['orchid-violet', 'orchid-pink', 'orchid-dark'])) failures.push(`${G.fallback.file}: hero list ${JSON.stringify(names)}, want violet, pink, dark (S4)`);
if (!/^\s*\/\/.*orchid-yellow.*high-quality original/m.test(fallback)) failures.push(`${G.fallback.file}: no comment that orchid-yellow returns with a high-quality original (S4)`);
if (!existsSync(path.join(repoRoot, 'public/images/orchid-yellow.jpg'))) failures.push('public/images/orchid-yellow.jpg is gone (S4)');
else {
  try { execFileSync('git', ['-C', repoRoot, 'diff', '--quiet', BASE, '--', 'public/images/orchid-yellow.jpg']); } catch { failures.push('public/images/orchid-yellow.jpg differs from BASE (S4)'); }
}

// S5
const variants = readRepoFile(G.variants.file) ?? '';
const heroSources = variants.match(/const HERO_SOURCES = new Set\(\[([^\]]*)\]/);
const listed = heroSources ? [...heroSources[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : null;
const fromFallback = [...fallback.matchAll(/path: '\/images\/([^']+)'/g)].map((m) => m[1]);
if (JSON.stringify(listed) !== JSON.stringify(fromFallback) || JSON.stringify(listed) !== JSON.stringify(G.heroSources)) failures.push(`${G.variants.file}: HERO_SOURCES ${JSON.stringify(listed)}, fallback list ${JSON.stringify(fromFallback)}, golden ${JSON.stringify(G.heroSources)} (S5)`);

// S6
for (const k of ['hero', 'fallback']) failures.push(...newProse(G[k].file, [G[k].file], { allow: G.allowCopy }));
const baseCss = readBaseFile(G.css.file) ?? '';
const baseLines = new Set(baseCss.split('\n'));
const added = css.split('\n').filter((l) => !baseLines.has(l));
const allowedTriples = new Set(['34 40 31', '244 243 236']);
const parchment = baseCss.match(/--parchment:\s*(#[0-9a-f]{6})/i);
const hexTriple = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
if (!parchment || hexTriple(parchment[1]) !== '244 243 236') failures.push(`${G.css.file}: BASE --parchment is not #f4f3ec (S6 INFRA)`);
for (const l of added) {
  if (/^\s*--[\w-]+\s*:/.test(l)) failures.push(`${G.css.file}: new token definition ${JSON.stringify(l.trim())} (S6)`);
  if (/#[0-9a-f]{3,8}\b/i.test(l.replace(/\/\*.*?\*\//g, ''))) failures.push(`${G.css.file}: new hex colour ${JSON.stringify(l.trim())} (S6)`);
  for (const m of l.matchAll(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) if (!allowedTriples.has(`${m[1]} ${m[2]} ${m[3]}`)) failures.push(`${G.css.file}: new colour rgb(${m[1]} ${m[2]} ${m[3]}) (S6)`);
}

// S7
let hits = '';
try { hits = execFileSync('git', ['-C', repoRoot, 'grep', '-l', '--untracked', G.dropAsset, '--', '.', ':!.agent', ':!docs', ':!.tmp', ':!contracts'], { encoding: 'utf8' }); } catch { hits = ''; }
if (hits.trim()) failures.push(`asset ${G.dropAsset} is named in shipped code: ${hits.trim().split('\n').join(', ')} (S7)`);

// S8
const mission = readRepoFile(G.scrims.nextSection.file) ?? '';
if (mission.split('\n')[G.scrims.nextSection.line - 1] !== G.scrims.nextSection.text) failures.push(`${G.scrims.nextSection.file}:${G.scrims.nextSection.line}: the next section is no longer bg-parchment; the pull's end colour must follow it (S8)`);
if (!new RegExp(`--parchment:\\s*${G.scrims.nextSection.hex}`, 'i').test(css)) failures.push(`${G.css.file}: --parchment is not ${G.scrims.nextSection.hex} (S8)`);

// S10
const qualities = (readRepoFile(G.config.file) ?? '').match(/\bimages:\s*\{[\s\S]*?\bqualities:\s*\[([^\]]*)\]/);
const listedQ = qualities ? qualities[1].split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)) : [];
for (const q of [G.defaultQuality, G.heroQuality]) if (!listedQ.includes(q)) failures.push(`${G.config.file}: images.qualities ${qualities ? JSON.stringify(listedQ) : '(absent)'} does not include ${q} (S10)`);

// S9
const doc = readRepoFile(DOC);
if (doc === null) failures.push(`${DOC}: missing (S9)`);
else for (const needle of ['quality={88}', 'smartSubsample', '--parchment', '79%', '2560', 'orchid-yellow', G.dropAsset, 'hero-filter']) if (!doc.includes(needle)) failures.push(`${DOC}: does not mention ${needle} (S9)`);

finish(NAME, failures, 'F1 static: exact edits, one quality={88} on the hero Image and in images.qualities, exact scrim stops ending on --parchment, yellow out of the fallback, q88 hero variants, no new copy or colours, no asset id in code, docs.');

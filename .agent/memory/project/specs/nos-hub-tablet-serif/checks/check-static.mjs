// Static checks for nos-hub-tablet-serif. Usage: node check-static.mjs <scope|tokens|css|nolaunch>.
//   scope     the diff versus the base ref touches only the two NOS css files, e2e specs, the doc and this spec, and none of the lanes held off
//   tokens    the diff adds no custom property, colour, font, image or @theme (no new tokens, no new assets)
//   sizes     HB-3: NosHero declares the hub photo sizes per band (phone 450px, tablet 100vw, desktop 1230px cover widths) from named constants
//   css       the fold decision is in the css: no 4/3 hub stack, h2 weight 300 with the 24px and 22px h2s restating 400, the 889px fluid-heading step, .nk-head h2 at 300
//   header    the NOS Design 768 cut (a): the header row breakpoint moves 779px to 767px in exactly two lines (nos-chrome.css media query, NosHeader.tsx picture source), nothing else in either file
//   countdown NOS Design countdown-wrap ruling: nos-theme.css carries (b) column-gap 32px at 768-1023 only (row gap and every other width untouched) and (a) tabular-nums plus, on the branch the measured face needs, the 3ch/2ch min-width and text-align center; the unit gap is component-level (ShowCountdown.tsx gap-4 lg:gap-6, lg = 1024 verified) and nos-theme.css must not override it
//   nolaunch  no check script sets SITE_PUBLIC_LAUNCH or BETA_PASSWORD_WALL_OFF (they may only delete them)
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { breakpointFailures } from './breakpoint-diff.mjs';
import { breakpointFailures as lgFailures, cssFailures, tsxGapFailures } from './countdown-fit-verdict.mjs';

const mode = process.argv[2];
const BASE = process.env.HUB_SERIF_BASE_REF ?? 'origin/main';
const SPEC = '.agent/memory/project/specs/nos-hub-tablet-serif';
const ROOT = process.env.HUB_SERIF_ROOT ?? '.';
const THEME = `${ROOT}/app/(nos)/national-show/nos-theme.css`;
const STRUCTURE = `${ROOT}/app/(nos)/national-show/nos-structure.css`;
const git = (...a) => execFileSync('git', process.env.HUB_SERIF_ROOT ? ['-C', ROOT, ...a] : a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = (s) => s.split('\n').filter(Boolean);
const failures = [];
const must = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

if (mode === 'scope') {
  const changed = new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  const ALLOWED = [
    /^app\/\(nos\)\/national-show\/(nos-theme|nos-structure)\.css$/,
    /^components\/nos\/NosHero\.tsx$/,
    // NOS Design H-a 768 cut (a): the header breakpoint (two lines, proven by `header`) and the P1 countdown guard (the hub page and ShowCountdown only).
    /^components\/nos-chrome\/(NosHeader\.tsx|nos-chrome\.css)$/,
    /^app\/\(nos\)\/national-show\/page\.tsx$/,
    /^components\/show\/ShowCountdown\.tsx$/,
    /^app\/\(nos\)\/(national-show\/)?not-found\.tsx$/,
    /^app\/not-found\.tsx$/,
    /^app\/\(nos\)\/tickets\/\[slug\]\/(page|layout|loading)\.tsx$/,
    /^lib\/data\/ticket-type-lookup\.ts$/,
    /^e2e\/[^/]+\.spec\.ts$/,
    /^docs\/nos-hub-tablet-serif\.md$/,
    /^\.agent\/memory\/project\/specs\/nos-hub-tablet-serif\//,
    /^\.agent\/memory\/(scratch|project\/(learned|backlog))/,
  ];
  // SAOC's lanes and the assets this PR may not touch (loaders, headers, header focus css, the newsletter form, hero image bytes and variant plumbing).
  const HELD_OFF = [
    /^app\/.*\/national-show\/[^/]+\/loading\.tsx$/, /^components\/chrome\//, /^components\/nos-chrome\//, /NewsletterSignup\.tsx$/,
    /^public\/images\//, /^lib\/hero-source-widths\.json$/, /^lib\/image-loader\.ts$/, /^scripts\/generate-image-variants\.mjs$/,
    /^CLAUDE\.md$/, /^apphosting\.yaml$/, /^package\.json$/, /^pnpm-lock\.yaml$/, /^sanity\//, /^firestore\.rules$/, /^proxy\.ts$/,
  ];
  const HEADER_CUT = /^components\/nos-chrome\/(NosHeader\.tsx|nos-chrome\.css)$/; // the only held-off files the 768 cut may touch
  for (const f of changed) {
    must(`held-off path changed: ${f}`, HEADER_CUT.test(f) || !HELD_OFF.some((r) => r.test(f)));
    must(`out-of-scope change: ${f}`, ALLOWED.some((r) => r.test(f)) || HELD_OFF.some((r) => r.test(f)));
  }
  console.log(`scope: ${changed.size} changed file(s) versus ${BASE}`);
} else if (mode === 'tokens') {
  const cssFiles = lines(git('diff', '--name-only', BASE)).filter((f) => /\.css$/.test(f));
  const added = [];
  for (const f of cssFiles) for (const l of lines(git('diff', '-U0', BASE, '--', f))) if (l.startsWith('+') && !l.startsWith('+++')) added.push([f, l.slice(1)]);
  for (const f of lines(git('ls-files', '--others', '--exclude-standard')).filter((x) => /\.css$/.test(x))) must(`new css file (new tokens risk): ${f}`, false);
  const RULES = [
    [/^\s*--[\w-]+\s*:/, 'adds a custom property'],
    [/@theme|@font-face|@import/, 'adds @theme, @font-face or @import'],
    [/#[0-9a-fA-F]{3,8}\b/, 'adds a hex colour'],
    [/\brgba?\(|\bhsla?\(|\boklch\(/, 'adds a colour function'],
    [/url\(/, 'adds an image or font url'],
  ];
  for (const [f, l] of added) {
    for (const [re, why] of RULES) must(`${f}: ${why}`, !re.test(l), l.trim());
    if (/font-family\s*:/.test(l)) must(`${f}: font-family other than var(--serif) or var(--sans)`, /var\(--(serif|sans)\)/.test(l), l.trim());
  }
  console.log(`tokens: ${added.length} added css line(s) inspected across ${cssFiles.length} css file(s)`);
} else if (mode === 'css') {
  const theme = readFileSync(THEME, 'utf8');
  const structure = readFileSync(STRUCTURE, 'utf8');
  must('no hub 4/3 stack remains in nos-theme.css (H-a)', !/aspect-ratio:\s*4\s*\/\s*3/.test(theme));
  const h2Block = /\.nos-theme h2 \{([^}]*)\}/.exec(theme);
  must('LT-1: the existing `.nos-theme h2` rule (the 32-48px section heading) declares font-weight 300', Boolean(h2Block) && /font-weight:\s*300/.test(h2Block[1]));
  must('LT-1: no separate `h2:not(...)` weight rule (a (0,2,1) selector would override the sans eyebrow h2s that set their own weight)', !/h2:not\([^)]*\)\s*\{[^}]*font-weight/.test(theme));
  must('LT-1: `.nos-card-title` (22px h2) restates weight 400', /\.nos-theme :is\(h2, h3\)\.nos-card-title \{[^}]*font-weight:\s*400/.test(theme));
  must('LT-1: `.nos-label` (12px sans h2) keeps its own weight 600', /\.nos-theme :is\(h2, h3, h4, h5, h6\)\.nos-label \{[^}]*font-weight:\s*600/.test(theme));
  must('LT-1: `.nk-attendees-title` (24px h2) restates weight 400', /\.nos-theme \.nk-attendees-title \{[^}]*font-weight:\s*400/.test(structure));
  must('LT-1: the fluid heading step (28 to 44px, 32px at 889px viewport) takes weight 300 from min-width 889px', /@media\s*\(min-width:\s*889px\)\s*\{[^@]*nos-opsz-fluid[^}]*\{[^}]*font-weight:\s*300/.test(theme));
  must('LT-1: .nk-head h2 (32 to 39px) no longer pins weight 400', !/\.nk-head h2\s*\{[^}]*font-weight:\s*400/.test(structure));
  must('LT-1: .nk-head h2 declares weight 300', /\.nk-head h2\s*\{[^}]*font-weight:\s*300/.test(structure));
  must('LT-1: the h3-h6 base stays weight 400 (the base heading rule is unchanged)', /\.nos-theme :is\(h1, h2, h3, h4, h5, h6\) \{[^}]*font-weight:\s*400/.test(theme));
} else if (mode === 'sizes') {
  const hero = readFileSync(`${ROOT}/components/nos/NosHero.tsx`, 'utf8');
  must('HB-3: HUB_PHONE_BAND_HEIGHT_PX is 300 (nos-theme.css hub band height at 767px and below)', /const HUB_PHONE_BAND_HEIGHT_PX = 300;/.test(hero));
  must('HB-3: HUB_DESKTOP_MAX_HEIGHT_PX is 820 (nos-theme.css hub min-height ceiling)', /const HUB_DESKTOP_MAX_HEIGHT_PX = 820;/.test(hero));
  must('HB-3: HUB_SOURCE_ASPECT is 1.5 (orchid-dark.jpg 5184x3456)', /const HUB_SOURCE_ASPECT = 1\.5;/.test(hero));
  must('HB-3: HUB_PHOTO_SIZES declares max(100vw, 450px) at <=767 and max(100vw, 1230px) from 1024, built from the constants', /const HUB_PHOTO_SIZES = `\(max-width: 767px\) max\(100vw, \$\{Math\.round\(HUB_PHONE_BAND_HEIGHT_PX \* HUB_SOURCE_ASPECT\)\}px\), \(min-width: 1024px\) max\(100vw, \$\{Math\.round\(HUB_DESKTOP_MAX_HEIGHT_PX \* HUB_SOURCE_ASPECT\)\}px\), 100vw`;/.test(hero));
  must('HB-3: the hub photo uses HUB_PHOTO_SIZES', /isHub \? HUB_PHOTO_SIZES/.test(hero));
  must('HB-3: no bare 100vw literal is left for the hub photo', !/isHub \? '100vw'/.test(hero));
} else if (mode === 'header') {
  const FILES = [
    ['components/nos-chrome/nos-chrome.css', '@media (max-width: 779px) {', '@media (max-width: 767px) {'],
    ['components/nos-chrome/NosHeader.tsx', 'media="(max-width: 779px)"', 'media="(max-width: 767px)"'],
  ];
  for (const [file, from, to] of FILES) {
    for (const f of breakpointFailures(file, git('diff', '-U0', BASE, '--', file), from, to)) must(f, false);
    must(`${file}: no 779px breakpoint remains`, !/779px/.test(readFileSync(`${ROOT}/${file}`, 'utf8')));
  }
} else if (mode === 'countdown') {
  execFileSync('node', [`${ROOT}/${SPEC}/checks/measure-tnum.mjs`], { encoding: 'utf8', env: process.env });
  const branch = JSON.parse(readFileSync(`${ROOT}/${SPEC}/evidence/tnum-branch.json`, 'utf8')).branch;
  for (const f of cssFailures(readFileSync(THEME, 'utf8'), branch)) must(`nos-theme.css (branch ${branch})`, false, f);
  for (const f of tsxGapFailures(readFileSync(`${ROOT}/components/show/ShowCountdown.tsx`, 'utf8'))) must('components/show/ShowCountdown.tsx', false, f);
  const cssTexts = ['app', 'components'].flatMap((d) => readdirSync(`${ROOT}/${d}`, { recursive: true }).filter((n) => String(n).endsWith('.css')).map((n) => [`${d}/${n}`, readFileSync(`${ROOT}/${d}/${n}`, 'utf8')]));
  for (const f of lgFailures(cssTexts)) must('tailwind breakpoints', false, f);
} else if (mode === 'nolaunch') {
  const dir = `${SPEC}/checks`;
  for (const f of readdirSync(dir)) {
    if (f === 'check-static.mjs') continue;
    readFileSync(`${dir}/${f}`, 'utf8').split('\n').forEach((l, i) => {
      if (!/SITE_PUBLIC_LAUNCH|BETA_PASSWORD_WALL_OFF/.test(l) || /^\s*(\/\/|#)/.test(l)) return;
      must(`${f}:${i + 1} sets a launch or wall-off flag`, /\bdelete\s+env\.|\bunset\s+/.test(l), l.trim());
    });
  }
  const contract = readFileSync(`${SPEC}/contract.yaml`, 'utf8');
  must('contract.yaml never exports SITE_PUBLIC_LAUNCH or BETA_PASSWORD_WALL_OFF', !/(SITE_PUBLIC_LAUNCH|BETA_PASSWORD_WALL_OFF)\s*=/.test(contract));
} else {
  console.error('usage: check-static.mjs <scope|tokens|css|sizes|header|countdown|nolaunch>');
  process.exit(2);
}

if (failures.length) { console.error(`check-static ${mode} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`check-static ${mode} pass`);

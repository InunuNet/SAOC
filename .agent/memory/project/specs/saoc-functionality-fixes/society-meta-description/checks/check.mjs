// Offline checks for society-meta-description. Usage: tsx check.mjs <case>. SAOC_ROOT overrides the repo root.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SAOC_ROOT ?? process.cwd();
const { buildSocietyMetadata } = await import(pathToFileURL(join(root, 'lib/society-metadata.ts')).href);
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };
const MAX = 160;
const describe = (description, over = {}) =>
  buildSocietyMetadata({ name: 'Test Society', slug: 'test-society', region: 'Western Cape', description, ...over }).description;

// Fixtures are synthetic stand-ins shaped like the live cut ("... The COS strives to").
const SENT_1 = 'Founded in 1957, the Test Orchid Society meets monthly and welcomes growers of every level of experience.';
const SENT_2 = 'The Society strives to promote the cultivation of orchids among its members and the wider public through talks and shows.';
const ONE_LONG = 'The Test Orchid Society is a community of growers who meet each month to share plants, knowledge, growing tips, show results and friendship across many years and welcome visitors of every age and level to join them';

const cases = {
  'cut-at-sentence'() {
    const text = `${SENT_1} ${SENT_2}`;
    if (text.length <= MAX) fail('fixture must exceed the limit');
    const got = describe(text);
    if (got !== SENT_1) fail(`expected the first whole sentence, got ${JSON.stringify(got)}`);
  },
  'cut-at-word-with-ellipsis'() {
    if (ONE_LONG.length <= MAX || /[.!?]/.test(ONE_LONG)) fail('fixture must be one over-long sentence');
    const got = describe(ONE_LONG);
    if (!got.endsWith('…')) fail(`must end with an ellipsis, got ${JSON.stringify(got)}`);
    if (got.length > MAX) fail(`length ${got.length} exceeds ${MAX}`);
    const stem = got.slice(0, -1);
    if (!ONE_LONG.startsWith(stem)) fail('result must be a prefix of the source, no new copy');
    if (ONE_LONG[stem.length] !== ' ') fail(`cut is mid-word: ${JSON.stringify(got)}`);
    if (/[\s,;:\-]$/.test(stem)) fail(`stem must not end in space/punctuation before the ellipsis: ${JSON.stringify(got)}`);
  },
  'short-first-sentence-uses-word-cut'() {
    const text = `Founded in 1957. ${ONE_LONG}`;
    const got = describe(text);
    if (got === 'Founded in 1957.') fail('a sentence under 70 chars is too thin for a meta description');
    if (!got.endsWith('…') || got.length > MAX) fail(`expected word-cut with ellipsis within ${MAX}, got ${JSON.stringify(got)}`);
  },
  'guard-fits-unchanged'() {
    const exact = 'x'.repeat(MAX - 1) + '.';
    if (describe('A short   description\nwith  odd   spacing.') !== 'A short description with odd spacing.') fail('whitespace collapse regressed');
    if (describe(exact) !== exact) fail('a description of exactly 160 chars must be unchanged');
  },
  'guard-fallbacks'() {
    if (describe(null) !== 'Test Society — affiliated SAOC society in Western Cape.') fail('null description region fallback regressed');
    if (describe('', { region: null }) !== 'Test Society — an affiliated SAOC society.') fail('null description no-region fallback regressed');
  },
};

const name = process.argv[2];
if (!cases[name]) fail(`unknown case ${name}`);
await cases[name]();
console.log(`ok ${name}`);

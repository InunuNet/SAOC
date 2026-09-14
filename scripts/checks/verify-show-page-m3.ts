/**
 * verify-show-page-m3.ts — the M3 verifier (national-show-ia-alignment).
 *
 * See .agent/memory/project/specs/national-show-ia-alignment/goldens/m3/verifier-contract.golden.md
 * for the full check-id contract this script implements, and copy-authoring.golden.md /
 * per-page-copy.golden.md / wosa-content-boundary.golden.md for the rules each check enforces.
 *
 * Lives in scripts/checks/, NOT execution/checks/ — execution/ is harness-owned wholesale
 * (.agent/update-manifest.yaml:12) and is wiped by the next template update, taking its gate
 * with it.
 *
 * Exit 0: every check passed. Exit 1: at least one check FAILED. Exit 2: the verifier itself
 * could not run (never collapsed into 1).
 *
 * Writes a flat two-token PASS/FAIL manifest to .tmp/sandbox/nos-ia/m3-results.txt, one line
 * per check id, colon-free so each assertion is an unquoted one-line grep. Every id is written
 * as UNSET up front and every check overwrites its own line — if any id is still UNSET at the
 * end, that is a verifier bug and the run exits 2 rather than silently under-reporting.
 *
 * Reads the committed corpus only — no Sanity token, no network — which is what makes this
 * gate-runnable at all.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const RESULTS_DIR = path.resolve(PROJECT_ROOT, '.tmp/sandbox/nos-ia');
const RESULTS_FILE = path.join(RESULTS_DIR, 'm3-results.txt');
const SHOW_PAGES_DIR = path.resolve(PROJECT_ROOT, 'content/show-pages');
const DRIVE_RECOVERED_DIR = path.resolve(PROJECT_ROOT, 'content/drive-recovered');
const ALLOWLIST_FILE = path.join(SHOW_PAGES_DIR, '_name-allowlist.json');

type Verdict = 'PASS' | 'FAIL';

const ALL_CHECK_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'P6', 'W1', 'W2'] as const;
type CheckId = (typeof ALL_CHECK_IDS)[number];

const results = new Map<CheckId, Verdict>();
let hardFailure = false;

function record(id: CheckId, verdict: Verdict, detail?: string): void {
  results.set(id, verdict);
  if (verdict === 'FAIL') {
    hardFailure = true;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  }
}

function check(id: CheckId, condition: boolean, expected: string, found: string): void {
  record(id, condition ? 'PASS' : 'FAIL', condition ? undefined : `expected ${expected}, found ${found}`);
}

function writeResults(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const lines = ALL_CHECK_IDS.map((id) => `${id} ${results.get(id) ?? 'UNSET'}`);
  writeFileSync(RESULTS_FILE, lines.join('\n') + '\n', 'utf8');
}

// ===========================================================================
// Seed corpus types and loading
// ===========================================================================

type SeedSpan = { _type?: string; text?: string; [key: string]: unknown };
type SeedBlockChild = SeedSpan;
type SeedBlock = { _type?: string; children?: SeedBlockChild[]; [key: string]: unknown };
type SeedSectionDoc = {
  sectionKey?: string;
  heading?: string;
  kind?: string;
  provenance?: string;
  sourcePath?: string;
  body?: SeedBlock[];
  [key: string]: unknown;
};
type SeedPageDoc = {
  pageKey?: string;
  specNumber?: number;
  title?: string;
  sections?: SeedSectionDoc[];
  [key: string]: unknown;
};

function loadSeedCorpus(): Array<{ file: string; doc: SeedPageDoc }> {
  if (!existsSync(SHOW_PAGES_DIR)) return [];
  return readdirSync(SHOW_PAGES_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((file) => ({ file, doc: JSON.parse(readFileSync(path.join(SHOW_PAGES_DIR, file), 'utf8')) }));
}

// "Generated" = copy we wrote. council-supplied sections are exempt from every semantic
// check below — we police our own words, not the client's. Same scoping as M1's P6 and
// the wosa-content-boundary golden's W1/W2.
function isGenerated(section: SeedSectionDoc): boolean {
  return section.provenance === 'placeholder-ai' || section.provenance === 'research';
}

// Flatten a section's portableText body to plain text — headings are structural metadata,
// not generated prose in the same sense, so (matching M1's P6 convention) every semantic
// check below scans `body` only.
function sectionText(section: SeedSectionDoc): string {
  const blocks = Array.isArray(section.body) ? section.body : [];
  return blocks
    .flatMap((b) => (Array.isArray(b.children) ? b.children : []))
    .map((c) => (typeof c.text === 'string' ? c.text : ''))
    .join(' ');
}

// ===========================================================================
// C1 — no section M3 authors carries council-supplied
// ===========================================================================

// The exact section plan from per-page-copy.golden.md. Doubles as C9's expected shape and
// C1's "which sections did M3 author" manifest. Sections not listed under a pageKey's
// `authored` set are pre-existing council-supplied sections M3 does not touch.
const PAGE_PLAN: Record<string, { all: string[]; authored: string[] }> = {
  '01-national-show-landing': { all: ['welcome', 'what-is-on', 'getting-here'], authored: ['welcome', 'what-is-on', 'getting-here'] },
  '03-what-to-expect': { all: ['overview', 'visitor-logistics'], authored: ['visitor-logistics'] },
  '04-south-african-exhibitors': { all: ['overview', 'directory-coming'], authored: ['directory-coming'] },
  '05-international-guests-and-exhibitors': { all: ['intro', 'who-will-appear'], authored: ['intro', 'who-will-appear'] },
  '06-saoc-symposium': { all: ['theme', 'about-the-symposium', 'attending'], authored: ['about-the-symposium', 'attending'] },
  '07-wosa-conference': { all: ['about-the-conference', 'attending', 'about-wosa'], authored: ['about-the-conference', 'attending', 'about-wosa'] },
  '08-judging-and-awards': { all: ['intro', 'how-judging-works', 'results'], authored: ['intro', 'how-judging-works', 'results'] },
  '09-plant-exhibition-and-sales': { all: ['intro', 'visiting', 'accessibility'], authored: ['intro', 'visiting', 'accessibility'] },
  '10-plant-sales': { all: ['intro', 'buying-and-taking-plants-home', 'payment'], authored: ['intro', 'buying-and-taking-plants-home', 'payment'] },
  '11-programme': { all: ['intro', 'how-the-programme-will-work'], authored: ['intro', 'how-the-programme-will-work'] },
  '12-workshops': { all: ['intro', 'what-to-expect', 'booking'], authored: ['intro', 'what-to-expect', 'booking'] },
  '15-sponsors': { all: ['intro', 'listing'], authored: ['intro', 'listing'] },
  '16-plan-your-visit': { all: ['intro', 'getting-here', 'staying-nearby'], authored: ['intro', 'getting-here', 'staying-nearby'] },
  '17-faq': { all: ['faq', 'more-questions-coming'], authored: ['more-questions-coming'] },
  '18-contact-us': { all: ['overview', 'how-to-reach-us'], authored: ['how-to-reach-us'] },
};

function runC1AndC9(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  let c1ok = true;
  const c1Failures: string[] = [];
  let c9ok = true;
  const c9Failures: string[] = [];

  for (const [pageKey, plan] of Object.entries(PAGE_PLAN)) {
    const entry = corpus.find(({ doc }) => doc.pageKey === pageKey);
    if (!entry) {
      c1ok = false;
      c9ok = false;
      c1Failures.push(`${pageKey}: missing from corpus`);
      c9Failures.push(`${pageKey}: missing from corpus`);
      continue;
    }
    const sections = entry.doc.sections ?? [];
    const actualKeys = sections.map((s) => s.sectionKey).filter((k): k is string => typeof k === 'string');

    // C9 — exact set match, order-independent.
    const expectedSet = new Set(plan.all);
    const actualSet = new Set(actualKeys);
    const missing = plan.all.filter((k) => !actualSet.has(k));
    const extra = actualKeys.filter((k) => !expectedSet.has(k));
    if (missing.length > 0 || extra.length > 0) {
      c9ok = false;
      c9Failures.push(`${pageKey}: missing=[${missing.join(',')}] extra=[${extra.join(',')}]`);
    }

    // C1 — every section M3 authored must not be council-supplied.
    for (const key of plan.authored) {
      const section = sections.find((s) => s.sectionKey === key);
      if (!section) continue; // already reported by C9
      if (section.provenance === 'council-supplied') {
        c1ok = false;
        c1Failures.push(`${pageKey}/${key}: authored section carries council-supplied`);
      }
    }
  }

  check('C1', c1ok, 'no M3-authored section is council-supplied', c1Failures.join('; '));
  check('C9', c9ok, 'sectionKey sets match per-page-copy.golden.md exactly', c9Failures.join('; '));
}

// ===========================================================================
// C2 — no facts of record in generated copy
// ===========================================================================

const TIME_OF_DAY_RE = /\b([01]?\d|2[0-3])[:.]\d{2}\s?(am|pm)?\b|\b\d{1,2}\s?(am|pm)\b/i;
const MONTH_NAMES =
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const CALENDAR_DATE_RE = new RegExp(
  `\\b\\d{1,2}(st|nd|rd|th)?\\s+(${MONTH_NAMES})\\b|\\b(${MONTH_NAMES})\\s+\\d{1,2}(st|nd|rd|th)?\\b|` +
    `\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b`,
  'i',
);
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /\+27[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}\b|\b0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/;
const COUNT_RE = /\b(over|about|nearly|approximately|around|more than)\s+\d[\d,]*\b/i;
const HONORIFIC_RE = /\b(Dr|Prof|Mr|Mrs|Ms|Miss)\.?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/;

function findFactOfRecord(text: string): string | null {
  if (TIME_OF_DAY_RE.test(text)) return 'time-of-day';
  if (CALENDAR_DATE_RE.test(text)) return 'calendar-date';
  if (EMAIL_RE.test(text)) return 'email';
  if (PHONE_RE.test(text)) return 'phone';
  if (COUNT_RE.test(text)) return 'count';
  if (HONORIFIC_RE.test(text)) return 'honorific-plus-name';
  return null;
}

function runC2(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  let ok = true;
  const failures: string[] = [];
  for (const { file, doc } of corpus) {
    for (const section of doc.sections ?? []) {
      if (!isGenerated(section)) continue;
      const text = sectionText(section);
      const hit = findFactOfRecord(text);
      if (hit) {
        ok = false;
        failures.push(`${file}/${section.sectionKey}: ${hit}`);
      }
    }
  }
  check('C2', ok, 'no fact-of-record pattern in any generated section', failures.join('; '));
}

// ===========================================================================
// C3 — proper-noun allowlist
// ===========================================================================

// Sentence-initial and generic function words that should never anchor a proper-noun match
// on their own — trimmed from the ends of a candidate phrase before it is checked. A real
// name essentially never starts or ends on one of these.
const STOPWORDS = new Set([
  'the', 'this', 'these', 'those', 'that', 'a', 'an', 'each', 'every', 'some', 'all', 'no',
  'and', 'or', 'but', 'if', 'when', 'where', 'what', 'who', 'how', 'why', 'we', 'they', 'it',
  'its', 'our', 'your', 'his', 'her', 'more', 'most', 'many', 'few', 'such', 'once', 'here',
  'for', 'to', 'at', 'in', 'on', 'from', 'of', 'after', 'before', 'since', 'until', 'while',
  'although', 'because', 'though',
]);
// Deliberately narrow: only true noun-phrase connectors chain two capitalised words into one
// candidate. Verbs like "is"/"will"/"are" are excluded on purpose — including them let a
// candidate swallow an entire sentence ("National Show is Stellenbosch Flying Club").
const CONNECTOR_ALT = 'of|the|and|for|to|at|in|on|from';

// Matches a run of 2+ Title Case words, optionally joined by a single connector word from
// CONNECTOR_ALT. Chaining through anything else (a comma, a verb, punctuation) breaks the run.
const PROPER_PHRASE_RE = new RegExp(
  `\\b[A-Z][a-zA-Z'-]*(?:\\s+(?:(?:${CONNECTOR_ALT})\\s+)?[A-Z][a-zA-Z'-]*)+\\b`,
  'g',
);

function loadAllowlist(): Set<string> {
  const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'));
  const names: unknown = raw?.names;
  return new Set(Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : []);
}

// Trims leading/trailing stopwords from a matched phrase, and drops any interior word that
// isn't itself Title Case (i.e. a lowercase connector word survived the regex but isn't part
// of the name). Returns null if fewer than 2 real Title Case words remain.
function normalisePhrase(match: string): string | null {
  const words = match.split(/\s+/);
  let start = 0;
  let end = words.length - 1;
  while (start <= end && STOPWORDS.has(words[start].toLowerCase())) start++;
  while (end >= start && STOPWORDS.has(words[end].toLowerCase())) end--;
  const trimmed = words.slice(start, end + 1);
  const capWords = trimmed.filter((w) => /^[A-Z]/.test(w));
  if (capWords.length < 2) return null;
  return trimmed.join(' ');
}

function findUnallowedProperNouns(text: string, allowlist: Set<string>): string[] {
  const violations: string[] = [];
  for (const match of text.matchAll(PROPER_PHRASE_RE)) {
    const phrase = normalisePhrase(match[0]);
    if (!phrase) continue;
    if (!allowlist.has(phrase)) violations.push(phrase);
  }
  return violations;
}

function runC3(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  let allowlist: Set<string>;
  try {
    allowlist = loadAllowlist();
  } catch (err) {
    console.error('Verifier bug: could not load _name-allowlist.json:', err);
    record('C3', 'FAIL', 'allowlist file missing or malformed');
    return;
  }
  let ok = true;
  const failures: string[] = [];
  for (const { file, doc } of corpus) {
    for (const section of doc.sections ?? []) {
      if (!isGenerated(section)) continue;
      const text = sectionText(section);
      const violations = findUnallowedProperNouns(text, allowlist);
      if (violations.length > 0) {
        ok = false;
        failures.push(`${file}/${section.sectionKey}: ${[...new Set(violations)].join(', ')}`);
      }
    }
  }
  check('C3', ok, 'every multi-word capitalised name in generated copy is in the allowlist', failures.join('; '));
}

// ===========================================================================
// C4 — credential scan over content/show-pages/** and content/drive-recovered/**
// Deliberately does NOT scan content/drive-source/ — see verifier-contract.golden.md.
// ===========================================================================

// Requires a colon or equals directly after the label (with optional whitespace), which is
// what distinguishes "password: hunter2" from "a password to access the journal" or
// "password-protected".
const CREDENTIAL_RE = /\b(email\s*password|app\s*password|api[_\s-]?key|access[_\s-]?token|pwd|password)\s*[:=]\s*\S+/i;

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function runC4(): void {
  const files = [...walkFiles(SHOW_PAGES_DIR), ...walkFiles(DRIVE_RECOVERED_DIR)];
  let ok = true;
  const failures: string[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue; // not a text file, or unreadable — not this check's concern
    }
    if (CREDENTIAL_RE.test(content)) {
      ok = false;
      failures.push(path.relative(PROJECT_ROOT, file));
    }
  }
  check('C4', ok, 'no credential-shaped string in content/show-pages or content/drive-recovered', failures.join(', '));
}

// ===========================================================================
// C5 — every in-scope page has at least one non-empty generated section
// ===========================================================================

function runC5(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  let ok = true;
  const failures: string[] = [];
  for (const pageKey of Object.keys(PAGE_PLAN)) {
    const entry = corpus.find(({ doc }) => doc.pageKey === pageKey);
    if (!entry) {
      ok = false;
      failures.push(`${pageKey}: missing`);
      continue;
    }
    const hasNonEmptyGenerated = (entry.doc.sections ?? []).some(
      (s) => isGenerated(s) && sectionText(s).trim().length > 0,
    );
    if (!hasNonEmptyGenerated) {
      ok = false;
      failures.push(`${pageKey}: no non-empty generated section`);
    }
  }
  check('C5', ok, 'all 15 pages have at least one non-empty generated section', failures.join('; '));
}

// ===========================================================================
// C6 — spec entry 14 regression guard
// ===========================================================================

function runC6(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  const noSource = !corpus.some(({ file, doc }) => file.startsWith('14-') || String(doc.pageKey ?? '').startsWith('14-'));
  check('C6', noSource, 'no 14- seed source and no 14- pageKey', noSource ? 'absent' : 'present');
}

// ===========================================================================
// C7 — entry 7 (WOSA Conference): no honorific+name, no quoted attributed speech
// ===========================================================================

// Double quotes only — a straight apostrophe also appears in ordinary possessives and
// contractions ("Council's", "WOSA's"), which are not attributed speech and must not fire.
const QUOTE_RE = /["“”]/;

function runC7(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  const entry = corpus.find(({ doc }) => doc.pageKey === '07-wosa-conference');
  if (!entry) {
    check('C7', false, 'spec entry 7 present', 'missing from corpus');
    return;
  }
  let ok = true;
  const failures: string[] = [];
  for (const section of entry.doc.sections ?? []) {
    if (!isGenerated(section)) continue;
    const text = sectionText(section);
    if (HONORIFIC_RE.test(text)) {
      ok = false;
      failures.push(`${section.sectionKey}: honorific+name`);
    }
    if (QUOTE_RE.test(text)) {
      ok = false;
      failures.push(`${section.sectionKey}: quoted text`);
    }
  }
  check('C7', ok, 'no honorific+name and no quoted speech on spec entry 7', failures.join('; '));
}

// ===========================================================================
// C8 — venue and theme sentences appear verbatim wherever reused
// ===========================================================================

const VENUE_SENTENCE = 'Stellenbosch Flying Club, R44 northbound to Stellenbosch';
const THEME_SENTENCE = 'From Wild Origins to Cultivated Excellence: The Future of Orchids';

function runC8(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  let ok = true;
  const failures: string[] = [];
  for (const { file, doc } of corpus) {
    const bodyText = JSON.stringify(doc);
    if (bodyText.includes('Stellenbosch Flying Club') && !bodyText.includes(VENUE_SENTENCE)) {
      ok = false;
      failures.push(`${file}: venue paraphrased`);
    }
    if (bodyText.includes('Wild Origins to Cultivated Excellence') && !bodyText.includes(THEME_SENTENCE)) {
      ok = false;
      failures.push(`${file}: theme paraphrased`);
    }
  }
  check('C8', ok, 'venue and theme sentences reproduced verbatim wherever reused', failures.join('; '));
}

// ===========================================================================
// P6 — no rand price in generated copy (M1's discriminator, reused verbatim)
// ===========================================================================

const PRICE_CANDIDATE_RE = /\bR\s?\d{1,3}(?:[ ,]?\d{3})*(?:\.\d{2})?\b/g;
const ROUTE_KEYWORD_RE =
  /^\W{0,3}(northbound|southbound|eastbound|westbound|highway|freeway|motorway|route|road|off-?ramp|on-?ramp|turn-?off|toward|towards|exit)\b/i;
const ROUTE_ALLOWLIST = new Set(['R44', 'R45', 'R101', 'R102', 'R304', 'R310', 'N1', 'N2', 'N7', 'M3']);
const ROUTE_LOOKAHEAD_CHARS = 30;

function containsRandPrice(text: string): boolean {
  for (const match of text.matchAll(PRICE_CANDIDATE_RE)) {
    const token = match[0];
    const hasDecimal = /\.\d{2}\b/.test(token);
    if (hasDecimal) return true;

    const afterIdx = (match.index ?? 0) + token.length;
    const lookahead = text.slice(afterIdx, afterIdx + ROUTE_LOOKAHEAD_CHARS);
    if (ROUTE_KEYWORD_RE.test(lookahead)) continue;

    const bareToken = token.replace(/\s/g, '');
    if (ROUTE_ALLOWLIST.has(bareToken)) continue;

    return true;
  }
  return false;
}

function runP6(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  let ok = true;
  const failures: string[] = [];
  for (const { file, doc } of corpus) {
    for (const section of doc.sections ?? []) {
      if (!isGenerated(section)) continue;
      const text = JSON.stringify(section.body ?? []);
      if (containsRandPrice(text)) {
        ok = false;
        failures.push(`${file}/${section.sectionKey}`);
      }
    }
  }
  check('P6', ok, 'no rand price token in any section we generated', failures.join(', '));
}

// ===========================================================================
// W1/W2 — the WOSA content boundary. Vocabularies live in a committed, reviewable data
// file per wosa-content-boundary.golden.md, not inline here.
// ===========================================================================

const VOCAB_A = [
  'habitat', 'fynbos', 'renosterveld', 'grassland', 'wetland', 'vlei', 'montane', 'afromontane',
  'karoo', 'in situ', 'in the wild', 'wild population', 'natural population', 'endemic',
  'indigenous population', 'distribution range', 'range map', 'red list', 'red data', 'iucn',
  'threatened', 'endangered', 'critically endangered', 'vulnerable species', 'near threatened',
  'extinct in the wild', 'poaching', 'illegal collection', 'wild-collected', 'wild harvest',
  'habitat loss', 'habitat destruction', 'conservation status',
];
const VOCAB_B = [
  'Disa', 'Satyrium', 'Habenaria', 'Eulophia', 'Bonatea', 'Ansellia', 'Bartholina', 'Ceratandra',
  'Corycium', 'Disperis', 'Holothrix', 'Huttonaea', 'Mystacidium', 'Pterygodium', 'Schizochilus',
  'Stenoglottis', 'Tridactyle', 'Acrolophia', 'Brachycorythis', 'Polystachya', 'Cynorkis', 'Liparis',
];

function runW1AndW2(corpus: Array<{ file: string; doc: SeedPageDoc }>): void {
  let w1ok = true;
  const w1Failures: string[] = [];
  let w2ok = true;
  const w2Failures: string[] = [];

  for (const { file, doc } of corpus) {
    for (const section of doc.sections ?? []) {
      if (!isGenerated(section)) continue;
      const text = sectionText(section);
      const lower = text.toLowerCase();

      for (const term of VOCAB_A) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(lower)) {
          w1ok = false;
          w1Failures.push(`${file}/${section.sectionKey}: ${term}`);
        }
      }

      for (const genus of VOCAB_B) {
        const re = new RegExp(`\\b${genus}\\b`); // case-sensitive on purpose
        if (re.test(text)) {
          w2ok = false;
          w2Failures.push(`${file}/${section.sectionKey}: ${genus}`);
        }
      }
    }
  }

  check('W1', w1ok, 'no habitat/distribution/conservation-status vocabulary in generated copy', w1Failures.join('; '));
  check('W2', w2ok, 'no South African orchid genus in generated copy', w2Failures.join('; '));
}

// ===========================================================================
// main
// ===========================================================================

function main(): void {
  writeResults(); // every id UNSET up front

  let corpus: Array<{ file: string; doc: SeedPageDoc }>;
  try {
    corpus = loadSeedCorpus();
  } catch (err) {
    console.error('Verifier bug: could not load seed corpus:', err);
    process.exit(2);
  }

  runC1AndC9(corpus);
  runC2(corpus);
  runC3(corpus);
  runC4();
  runC5(corpus);
  runC6(corpus);
  runC7(corpus);
  runC8(corpus);
  runP6(corpus);
  runW1AndW2(corpus);

  writeResults();

  const unset = ALL_CHECK_IDS.filter((id) => !results.has(id));
  if (unset.length > 0) {
    console.error(`Verifier bug: ids never written: ${unset.join(', ')}`);
    process.exit(2);
  }

  process.exit(hardFailure ? 1 : 0);
}

main();

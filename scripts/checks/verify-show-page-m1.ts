/**
 * verify-show-page-m1.ts — the M1 verifier (national-show-ia-alignment).
 *
 * See .agent/memory/project/specs/national-show-ia-alignment/goldens/m1/verifier-contract.golden.md
 * for the full check-id contract this script implements.
 *
 * Lives in scripts/checks/, NOT execution/checks/ — execution/ is harness-owned
 * wholesale (.agent/update-manifest.yaml:12) and is wiped by the next template update.
 *
 * Exit 0: every check passed. Exit 1: at least one check FAILED. Exit 2: the verifier
 * itself could not run (never collapsed into 1).
 *
 * Writes a flat two-token PASS/FAIL/SKIP manifest to .tmp/sandbox/nos-ia/m1-results.txt,
 * one line per check id. Every id below is written before any check runs (as UNSET) and
 * every check overwrites its own line — if any id is still UNSET at the end, that is a
 * verifier bug and the run exits 2 rather than silently under-reporting.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const PROJECT_ROOT = process.cwd();
const RESULTS_DIR = path.resolve(PROJECT_ROOT, '.tmp/sandbox/nos-ia');
const RESULTS_FILE = path.join(RESULTS_DIR, 'm1-results.txt');

type Verdict = 'PASS' | 'FAIL' | 'SKIP';

const ALL_CHECK_IDS = [
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
  'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G10', 'G11', 'G12',
  'D1', 'D2', 'D3', 'D5', 'D6',
  'P1', 'P2', 'P3', 'P4', 'P6', 'P7',
  'R1', 'R2', 'R3', 'R4', 'R5',
  'N1', 'N2', 'N3',
] as const;
type CheckId = (typeof ALL_CHECK_IDS)[number];

// Loose runtime shapes for values this verifier introspects but does not own the exact
// type of — dynamically-imported Sanity schema objects and parsed JSON documents.
// Index signatures rather than `any`: an index signature still type-checks the property
// accesses and method calls this file actually performs, where `any` would silently
// accept anything, including a typo.
type SchemaField = {
  name?: string;
  type?: string;
  options?: { list?: unknown[] };
  validation?: (rule: unknown) => unknown;
  fields?: SchemaField[];
  [key: string]: unknown;
};
type SchemaTypeDef = { name?: string; fields?: SchemaField[]; [key: string]: unknown };
type SchemaIndexModule = { schemaTypes?: SchemaTypeDef[] };

type RecoveryJson = {
  specPage?: unknown;
  sourceDrivePath?: unknown;
  sourceMd5?: unknown;
  method?: unknown;
  recoveredAt?: unknown;
  recoveredBy?: unknown;
  supersededBy?: unknown;
  [key: string]: unknown;
};
type RecoveryManifest = { name?: string; md5_checksum?: string; [key: string]: unknown };

type SeedSectionDoc = {
  sectionKey?: string;
  provenance?: string;
  sourcePath?: string;
  kind?: string;
  body?: unknown;
  [key: string]: unknown;
};
type SeedPageDoc = {
  pageKey?: string;
  specNumber?: number;
  title?: string;
  sections?: SeedSectionDoc[];
  [key: string]: unknown;
};

type SeedScriptModule = {
  decideSectionAction?: (
    seedSection: SeedSectionDoc | null,
    existing: { body: unknown; seedHash?: string | null } | null,
  ) => string;
  hashBody?: (body: unknown) => string;
  SHOW_PAGE_SETTINGS_DEFAULTS?: { placeholderNotice?: string; [key: string]: unknown };
};

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

function skip(id: CheckId, reason: string): void {
  results.set(id, 'SKIP');
  console.error(`SKIP ${id} — ${reason}`);
}

function writeResults(): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const lines = ALL_CHECK_IDS.map((id) => `${id} ${results.get(id) ?? 'UNSET'}`);
  writeFileSyncSafe(RESULTS_FILE, lines.join('\n') + '\n');
}

function writeFileSyncSafe(file: string, content: string): void {
  // Local indirection only so the initial "write full id list" pass and the final pass
  // go through one code path.
  writeFileSync(file, content, 'utf8');
}

async function main(): Promise<void> {
  // Write every id as UNSET up front — see file header.
  writeResults();

  await runSchemaChecks();
  await runGateChecks();
  runDriveRecoveryChecks();
  await runSeedCorpusChecks();
  runRouteMapChecks();
  await runSeedScriptChecks();

  writeResults();

  const unset = ALL_CHECK_IDS.filter((id) => !results.has(id));
  if (unset.length > 0) {
    console.error(`Verifier bug: ids never written: ${unset.join(', ')}`);
    process.exit(2);
  }

  process.exit(hardFailure ? 1 : 0);
}

// ===========================================================================
// S — schema
// ===========================================================================

// A minimal chainable Sanity Rule spy. Records every method call by name so S3 can
// assert `.required()` was invoked, without needing the real `sanity` package's Rule
// implementation (which requires a live schema context to construct).
function makeRuleSpy() {
  const calls: string[] = [];
  const customFns: Array<(value: unknown, context?: unknown) => unknown> = [];
  const methods = ['required', 'regex', 'min', 'max', 'integer', 'warning', 'error'];
  const spy: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of methods) {
    spy[m] = (...args: unknown[]) => {
      calls.push(m);
      void args;
      return spy;
    };
  }
  // `.custom(fn)` also captures `fn` itself so a schema-level business rule (like
  // "specNumber must not be 14") can actually be exercised with real values, not just
  // recorded as having been registered.
  spy.custom = (fn: unknown) => {
    calls.push('custom');
    if (typeof fn === 'function') customFns.push(fn as (value: unknown, context?: unknown) => unknown);
    return spy;
  };
  return { spy, calls, customFns };
}

async function runSchemaChecks(): Promise<void> {
  let showPageSection: SchemaTypeDef | undefined;
  let showPage: SchemaTypeDef | undefined;
  let showPageSettings: SchemaTypeDef | undefined;
  let schemaIndex: SchemaIndexModule | undefined;

  try {
    // Cast through `unknown`, with a comment, rather than `any`: the real `sanity`
    // package's field/validation types are far richer generics than this verifier
    // needs, and don't structurally match the loose introspection shape above (which
    // exists to type-check the property accesses this file actually performs, not to
    // model Sanity's schema types exactly).
    showPageSection = (await import('@/sanity/schemas/objects/showPageSection.ts')).showPageSection as unknown as SchemaTypeDef;
    showPage = (await import('@/sanity/schemas/documents/showPage.ts')).showPage as unknown as SchemaTypeDef;
    showPageSettings = (await import('@/sanity/schemas/documents/showPageSettings.ts')).showPageSettings as unknown as SchemaTypeDef;
    schemaIndex = (await import('@/sanity/schemas/index.ts')) as unknown as SchemaIndexModule;
  } catch (err) {
    console.error('Verifier bug: could not import schema modules:', err);
    for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'] as CheckId[]) record(id, 'FAIL', 'schema module failed to import');
    return;
  }

  const fields = (t: SchemaTypeDef | undefined): SchemaField[] => (Array.isArray(t?.fields) ? t.fields : []);
  const field = (t: SchemaTypeDef | undefined, name: string): SchemaField | undefined =>
    fields(t).find((f) => f?.name === name);

  // S1
  const provenanceField = field(showPageSection, 'provenance');
  const listValues = (provenanceField?.options?.list ?? []).map((o: unknown) =>
    typeof o === 'string' ? o : (o as { value?: string } | undefined)?.value,
  );
  const expectedSet = ['council-supplied', 'research', 'placeholder-ai'];
  const s1ok =
    !!provenanceField &&
    provenanceField.type === 'string' &&
    listValues.length === expectedSet.length &&
    expectedSet.every((v) => listValues.includes(v));
  check('S1', s1ok, expectedSet.join(','), listValues.join(','));

  // S2 — no initialValue OWN property at all.
  const s2ok = !!provenanceField && !Object.prototype.hasOwnProperty.call(provenanceField, 'initialValue');
  check('S2', s2ok, 'no initialValue property', s2ok ? 'absent' : 'present');

  // S3
  let s3ok = false;
  if (typeof provenanceField?.validation === 'function') {
    const { spy, calls } = makeRuleSpy();
    try {
      provenanceField.validation(spy);
      s3ok = calls.includes('required');
    } catch (err) {
      s3ok = false;
      console.error('S3: validation() threw against Rule spy:', err);
    }
  }
  check('S3', s3ok, 'validation() calls .required()', s3ok ? 'called' : 'not called');

  // S4
  const pageKeyField = field(showPage, 'pageKey');
  const sectionsField = field(showPage, 'sections');
  const specNumberField = field(showPage, 'specNumber');

  const pageKeySpy = makeRuleSpy();
  const sectionsSpy = makeRuleSpy();
  const specNumberSpy = makeRuleSpy();
  try {
    pageKeyField?.validation?.(pageKeySpy.spy);
  } catch {
    // Async custom validators may throw against a spy with no real Sanity context —
    // that's fine, we only need the synchronous `.required()`/`.regex()` calls that
    // happen before any `.custom()` callback executes.
  }
  try {
    sectionsField?.validation?.(sectionsSpy.spy);
  } catch {
    /* see above */
  }
  try {
    specNumberField?.validation?.(specNumberSpy.spy);
  } catch {
    /* see above */
  }

  const s4ok =
    pageKeySpy.calls.includes('required') &&
    pageKeySpy.calls.includes('regex') &&
    sectionsSpy.calls.includes('required') &&
    sectionsSpy.calls.includes('min') &&
    specNumberSpy.calls.includes('required');
  check(
    'S4',
    s4ok,
    'pageKey required+regex, sections required+min(1), specNumber required',
    JSON.stringify({ pageKey: pageKeySpy.calls, sections: sectionsSpy.calls, specNumber: specNumberSpy.calls }),
  );

  // S5
  const labelFieldNames = ['placeholderLabel', 'placeholderNotice', 'researchLabel', 'researchNotice'];
  const s5ok = labelFieldNames.every((name) => {
    const f = field(showPageSettings, name);
    if (!f) return false;
    const { spy, calls } = makeRuleSpy();
    try {
      f.validation?.(spy);
    } catch {
      return false;
    }
    return calls.includes('required');
  });
  check('S5', s5ok, 'all four label fields required', s5ok ? 'all required' : 'one or more not required');

  // S6
  const schemaTypeNames: string[] = (schemaIndex?.schemaTypes ?? []).flatMap((t) => (t?.name ? [t.name] : []));
  const s6ok =
    schemaTypeNames.includes('showPage') &&
    schemaTypeNames.includes('showPageSettings') &&
    schemaTypeNames.includes('showPageSection');
  let structureOk = false;
  try {
    const structureSrc = readFileSync(path.resolve(PROJECT_ROOT, 'sanity/structure.ts'), 'utf8');
    structureOk =
      /PINNED_SINGLETON_TYPES\s*=\s*\[[\s\S]*?'showPageSettings'[\s\S]*?\]\s*as\s*const/.test(structureSrc) &&
      /SINGLETON_TITLES[\s\S]*?showPageSettings\s*:/.test(structureSrc) &&
      /COLLECTION_TYPES\s*=\s*\[[\s\S]*?'showPage'[\s\S]*?\];/.test(structureSrc);
  } catch {
    structureOk = false;
  }
  check('S6', s6ok && structureOk, 'registered in schemaTypes/structure.ts', `schemaTypes ok=${s6ok}, structure ok=${structureOk}`);

  // S7 — specNumber's own description says entry 14 is never a document; the range
  // check alone (min/max) does not enforce that, so this drives the custom validator
  // directly against 14 and against the legal boundary values.
  const specNumberCustomSpy = makeRuleSpy();
  try {
    specNumberField?.validation?.(specNumberCustomSpy.spy);
  } catch {
    /* see the S4 comment above — a spy is not a real Sanity context */
  }
  let s7ok = false;
  if (specNumberCustomSpy.customFns.length > 0) {
    const fn = specNumberCustomSpy.customFns[specNumberCustomSpy.customFns.length - 1];
    const rejects14 = fn(14) !== true;
    const acceptsLegal = [1, 2, 13, 15, 18].every((n) => fn(n) === true);
    s7ok = rejects14 && acceptsLegal;
  }
  check('S7', s7ok, 'custom validator rejects 14, accepts 1/2/13/15/18', `hasCustomFn=${specNumberCustomSpy.customFns.length > 0} s7ok=${s7ok}`);
}

// ===========================================================================
// G — the gate
// ===========================================================================

async function runGateChecks(): Promise<void> {
  let mod: typeof import('../../lib/data/show-pages');
  try {
    mod = await import('@/lib/data/show-pages.ts');
  } catch (err) {
    console.error('Verifier bug: could not import lib/data/show-pages.ts:', err);
    for (const id of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G10', 'G11', 'G12'] as CheckId[]) {
      record(id, 'FAIL', 'module failed to import');
    }
    return;
  }
  const { resolveNotice, resolvePageProvenance, FALLBACK_PLACEHOLDER_LABEL, FALLBACK_PLACEHOLDER_NOTICE, FALLBACK_RESEARCH_LABEL, FALLBACK_RESEARCH_NOTICE } = mod;

  const realExistingFile = 'content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md';
  const differentRealFile = 'content/drive-source/National Show/3. What to expect/3.1 Info - What to Expect/v1.0/content.md';
  const nonexistentFile = 'content/drive-source/does-not-exist.md';

  // A genuine verbatim sentence from realExistingFile's opening paragraph — used to
  // build a section body that IS actually linked to that source, for the linkage
  // check's one accept case. Portable-text shaped (a single block, one span).
  const LINKED_SENTENCE =
    "The 2027 South African National Orchid Show is the South African Orchid Council's premier " +
    'triennial event, bringing together orchid enthusiasts, growers, researchers, conservationists, ' +
    'judges, horticultural professionals and members of the public to celebrate one of the world\'s ' +
    'most remarkable plant families.';
  function makeBody(text: string) {
    return [
      {
        _type: 'block',
        _key: 'b1',
        style: 'normal',
        markDefs: [],
        children: [{ _type: 'span', _key: 's1', text, marks: [] }],
      },
    ];
  }
  const linkedBody = makeBody(LINKED_SENTENCE);

  // G1 — the ONLY null-returning input in the whole suite. Requires BOTH a verified
  // sourcePath AND a body whose text actually occurs in that source — Codex's
  // cross-model review (second pass) found that sourcePath existence alone used to be
  // sufficient, with no check that the rendered words came from the named document.
  const g1notice = resolveNotice({ provenance: 'council-supplied', sourcePath: realExistingFile, body: linkedBody });
  check('G1', g1notice === null, 'null', JSON.stringify(g1notice));

  // G2 — all of these must notify. The last three rows are the regression for the
  // Codex-found hole: a sourcePath naming a real file on the machine that is not a
  // council source (absolute, traversal, or simply outside both allowed trees) must
  // never suppress the notice — "the file exists" is not the property; "the file is a
  // council document under content/drive-source or content/drive-recovered" is.
  const g2Cases: Array<[string, ReturnType<typeof resolveNotice>]> = [
    ['council-supplied, absent sourcePath', resolveNotice({ provenance: 'council-supplied' })],
    ['council-supplied, empty sourcePath', resolveNotice({ provenance: 'council-supplied', sourcePath: '' })],
    ['council-supplied, nonexistent sourcePath', resolveNotice({ provenance: 'council-supplied', sourcePath: nonexistentFile })],
    ['research', resolveNotice({ provenance: 'research' })],
    ['placeholder-ai', resolveNotice({ provenance: 'placeholder-ai' })],
    ['council-supplied, absolute path to a real file', resolveNotice({ provenance: 'council-supplied', sourcePath: '/etc/hosts' })],
    [
      'council-supplied, traversal out of the allowed root to a real file',
      resolveNotice({ provenance: 'council-supplied', sourcePath: 'content/drive-source/../../package.json' }),
    ],
    [
      'council-supplied, real file outside both allowed roots',
      resolveNotice({ provenance: 'council-supplied', sourcePath: 'package.json' }),
    ],
    [
      'council-supplied, valid sourcePath, but an unrecognised future kind',
      resolveNotice({ provenance: 'council-supplied', sourcePath: realExistingFile, kind: 'futureKind' }),
    ],
    [
      'council-supplied, valid sourcePath, but body text absent from that source (linkage)',
      resolveNotice({
        provenance: 'council-supplied',
        sourcePath: realExistingFile,
        body: makeBody('This paragraph was never written by the Orchid Council and appears nowhere in the source file.'),
      }),
    ],
  ];
  const g2ok = g2Cases.every(([, notice]) => notice !== null);
  check('G2', g2ok, 'all notify', JSON.stringify(g2Cases.map(([label, notice]) => [label, notice === null])));

  // G3 — unenumerated states, via explicit default, all placeholder.
  const g3Inputs: Array<string | null | undefined> = [null, undefined, '', 'confirmed'];
  const g3Notices = g3Inputs.map((p) => resolveNotice({ provenance: p }));
  const g3ok = g3Notices.every((n) => n !== null && n.label === FALLBACK_PLACEHOLDER_LABEL && n.text === FALLBACK_PLACEHOLDER_NOTICE);
  check('G3', g3ok, 'placeholder notice for all', JSON.stringify(g3Notices));

  // G4 — settings absent, and each label field blank, still falls back to the fixed
  // hardcoded constants.
  const g4Cases: Array<Record<string, string> | null | undefined> = [
    null,
    undefined,
    { placeholderLabel: '', placeholderNotice: '', researchLabel: '', researchNotice: '' },
    { placeholderLabel: '   ', placeholderNotice: '   ', researchLabel: '   ', researchNotice: '   ' },
  ];
  const g4ok = g4Cases.every((settings) => {
    const n = resolveNotice({ provenance: 'placeholder-ai' }, settings);
    return n !== null && n.label === FALLBACK_PLACEHOLDER_LABEL && n.text === FALLBACK_PLACEHOLDER_NOTICE;
  });
  // Also check the research fallback constants are correct and reachable.
  const g4ResearchOk = (() => {
    const n = resolveNotice({ provenance: 'research' }, null);
    return n !== null && n.label === FALLBACK_RESEARCH_LABEL && n.text === FALLBACK_RESEARCH_NOTICE;
  })();
  check('G4', g4ok && g4ResearchOk, 'fallback constants used', `placeholder=${g4ok} research=${g4ResearchOk}`);

  // G5 — page-level rollup.
  const allClean = resolvePageProvenance([
    { provenance: 'council-supplied', sourcePath: realExistingFile, body: linkedBody },
    { provenance: 'council-supplied', sourcePath: realExistingFile, body: linkedBody },
  ]);
  const oneResearch = resolvePageProvenance([
    { provenance: 'council-supplied', sourcePath: realExistingFile, body: linkedBody },
    { provenance: 'research' },
  ]);
  const onePlaceholder = resolvePageProvenance([
    { provenance: 'council-supplied', sourcePath: realExistingFile, body: linkedBody },
    { provenance: 'research' },
    { provenance: 'placeholder-ai' },
  ]);
  const zeroSections = resolvePageProvenance([]);
  const g5ok =
    allClean === 'council-supplied' &&
    oneResearch === 'research' &&
    onePlaceholder === 'placeholder-ai' &&
    zeroSections === 'placeholder-ai';
  check('G5', g5ok, 'council-supplied/research/placeholder-ai/placeholder-ai', JSON.stringify({ allClean, oneResearch, onePlaceholder, zeroSections }));

  // G6, G7 — rendered output, via the real ShowPageProse component.
  let ShowPageProse: React.ComponentType<{ section: unknown }> | undefined;
  try {
    // Cast through `unknown`: the real component's prop type is the real
    // `ShowPageSection`, but this verifier's fixtures build a structurally-equivalent
    // fake (see fakeSection() below) rather than a genuine one, so the prop type here
    // is deliberately loosened to `unknown` at the call site.
    ShowPageProse = (await import('@/components/nos/ShowPageProse.tsx'))
      .ShowPageProse as unknown as React.ComponentType<{ section: unknown }>;
  } catch (err) {
    console.error('Verifier bug: could not import ShowPageProse:', err);
    record('G6', 'FAIL', 'component failed to import');
    record('G7', 'FAIL', 'component failed to import');
    record('G8', 'FAIL', 'component failed to import');
    return;
  }

  function fakeSection(notice: { label: string; text: string } | null, bodyText: string) {
    const gated = {
      blocks: [
        {
          _type: 'block',
          _key: 'b1',
          style: 'normal',
          markDefs: [],
          children: [{ _type: 'span', _key: 's1', text: bodyText, marks: [] }],
        },
      ],
      notice,
    };
    return {
      sectionKey: 'fixture',
      heading: null,
      kind: 'prose' as const,
      body: gated as unknown,
      notice,
    };
  }

  const placeholderNotice = { label: FALLBACK_PLACEHOLDER_LABEL, text: FALLBACK_PLACEHOLDER_NOTICE };
  const bodyText = 'This is the section body copy.';
  const placeholderSection = fakeSection(placeholderNotice, bodyText);
  const html = renderToStaticMarkup(React.createElement(ShowPageProse, { section: placeholderSection }));
  const noticeIdx = html.indexOf(placeholderNotice.text);
  const bodyIdx = html.indexOf(bodyText);
  const g6ok = noticeIdx !== -1 && bodyIdx !== -1 && noticeIdx < bodyIdx;
  check('G6', g6ok, 'notice before body', `noticeIdx=${noticeIdx} bodyIdx=${bodyIdx}`);

  // G7 — props type has exactly one key. We can't introspect a TS type at runtime, so
  // this is proven by tsc via the fixture file, PLUS a runtime check here that every
  // notice-carrying fixture actually renders its notice text (the second half of G7).
  const researchNotice = { label: FALLBACK_RESEARCH_LABEL, text: FALLBACK_RESEARCH_NOTICE };
  const fixtures = [fakeSection(placeholderNotice, 'body a'), fakeSection(researchNotice, 'body b')];
  const g7RenderOk = fixtures.every((section) => {
    const rendered = renderToStaticMarkup(React.createElement(ShowPageProse, { section }));
    return section.notice !== null && rendered.includes(section.notice.text);
  });
  // The "exactly one key" half is a static claim checked by grepping the source for
  // additional exported prop keys beyond `section`.
  let propsOneKeyOk = false;
  try {
    const src = readFileSync(path.resolve(PROJECT_ROOT, 'components/nos/ShowPageProse.tsx'), 'utf8');
    const match = src.match(/interface\s+ShowPageProseProps\s*\{([\s\S]*?)\}/);
    const body = match?.[1] ?? '';
    const keyLines = body.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('//'));
    propsOneKeyOk = keyLines.length === 1 && /^section\s*:/.test(keyLines[0]);
  } catch {
    propsOneKeyOk = false;
  }
  check('G7', g7RenderOk && propsOneKeyOk, 'exactly one prop (section), notices render', `propsOneKeyOk=${propsOneKeyOk} g7RenderOk=${g7RenderOk}`);

  // G8 — proved by tsc accepting the @ts-expect-error fixture. We assert here only that
  // the fixture file exists and the loader's body is structurally NOT an array (the
  // runtime half of "it is not an array of portable-text blocks").
  const fixtureExists = existsSync(path.resolve(PROJECT_ROOT, 'scripts/checks/fixtures/gated-prose-type-guard.ts'));
  const notArrayOk = !Array.isArray(placeholderSection.body);
  check('G8', fixtureExists && notArrayOk, 'fixture exists and GatedProse is not an array', `fixtureExists=${fixtureExists} notArrayOk=${notArrayOk}`);

  // G10 — the placeholder notice must disclose it is AI-generated, in BOTH the
  // hardcoded fallback constant (checked here directly) and the value the seed script
  // writes to showPageSettings.placeholderNotice (checked by importing the seed
  // script's exported defaults — G4 already pins the exact fallback string; this pins
  // the weaker, more durable property that must survive any rewording).
  const aiDisclosureRe = /\bAI[- ]generated\b/i;
  const fallbackHasDisclosure = aiDisclosureRe.test(FALLBACK_PLACEHOLDER_NOTICE);
  let seedHasDisclosure = false;
  try {
    const seedMod = await import('@/scripts/seed-show-pages.ts');
    seedHasDisclosure = aiDisclosureRe.test(seedMod.SHOW_PAGE_SETTINGS_DEFAULTS?.placeholderNotice ?? '');
  } catch (err) {
    console.error('G10: failed to import scripts/seed-show-pages.ts:', err);
  }
  // G11 — sourcePath containment, driven in BOTH directions (A45). Codex GPT-5.5 found
  // the original implementation accepted any existing path on the machine; a
  // one-directional test (reject-only) would not have caught that, because the bug was
  // that rejection never happened at all. So this exercises one genuine accept AND every
  // rejection shape named in the contract.
  const realAbsolutePathToRealFile = path.resolve(PROJECT_ROOT, realExistingFile);
  const g11Cases: Array<[string, boolean, boolean]> = [
    // [label, expectAccepted (notice === null), actualIsNull]
    ['clean: repo-relative path under content/drive-source/, body actually linked', true, resolveNotice({ provenance: 'council-supplied', sourcePath: realExistingFile, body: linkedBody }) === null],
    ['reject: absolute path to a real in-repo file', false, resolveNotice({ provenance: 'council-supplied', sourcePath: realAbsolutePathToRealFile, body: linkedBody }) === null],
    ['reject: absolute path outside the repo', false, resolveNotice({ provenance: 'council-supplied', sourcePath: '/etc/hosts' }) === null],
    ['reject: traversal with no valid prefix at all', false, resolveNotice({ provenance: 'council-supplied', sourcePath: '../../../etc/hosts' }) === null],
    ['reject: traversal escaping after a valid prefix', false, resolveNotice({ provenance: 'council-supplied', sourcePath: 'content/drive-source/../../../etc/passwd' }) === null],
    ['reject: prefix-lookalike directory', false, resolveNotice({ provenance: 'council-supplied', sourcePath: 'content/drive-source-evil/x.md' }) === null],
    ['reject: nonexistent file under a valid prefix', false, resolveNotice({ provenance: 'council-supplied', sourcePath: 'content/drive-source/does-not-exist-xyz.md' }) === null],
    [
      'reject: same linked body, sourcePath repointed at a different real file in the allowed tree (linkage)',
      false,
      resolveNotice({ provenance: 'council-supplied', sourcePath: differentRealFile, body: linkedBody }) === null,
    ],
  ];
  const g11ok = g11Cases.every(([, expected, actual]) => expected === actual);
  check(
    'G11',
    g11ok,
    'accept clean, reject every containment-bypass shape',
    JSON.stringify(g11Cases.map(([label, expected, actual]) => ({ label, expected, actual }))),
  );

  check(
    'G10',
    fallbackHasDisclosure && seedHasDisclosure,
    'AI-generation disclosure in both the fallback constant and the seed default',
    `fallback=${fallbackHasDisclosure} seed=${seedHasDisclosure}`,
  );

  // G12 (A47) — the GatedProse renderer boundary, proved in both directions. The
  // previous shape of this boundary was an exported `__unsafeUnwrapGatedProse`
  // function with only a doc comment asking people not to import it — QA's
  // cross-model review wrote a probe that imported it from an arbitrary component,
  // discarded the notice, rendered the blocks, and typechecked clean. Three parts:
  //   1. No REAL project file outside the two allowed consumers imports
  //      gated-prose-internal.ts.
  //   2. lib/data/show-pages.ts exports no public "opener" — no export whose name
  //      suggests unwrapping GatedProse.
  //   3. The COMMITTED bypass-probe fixture — a verbatim copy of QA's own probe,
  //      saved as scripts/checks/fixtures/gated-prose-bypass-attempt.tsx.txt so it is
  //      never compiled as project source — MUST be flagged. Committed rather than
  //      read from gitignored .tmp/, or the self-test passes vacuously on a fresh
  //      checkout, having tested nothing.
  const ALLOWED_GATED_PROSE_CONSUMERS = new Set([
    'components/nos/ShowPageProse.tsx',
    'lib/data/show-pages.ts',
  ]);

  function findGatedProseInternalImporters(roots: string[]): string[] {
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of listFilesRecursive(path.resolve(PROJECT_ROOT, root))) {
        if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
        let src: string;
        try {
          src = readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        if (src.includes('gated-prose-internal')) {
          hits.push(path.relative(PROJECT_ROOT, file).split(path.sep).join('/'));
        }
      }
    }
    return hits;
  }

  // This verifier's own source mentions "gated-prose-internal" in prose (this very
  // comment block, for one) without importing it — exclude it from the scan, same as
  // the module's own definition file.
  const VERIFIER_SELF_REL_PATH = 'scripts/checks/verify-show-page-m1.ts';
  const allHits = findGatedProseInternalImporters(['app', 'components', 'lib', 'scripts']);
  const realHits = allHits.filter(
    (rel) => rel !== 'components/nos/gated-prose-internal.ts' && rel !== VERIFIER_SELF_REL_PATH,
  );
  const boundaryClean = realHits.every((rel) => ALLOWED_GATED_PROSE_CONSUMERS.has(rel));

  const openerLikeExportNames = Object.keys(mod).filter((name) => /unwrap|opener/i.test(name));
  const noPublicOpener = openerLikeExportNames.length === 0;

  // The committed fixture reproduces QA's original bypass VERBATIM — it imports
  // `__unsafeUnwrapGatedProse` from '@/lib/data/show-pages', the export name that used
  // to exist and no longer does. Saved as .tsx.txt (never compiled), so "the probe is
  // flagged" is proved by static inspection: extract the names the fixture imports
  // from lib/data/show-pages, and confirm at least one of them is NOT among that
  // module's real, current exports. If it were still exportable, this evaluates false
  // and the whole check fails loud instead of passing vacuously.
  const BYPASS_FIXTURE_REL_PATH = 'scripts/checks/fixtures/gated-prose-bypass-attempt.tsx.txt';
  const bypassFixtureAbsPath = path.resolve(PROJECT_ROOT, BYPASS_FIXTURE_REL_PATH);
  let probeIsFlagged = false;
  let probeImportedNames: string[] = [];
  if (existsSync(bypassFixtureAbsPath)) {
    const fixtureSrc = readFileSync(bypassFixtureAbsPath, 'utf8');
    const importMatch = fixtureSrc.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/data\/show-pages['"]/);
    // Only the VALUE imports matter here — a `type X` import (TS's inline
    // type-import syntax) is erased at compile time and never appears in
    // `Object.keys(mod)` regardless of whether the module still exports it as a
    // value, so comparing a type-only name against the runtime export list would
    // always read as "not found" and make this check trivially, meaninglessly true.
    const valueImportedNames = (importMatch?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('type '));
    probeImportedNames = valueImportedNames;
    const realExportNames = new Set(Object.keys(mod));
    probeIsFlagged =
      valueImportedNames.length > 0 && valueImportedNames.some((name) => !realExportNames.has(name));
  }
  // `probeIsFlagged` stays false (fixture missing counts as FAIL, never a vacuous pass)
  // when the committed fixture is absent — see the check below.

  // Second bypass shape (Codex's cross-model review, second pass): a raw double-cast
  // reaching into GatedProse's opaque shape directly — `section.body as unknown as
  // { blocks: ... }` — imports NOTHING from gated-prose-internal.ts, so the import scan
  // above and the eslint rule have nothing to catch. Detected by scanning real project
  // files for the cast SHAPE itself: `as unknown as` followed by either the internal
  // type's name or an inline object type naming `blocks`. Legitimate occurrences of
  // this exact shape exist ONLY inside gated-prose-internal.ts itself (wrapGatedProse/
  // unwrapGatedProse) — excluded by path, not by pattern, so the detector stays
  // maximally strict everywhere else.
  const CAST_BYPASS_RE = /as\s+unknown\s+as\s*(?:GatedProseInternal\b|\{[^{}]*\bblocks\b[^{}]*\})/;
  const CAST_BYPASS_FIXTURE_REL_PATH = 'scripts/checks/fixtures/gated-prose-cast-bypass-attempt.tsx.txt';

  function findCastBypassOccurrences(roots: string[]): string[] {
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of listFilesRecursive(path.resolve(PROJECT_ROOT, root))) {
        if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
        let src: string;
        try {
          src = readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        if (CAST_BYPASS_RE.test(src)) {
          hits.push(path.relative(PROJECT_ROOT, file).split(path.sep).join('/'));
        }
      }
    }
    return hits;
  }

  const castHits = findCastBypassOccurrences(['app', 'components', 'lib', 'scripts']);
  const realCastHits = castHits.filter((rel) => rel !== 'components/nos/gated-prose-internal.ts');
  const noCastBypass = realCastHits.length === 0;

  const castFixtureAbsPath = path.resolve(PROJECT_ROOT, CAST_BYPASS_FIXTURE_REL_PATH);
  const castFixtureExists = existsSync(castFixtureAbsPath);
  const castProbeIsFlagged = castFixtureExists && CAST_BYPASS_RE.test(readFileSync(castFixtureAbsPath, 'utf8'));

  const g12ok =
    boundaryClean &&
    noPublicOpener &&
    probeIsFlagged &&
    existsSync(bypassFixtureAbsPath) &&
    noCastBypass &&
    castFixtureExists &&
    castProbeIsFlagged;
  check(
    'G12',
    g12ok,
    'boundary clean (imports + casts), no public opener, both committed bypass fixtures exist and ARE flagged',
    JSON.stringify({
      realHits,
      boundaryClean,
      noPublicOpener,
      openerLikeExportNames,
      fixtureExists: existsSync(bypassFixtureAbsPath),
      probeImportedNames,
      probeIsFlagged,
      realCastHits,
      noCastBypass,
      castFixtureExists,
      castProbeIsFlagged,
    }),
  );
}

// ===========================================================================
// D — drive recovery tree
// ===========================================================================

const RECOVERY_ENTRIES = [
  { dir: '13-booking-tickets/ticketing', specPage: 13 },
  { dir: '13-booking-tickets/vendor-form', specPage: 13 },
  { dir: '06-saoc-symposium/theme', specPage: 6 },
  { dir: '17-faq/faq', specPage: 17 },
] as const;

const RECOVERY_METHODS = ['manual-salvage-from-zip-headers', 'manual-docx-extract', 'unsafe-drive-path-workaround'];

type SupersessionStatus = 'match' | 'superseded' | 'no-manifest';

// The actual comparison D3/A20 promises: "report whether a matching drive-source
// manifest's md5 still equals the recovery entry's sourceMd5". Pulled out as a pure
// function so the check below can drive it directly with synthetic fixtures, not only
// against the real corpus — which today has zero live 'superseded' cases (none of the
// four recovered documents has a real drive-source counterpart yet), so a check that
// only ever ran the real corpus would never actually exercise its own mismatch branch.
// Codex's cross-model review found exactly that: the previous D3 only ever asked "did
// the scan throw", never "does the comparison discriminate match from superseded".
function checkSupersession(recoveryMd5: string, manifestMd5: string | undefined): SupersessionStatus {
  if (!manifestMd5) return 'no-manifest';
  return manifestMd5 === recoveryMd5 ? 'match' : 'superseded';
}

function runDriveRecoveryChecks(): void {
  const base = path.resolve(PROJECT_ROOT, 'content/drive-recovered');

  // D1
  const d1ok = RECOVERY_ENTRIES.every((entry) => {
    const dir = path.join(base, entry.dir);
    return existsSync(path.join(dir, 'content.md')) && existsSync(path.join(dir, 'recovery.json'));
  });
  check('D1', d1ok, 'all 4 content.md + recovery.json pairs exist', d1ok ? 'all present' : 'one or more missing');

  // D2
  let d2ok = true;
  const parsed: Array<{ entry: (typeof RECOVERY_ENTRIES)[number]; json: RecoveryJson }> = [];
  for (const entry of RECOVERY_ENTRIES) {
    try {
      const raw = readFileSync(path.join(base, entry.dir, 'recovery.json'), 'utf8');
      const json = JSON.parse(raw);
      parsed.push({ entry, json });
      const ok =
        Number.isInteger(json.specPage) &&
        json.specPage >= 1 &&
        json.specPage <= 18 &&
        typeof json.sourceDrivePath === 'string' &&
        json.sourceDrivePath.length > 0 &&
        typeof json.sourceMd5 === 'string' &&
        /^[0-9a-f]{32}$/.test(json.sourceMd5) &&
        RECOVERY_METHODS.includes(json.method) &&
        typeof json.recoveredAt === 'string' &&
        !Number.isNaN(Date.parse(json.recoveredAt)) &&
        typeof json.recoveredBy === 'string' &&
        Object.prototype.hasOwnProperty.call(json, 'supersededBy');
      if (!ok) d2ok = false;
    } catch (err) {
      d2ok = false;
      console.error(`D2: failed to parse recovery.json for ${entry.dir}:`, err);
    }
  }
  check('D2', d2ok, 'every recovery.json well-formed', d2ok ? 'all well-formed' : 'one or more malformed');

  // D3 — supersession reporting, proved two ways. (1) A synthetic unit test drives
  // checkSupersession() directly against all three states — match, superseded,
  // no-manifest — so the comparison itself is proven correct independent of what the
  // live corpus happens to contain today (zero real 'superseded' cases). (2) The real
  // corpus is still scanned end-to-end, and a live superseded entry (never silently
  // kept) is treated as a genuine FAIL, not merely logged — this project already has a
  // "reported, not silent" defect class named after it (D3's own description) and a
  // check that only asked "did the scan throw" would repeat it.
  const supersessionUnitOk =
    checkSupersession('abc123', 'abc123') === 'match' &&
    checkSupersession('abc123', 'def456') === 'superseded' &&
    checkSupersession('abc123', undefined) === 'no-manifest';

  let d3ScanOk = true;
  const d3Superseded: string[] = [];
  try {
    const driveSourceRoot = path.resolve(PROJECT_ROOT, 'content/drive-source');
    for (const { entry, json } of parsed) {
      const baseName = path.basename(String(json.sourceDrivePath ?? ''));
      const manifest = findManifestByOriginalName(driveSourceRoot, baseName);
      const status = checkSupersession(String(json.sourceMd5 ?? ''), manifest?.md5_checksum);
      if (status === 'superseded') {
        d3Superseded.push(
          `${entry.dir}: drive-source md5 ${manifest?.md5_checksum} != recovery sourceMd5 ${json.sourceMd5}`,
        );
      }
    }
  } catch (err) {
    d3ScanOk = false;
    console.error('D3: supersession scan failed:', err);
  }
  // A live superseded entry means a real Drive re-export has landed and the
  // hand-salvaged recovery.json is now stale — resolving it (repointing sourcePath,
  // setting supersededBy) is the deliberate human step drive-recovery.golden.md
  // describes, not something this gate should paper over as a pass.
  const d3ok = supersessionUnitOk && d3ScanOk && d3Superseded.length === 0;
  check(
    'D3',
    d3ok,
    'checkSupersession discriminates match/superseded/no-manifest, and no live entry is superseded',
    JSON.stringify({ supersessionUnitOk, d3ScanOk, d3Superseded }),
  );

  // D5
  let recoveryTreeText = '';
  try {
    for (const entry of RECOVERY_ENTRIES) {
      recoveryTreeText += readFileSync(path.join(base, entry.dir, 'content.md'), 'utf8');
    }
  } catch {
    /* handled by d1 */
  }
  const d5ok =
    recoveryTreeText.includes('Stellenbosch Flying Club') &&
    recoveryTreeText.includes('From Wild Origins to Cultivated Excellence');
  check('D5', d5ok, 'both fixed facts present', d5ok ? 'both present' : 'one or both missing');

  // D6 — the council's venue sentence survives verbatim. The recovery tree must carry
  // the exact string, and any seed section that quotes the venue by name must reproduce
  // the whole sentence character-for-character rather than paraphrase around it (the
  // defect this check exists to catch directly, per verifier-contract.golden.md).
  const VENUE_SENTENCE = 'Stellenbosch Flying Club, R44 northbound to Stellenbosch.';
  const recoveryHasVenueSentence = recoveryTreeText.includes(VENUE_SENTENCE);

  let seedVenueOk = true;
  const seedVenueFailures: string[] = [];
  try {
    const seedFiles = existsSync(SHOW_PAGES_DIR)
      ? readdirSync(SHOW_PAGES_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
      : [];
    for (const file of seedFiles) {
      const doc = JSON.parse(readFileSync(path.join(SHOW_PAGES_DIR, file), 'utf8'));
      const bodyText = JSON.stringify(doc);
      if (bodyText.includes('Stellenbosch Flying Club') && !bodyText.includes(VENUE_SENTENCE)) {
        seedVenueOk = false;
        seedVenueFailures.push(file);
      }
    }
  } catch (err) {
    seedVenueOk = false;
    seedVenueFailures.push(`scan error: ${(err as Error).message}`);
  }

  const d6ok = recoveryHasVenueSentence && seedVenueOk;
  check(
    'D6',
    d6ok,
    `recovery tree contains "${VENUE_SENTENCE}" and every quoting seed section reproduces it verbatim`,
    `recoveryHasVenueSentence=${recoveryHasVenueSentence} seedVenueFailures=${seedVenueFailures.join(',')}`,
  );
}

function findManifestByOriginalName(root: string, originalName: string): RecoveryManifest | null {
  if (!originalName || !existsSync(root)) return null;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (entry === 'manifest.json') {
        try {
          const manifest = JSON.parse(readFileSync(full, 'utf8'));
          if (manifest.name === originalName) return manifest;
        } catch {
          /* ignore unparsable manifest */
        }
      }
    }
  }
  return null;
}

// ===========================================================================
// P — the seed corpus
// ===========================================================================

const SHOW_PAGES_DIR = path.resolve(PROJECT_ROOT, 'content/show-pages');
const EXPECTED_SPEC_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18];

// P6 — "and why the first version was broken" (verifier-contract.golden.md). The
// original /\bR\s?\d{2,4}\b/ matched R44, the national road the venue sits on, and made
// the council's own venue sentence unpublishable. Two fixes: (1) scope this check to
// copy WE generated — council-supplied sections are exempt, because we police our own
// words, not the client's; (2) discriminate an actual price from a route designation in
// the copy we do police.
const PRICE_CANDIDATE_RE = /\bR\s?\d{1,3}(?:[ ,]?\d{3})*(?:\.\d{2})?\b/g;
const ROUTE_KEYWORD_RE =
  /^\W{0,3}(northbound|southbound|eastbound|westbound|highway|freeway|motorway|route|road|off-?ramp|on-?ramp|turn-?off|toward|towards|exit)\b/i;
const ROUTE_ALLOWLIST = new Set(['R44', 'R45', 'R101', 'R102', 'R304', 'R310', 'N1', 'N2', 'N7', 'M3']);
const ROUTE_LOOKAHEAD_CHARS = 30;

// True when `text` contains a genuine, unconfirmed rand price — a decimal part is
// decisive ("R44.00" is a price no matter what follows); otherwise a route keyword
// within the lookahead window, or a known SA route designation, makes it not a price.
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

function loadSeedCorpus(): Array<{ file: string; doc: SeedPageDoc }> {
  if (!existsSync(SHOW_PAGES_DIR)) return [];
  // Underscore-prefixed files (e.g. _name-allowlist.json, M3's checker data file) are
  // NOT page documents — same convention the M3 verifier uses. Excluding them here is
  // what keeps P1/P2/D6 reading the real 17-page corpus instead of an 18th non-page file.
  return readdirSync(SHOW_PAGES_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((file) => ({ file, doc: JSON.parse(readFileSync(path.join(SHOW_PAGES_DIR, file), 'utf8')) }));
}

async function runSeedCorpusChecks(): Promise<void> {
  const corpus = loadSeedCorpus();

  // P1
  const specNumbers = corpus.map(({ doc }) => doc.specNumber ?? -1).sort((a, b) => a - b);
  const p1ok =
    corpus.length === 17 && JSON.stringify(specNumbers) === JSON.stringify(EXPECTED_SPEC_NUMBERS);
  check('P1', p1ok, `17 files, specNumbers ${EXPECTED_SPEC_NUMBERS.join(',')}`, `${corpus.length} files, specNumbers ${specNumbers.join(',')}`);

  // P2
  const pageKeys = corpus.map(({ doc }) => doc.pageKey);
  const p2ok =
    corpus.every(({ file, doc }) => {
      const stem = file.replace(/\.json$/, '');
      return /^[0-9]{2}-[a-z0-9-]+$/.test(doc.pageKey ?? '') && doc.pageKey === stem;
    }) && new Set(pageKeys).size === pageKeys.length;
  check('P2', p2ok, 'pageKey matches format and filename stem, all distinct', p2ok ? 'ok' : 'mismatch found');

  // P3 — also asserts sections.length >= 1 per page. Codex's cross-model review found
  // the earlier version passed vacuously for `sections: []` (every() over an empty
  // array is true by definition), while scripts/seed-show-pages.ts:220 would still
  // write that empty page straight through the Sanity API — bypassing Studio's own
  // `sections` min(1) validation, which only ever runs inside Studio's UI, never
  // against an API write.
  const validProvenance = new Set(['council-supplied', 'research', 'placeholder-ai']);
  const p3Failures: string[] = [];
  const p3ok = corpus.every(({ file, doc }) => {
    const sections = doc.sections ?? [];
    if (sections.length === 0) {
      p3Failures.push(`${file}: zero sections`);
      return false;
    }
    const sectionKeys = sections.map((s) => s.sectionKey);
    const uniqueOk = new Set(sectionKeys).size === sectionKeys.length;
    const provenanceOk = sections.every((s) => validProvenance.has(s.provenance ?? ''));
    if (!uniqueOk) p3Failures.push(`${file}: duplicate sectionKey`);
    if (!provenanceOk) p3Failures.push(`${file}: invalid provenance value`);
    return uniqueOk && provenanceOk;
  });
  check('P3', p3ok, 'sections.length >= 1, valid provenance, unique sectionKey per page', p3Failures.join('; '));

  // P4 — HONESTY CHECK. Reuses the REAL resolveNotice() from lib/data/show-pages.ts
  // rather than a second, separately-maintained prefix+existence check: Codex's
  // cross-model review found the verifier's own hand-rolled version here accepted
  // "content/drive-source/../../package.json" (a prefix-lookalike string test, not
  // real containment) even after the loader's equivalent check had already been
  // hardened with realpathSync()-based containment (G11). Two implementations of the
  // same property drift; one implementation, called from two places, cannot.
  let p4ok = true;
  const p4Failures: string[] = [];
  try {
    const { resolveNotice } = await import('@/lib/data/show-pages.ts');
    for (const { file, doc } of corpus) {
      for (const section of doc.sections ?? []) {
        if (section.provenance !== 'council-supplied') continue;
        const notice = resolveNotice({
          provenance: section.provenance,
          sourcePath: section.sourcePath,
          kind: section.kind,
          body: section.body,
        });
        if (notice !== null) {
          p4ok = false;
          p4Failures.push(`${file}/${section.sectionKey}: sourcePath=${JSON.stringify(section.sourcePath)} did not resolve clean`);
        }
      }
    }
  } catch (err) {
    p4ok = false;
    p4Failures.push(`could not import lib/data/show-pages.ts: ${(err as Error).message}`);
  }
  check('P4', p4ok, 'every council-supplied section resolves clean through the real resolveNotice()', p4Failures.join('; '));

  // P6 — scoped to sections WE generated (research/placeholder-ai). council-supplied
  // sections are exempt: we police our own words, never the client's. See the
  // containsRandPrice()/PRICE_CANDIDATE_RE comment above for why the regex changed.
  let p6ok = true;
  const p6Failures: string[] = [];
  for (const { file, doc } of corpus) {
    for (const section of doc.sections ?? []) {
      if (section.provenance === 'council-supplied') continue;
      const text = JSON.stringify(section.body ?? []);
      if (containsRandPrice(text)) {
        p6ok = false;
        p6Failures.push(`${file}/${section.sectionKey}`);
      }
    }
  }
  check('P6', p6ok, 'no rand price token in any section we generated', p6Failures.join(', '));

  // P7 — "home" as a whole word (case-insensitive), so a legitimate title like
  // "Homegrown Orchids" is not forced to change.
  const noEntry14 = !corpus.some(({ doc }) => doc.pageKey?.startsWith('14-'));
  const noHome = !corpus.some(
    ({ doc }) => /\bhome\b/i.test(String(doc.pageKey ?? '')) || /\bhome\b/i.test(String(doc.title ?? '')),
  );
  const p7ok = noEntry14 && noHome;
  check('P7', p7ok, 'no entry-14 source, no "home" in pageKey/title', `noEntry14=${noEntry14} noHome=${noHome}`);
}

// ===========================================================================
// R — the route map
// ===========================================================================

function runRouteMapChecks(): void {
  const untouchableDirs = ['tickets', 'vendors', 'archive', 'upcoming'];
  let r2ok = true;
  const r2Failures: string[] = [];
  for (const dir of untouchableDirs) {
    const relDir = `app/(marketing)/national-show/${dir}`;
    let diffOutput = '';
    try {
      diffOutput = execSync(`git diff --name-only HEAD -- "${relDir}"`, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      }).trim();
    } catch (err) {
      r2ok = false;
      r2Failures.push(`${dir}: git diff failed (${(err as Error).message})`);
      continue;
    }
    if (diffOutput.length > 0) {
      r2ok = false;
      r2Failures.push(`${dir}: modified — ${diffOutput}`);
    }
  }
  check('R2', r2ok, 'tickets/vendors/archive/upcoming unmodified against HEAD', r2Failures.join('; '));

  // R5 — no colour/font-family/border-radius/box-shadow literal in any .tsx under
  // app/(marketing)/national-show/. nos-theme.css is the token layer itself and is
  // exempt by construction (it is not a .tsx file).
  const nosRoot = path.resolve(PROJECT_ROOT, 'app/(marketing)/national-show');
  const tsxFiles = listFilesRecursive(nosRoot).filter((f) => f.endsWith('.tsx'));
  const literalRe = /(#[0-9a-fA-F]{3,8}\b)|font-family\s*:|border-radius\s*:|box-shadow\s*:|\[(?:#|rgb\(|hsl\()/;
  let r5ok = true;
  const r5Failures: string[] = [];
  for (const file of tsxFiles) {
    let src = '';
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (literalRe.test(src)) {
      r5ok = false;
      r5Failures.push(path.relative(PROJECT_ROOT, file));
    }
  }
  check('R5', r5ok, 'no invented brand-asset literals under app/(marketing)/national-show/*.tsx', r5Failures.join(', '));

  // R1, R3, R4 — M4 build checks. The routes do not exist yet at M1.
  skip('R1', 'M4 build check — routes are not built yet at M1');
  skip('R3', 'M4 build check — nav wiring happens at M4');
  skip('R4', 'M4 build check — nav wiring happens at M4');
}

function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

// ===========================================================================
// N — the seed script's safety properties
// ===========================================================================

async function runSeedScriptChecks(): Promise<void> {
  let mod: SeedScriptModule;
  try {
    mod = (await import('@/scripts/seed-show-pages.ts')) as unknown as SeedScriptModule;
  } catch (err) {
    console.error('N1: failed to import scripts/seed-show-pages.ts without credentials:', err);
    record('N1', 'FAIL', 'module failed to import without Sanity credentials');
    record('N2', 'FAIL', 'module failed to import');
    record('N3', 'FAIL', 'module failed to import');
    return;
  }

  const { decideSectionAction, hashBody } = mod;
  const n1ok = typeof decideSectionAction === 'function' && typeof hashBody === 'function';
  check('N1', n1ok, 'decideSectionAction and hashBody exported as functions', `decideSectionAction=${typeof decideSectionAction} hashBody=${typeof hashBody}`);

  if (!n1ok) {
    record('N2', 'FAIL', 'cannot drive decideSectionAction — not exported');
    record('N3', 'FAIL', 'cannot drive hashBody — not exported');
    return;
  }

  const seedSection = { sectionKey: 'x', provenance: 'placeholder-ai', body: [{ a: 1 }] };
  const bodyA = { a: 1, b: 2 };
  const hashA = hashBody(bodyA);
  const bodyB = { a: 1, b: 3 };

  const rows: Array<{
    label: string;
    seedSection: SeedSectionDoc | null;
    existing: { body: unknown; seedHash?: string | null } | null;
    expected: string;
  }> = [
    { label: 'create', seedSection, existing: null, expected: 'create' },
    { label: 'update', seedSection, existing: { body: bodyA, seedHash: hashA }, expected: 'update' },
    { label: 'skip-edited', seedSection, existing: { body: bodyB, seedHash: hashA }, expected: 'skip-edited' },
    { label: 'skip-unknown-origin (null)', seedSection, existing: { body: bodyA, seedHash: null }, expected: 'skip-unknown-origin' },
    { label: 'skip-unknown-origin (empty)', seedSection, existing: { body: bodyA, seedHash: '' }, expected: 'skip-unknown-origin' },
    { label: 'leave-extra', seedSection: null, existing: { body: bodyA, seedHash: hashA }, expected: 'leave-extra' },
  ];

  let n2ok = true;
  const n2Failures: string[] = [];
  for (const row of rows) {
    const actual = decideSectionAction(row.seedSection, row.existing);
    if (actual !== row.expected) {
      n2ok = false;
      n2Failures.push(`${row.label}: expected ${row.expected}, got ${actual}`);
    }
  }
  check('N2', n2ok, 'all six decision-table rows match', n2Failures.join('; '));

  const reordered = { b: 2, a: 1 };
  const n3ok = hashBody(bodyA) === hashBody(reordered);
  check('N3', n3ok, 'hash stable under key reordering', `hashBody(bodyA)=${hashBody(bodyA)} hashBody(reordered)=${hashBody(reordered)}`);
}

main().catch((err) => {
  console.error('Verifier crashed:', err);
  try {
    writeResults();
  } catch {
    /* best effort */
  }
  process.exit(2);
});

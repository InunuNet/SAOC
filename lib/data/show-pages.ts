import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

import type { PortableTextBlock } from '@portabletext/react';
import type { SanityImageSource } from '@sanity/image-url';

import { sanityFetch } from '@/sanity/lib/fetch';
import { wrapGatedProse } from '@/components/nos/gated-prose-internal';
import { wrapShowPageResult } from '@/components/show/nos/show-content-state-internal';

// F3 (national-show-ia-alignment, M1) — THE GATE.
//
// See:
//   .agent/memory/project/specs/national-show-ia-alignment/goldens/m1/provenance-gate.golden.md
//   .agent/memory/project/specs/national-show-ia-alignment/goldens/m1/page-contract.golden.md
//
// This module is the ONLY place a `showPage` document may be read through. It hands
// section prose to callers only as an opaque `GatedProse` value — never as a plain
// array of portable-text blocks — so there is no un-noticed form of the copy for a page
// template to render by mistake. `components/nos/ShowPageProse.tsx` is the only module
// permitted to unwrap it.
//
// `resolveNotice()` fails LOUD: the notice is suppressed only by an affirmative,
// file-verified `council-supplied` section. Every other state — a legacy value, a typo,
// a missing settings singleton, an unimplemented M2 section kind — notifies. Mirrors the
// fails-closed house style of `lib/admin-auth.ts`.

// F20 (national-show-ia-alignment, M4) adds 'council-draft' — the council's own words,
// not yet finished. 'council-supplied' conflated "whose words these are" with "whether
// they are finished", which let an unfilled FAQ template render as finished copy with
// no notice. See goldens/m4/council-draft-provenance.golden.md. The fourth value widens
// what NOTIFIES; it never widens what SUPPRESSES — only 'council-supplied' with a
// resolving sourcePath suppresses the notice, exactly as before.
export type Provenance = 'council-supplied' | 'council-draft' | 'research' | 'placeholder-ai';

// `tone` drives R11's token choice (goldens/m4/r11-disclosure.golden.md): 'warning' for
// AI-generated placeholder copy, 'muted' for the two quieter states — researched-but-
// unconfirmed and an unfinished council draft. NEVER 'error' — an unwritten page is not
// a fault. Carried on the notice itself so the renderer never re-derives it from
// provenance and cannot drift from the classification that produced the notice text.
export type ShowPageNoticeTone = 'warning' | 'muted';

export type ShowPageNotice = { label: string; text: string; tone: ShowPageNoticeTone };

// Opaque brand. There is no value of this type anyone outside this module can construct
// or destructure through the type system alone — the only legitimate way to get useful
// content out of it is through components/nos/ShowPageProse.tsx, which (along with this
// module, for the wrap side) is the only file permitted to import
// components/nos/gated-prose-internal.ts. Passing this to a portable-text renderer
// directly is a compile error, on purpose (see
// scripts/checks/fixtures/gated-prose-type-guard.ts).
//
// The wrap/unwrap functions themselves do NOT live in this file and are NOT exported
// from here — see gated-prose-internal.ts's header comment for why. A prior version of
// this module exported an unwrap function directly, and QA's cross-model review found
// that a second file could import it and render section copy with no notice, entirely
// undetected by the type system. Moving the escape hatch to its own module, with an
// eslint import restriction limiting who may reach it, is what actually closes that —
// the type brand alone never did. Be precise about what this buys: it is enforced by
// lint and a grep guard, not by the type system, so it stops accidental and
// lint-checked misuse, not a deliberate rewrite of the enforcement itself. See
// provenance-gate.golden.md's "what this does NOT prevent" list.
export type GatedProse = { readonly __gated: unique symbol };

export type ShowPageSectionKind = 'prose' | 'entityList' | 'programme';

export type ShowPageSection = {
  sectionKey: string;
  heading: string | null;
  kind: ShowPageSectionKind;
  body: GatedProse;
  notice: ShowPageNotice | null;
};

// Minimal local alias — this project has no shared `SanityImage` export; seoImage is
// whatever @sanity/image-url's builder accepts, narrowed to null when unset.
export type SanityImage = SanityImageSource;

export type ShowPage = {
  pageKey: string;
  specNumber: number;
  title: string;
  summary: string | null;
  sections: ShowPageSection[];
  pageProvenance: Provenance;
  notice: ShowPageNotice | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImage: SanityImage | null;
  // F24 (national-show-ia-alignment, M4) — the single source of truth the
  // data-nos-content-state marker is derived from. Absent/false on every real document;
  // true only on a value buildAbsentShowPage() constructed. See
  // goldens/m4/never-404-fallback.golden.md.
  isFallback?: boolean;
};

// F24 — opaque result of loadShowPageOrFallback(). There is no way through the type
// system for a route module to reach `.sections`, `.title` or `.isFallback` on this
// value — the single component permitted to open it is
// components/show/nos/ShowContentState.tsx, via
// components/show/nos/show-content-state-internal.ts's unwrap side (that module's wrap
// side is called below, in loadShowPageOrFallback, and never re-exported). Same
// opaque-brand + eslint `no-restricted-imports` + grep-guard idiom as GatedProse above —
// not a new enforcement mechanism. See never-404-fallback.golden.md's "The marker must
// be STRUCTURAL, not author-remembered".
export type ShowPageResult = { readonly __showPageResult: unique symbol };

// ---------------------------------------------------------------------------
// Fixed fallback wording — must match the seed defaults in
// scripts/seed-show-pages.ts and provenance-gate.golden.md verbatim. A missing or
// blank showPageSettings singleton falls back to these; it must never fall back to
// silence.
// ---------------------------------------------------------------------------

export const FALLBACK_PLACEHOLDER_LABEL = 'Placeholder copy';
export const FALLBACK_PLACEHOLDER_NOTICE =
  'This text is an AI-generated placeholder. It has not been written or approved by the ' +
  'South African Orchid Council, and it may be inaccurate. Final copy is still to be ' +
  'supplied by the Council.';
export const FALLBACK_RESEARCH_LABEL = 'Not yet confirmed';
export const FALLBACK_RESEARCH_NOTICE =
  'This information was researched by the web team and has not yet been confirmed by the ' +
  'South African Orchid Council.';
export const FALLBACK_DRAFT_LABEL = 'Council draft';
export const FALLBACK_DRAFT_NOTICE =
  'This text was supplied by the South African Orchid Council and is still a working draft. ' +
  'It may be incomplete or may change before the show.';

export type ShowPageSettingsFields = {
  placeholderLabel?: string | null;
  placeholderNotice?: string | null;
  researchLabel?: string | null;
  researchNotice?: string | null;
  draftLabel?: string | null;
  draftNotice?: string | null;
};

function nonBlank(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function buildNotice(
  kind: 'research' | 'placeholder' | 'draft',
  settings: ShowPageSettingsFields | null | undefined,
): ShowPageNotice {
  if (kind === 'research') {
    return {
      label: nonBlank(settings?.researchLabel) ?? FALLBACK_RESEARCH_LABEL,
      text: nonBlank(settings?.researchNotice) ?? FALLBACK_RESEARCH_NOTICE,
      tone: 'muted',
    };
  }
  if (kind === 'draft') {
    return {
      label: nonBlank(settings?.draftLabel) ?? FALLBACK_DRAFT_LABEL,
      text: nonBlank(settings?.draftNotice) ?? FALLBACK_DRAFT_NOTICE,
      tone: 'muted',
    };
  }
  return {
    label: nonBlank(settings?.placeholderLabel) ?? FALLBACK_PLACEHOLDER_LABEL,
    text: nonBlank(settings?.placeholderNotice) ?? FALLBACK_PLACEHOLDER_NOTICE,
    tone: 'warning',
  };
}

// The only two trees a council source may live under. Anything else — an absolute
// path, a traversal, or a path that merely starts with the right-looking prefix string
// — is not a council document, no matter what the field claims.
const ALLOWED_SOURCE_ROOTS = ['content/drive-source', 'content/drive-recovered'] as const;

// Cheap, string-only well-formedness check: no absolute path, no ".." segment anywhere,
// and the value must start with one of the two allowed prefixes. This mirrors
// sanity/schemas/objects/showPageSection.ts's `isWellFormedSourcePath` — the schema
// rejects a malformed path at entry in Studio, this function rejects it again at
// render. Neither one trusts the other.
function isWellFormedSourcePath(value: string): boolean {
  if (path.isAbsolute(value)) return false;
  if (value.split(/[\\/]/).some((segment) => segment === '..')) return false;
  return ALLOWED_SOURCE_ROOTS.some((root) => value === root || value.startsWith(`${root}/`));
}

// Resolves a repo-relative sourcePath against the project root and checks it names a
// real file — with resolved-path containment, not a string-prefix test. A sourcePath
// of "content/drive-source/../../etc/hosts" starts with the right-looking prefix and
// would pass a naive `startsWith` check; `realpathSync` collapses that back to
// `/etc/hosts`, which fails containment against either allowed root's own realpath.
// This is what closes the "any existing path on the machine suppresses the notice"
// hole Codex's cross-model review found — see .agent/memory/scratch/dev-result-national-show-ia-alignment.md.
//
// Deliberately synchronous fs access — the loader runs server-side only (Server
// Components, API routes), never in a browser bundle.
function sourceFileExists(sourcePath: string | null | undefined): boolean {
  if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0) return false;
  if (!isWellFormedSourcePath(sourcePath)) return false;

  const resolved = path.resolve(process.cwd(), sourcePath);
  if (!existsSync(resolved)) return false;

  let resolvedReal: string;
  try {
    resolvedReal = realpathSync(resolved);
  } catch {
    return false;
  }

  const contained = ALLOWED_SOURCE_ROOTS.some((root) => {
    const rootAbs = path.resolve(process.cwd(), root);
    let rootReal: string;
    try {
      rootReal = realpathSync(rootAbs);
    } catch {
      return false;
    }
    return resolvedReal === rootReal || resolvedReal.startsWith(rootReal + path.sep);
  });
  if (!contained) return false;

  try {
    return statSync(resolvedReal).isFile();
  } catch {
    return false;
  }
}

// --- linkage: does the rendered body actually occur in the named source? -----------
//
// sourceFileExists() answers "does an allowed file exist at this path" — it says
// nothing about whether the WORDS being rendered came from that file. Codex's
// cross-model review found that gap: a section can claim `council-supplied`, name any
// real file under an allowed tree, and render invented copy with the notice
// suppressed, because nothing checked the second half of the claim.
//
// Plain-text extraction from portable-text blocks, ignoring block type/marks/formatting
// — this is a content-linkage check, not a renderer.
function extractPlainText(body: unknown): string {
  if (!Array.isArray(body)) return '';
  return body
    .map((block) => {
      const children = (block as { children?: unknown })?.children;
      if (!Array.isArray(children)) return '';
      return children
        .map((child) => {
          const text = (child as { text?: unknown })?.text;
          return typeof text === 'string' ? text : '';
        })
        .join('');
    })
    .join('\n');
}

// Casefold, strip everything but letters/digits/whitespace, collapse whitespace. Both
// sides of the comparison go through this — it absorbs smart-quote/straight-quote
// differences, WordprocessingML noise adjacent to real text, and markdown punctuation,
// without needing to know which specific noise a given source file carries.
function normalizeForLinkage(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// The threshold: ~4-5 English words after normalisation. Chosen at the SENTENCE grain,
// not the whole-block grain, because a legitimate quotation authored by condensing a
// source paragraph (dropping a sentence in the middle, keeping the rest verbatim) is
// still an honest quotation — checking the whole block as one contiguous run would
// reject that as a false negative. 25 normalized characters is short enough that every
// genuine sentence-length quote in this corpus clears it, and long enough that a
// coincidental match against unrelated source text is implausible — a bare "the show"
// (8 chars) would match nearly anything; a real sentence fragment does not.
const MIN_LINKAGE_SENTENCE_CHARS = 25;

// True only when every sentence in `body` long enough to test meaningfully occurs, as a
// contiguous normalised run, somewhere in the normalised source text. A body with NO
// sentence long enough to test (all short fragments) fails rather than passing
// vacuously — the same "no default counts as permission" rule as everywhere else in
// this gate.
function bodyLinkedToSource(body: unknown, sourceText: string): boolean {
  const normalizedSource = normalizeForLinkage(sourceText);
  const meaningfulSentences = splitIntoSentences(extractPlainText(body))
    .map(normalizeForLinkage)
    .filter((s) => s.length >= MIN_LINKAGE_SENTENCE_CHARS);
  if (meaningfulSentences.length === 0) return false;
  return meaningfulSentences.every((sentence) => normalizedSource.includes(sentence));
}

// Reads the source file's text for linkage comparison. Only ever called after
// sourceFileExists() has already confirmed containment and existence, so this does not
// repeat those checks — it is not a substitute for sourceFileExists(), only usable
// after it.
function readSourceTextForLinkage(sourcePath: string): string | null {
  try {
    return readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8');
  } catch {
    return null;
  }
}

export type SectionProvenanceInput = {
  provenance?: string | null;
  sourcePath?: string | null;
  kind?: string | null;
  body?: unknown;
};

type SectionClass = 'clean' | 'research' | 'placeholder' | 'draft';

// The single fail-loud decision, shared by resolveNotice() (per-section) and
// resolvePageProvenance() (page-level rollup) so the two can never disagree about what
// counts as clean. The `switch` has an explicit `default` — never a fallthrough.
// `kind` values M1 actually implements as prose. Anything else — 'entityList',
// 'programme', a future value, a typo, a hand-written Sanity API write — must notify.
// This is an ALLOWLIST deliberately, not a denylist of the two known M2 values: Codex's
// cross-model review found the denylist form let an unrecognised kind (e.g.
// "futureKind") fall through to the provenance switch below and render clean whenever
// provenance happened to be a verified council-supplied — an unimplemented section type
// has no confirmed content to show, regardless of what its provenance field claims.
const PROSE_LIKE_KINDS = new Set<string | null | undefined>(['prose', null, undefined]);

function classifySection(input: SectionProvenanceInput): SectionClass {
  if (!PROSE_LIKE_KINDS.has(input.kind)) {
    // Any kind M1 doesn't implement as prose — including 'entityList', 'programme',
    // and anything not yet invented. M1 has nothing confirmed to show for any of them.
    return 'placeholder';
  }
  switch (input.provenance) {
    case 'council-supplied': {
      if (!sourceFileExists(input.sourcePath)) return 'placeholder';
      // input.sourcePath is a string here — sourceFileExists() returned true.
      const sourceText = readSourceTextForLinkage(input.sourcePath as string);
      if (sourceText === null) return 'placeholder';
      return bodyLinkedToSource(input.body, sourceText) ? 'clean' : 'placeholder';
    }
    case 'council-draft': {
      // Still her words, just not finished — this NEVER reaches 'clean', so it always
      // notifies regardless of the linkage outcome (CD2: the fourth value widens what
      // notifies, never what suppresses). But the same linkage check still runs
      // (CL3c — the guarded provenance set is council-supplied AND council-draft, never
      // narrowed to one): a "council-draft" claim over invented text is exactly the
      // provenance lie this project has already audited, just in the opposite
      // direction, and the check must not skip it merely because this value can never
      // suppress. A section that fails linkage is demoted to 'placeholder' — the same
      // fallback council-supplied takes on failure.
      if (!sourceFileExists(input.sourcePath)) return 'placeholder';
      const sourceText = readSourceTextForLinkage(input.sourcePath as string);
      if (sourceText === null) return 'placeholder';
      return bodyLinkedToSource(input.body, sourceText) ? 'draft' : 'placeholder';
    }
    case 'research':
      return 'research';
    case 'placeholder-ai':
      return 'placeholder';
    default:
      // null, undefined, '', or any unrecognised string (legacy doc, typo, future
      // value). Silence is never a default and never a fallback.
      return 'placeholder';
  }
}

/**
 * Resolves the notice for one section. Returns `null` ONLY for a `council-supplied`
 * section whose `sourcePath` resolves to a file that exists on disk — the single
 * suppressing state in the whole gate. Every other input notifies.
 */
export function resolveNotice(
  input: SectionProvenanceInput,
  settings?: ShowPageSettingsFields | null,
): ShowPageNotice | null {
  const cls = classifySection(input);
  if (cls === 'clean') return null;
  return buildNotice(cls, settings);
}

/**
 * Page-level rollup. Derived and never stored — a stored rollup can drift out of sync
 * with the sections it summarises. Zero sections rolls up to 'placeholder-ai', not to
 * 'council-supplied': an empty page is not council-supplied content, it is content
 * nobody has written.
 */
export function resolvePageProvenance(sections: SectionProvenanceInput[]): Provenance {
  if (sections.length === 0) return 'placeholder-ai';
  const classes = sections.map(classifySection);
  if (classes.some((c) => c === 'placeholder')) return 'placeholder-ai';
  if (classes.some((c) => c === 'draft')) return 'council-draft';
  if (classes.some((c) => c === 'research')) return 'research';
  return 'council-supplied';
}

// ---------------------------------------------------------------------------
// GatedProse — the opaque wrapper. wrapGatedProse() itself lives in
// components/nos/gated-prose-internal.ts, imported above, NOT defined or re-exported
// here — see that file's header and the GatedProse type comment for why. This module
// calls it below (hydrateSection) but never hands the unwrap side to anyone; only
// components/nos/ShowPageProse.tsx imports that.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Raw document shape as read from Sanity, and hydration into the public ShowPage type.
// ---------------------------------------------------------------------------

type RawShowPageSection = {
  sectionKey: string;
  heading?: string | null;
  kind?: string | null;
  body?: PortableTextBlock[] | null;
  provenance?: string | null;
  sourcePath?: string | null;
};

type RawShowPage = {
  pageKey: string;
  specNumber: number;
  title: string;
  summary?: string | null;
  sections?: RawShowPageSection[] | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoImage?: SanityImage | null;
};

const SHOW_PAGE_SECTION_PROJECTION = `
  sectionKey,
  heading,
  kind,
  body,
  provenance,
  sourcePath
`;

const SHOW_PAGE_PROJECTION = `{
  pageKey,
  specNumber,
  title,
  summary,
  sections[]{ ${SHOW_PAGE_SECTION_PROJECTION} },
  seoTitle,
  seoDescription,
  seoImage
}`;

const SHOW_PAGE_BY_KEY_QUERY = `*[_type == "showPage" && pageKey == $pageKey]${SHOW_PAGE_PROJECTION}`;
const ALL_SHOW_PAGES_QUERY = `*[_type == "showPage"]${SHOW_PAGE_PROJECTION}`;
const SHOW_PAGE_SETTINGS_QUERY = `*[_type == "showPageSettings"][0]{
  placeholderLabel,
  placeholderNotice,
  researchLabel,
  researchNotice,
  draftLabel,
  draftNotice
}`;

async function loadShowPageSettings(): Promise<ShowPageSettingsFields | null> {
  return sanityFetch<ShowPageSettingsFields>({
    query: SHOW_PAGE_SETTINGS_QUERY,
    tags: ['showPageSettings'],
  });
}

function hydrateSection(
  raw: RawShowPageSection,
  settings: ShowPageSettingsFields | null,
): ShowPageSection {
  const kind: ShowPageSectionKind =
    raw.kind === 'entityList' || raw.kind === 'programme' ? raw.kind : 'prose';
  const notice = resolveNotice(
    { provenance: raw.provenance, sourcePath: raw.sourcePath, kind: raw.kind, body: raw.body },
    settings,
  );
  return {
    sectionKey: raw.sectionKey,
    heading: raw.heading ?? null,
    kind,
    body: wrapGatedProse(raw.body ?? [], notice),
    notice,
  };
}

function hydratePage(raw: RawShowPage, settings: ShowPageSettingsFields | null): ShowPage {
  const rawSections = raw.sections ?? [];
  const sections = rawSections.map((section) => hydrateSection(section, settings));
  const pageProvenance = resolvePageProvenance(
    rawSections.map((section) => ({
      provenance: section.provenance,
      sourcePath: section.sourcePath,
      kind: section.kind,
      body: section.body,
    })),
  );
  const notice =
    pageProvenance === 'council-supplied'
      ? null
      : buildNotice(
          pageProvenance === 'research' ? 'research' : pageProvenance === 'council-draft' ? 'draft' : 'placeholder',
          settings,
        );

  return {
    pageKey: raw.pageKey,
    specNumber: raw.specNumber,
    title: raw.title,
    summary: raw.summary ?? null,
    sections,
    pageProvenance,
    notice,
    seoTitle: raw.seoTitle ?? null,
    seoDescription: raw.seoDescription ?? null,
    seoImage: raw.seoImage ?? null,
  };
}

/**
 * The only supported read path for a single `showPage` document. Returns `null` when no
 * document has the given `pageKey`. THROWS when more than one document shares it — never
 * silently takes `[0]`. See content-model.golden.md's `pageKey` uniqueness section.
 */
export async function loadShowPage(pageKey: string): Promise<ShowPage | null> {
  const docs = await sanityFetch<RawShowPage[]>({
    query: SHOW_PAGE_BY_KEY_QUERY,
    params: { pageKey },
    tags: ['showPage', `showPage:${pageKey}`],
  });
  if (!docs || docs.length === 0) return null;
  if (docs.length > 1) {
    throw new Error(
      `loadShowPage: ${docs.length} showPage documents share pageKey "${pageKey}" — this ` +
        'should be impossible under the schema\'s uniqueness validation. Refusing to guess.',
    );
  }
  const settings = await loadShowPageSettings();
  return hydratePage(docs[0], settings);
}

/** Every `showPage` document, sorted by `specNumber`. */
export async function loadAllShowPages(): Promise<ShowPage[]> {
  const [docs, settings] = await Promise.all([
    sanityFetch<RawShowPage[]>({ query: ALL_SHOW_PAGES_QUERY, tags: ['showPage'] }),
    loadShowPageSettings(),
  ]);
  return (docs ?? [])
    .map((doc) => hydratePage(doc, settings))
    .sort((a, b) => a.specNumber - b.specNumber);
}

// ---------------------------------------------------------------------------
// F24 (national-show-ia-alignment, M4) — the never-404 fallback.
//
// See goldens/m4/never-404-fallback.golden.md and goldens/m4/content-state-verifier.golden.md.
// ---------------------------------------------------------------------------

export type ShowPageFallbackInput = {
  /** The route's manifest label — becomes the fallback's <h1> and page title. */
  label: string;
  /** The route's manifest `purpose`, reproduced byte-identical (NF13) — never edited,
   * tightened or re-voiced. */
  purpose: string;
};

// Pinned to fixtures/f24-fallback-wording.json's `fixedSentence`. Quoted directly here
// (not imported from the fixture, which is test-only content, not a runtime
// dependency) — NF11 is what keeps the two from drifting apart.
export const ABSENT_SHOW_PAGE_FIXED_SENTENCE =
  'The South African Orchid Council has not yet supplied the content for this page.';

const ABSENT_SHOW_PAGE_SECTION_KEY = 'content-not-yet-published';

function absentShowPageBody(purpose: string): PortableTextBlock[] {
  const block = (key: string, text: string): PortableTextBlock =>
    ({
      _type: 'block',
      _key: key,
      style: 'normal',
      markDefs: [],
      children: [{ _type: 'span', _key: `${key}-s1`, text, marks: [] }],
    }) as unknown as PortableTextBlock;

  return [
    block(`${ABSENT_SHOW_PAGE_SECTION_KEY}-purpose`, purpose),
    block(`${ABSENT_SHOW_PAGE_SECTION_KEY}-sentence`, ABSENT_SHOW_PAGE_FIXED_SENTENCE),
  ];
}

// Builds a REAL ShowPage for a listed route whose document is absent, so the route can
// render through the same ShowPageProse path as any other page instead of 404ing.
// NEVER assigns `pageProvenance` from a literal (A5's static guard, second layer over
// NF9/NF12) — the section's own provenance is 'placeholder-ai' and the existing
// resolvePageProvenance() derives the page-level rollup exactly as it would for any
// other zero-confirmed-content page. The gate decides; this builder does not get to
// declare itself clean. See never-404-fallback.golden.md §2-3.
function buildAbsentShowPage(pageKey: string, fallback: ShowPageFallbackInput, settings: ShowPageSettingsFields | null): ShowPage {
  const sectionInput: SectionProvenanceInput = {
    provenance: 'placeholder-ai',
    sourcePath: null,
    kind: 'prose',
    body: [],
  };
  const notice = resolveNotice(sectionInput, settings);
  const pageProvenance = resolvePageProvenance([sectionInput]);
  const section: ShowPageSection = {
    sectionKey: ABSENT_SHOW_PAGE_SECTION_KEY,
    heading: null,
    kind: 'prose',
    body: wrapGatedProse(absentShowPageBody(fallback.purpose), notice),
    notice,
  };
  return {
    pageKey,
    specNumber: 0,
    title: fallback.label,
    summary: null,
    sections: [section],
    pageProvenance,
    notice,
    seoTitle: null,
    seoDescription: null,
    seoImage: null,
    isFallback: true,
  };
}

/**
 * The never-404 read path. `loadShowPage` above is UNCHANGED and still returns `null`
 * for an absent document — every existing caller keeps that distinction. This is the
 * ONLY place the absent case is turned into a renderable page, and it hands the result
 * out as an OPAQUE `ShowPageResult` rather than a bare `ShowPage` — see
 * components/show/nos/show-content-state-internal.ts and
 * components/show/nos/ShowContentState.tsx, the one component permitted to open it.
 *
 * NO try/catch here (NF9): a transport failure — Sanity unreachable, a bad token, a
 * malformed GROQ — must surface as an error, never be swallowed into a fallback that
 * reads as "content not yet published". See never-404-fallback.golden.md §5.
 */
export async function loadShowPageOrFallback(
  pageKey: string,
  fallback: ShowPageFallbackInput,
): Promise<ShowPageResult> {
  const page = await loadShowPage(pageKey);
  if (page) return wrapShowPageResult(page);
  const settings = await loadShowPageSettings();
  return wrapShowPageResult(buildAbsentShowPage(pageKey, fallback, settings));
}

// =============================================================
// NOS — lib/data/show-page-presentation.ts
// Render-time presentation of a showPage document, applied by hydratePage() to the raw document
// before its sections are wrapped as GatedProse. Nothing here edits the stored data: the content
// files and the Sanity documents keep their own wording, so every change below is reversible and
// a Sanity-sourced page gets exactly the same result as the seeded one.
//
// R70 (NOS Design, 2026-10-16), symposium only:
//   - the page title reads "National Orchid Show Symposium" (Brad);
//   - the hero summary is the symposium's theme line, replacing the internal Purpose line;
//   - the theme section is headed "Symposium theme" and drops its quoted theme-line block (the
//     line now lives in the hero), leaving only the council's description sentence from the data.
// =============================================================

import type { PortableTextBlock } from '@portabletext/react';

import type { RawShowPage, RawShowPageSection } from './show-pages';

const SYMPOSIUM_PAGE_KEY = '06-saoc-symposium';
const SYMPOSIUM_TITLE = 'National Orchid Show Symposium';
const THEME_SECTION_KEY = 'theme';
const THEME_SECTION_HEADING = 'Symposium theme';

// The theme line, verbatim from Lee-Ann's Drive export: content/drive-source/National Show/
// 2. About/2.1 About - 2027 National Show/v1.0/content.md (line 7) and content/drive-source/
// National Show/1. Website Development SpecificationV3/v1.0/content.md (line 225). The source
// sets it inside curly quotes; the quotes are punctuation of those sentences, not of the line,
// and it renders with no quote characters.
const SYMPOSIUM_THEME_LINE = 'From Wild Origins to Cultivated Excellence: The Future of Orchids';

const QUOTE_CHARACTERS = /["“”„‟″«»]/g;

function blockText(block: PortableTextBlock): string {
  if (!Array.isArray(block.children)) return '';
  return block.children
    .map((child) => ('text' in child && typeof child.text === 'string' ? child.text : ''))
    .join('');
}

function isThemeLineBlock(block: PortableTextBlock): boolean {
  return blockText(block).replace(QUOTE_CHARACTERS, '').trim() === SYMPOSIUM_THEME_LINE;
}

function presentThemeSection(section: RawShowPageSection): RawShowPageSection {
  return {
    ...section,
    heading: THEME_SECTION_HEADING,
    body: section.body?.filter((block) => !isThemeLineBlock(block)) ?? section.body,
  };
}

export function presentRawShowPage(raw: RawShowPage): RawShowPage {
  if (raw.pageKey !== SYMPOSIUM_PAGE_KEY) return raw;
  return {
    ...raw,
    title: SYMPOSIUM_TITLE,
    summary: SYMPOSIUM_THEME_LINE,
    sections: raw.sections?.map((section) =>
      section.sectionKey === THEME_SECTION_KEY ? presentThemeSection(section) : section,
    ),
  };
}

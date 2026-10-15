// nos-provenance-fix F3 — the three recovered sources, pinned. Shared by the F3 checks.
// Every value here is copied from the drive-source manifest or the seed corpus; none is
// authored. See .agent/memory/project/specs/nos-provenance-fix/goldens/f3-recovery.md.
export const RECOVERED = [
  {
    pageKey: '02-about-the-national-show',
    sectionKey: 'overview',
    specPage: 2,
    dir: 'content/drive-recovered/02-about-the-national-show/about',
    from: 'content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md',
    source: 'content/drive-source/National Show/2. About/2.1 About - 2027 National Show/v1.1/content.md',
    sourceDrivePath: 'National Show/2. About/2.1 About - 2027 National Show/source.docx',
    sourceMd5: '8b34c9c8820ec0a3bbe98f0ec773cb64',
    golden: '02-about-the-national-show.content.md',
    sentences: 11,
    renderedIn: ['app/(marketing)/national-show/about/page.tsx'],
  },
  {
    pageKey: '03-what-to-expect',
    sectionKey: 'overview',
    specPage: 3,
    dir: 'content/drive-recovered/03-what-to-expect/what-to-expect',
    from: 'content/drive-source/National Show/3. What to expect/3.1 Info - What to Expect/v1.0/content.md',
    source: 'content/drive-source/National Show/3. What to expect/3.1 Info - What to Expect/v1.1/content.md',
    sourceDrivePath: 'National Show/3. What to expect/3.1 Info - What to Expect/source.docx',
    sourceMd5: '5deb485875e5e4adb9e76c7a08bb3a89',
    golden: '03-what-to-expect.content.md',
    sentences: 4,
    renderedIn: ['app/(marketing)/national-show/what-to-expect/page.tsx'],
  },
  {
    pageKey: '04-south-african-exhibitors',
    sectionKey: 'overview',
    specPage: 4,
    dir: 'content/drive-recovered/04-south-african-exhibitors/sa-exhibitors',
    from: 'content/drive-source/National Show/4. South African Exhibitors/1.1 Exhibitors - South African Exhibitors/v1.0/content.md',
    source: 'content/drive-source/National Show/4. South African Exhibitors/1.1 Exhibitors - South African Exhibitors/v1.0/content.md',
    sourceDrivePath: 'National Show/4. South African Exhibitors/1.1 Exhibitors - South African Exhibitors/source.docx',
    sourceMd5: 'a7495d2bdc8d6726da2f103065affcdf',
    golden: '04-south-african-exhibitors.content.md',
    sentences: 3,
    // Rendered twice on the public site: the gated /national-show/sa-exhibitors section
    // (seed body) and the vendors page intro.
    renderedIn: ['components/vendors/VendorIntro.tsx'],
  },
];

export const RECOVERY_METHOD = 'drive-source-verbatim-extract';
export const RECOVERED_AT = '2026-10-16';
export const RECOVERED_BY = 'athanor:nos-provenance-fix';

// Same normalisation as lib/data/show-pages.ts normalizeForLinkage().
export function normalizeForLinkage(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Same split + plain-text extraction as lib/data/show-pages.ts.
export function bodySentences(body) {
  const plain = (Array.isArray(body) ? body : [])
    .map((b) => (Array.isArray(b?.children) ? b.children.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('') : ''))
    .join('\n');
  return plain.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

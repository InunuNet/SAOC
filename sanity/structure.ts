import type { StructureBuilder, StructureResolverContext } from 'sanity/structure';

// F3 (cms-activation-deploy): custom desk structure pinning the six page-singleton
// types to one fixed document each, so an editor cannot create a duplicate that the
// site's GROQ queries (which take [0] from an unordered result) could silently pick
// over the intended one. Fixed document ID convention: the document's own _id equals
// its schema type name (e.g. homePage -> _id "homePage"), Sanity's documented
// singleton pattern (drafts become "drafts.homePage").
//
// Content seeding for these six is explicitly out of scope here (F4, separate
// feature). membersPage is pinned identically to the other five per Brad's decision
// (2026-07-29) to keep it as an empty placeholder until the page is built.
const PINNED_SINGLETON_TYPES = [
  'homePage',
  'aboutPage',
  'nationalShow',
  'contactPage',
  'judgingPage',
  'membersPage',
] as const;

const SINGLETON_TITLES: Record<(typeof PINNED_SINGLETON_TYPES)[number], string> = {
  homePage: 'Home Page',
  aboutPage: 'About Page',
  nationalShow: 'National Show',
  contactPage: 'Contact Page',
  judgingPage: 'Judging Page',
  membersPage: 'Members Page',
};

// Collection (non-singleton) document types that keep the stock list behaviour.
const COLLECTION_TYPES = [
  'society',
  'boardMember',
  'societyEvent',
  'show',
  'showClass',
  'award',
  'sponsor',
  'judge',
  'province',
];

export function structure(S: StructureBuilder, _context: StructureResolverContext) {
  const singletonItems = PINNED_SINGLETON_TYPES.map((typeName) =>
    S.listItem()
      .id(typeName)
      .title(SINGLETON_TITLES[typeName])
      .child(S.document().schemaType(typeName).documentId(typeName))
  );

  const collectionItems = COLLECTION_TYPES.map((typeName) => S.documentTypeListItem(typeName));

  return S.list()
    .title('Content')
    .items([...singletonItems, S.divider(), ...collectionItems]);
}

// Closes the global "+ Create new document" menu loophole: without this, an editor
// could bypass the pinned sidebar entries above and create a second document of a
// pinned type directly from that menu. Ordinary collection types are left untouched.
export function filterNewDocumentOptions<T extends { templateId?: string; schemaType?: string }>(
  options: T[],
  _context: unknown
): T[] {
  return options.filter((option) => {
    const typeName = option.schemaType ?? option.templateId;
    return typeName === undefined || !(PINNED_SINGLETON_TYPES as readonly string[]).includes(typeName);
  });
}

// Maps a public route to the Sanity Studio document that drives it, for the admin pill's
// "Edit this page" link. Exact-path only: anything not listed (including /national-show/*
// subpages) gets no link. Document ids equal the type names (sanity/structure.ts).

const STUDIO_DOCUMENT_BY_PATH: Readonly<Record<string, string>> = {
  '/': 'homePage',
  '/about': 'aboutPage',
  '/contact': 'contactPage',
  '/judging': 'judgingPage',
  '/members': 'membersPage',
  '/tickets': 'ticketsPage',
  '/national-show': 'nationalShow',
};

export function studioEditHref(pathname: string): string | null {
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const type = STUDIO_DOCUMENT_BY_PATH[normalised];
  return type ? `/studio/intent/edit/id=${type};type=${type}` : null;
}

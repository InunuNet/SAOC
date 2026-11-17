import { NAV, CONTACT_LINK } from '@/components/chrome/nav-config';
import { FOOTER_NAV, FOOTER_LEGAL_LINKS } from '@/components/chrome/footer-data';
import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import { nosPath, NOS_INTERNAL_PREFIX } from '@/lib/nos-paths';
import { nosUrl } from '@/lib/site-hosts';
import { searchTokens } from '@/lib/societies/search';

interface PageLink {
  label: string;
  href: string;
  crossSite: boolean;
}

function pageLink(label: string, href: string, crossSite = false): PageLink {
  return href.startsWith(NOS_INTERNAL_PREFIX)
    ? { label, href: nosUrl(nosPath(href)), crossSite: true }
    : { label, href, crossSite };
}

// These labels and destinations come from the site's existing navigation only.
const links = [
  ...NAV.map((item) => pageLink(item.label, item.href, item.crossSite)),
  pageLink(CONTACT_LINK.label, CONTACT_LINK.href),
  ...FOOTER_NAV.map((item) => pageLink(item.label, item.href, item.crossSite)),
  ...FOOTER_LEGAL_LINKS.map((item) => pageLink(item.label, item.href)),
  ...NOS_NAV.flatMap((item) =>
    item.type === 'mega'
      ? [
          pageLink(item.label, item.href),
          ...(item.lead
            ? [
                ...item.lead.theShow.links.map((link) => pageLink(link.label, link.href)),
                pageLink(item.lead.leadLabel, item.lead.leadHref),
              ]
            : []),
          ...item.columns.flatMap((column) =>
            column.links.map((link) => pageLink(link.label, link.href)),
          ),
        ]
      : [pageLink(item.label, item.href, item.crossSite)],
  ),
];

export const SEARCH_PAGES: readonly PageLink[] = links.filter(
  (link, index) => links.findIndex((candidate) => candidate.href === link.href) === index,
);

export function matchPages(rawTerm: string): PageLink[] {
  const tokens = searchTokens(rawTerm);
  if (tokens.length === 0) return [];
  return SEARCH_PAGES.filter((page) => {
    const label = page.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return tokens.every((token) => label.includes(token));
  });
}

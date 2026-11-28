// =============================================================
// SAOC — e2e/utils/nos-nav-hrefs.ts
// Mission nos-site-split F3 — what the National Orchid Show header (components/nos-chrome/
// NosHeader.tsx, NOS Design R1.2) must render, derived from NOS_NAV so a spec can never drift from
// the nav data: the disclosure groups (Visit, Programme), a one-link group as a plain link (Vendors), then the plain links
// Show sponsors and Past shows, Contact (a SAOC URL), and the Tickets call to action. Hrefs are the
// public clean paths (nosPath), which is what the NOS host renders.
// =============================================================
import type { NavColumn, NavItem, NavLeaf } from '@/components/chrome/nav-config';
import { NOS_NAV } from '@/components/nos-chrome/nos-nav';
import { PAST_SHOWS_HREF } from '@/lib/data/past-shows';
import { nosPath } from '@/lib/nos-paths';

type MegaItem = Extract<NavItem, { type: 'mega' }>;

const mega = NOS_NAV.find((item): item is MegaItem => item.type === 'mega');
if (!mega) throw new Error('nos-nav.ts has no mega item');

const showLeaves: NavLeaf[] = mega.lead?.theShow.links ?? [];
const leaf = (id: string): NavLeaf => {
  const found = showLeaves.find((l) => l.id === id);
  if (!found) throw new Error(`nos-nav.ts has no "${id}" leaf`);
  return found;
};

/** Every nav group, in header order. */
const ALL_GROUPS: readonly NavColumn[] = mega.columns;
/** The disclosure groups (two or more links), in header order: each has a button and a panel. */
export const NOS_GROUPS: readonly NavColumn[] = ALL_GROUPS.filter((g) => g.links.length > 1);
/**
 * The one-link groups (Vendors): NosHeader's soleLink renders each as a plain link, labelled with the
 * group heading, to its only child's page (Brad, 25 Nov 2026), in the top row and the menu panel.
 */
export const NOS_SOLE_LINK_GROUPS: readonly { heading: string; leaf: NavLeaf }[] = ALL_GROUPS.filter(
  (g) => g.links.length === 1,
).map((g) => ({ heading: g.heading, leaf: g.links[0] }));
/** The Tickets call to action. */
export const NOS_TICKETS = leaf('tickets');
/** The plain top-row links after the groups. */
export const NOS_PLAIN_LEAVES: readonly NavLeaf[] = [leaf('show-sponsors'), leaf('past-shows')];
/** The route that is withheld in a public build until Sanity holds a past show (r64). */
export const NOS_PAST_SHOWS_PATH = nosPath(PAST_SHOWS_HREF);

/** The clean public path of a nav leaf. */
export const cleanHref = (l: NavLeaf): string => nosPath(l.href);

/** Every clean path the NOS header must offer as a real anchor (Past shows excluded: it is withheld). */
export const NOS_REQUIRED_HEADER_HREFS: readonly string[] = Array.from(
  new Set([
    '/',
    ...ALL_GROUPS.flatMap((g) => g.links.map(cleanHref)),
    cleanHref(NOS_TICKETS),
    cleanHref(leaf('show-sponsors')),
  ]),
);

import { NosHero } from '@/components/nos/NosHero';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';

// nos-loader-h1: the page's own hero, so the h1 and the group sub-nav are on screen from the first
// frame and do not move when the page streams in.
// The nav label, as the page itself names it (NL-1); the route table's longer title would wrap and shift the sub-nav.
const PAGE_TITLE = 'Symposium';

export default function Loading() {
  return (
    <NosHero
      route={NOS_ROUTE_HEROES.symposium.route}
      title={PAGE_TITLE}
      crumbLabel={PAGE_TITLE}
      lede={`\u201c${NOS_ROUTE_HEROES.symposium.lede}\u201d`}
      ledeKind="theme"
      titleAs="p"
      actions={<div className="nos-hero-facts-skeleton" aria-hidden="true" />}
      priority
    />
  );
}

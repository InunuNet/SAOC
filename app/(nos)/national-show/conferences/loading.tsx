import { NosHero } from '@/components/nos/NosHero';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';

// nos-loader-h1: the page's own hero, so the h1 and the group sub-nav are on screen from the first
// frame and do not move when the page streams in.
export default function Loading() {
  return (
    <NosHero
      route={NOS_ROUTE_HEROES.conferences.route}
      title={NOS_ROUTE_HEROES.conferences.title}
      crumbLabel={NOS_ROUTE_HEROES.conferences.title}
      titleAs="p"
      actions={<div className="nos-hero-facts-skeleton nos-hero-facts-skeleton--cr" aria-hidden="true" />}
      priority
    />
  );
}

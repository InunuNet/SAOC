import { NosHero } from '@/components/nos/NosHero';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';

// nos-loader-h1: the page's own hero, so the h1 and the group sub-nav are on screen from the first
// frame and do not move when the page streams in.
export default function Loading() {
  return (
    <NosHero
      route={NOS_ROUTE_HEROES.wosaConference.route}
      title={NOS_ROUTE_HEROES.wosaConference.title}
      priority
    />
  );
}

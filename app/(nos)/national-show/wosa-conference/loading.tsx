import { NosHero } from '@/components/nos/NosHero';
import { NOS_ROUTE_HEROES } from '@/components/nos/nos-route-heroes';
import { FAQ_SECTIONS } from '@/lib/data/faq-sections';

// nos-loader-h1: the page's own hero, so the h1, the crumb, the lede and the group sub-nav are on screen
// from the first frame and do not move when the page streams in. The lede is the page's own (her FAQ
// section 7 introduction); only the facts row waits for the page (an empty skeleton holds its height).
export default function Loading() {
  const [lede] = FAQ_SECTIONS.find((section) => section.id === 'wosa-conference')?.intro ?? [];
  return (
    <NosHero
      route={NOS_ROUTE_HEROES.wosaConference.route}
      title={NOS_ROUTE_HEROES.wosaConference.title}
      crumbLabel={NOS_ROUTE_HEROES.wosaConference.title}
      lede={lede}
      titleAs="p"
      actions={<div className="nos-hero-facts-skeleton" aria-hidden="true" />}
      priority
    />
  );
}

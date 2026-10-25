import { NATIONAL_SHOW_TITLE } from '@/lib/events-list';
import { nosUrl } from '@/lib/site-hosts';
import type { SanityEvent } from '@/types';

/**
 * The National Show has its own site, so its event links to the NOS home (absolute); every other
 * society event keeps its /events page on this site (a relative path).
 */
export function eventHref(event: Pick<SanityEvent, 'title' | 'slug'>): string {
  return NATIONAL_SHOW_TITLE.test(event.title) ? nosUrl('/') : `/events/${event.slug}`;
}

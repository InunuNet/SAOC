import type { SanityEvent } from '@/types';

const NATIONAL_SHOW_PATH = '/national-show';
const NATIONAL_SHOW_TITLE = /national.*show/i;

/** The National Show has its own section; every other society event keeps its /events page. */
export function eventHref(event: Pick<SanityEvent, 'title' | 'slug'>): string {
  return NATIONAL_SHOW_TITLE.test(event.title) ? NATIONAL_SHOW_PATH : `/events/${event.slug}`;
}

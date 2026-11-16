import { client } from '@/sanity/lib/client';
import { ticketTypeScheduleTraitsQuery } from '@/sanity/queries';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

export interface CheckinContext {
  window: { startDate: Date; endDate: Date } | null;
  daySelectionTypes: string[];
}

export async function getCheckinContext(now: Date): Promise<CheckinContext> {
  if (!client) throw new Error('Sanity client unavailable');
  const lookup = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  const traits = await client.fetch<Array<{ slug?: string | null; requiresDaySelection?: unknown }>>(ticketTypeScheduleTraitsQuery);
  const required = new Set(['day-visitor', 'early-bird']);
  for (const trait of traits) {
    if (trait.requiresDaySelection === true && trait.slug) required.add(trait.slug);
  }
  return { window: lookup(NATIONAL_SHOW_ID), daySelectionTypes: [...required] };
}

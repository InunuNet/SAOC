// lib/view-models/load-workshop-sessions.ts
//
// F6 (conference-workshop-tickets, M4). See golden §2 — resolves each workshopSession's
// linked ticketType through loadTicketCardViewModel(), never a re-derived shape. Returns
// an empty array (never throws) when none exist — the real, current state, since no
// workshopSession documents are council-confirmed yet.
// Relative imports with explicit `.ts` extensions — see load-ticket-card.ts's own header
// comment for why.
import { client } from '../../sanity/lib/client.ts';

import { loadTicketCardViewModel } from './load-ticket-card.ts';
import type { WorkshopSessionViewModel } from './ticket-card.ts';

interface SanityWorkshopSessionDoc {
  _id: string;
  title: string;
  description: string | null;
  presenterId: string | null;
  timeSlot: string | null;
  ticketTypeSlug: string | null;
}

const WORKSHOP_SESSIONS_QUERY = `
  *[_type == "workshopSession"] {
    _id,
    title,
    description,
    "presenterId": presenter._ref,
    timeSlot,
    "ticketTypeSlug": ticketType->slug.current
  }
`;

export async function loadWorkshopSessionViewModels(): Promise<WorkshopSessionViewModel[]> {
  if (!client) return [];

  // A30 (added 2026-10-07, Codex finding, relayed by team-lead, widening A29's
  // loadTicketCardViewModel fix to its sibling loaders): a Sanity failure here must never
  // throw past this boundary either — the workshops page has nothing to do with ticket
  // purchasing and must never 500 for unrendered workshop-session data. Logged, then the
  // same empty-array default as the `!client` branch above, never a rethrow and never a
  // silent swallow with no log.
  let docs: SanityWorkshopSessionDoc[];
  try {
    docs = ((await client.fetch(WORKSHOP_SESSIONS_QUERY)) ?? []) as SanityWorkshopSessionDoc[];
  } catch (error) {
    console.error('[load-workshop-sessions] client.fetch failed:', error);
    return [];
  }

  const sessions: WorkshopSessionViewModel[] = [];
  for (const doc of docs) {
    const ticketCard = doc.ticketTypeSlug ? await loadTicketCardViewModel(doc.ticketTypeSlug) : null;
    sessions.push({
      id: doc._id,
      title: doc.title,
      description: doc.description ?? null,
      presenterId: doc.presenterId ?? null,
      timeSlot: doc.timeSlot ?? null,
      ticketCard,
    });
  }

  return sessions;
}

// lib/view-models/load-presenters.ts
//
// F6 (conference-workshop-tickets, M4) — server-side loader for PresenterCardViewModel.
// See .agent/memory/project/specs/conference-workshop-tickets/goldens/f3-ui-render-states.golden.md
// §2. GROQ-only; no Firestore/Firebase Admin import — a presenter is pure Sanity content,
// no capacity/pricing to count. Returns an empty array (never throws) when none are seeded
// — the real, current state today — leaving how to render that to the caller.
// Relative import with an explicit `.ts` extension — see load-ticket-card.ts's own header
// comment for why (this feature's contracts/checks/*.mjs scripts load this file via a bare
// tsx/esm/api register(), where `@/` alias specifiers never resolve).
import { client } from '../../sanity/lib/client.ts';

import type { PresenterCardViewModel } from './ticket-card.ts';

interface SanityPresenterDoc {
  _id: string;
  name: string;
  role: string | null;
  bioExcerpt: string | null;
  photoUrl: string | null;
  event: 'saoc-symposium' | 'wosa-conference';
  order: number | null;
}

const CONFERENCE_PRESENTERS_BY_EVENT_QUERY = `
  *[_type == "conferencePresenter" && event == $event] | order(order asc) {
    _id,
    name,
    role,
    "bioExcerpt": bio,
    "photoUrl": photo.asset->url,
    event,
    order
  }
`;

export async function loadPresenterViewModels(
  event: 'saoc-symposium' | 'wosa-conference',
): Promise<PresenterCardViewModel[]> {
  if (!client) return [];

  // A30 (added 2026-10-07, Codex finding, relayed by team-lead, widening A29's
  // loadTicketCardViewModel fix to its sibling loaders): a Sanity failure here must never
  // throw past this boundary either — the three pages that call this (symposium,
  // wosa-conference) have nothing to do with ticket purchasing and must never 500 for
  // unrendered presenter data. Logged, then the same empty-array default as the `!client`
  // branch above, never a rethrow and never a silent swallow with no log.
  let docs: SanityPresenterDoc[];
  try {
    docs = ((await client.fetch(CONFERENCE_PRESENTERS_BY_EVENT_QUERY, { event })) ??
      []) as SanityPresenterDoc[];
  } catch (error) {
    console.error('[load-presenters] client.fetch failed:', error);
    return [];
  }

  return docs.map((doc) => ({
    id: doc._id,
    name: doc.name,
    role: doc.role ?? null,
    bioExcerpt: doc.bioExcerpt ?? null,
    photoUrl: doc.photoUrl ?? null,
    event: doc.event,
    order: doc.order ?? 0,
  }));
}

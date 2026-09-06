import type { BoardMember } from '@/types';

// Fallback board roster, rendered only when Sanity has no boardMember documents.
// SAOC's real officeholders have not yet been supplied — do not invent names here.
// Content we supply rather than source from the client is marked `data-placeholder`
// at render time (see BoardGrid.tsx) and `placeholder: true` when seeded into Sanity
// (see scripts/seed-sanity.ts, which derives the flag from this sentinel — never
// hardcode `placeholder: true` elsewhere for a name that might later be confirmed).
export const BOARD_PLACEHOLDER_NAME = 'To be confirmed';

export const boardMembers: BoardMember[] = [
  {
    name: 'To be confirmed',
    role: 'President',
    society: 'To be confirmed',
    tenure: 'To be confirmed',
  },
  {
    name: 'To be confirmed',
    role: 'Vice-President',
    society: 'To be confirmed',
    tenure: 'To be confirmed',
  },
  {
    name: 'To be confirmed',
    role: 'Secretary',
    society: 'To be confirmed',
    tenure: 'To be confirmed',
  },
  {
    name: 'To be confirmed',
    role: 'Treasurer',
    society: 'To be confirmed',
    tenure: 'To be confirmed',
  },
  {
    name: 'To be confirmed',
    role: 'Chair of Judging',
    society: 'To be confirmed',
    tenure: 'To be confirmed',
  },
  {
    name: 'To be confirmed',
    role: 'Editor, Orchids South Africa',
    society: 'To be confirmed',
    tenure: 'To be confirmed',
  },
];

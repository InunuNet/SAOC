// Class strings shared across the admin surfaces. Colours come only from app/globals.css tokens.
//
// TOKEN GAPS pending a ruling from Codi (mission admin-redesign). Each stands in with an
// existing token and is a single named constant, so the ruling is a one-line change here:
//   - the admin pill's "sage-light" dot
//   - the door scanner's "red-700" invalid banner (until then: ink + the ✕ icon + text,
//     never colour alone)
//   - the dashboard's brass tile for a pending count > 0
export const ADMIN_PILL_DOT_CLASS = 'bg-accent-soft';
export const DOOR_INVALID_BANNER_CLASS = 'border-ink bg-ivory text-ink';
export const STAT_TILE_PENDING_CLASS = 'bg-accent text-ink';
export const STAT_TILE_CLASS = 'bg-bone text-primary';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory';

export const BUTTON_BASE =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[2px] px-4 font-sans text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-ivory hover:bg-primary-800 ${FOCUS_RING}`;
export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-accent bg-transparent text-ink hover:bg-bone ${FOCUS_RING}`;

export const CARD_CLASS = 'rounded-[2px] border border-rule bg-parchment p-6';

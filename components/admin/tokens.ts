// Class strings shared across the admin surfaces. Colours come only from app/globals.css tokens.
//
// Codi's token rulings: the pill dot is accent-soft; --color-error is used only by the door's
// invalid banner (DoorResultBanner.tsx) and admin inline errors; the pending brass tile is accent with primary-800 text.
export const ADMIN_PILL_DOT_CLASS = 'bg-accent-soft';
export const STAT_TILE_PENDING_CLASS = 'bg-accent text-primary-800';
export const STAT_TILE_CLASS = 'bg-bone text-primary';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory';

export const BUTTON_BASE =
  'inline-flex min-h-[44px] touch-manipulation items-center justify-center gap-2 rounded-[2px] px-4 font-sans text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-ivory hover:bg-primary-800 ${FOCUS_RING}`;
export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-accent bg-transparent text-ink hover:bg-bone ${FOCUS_RING}`;

export const CARD_CLASS = 'rounded-[2px] border border-rule bg-parchment p-6';

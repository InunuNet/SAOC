// Whether a stock count may be shown. A total that comes from a provisional ticket type is a
// placeholder: a public build withholds the figure (the state words stay), the beta preview shows
// it marked as unconfirmed. The sales logic always runs on the real total; only the display moves.

import type { CountDisplay } from '@/components/tickets/keepsake/types';

export function countDisplay(provisional: boolean, withhold: boolean): CountDisplay {
  if (!provisional) return 'real';
  return withhold ? 'withhold' : 'placeholder';
}

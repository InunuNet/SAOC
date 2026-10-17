// The view-model shapes the keepsake ticket components render (goldens/f18b HANDOFF section 2).
// They are structurally satisfied by lib/data/ticket-card-view-models.ts, so a card built there
// renders here without a mapper. Field names and enum values are the locked interface.

import type { TicketCardState } from '@/lib/view-models/ticket-card';

export type { TicketCardState };

export interface KeepsakeScarcity {
  remaining: number;
  total: number;
  label: string;
}

export interface KeepsakeDay {
  day: string;
  state: TicketCardState;
  /** null when there is no real per-day count: the cell shows no number (R7). */
  remaining: number | null;
  total: number | null;
}

export interface KeepsakeCardVm {
  slug: string;
  /** The CMS ticket-type name; it wins over the design's own product name when present. */
  name?: string | null;
  state: TicketCardState;
  price: number | null;
  regularPrice: number | null;
  scarcity: KeepsakeScarcity | null;
  days: KeepsakeDay[] | null;
}

export interface KeepsakePool {
  remaining: number;
  total: number;
}

export interface KeepsakeSessionVm {
  id: string;
  title: string;
  description: string | null;
  presenterId: string | null;
  timeSlot: string | null;
  ticketCard: KeepsakeCardVm | null;
}

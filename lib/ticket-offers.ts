// Event JSON-LD offers, derived from the tickets hub's own cards so the structured data can never
// advertise a product the hub does not show, nor a different availability than the hub's.
// Pure: cards in, offers out.
import type { TicketCard, TicketCardsOutput } from '@/lib/data/ticket-card-view-models';
import { WORKSHOPS_PRODUCT_SLUG } from '@/lib/data/ticket-presentation';

export interface TicketOffer {
  slug: string;
  name: string;
  price: number;
  availability: 'InStock' | 'SoldOut';
}

function toOffer(card: TicketCard): TicketOffer | null {
  // The synthetic per-session workshops card has no product page and no offer.
  if (card.slug === WORKSHOPS_PRODUCT_SLUG) return null;
  // Nothing purchasable to advertise: sales are closed, or the price did not resolve.
  if (card.state === 'salesClosed' || card.state === 'pricePending') return null;
  if (card.price === null || card.name === null) return null;
  return {
    slug: card.slug,
    name: card.name,
    price: card.price,
    availability: card.state === 'soldOut' ? 'SoldOut' : 'InStock',
  };
}

export function buildTicketOffers(cards: TicketCardsOutput['cards']): TicketOffer[] {
  return Object.values(cards).flatMap((card) => {
    const offer = card ? toOffer(card) : null;
    return offer ? [offer] : [];
  });
}

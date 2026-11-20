import { generateBookingRefQrDataUri } from '@/lib/qr';
import { buildOrderEmailFields } from '@/lib/ticket-order-fields';
import type { TicketPdfInput } from '@/lib/ticket-pdf';
import type { TicketTypeEmailInput } from '@/lib/ticket-type-email';
import {
  SAMPLE_EMERGENCY,
  SAMPLE_FIRST_NAME,
  SAMPLE_OPENING_TIMES,
  SAMPLE_ORDERS,
  SAMPLE_PRICE_RAND,
  SAMPLE_QUESTIONS_EMAIL,
  SAMPLE_SHOW_DATES,
  SAMPLE_SHOW_URL,
  SAMPLE_VENUE_NAME,
  type SampleOrder,
} from '@/scripts/ticket-email-sample-fixtures';

/**
 * ticket-design-studio (F2) — the made-up order the studio previews, from the sample fixtures.
 * Every key in TICKET_EMAIL_COPY can be edited and saved; VIP is the default selection.
 */
export const STUDIO_DEFAULT_SLUG = 'vip';

export interface StudioTypeOption {
  slug: string;
  label: string;
}

export function studioTypeOptions(): StudioTypeOption[] {
  return SAMPLE_ORDERS.map((order) => ({
    slug: order.key,
    label: order.title,
  }));
}

export function isStudioSlug(slug: string): boolean {
  return SAMPLE_ORDERS.some((order) => order.key === slug);
}

export function studioSampleOrder(slug: string): SampleOrder {
  const order = SAMPLE_ORDERS.find((candidate) => candidate.key === slug);
  if (!order) throw new Error(`studio: no sample order for ticket type "${slug}"`);
  return order;
}

const QR_CONTENT_ID_PREFIX = 'qr-';
const SITE_IMAGE_URL = /(src|href)="https?:\/\/[^"]*?(\/images\/email\/[^"]+)"/g;

export function studioEmailInput(order: SampleOrder): TicketTypeEmailInput {
  const fields = buildOrderEmailFields(SAMPLE_PRICE_RAND, order.chosenDay);
  return {
    key: order.key,
    values: {
      firstName: SAMPLE_FIRST_NAME,
      visitorName: order.visitorName,
      quantity: String(order.quantity),
      bookingReference: order.bookingReference,
      amountPaid: fields.amountPaid,
      paymentStatus: fields.paymentStatus,
      visitDate: fields.visitDate ?? null,
    },
    positions: [
      {
        bookingRef: order.bookingReference,
        attendeeName: order.visitorName,
        ticketTypeTitle: order.title,
        qrContentId: `${QR_CONTENT_ID_PREFIX}${order.bookingReference}`,
      },
    ],
    recoveryUrl: null,
  };
}

/** Makes the rendered email self-contained for an iframe: inline QR, images from this origin. */
export async function studioPreviewHtml(html: string, order: SampleOrder): Promise<string> {
  const contentId = `${QR_CONTENT_ID_PREFIX}${order.bookingReference}`;
  const qrUri = await generateBookingRefQrDataUri(order.bookingReference);
  return html
    .replaceAll(`cid:${contentId}`, qrUri)
    .replace(SITE_IMAGE_URL, (_m, attr: string, imagePath: string) => `${attr}="${imagePath}"`);
}

export function studioPdfInput(order: SampleOrder): TicketPdfInput {
  return {
    orderReference: null,
    positions: [
      {
        bookingRef: order.bookingReference,
        attendeeName: order.visitorName,
        ticketType: order.title,
        slug: order.slug,
        schedule: order.schedule,
      },
    ],
    visit: {
      venueName: SAMPLE_VENUE_NAME,
      venueAddress: null,
      venueParking: null,
      showDates: SAMPLE_SHOW_DATES,
      showUrl: SAMPLE_SHOW_URL,
      emergency: SAMPLE_EMERGENCY,
      onSiteContact: null,
      organiser: null,
      showOffice: null,
      questionsEmail: SAMPLE_QUESTIONS_EMAIL,
      openingTimes: SAMPLE_OPENING_TIMES,
    },
  };
}

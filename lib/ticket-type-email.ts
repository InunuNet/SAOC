import type { ReactElement } from 'react';

import type { OrderConfirmationPosition } from '@/emails/OrderConfirmation';
import TicketTypeConfirmation from '@/emails/TicketTypeConfirmation';
import {
  PENDING_MARKER,
  TICKET_EMAIL_COPY,
  type TicketEmailKey,
  type TicketEmailValues,
} from '@/lib/ticket-email-copy';
import { withTestSubjectPrefix } from '@/lib/ticketing-test-mode';

/**
 * ticket-email-samples (F1) — the one pure builder of a per-ticket-type confirmation email
 * (subject plus React element), used by BOTH the live send path and the sample generator so the
 * samples show exactly what would be sent. Pure: it touches no mailer, store or network.
 */

export interface TicketTypeEmailInput {
  key: TicketEmailKey;
  values: TicketEmailValues;
  positions: OrderConfirmationPosition[];
  recoveryUrl: string | null;
  testMode?: boolean;
}

export interface TicketTypeEmail {
  subject: string;
  react: ReactElement;
}

export function buildTicketTypeEmail(input: TicketTypeEmailInput): TicketTypeEmail {
  const copy = TICKET_EMAIL_COPY[input.key];
  const subject = withTestSubjectPrefix(copy.subject ?? PENDING_MARKER, input.testMode);
  return {
    subject,
    react: TicketTypeConfirmation({
      copy,
      preview: copy.subject ?? PENDING_MARKER,
      values: input.values,
      positions: input.positions,
      recoveryUrl: input.recoveryUrl,
      testMode: input.testMode,
    }),
  };
}

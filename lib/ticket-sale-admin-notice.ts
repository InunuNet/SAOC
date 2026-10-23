import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import { getAdminNotifyRecipients } from '@/lib/admin-notify-recipients';
import TicketSaleAdminNotice from '@/emails/TicketSaleAdminNotice';

/**
 * Admin notice fired once when a ticket order settles as 'paid' (Brad via SAOC: "Admin emails
 * must also get sent to Lee-Ann for tickets"). Same shape as lib/vendor-payment-admin-notice.ts.
 * Recipients resolve EXCLUSIVELY via `getAdminNotifyRecipients()` (ADMIN_EMAIL_ALLOWLIST) --
 * never from the buyer's own submitted details.
 *
 * Exactly-once: the settlement handler (lib/tickets-notification.ts) calls this only after
 * `markOrderAndPositionPaidByPaymentId` returned `committed: true`, which is true only for the
 * call that moved the order from 'reserved' to 'paid' inside its transaction. A re-sent gateway
 * notification finds the order no longer reserved and never reaches this code.
 *
 * The ONLY `console.*` call permitted in this file is a single, non-PII `console.warn` fired
 * when the resolved recipient list is empty.
 */

export interface TicketSalePosition {
  ticketType: string;
  chosenDay: string | null;
}

export interface TicketSaleLine {
  product: string;
  quantity: number;
  days: string[];
}

export interface TicketSaleAdminNoticeInput {
  orderReference: string;
  buyerName: string;
  buyerEmail: string;
  positions: TicketSalePosition[];
  total: number;
  adminUrl: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as every other admin-notice sender's mailer interface. */
export interface TicketSaleAdminNoticeMailer {
  send(args: { to: string; subject: string; react: React.ReactElement; from?: string }): Promise<void>;
}

export interface SendTicketSaleAdminNoticeDeps {
  mailer?: TicketSaleAdminNoticeMailer;
}

/** One line per product, in first-seen order, with its quantity and the distinct chosen days. */
export function buildTicketSaleLines(positions: TicketSalePosition[]): TicketSaleLine[] {
  const lines = new Map<string, TicketSaleLine>();
  for (const position of positions) {
    const line = lines.get(position.ticketType) ?? {
      product: position.ticketType,
      quantity: 0,
      days: [],
    };
    line.quantity += 1;
    if (position.chosenDay && !line.days.includes(position.chosenDay)) {
      line.days.push(position.chosenDay);
    }
    lines.set(position.ticketType, line);
  }
  return [...lines.values()];
}

export async function sendTicketSaleAdminNotice(
  input: TicketSaleAdminNoticeInput,
  deps: SendTicketSaleAdminNoticeDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const recipients = getAdminNotifyRecipients();

  if (recipients.length === 0) {
    console.warn(
      '[ticket-sale-admin-notice] ADMIN_EMAIL_ALLOWLIST resolved zero recipients — no admin notice sent.',
    );
    return;
  }

  const react = React.createElement(TicketSaleAdminNotice, {
    orderReference: input.orderReference,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    lines: buildTicketSaleLines(input.positions),
    total: input.total,
    adminUrl: input.adminUrl,
  });

  await Promise.all(
    recipients.map((to) =>
      mailer.send({
        to,
        subject: 'Ticket payment received — SAOC',
        react,
        from: FORMS_FROM_ADDRESS,
      }),
    ),
  );
}

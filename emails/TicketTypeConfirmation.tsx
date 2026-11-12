import { Img } from '@react-email/components';

import {
  PENDING_MARKER,
  fillTokens,
  type CopyBlock,
  type TicketEmailCopy,
  type TicketEmailValues,
} from '@/lib/ticket-email-copy';

import EmailShell, {
  ShellCard,
  ShellDetailRow,
  ShellFootnote,
  ShellLink,
  ShellPill,
  ShellQrTile,
  ShellSubheading,
  ShellText,
} from './_shared/EmailShell';
import { TestingNotice } from './_shared/TestingNotice';
import type { OrderConfirmationPosition } from './OrderConfirmation';

/**
 * ticket-email-samples (F1) — the per-ticket-type confirmation email. Chrome is EmailShell
 * family A and each ticket keeps the QR card of emails/OrderConfirmation.tsx; the words come
 * from lib/ticket-email-copy.ts and nothing is added to them. The one row group per ticket
 * ("Your booking details") repeats for each position, each with its own QR code.
 */

export interface TicketTypeConfirmationProps {
  copy: TicketEmailCopy;
  /** The preview line: the email's subject. */
  preview: string;
  values: TicketEmailValues;
  positions: OrderConfirmationPosition[];
  recoveryUrl: string | null;
  /** Defaults to isTicketingTestMode(); explicit so the live (off) rendering is testable. */
  testMode?: boolean;
}

const QR_SIZE = 200;
const EMERGENCY_NUMBERS =
  'In an emergency: 10111 Police (national) · 10177 Ambulance and fire (national) · 112 All emergencies, from a mobile phone';

function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <span key={line}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </>
  );
}

function TicketCards({
  block,
  copy,
  values,
  positions,
}: {
  block: Extract<CopyBlock, { kind: 'details' }>;
  copy: TicketEmailCopy;
  values: TicketEmailValues;
  positions: OrderConfirmationPosition[];
}) {
  const pendingLabels = [...(copy.subject === null ? ['Subject'] : []), ...copy.pendingRows];
  return (
    <>
      {positions.map((position) => {
        const own: TicketEmailValues = {
          ...values,
          visitorName: position.attendeeName,
          bookingReference: position.bookingRef,
        };
        return (
          <ShellCard key={position.bookingRef}>
            {block.rows.map((row) => (
              <ShellDetailRow key={row.label} label={row.label}>
                {fillTokens(row.value, own)}
              </ShellDetailRow>
            ))}
            {pendingLabels.map((label) => (
              <ShellDetailRow key={label} label={`${label}:`}>
                <ShellPill>{PENDING_MARKER}</ShellPill>
              </ShellDetailRow>
            ))}
            <ShellQrTile>
              <Img
                src={`cid:${position.qrContentId}`}
                alt={`QR code for booking reference ${position.bookingRef}`}
                width={QR_SIZE}
                height={QR_SIZE}
                style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
              />
            </ShellQrTile>
          </ShellCard>
        );
      })}
    </>
  );
}

export default function TicketTypeConfirmation({
  copy,
  preview,
  values,
  positions,
  recoveryUrl,
  testMode,
}: TicketTypeConfirmationProps) {
  return (
    <EmailShell family="A" preview={preview}>
      <TestingNotice testMode={testMode} />
      {copy.blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case 'heading':
            return <ShellSubheading key={key}>{block.text}</ShellSubheading>;
          case 'text':
            return (
              <ShellText key={key}>
                <Lines lines={block.lines.map((line) => fillTokens(line, values))} />
              </ShellText>
            );
          case 'list':
            return (
              <ShellText key={key}>
                {block.items.map((item, itemIndex) => (
                  <span key={item}>
                    {itemIndex > 0 ? <br /> : null}• {fillTokens(item, values)}
                  </span>
                ))}
              </ShellText>
            );
          case 'details':
            return (
              <TicketCards
                key={key}
                block={block}
                copy={copy}
                values={values}
                positions={positions}
              />
            );
        }
      })}
      {recoveryUrl !== null && (
        <ShellText size="small">
          Lost this email? <ShellLink href={recoveryUrl}>Recover your tickets</ShellLink>
        </ShellText>
      )}
      <ShellFootnote>{EMERGENCY_NUMBERS}</ShellFootnote>
    </EmailShell>
  );
}

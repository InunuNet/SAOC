import { Img } from '@react-email/components';

import { DEFAULT_DESIGN, type EmailDesign } from '@/lib/ticket-design';
import {
  PENDING_MARKER,
  fillTokens,
  type CopyBlock,
  type TicketEmailCopy,
  type TicketEmailValues,
} from '@/lib/ticket-email-copy';

import EmailShell, {
  themeFromDesign,
  type ShellTheme,
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
  /** The email half of a ticket design; omitted reproduces the pre-studio look. */
  design?: EmailDesign;
}

const RECOVERY_LEAD = 'Lost this email? ';
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
  theme,
}: {
  block: Extract<CopyBlock, { kind: 'details' }>;
  copy: TicketEmailCopy;
  values: TicketEmailValues;
  positions: OrderConfirmationPosition[];
  theme: ShellTheme;
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
          <ShellCard key={position.bookingRef} theme={theme}>
            {block.rows.map((row) => (
              <ShellDetailRow key={row.label} label={row.label} theme={theme}>
                {fillTokens(row.value, own)}
              </ShellDetailRow>
            ))}
            {pendingLabels.map((label) => (
              <ShellDetailRow key={label} label={`${label}:`} theme={theme}>
                <ShellPill theme={theme}>{PENDING_MARKER}</ShellPill>
              </ShellDetailRow>
            ))}
            <ShellQrTile theme={theme}>
              <Img
                src={`cid:${position.qrContentId}`}
                alt={`QR code for booking reference ${position.bookingRef}`}
                width={theme.qrPx}
                height={theme.qrPx}
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
  design = DEFAULT_DESIGN.email,
}: TicketTypeConfirmationProps) {
  const theme = themeFromDesign(design);
  const blocks = copy.blocks.map((block, index) => ({ block, index }));
  // cardPosition "top" lifts the booking-detail cards above the other blocks; their words and
  // the order of everything else are unchanged.
  if (design.cardPosition === 'top') {
    blocks.sort(
      (a, b) =>
        Number(b.block.kind === 'details') - Number(a.block.kind === 'details') || a.index - b.index
    );
  }
  return (
    <EmailShell family="A" preview={preview} theme={theme}>
      <TestingNotice testMode={testMode} />
      {blocks.map(({ block, index }) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case 'heading':
            return (
              <ShellSubheading key={key} theme={theme}>
                {block.text}
              </ShellSubheading>
            );
          case 'text':
            return (
              <ShellText key={key} theme={theme}>
                <Lines lines={block.lines.map((line) => fillTokens(line, values))} />
              </ShellText>
            );
          case 'list':
            return (
              <ShellText key={key} theme={theme}>
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
                theme={theme}
              />
            );
        }
      })}
      {recoveryUrl !== null && (
        <ShellText size="small" theme={theme}>
          {RECOVERY_LEAD}
          <ShellLink href={recoveryUrl} theme={theme}>
            Recover your tickets
          </ShellLink>
        </ShellText>
      )}
      <ShellFootnote theme={theme}>{EMERGENCY_NUMBERS}</ShellFootnote>
    </EmailShell>
  );
}

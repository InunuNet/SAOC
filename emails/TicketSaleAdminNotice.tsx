import EmailShell, {
  ShellButton,
  ShellDetailRow,
  ShellHeading,
  ShellText,
} from './_shared/EmailShell';

interface TicketSaleAdminNoticeLine {
  product: string;
  quantity: number;
  days: string[];
}

interface TicketSaleAdminNoticeProps {
  orderReference: string;
  buyerName: string;
  buyerEmail: string;
  lines: TicketSaleAdminNoticeLine[];
  total: number;
  adminUrl: string;
}

/**
 * Admin-facing notice, fired once when a ticket order settles as 'paid'. Chrome: EmailShell
 * family C, same shell and wording pattern as emails/VendorPaymentAdminNotice.tsx. Links to the
 * existing admin tickets list, since no per-order admin page exists.
 */
export default function TicketSaleAdminNotice({
  orderReference,
  buyerName,
  buyerEmail,
  lines,
  total,
  adminUrl,
}: TicketSaleAdminNoticeProps) {
  return (
    <EmailShell family="C" preview="Ticket payment received — SAOC">
      <ShellHeading>Ticket Payment Received</ShellHeading>
      <ShellText>
        <strong>{buyerName}</strong> ({buyerEmail}) has paid for tickets to the National Orchid
        Show.
      </ShellText>
      <ShellDetailRow label="Order reference:">{orderReference}</ShellDetailRow>
      {lines.map((line) => (
        <ShellDetailRow key={line.product} label={`${line.product}:`}>
          {line.days.length > 0 ? `${line.quantity} (${line.days.join(', ')})` : `${line.quantity}`}
        </ShellDetailRow>
      ))}
      <ShellDetailRow label="Total:">R{total.toFixed(2)}</ShellDetailRow>
      <div style={{ height: '24px' }} />
      <ShellButton href={adminUrl}>Review tickets</ShellButton>
    </EmailShell>
  );
}

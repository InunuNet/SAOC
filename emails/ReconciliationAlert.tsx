import EmailShell, { ShellHeading, ShellRule, ShellText } from './_shared/EmailShell';

interface ReconciliationAlertOrder {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  m_payment_id: string | null;
}

interface ReconciliationAlertProps {
  orders: ReconciliationAlertOrder[];
}

/**
 * order-reconciliation F1 — the "alerts go to a log nobody reads" fix: an email in a real
 * inbox listing every order stranded `status == 'reserved'` past its `expiresAt`. Chrome:
 * EmailShell family C (mission email-shell).
 *
 * Deliberately does not offer a "mark as paid" action of any kind — this email is a flag for a
 * human to investigate, never a control that can auto-settle an order.
 */
export default function ReconciliationAlert({ orders }: ReconciliationAlertProps) {
  return (
    <EmailShell family="C" preview={`${orders.length} stranded ticket order(s) need review`}>
      <ShellHeading>Stranded ticket orders need review</ShellHeading>
      <ShellText>
        The following order(s) are still marked <strong>reserved</strong> even though their
        reservation window has expired. This can happen when a PayFast notification fails
        to arrive or fails validation. Nothing has been changed automatically — please
        investigate each order below and confirm with PayFast directly before taking any
        action.
      </ShellText>
      <ShellRule />
      {orders.map((order) => (
        <ShellText key={order.orderId} size="small">
          Order <strong>{order.orderId}</strong> — {order.buyerName} ({order.buyerEmail}) —
          R{order.amount.toFixed(2)}
          {order.m_payment_id ? ` — m_payment_id: ${order.m_payment_id}` : ''}
        </ShellText>
      ))}
    </EmailShell>
  );
}

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';

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
 * inbox listing every order stranded `status == 'reserved'` past its `expiresAt`. No invented
 * brand colours/typography (project rule) — modelled on emails/VendorApprovalConfirmation.tsx's
 * plain-style convention.
 *
 * Deliberately does not offer a "mark as paid" action of any kind — this email is a flag for a
 * human to investigate, never a control that can auto-settle an order.
 */
export default function ReconciliationAlert({ orders }: ReconciliationAlertProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${orders.length} stranded ticket order(s) need review`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            Stranded ticket orders need review
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            The following order(s) are still marked <strong>reserved</strong> even though their
            reservation window has expired. This can happen when a PayFast notification fails
            to arrive or fails validation. Nothing has been changed automatically — please
            investigate each order below and confirm with PayFast directly before taking any
            action.
          </Text>
          <Hr />
          {orders.map((order) => (
            <Text key={order.orderId} style={{ fontSize: '14px', color: '#333' }}>
              Order <strong>{order.orderId}</strong> — {order.buyerName} ({order.buyerEmail}) —
              R{order.amount.toFixed(2)}
              {order.m_payment_id ? ` — m_payment_id: ${order.m_payment_id}` : ''}
            </Text>
          ))}
          <Hr />
          <Text style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
            South African Orchid Council — saoc.co.za
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

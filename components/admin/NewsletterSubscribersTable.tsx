'use client';

import { formatAdminDate, formatAdminDateTime } from '@/lib/admin-format';
import { NEWSLETTER_COPY } from '@/lib/newsletter-copy';
import { StatusPill } from './StatusPill';
import { AdminTable } from './table/AdminTable';
import type { ColumnDef } from './table/columns';

/** Serialisable view of a subscriber: Firestore Timestamps never cross into this client module. */
export interface SubscriberRow {
  id: string;
  email: string;
  source: string;
  status: 'subscribed' | 'unsubscribed';
  subscribedAt: string | null;
}

const SUBSCRIBER_COLUMNS: readonly ColumnDef[] = [
  { id: 'email', label: NEWSLETTER_COPY.adminColumnEmail, width: '40%', priority: 1, align: 'left' },
  { id: 'source', label: NEWSLETTER_COPY.adminColumnSource, width: '20%', priority: 3, align: 'left' },
  { id: 'status', label: NEWSLETTER_COPY.adminColumnStatus, width: '18%', priority: 1, align: 'left' },
  { id: 'subscribed', label: NEWSLETTER_COPY.adminColumnSubscribed, width: '22%', priority: 2, align: 'right' },
];

// Status pill tone: subscribed reads as the solid "approved" pill, unsubscribed as the muted outline.
const STATUS_TONE: Record<SubscriberRow['status'], string> = {
  subscribed: 'approved',
  unsubscribed: 'declined',
};

function renderCell(columnId: string, row: SubscriberRow): React.ReactNode {
  switch (columnId) {
    case 'email':
      return row.email;
    case 'source':
      return row.source;
    case 'status':
      return <StatusPill status={row.status} tone={STATUS_TONE[row.status]} />;
    case 'subscribed':
      return formatAdminDate(row.subscribedAt);
    default:
      return null;
  }
}

function cellTitle(columnId: string, row: SubscriberRow): string | undefined {
  switch (columnId) {
    case 'email':
      return row.email;
    case 'subscribed':
      return formatAdminDateTime(row.subscribedAt);
    default:
      return undefined;
  }
}

export function NewsletterSubscribersTable({ rows }: { rows: readonly SubscriberRow[] }) {
  return (
    <AdminTable
      caption={NEWSLETTER_COPY.adminHeading}
      columns={SUBSCRIBER_COLUMNS}
      rows={rows}
      getRowId={(row) => row.id}
      renderCell={renderCell}
      cellTitle={cellTitle}
      sortedDescColumnId="subscribed"
      emptyText=""
      card={(row) => ({
        title: row.email,
        status: <StatusPill status={row.status} tone={STATUS_TONE[row.status]} />,
        fields: [
          { label: NEWSLETTER_COPY.adminColumnSource, value: row.source },
          { label: NEWSLETTER_COPY.adminColumnSubscribed, value: formatAdminDate(row.subscribedAt) },
        ],
      })}
    />
  );
}

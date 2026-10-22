'use client';

import { useState } from 'react';

import { formatAdminDate, formatAdminDateTime } from '@/lib/admin-format';
import { StatusPill } from './StatusPill';
import { AdminTable } from './table/AdminTable';
import { TICKET_COLUMNS } from './table/columns';
import { TableToolbar, type FilterOption } from './table/TableToolbar';

/** Serialisable view of a ticket: Firestore Timestamps never cross into this client module. */
export interface TicketRow {
  id: string;
  bookingRef: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketType: string;
  status: string;
  purchasedAt: string | null;
}

const ALL_STATUSES = 'all';
const STATUS_OPTIONS: readonly FilterOption[] = [
  { value: ALL_STATUSES, label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'checked-in', label: 'Checked in' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY_TEXT = 'No tickets have been sold yet.';

function matchesSearch(row: TicketRow, needle: string): boolean {
  return [row.bookingRef, row.attendeeName, row.attendeeEmail, row.ticketType].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

interface TicketsTableProps {
  tickets: TicketRow[];
}

export function TicketsTable({ tickets }: TicketsTableProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL_STATUSES);

  const needle = search.trim().toLowerCase();
  const visible = tickets.filter(
    (row) => (status === ALL_STATUSES || row.status === status) && (!needle || matchesSearch(row, needle)),
  );

  function renderCell(columnId: string, row: TicketRow): React.ReactNode {
    switch (columnId) {
      case 'bookingRef':
        return <span className="font-mono text-[13px]">{row.bookingRef}</span>;
      case 'name':
        return row.attendeeName;
      case 'email':
        return row.attendeeEmail;
      case 'ticketType':
        return row.ticketType;
      case 'purchased':
        return formatAdminDate(row.purchasedAt);
      case 'status':
        return <StatusPill status={row.status} />;
      default:
        return null;
    }
  }

  function cellTitle(columnId: string, row: TicketRow): string | undefined {
    switch (columnId) {
      case 'bookingRef':
        return row.bookingRef;
      case 'name':
        return row.attendeeName;
      case 'email':
        return row.attendeeEmail;
      case 'ticketType':
        return row.ticketType;
      case 'purchased':
        return formatAdminDateTime(row.purchasedAt);
      default:
        return undefined;
    }
  }

  return (
    <div>
      <TableToolbar
        searchLabel="Search tickets"
        search={search}
        onSearchChange={setSearch}
        filterLabel="Ticket status"
        filterOptions={STATUS_OPTIONS}
        filterValue={status}
        onFilterChange={setStatus}
        countText={`${visible.length} ${visible.length === 1 ? 'ticket' : 'tickets'}`}
        csvHref="/api/admin/export-csv"
      />
      <AdminTable
        caption="Ticket sales and check-in status"
        columns={TICKET_COLUMNS}
        rows={visible}
        getRowId={(row) => row.id}
        renderCell={renderCell}
        cellTitle={cellTitle}
        sortedDescColumnId="purchased"
        emptyText={EMPTY_TEXT}
        card={(row) => ({
          title: row.attendeeName,
          status: <StatusPill status={row.status} />,
          fields: [
            { label: 'Booking ref', value: row.bookingRef },
            { label: 'Ticket type', value: row.ticketType },
            { label: 'Purchased', value: formatAdminDate(row.purchasedAt) },
          ],
        })}
      />
    </div>
  );
}

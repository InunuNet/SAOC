'use client';

import { useState } from 'react';

import { formatAdminDate, formatAdminDateTime } from '@/lib/admin-format';
import { DetailDrawer, DetailSection } from './DetailDrawer';
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
  /** Dietary and contact details from the registration form; null for every other ticket. */
  registration?: TicketRegistrationView | null;
}

/** Serialisable view of a ticket's registration map. Shown in this drawer and the CSV only. */
export interface TicketRegistrationView {
  attendeeNumber: number | null;
  mobile: string;
  societies: string[] | null;
  attending: string;
  judgeAccredited: string;
  judgeOrganisation: string;
  judgeAvailable: string;
  judgeDate: string;
  judgeCommunication: string;
  judgeForum: string;
  dietary: string;
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
  const [openId, setOpenId] = useState<string | null>(null);

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

  const opened = openId ? (tickets.find((row) => row.id === openId) ?? null) : null;

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
        onOpen={(row) => setOpenId(row.id)}
        selectedId={opened?.id ?? null}
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
      <DetailDrawer
        open={opened !== null}
        title={opened?.attendeeName ?? ''}
        subtitle={opened?.attendeeEmail}
        onClose={() => setOpenId(null)}
        rowId={opened?.id}
      >
        {opened ? <TicketDetail row={opened} /> : null}
      </DetailDrawer>
    </div>
  );
}

const NOT_PROVIDED = 'Not provided';

function TicketDetail({ row }: { row: TicketRow }) {
  const { registration } = row;
  return (
    <>
      <DetailSection
        title="Ticket"
        items={[
          { label: 'Booking ref', value: row.bookingRef },
          { label: 'Ticket type', value: row.ticketType },
          { label: 'Status', value: <StatusPill status={row.status} /> },
          { label: 'Purchased', value: formatAdminDateTime(row.purchasedAt) },
        ]}
      />
      {registration ? (
        <DetailSection
          title="Registration"
          items={[
            { label: 'Attendee number', value: String(registration.attendeeNumber ?? NOT_PROVIDED) },
            { label: 'Attending', value: registration.attending || NOT_PROVIDED },
            { label: 'Dietary', value: registration.dietary },
            { label: 'Mobile', value: registration.mobile || NOT_PROVIDED },
            { label: 'Societies', value: registration.societies?.join('; ') || NOT_PROVIDED },
            { label: 'Accredited judge', value: registration.judgeAccredited || NOT_PROVIDED },
            { label: 'Judging organisation', value: registration.judgeOrganisation || NOT_PROVIDED },
            { label: 'Available as show judge', value: registration.judgeAvailable || NOT_PROVIDED },
            { label: 'Date available', value: registration.judgeDate || NOT_PROVIDED },
            { label: 'Judges Communication', value: registration.judgeCommunication || NOT_PROVIDED },
            { label: 'Judges Forum', value: registration.judgeForum || NOT_PROVIDED },
          ]}
        />
      ) : null}
    </>
  );
}

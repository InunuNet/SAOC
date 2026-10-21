// Column configs for the three admin tables (goldens/table-columns.md). Priority 1 always
// shows, 2 shows from 640, 3 shows only from 1024. Widths are percentages of the fixed-layout
// table and each set sums to 100.

export type ColumnAlign = 'left' | 'right';
export type ColumnPriority = 1 | 2 | 3;

export interface ColumnDef {
  id: string;
  label: string;
  width: string;
  priority: ColumnPriority;
  align: ColumnAlign;
}

export const TICKET_COLUMNS: readonly ColumnDef[] = [
  { id: 'bookingRef', label: 'Booking ref', width: '17%', priority: 1, align: 'left' },
  { id: 'name', label: 'Name', width: '19%', priority: 1, align: 'left' },
  { id: 'email', label: 'Email', width: '22%', priority: 3, align: 'left' },
  { id: 'ticketType', label: 'Ticket type', width: '15%', priority: 2, align: 'left' },
  { id: 'purchased', label: 'Purchased', width: '13%', priority: 2, align: 'right' },
  { id: 'status', label: 'Status', width: '14%', priority: 1, align: 'left' },
];

export const APPLICATION_COLUMNS: readonly ColumnDef[] = [
  { id: 'business', label: 'Business', width: '32%', priority: 1, align: 'left' },
  { id: 'category', label: 'Category', width: '20%', priority: 3, align: 'left' },
  { id: 'stands', label: 'Stand', width: '10%', priority: 2, align: 'right' },
  { id: 'submitted', label: 'Submitted', width: '14%', priority: 2, align: 'right' },
  { id: 'status', label: 'Status', width: '14%', priority: 1, align: 'left' },
  { id: 'view', label: 'View', width: '10%', priority: 1, align: 'right' },
];

export const VENDOR_COLUMNS: readonly ColumnDef[] = [
  { id: 'business', label: 'Business', width: '30%', priority: 1, align: 'left' },
  { id: 'category', label: 'Category', width: '18%', priority: 3, align: 'left' },
  { id: 'submitted', label: 'Submitted', width: '14%', priority: 2, align: 'right' },
  { id: 'status', label: 'Status', width: '14%', priority: 1, align: 'left' },
  { id: 'standPayment', label: 'Stand payment', width: '16%', priority: 2, align: 'left' },
  { id: 'view', label: 'View', width: '8%', priority: 1, align: 'right' },
];

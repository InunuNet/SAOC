// Asserts the three column configs: <=6 columns, exact header labels from goldens/table-columns.md.
import { TICKET_COLUMNS, APPLICATION_COLUMNS, VENDOR_COLUMNS } from '../../../components/admin/table/columns';

const EXPECTED: Record<string, string[]> = {
  TICKET_COLUMNS: ['Booking ref', 'Name', 'Email', 'Ticket type', 'Purchased', 'Status'],
  APPLICATION_COLUMNS: ['Business', 'Category', 'Stand', 'Submitted', 'Status', 'View'],
  VENDOR_COLUMNS: ['Business', 'Category', 'Submitted', 'Status', 'Stand payment', 'View'],
};
const ACTUAL: Record<string, { label: string; priority: number }[]> = {
  TICKET_COLUMNS, APPLICATION_COLUMNS, VENDOR_COLUMNS,
};
let failed = false;
for (const [name, want] of Object.entries(EXPECTED)) {
  const cols = ACTUAL[name];
  const got = cols.map((c) => c.label);
  if (cols.length > 6) { console.error(`FAIL ${name}: ${cols.length} columns`); failed = true; }
  if (JSON.stringify(got) !== JSON.stringify(want)) { console.error(`FAIL ${name}: labels ${JSON.stringify(got)}`); failed = true; }
  if (cols.some((c) => ![1, 2, 3].includes(c.priority))) { console.error(`FAIL ${name}: priority not 1-3`); failed = true; }
}
if (failed) process.exit(1);
console.log('PASS[columns]');

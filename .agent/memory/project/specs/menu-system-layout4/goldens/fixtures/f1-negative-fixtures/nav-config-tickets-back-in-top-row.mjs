// NEGATIVE FIXTURE for contract-f1.yaml A1 (check-nav-top-level-golden.mjs). Re-adds
// Tickets as an 8th top-level link item -- the UNRULED question from mission section 2.
// The checker must reject this: the golden builds Tickets OUT of the top row, and any
// re-addition must be a deliberate, reported Brad ruling, not a silent pass.
import { NAV as GOOD } from './nav-config-good-control.mjs';

const NAV = structuredClone(GOOD);
NAV.splice(NAV.length - 1, 0, { type: 'link', id: 'tickets', label: 'Tickets', href: '/national-show/tickets' });

export { NAV };

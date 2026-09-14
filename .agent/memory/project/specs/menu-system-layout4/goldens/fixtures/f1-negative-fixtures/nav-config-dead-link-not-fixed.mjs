// NEGATIVE FIXTURE for contract-f1.yaml A4 (check-dead-link-fixed.mjs). Reverts the
// International Guests leaf's href back to the old, dead
// /national-show/exhibitors/international -- proving F5's fix is actually checked, not just
// assumed done because the leaf exists under some href.
import { NAV as GOOD } from './nav-config-good-control.mjs';

const NAV = structuredClone(GOOD);
const mega = NAV.find((item) => item.type === 'mega');
const exhibitColumn = mega.columns.find((c) => c.id === 'exhibit-trade');
const leaf = exhibitColumn.links.find((l) => l.id === 'international-guests');
leaf.href = '/national-show/exhibitors/international';

export { NAV };

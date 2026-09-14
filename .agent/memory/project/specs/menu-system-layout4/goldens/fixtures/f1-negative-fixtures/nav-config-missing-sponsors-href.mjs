// NEGATIVE FIXTURE for contract-f1.yaml A2 (check-nav-hrefs-golden.mjs). Drops the "Show
// Sponsors" leaf (/national-show/sponsors, inside lead.theShow) entirely -- the checker must
// catch a manifest route silently missing from NAV, not just a wrong-shape top level.
import { NAV as GOOD } from './nav-config-good-control.mjs';

const NAV = structuredClone(GOOD);
const mega = NAV.find((item) => item.type === 'mega');
mega.lead.theShow.links = mega.lead.theShow.links.filter((l) => l.id !== 'show-sponsors');

export { NAV };

// NEGATIVE FIXTURE for contract-f1.yaml A3 (check-descriptor-provenance.mjs). Gives the FAQ
// leaf an invented, marketing-voice descriptor that is NOT a prefix of the manifest's real
// purpose text ("The questions visitors ask us most.") -- exactly the back-door invention
// property 6 (mission section 6) exists to catch.
import { NAV as GOOD } from './nav-config-good-control.mjs';

const NAV = structuredClone(GOOD);
const mega = NAV.find((item) => item.type === 'mega');
const visitColumn = mega.columns.find((c) => c.id === 'visit');
const faqLeaf = visitColumn.links.find((l) => l.id === 'faq');
faqLeaf.descriptor = 'Everything you need to know before you visit!';

export { NAV };

// The tickets hub foot card "I'm exhibiting orchids" must link to the Plant Entry page; the
// "nursery or trader" card keeps the vendor registration link.
import { readFileSync } from 'node:fs';

const src = readFileSync('app/(nos)/national-show/tickets/page.tsx', 'utf8');
const hrefOf = (id) => {
  const match = src.match(new RegExp(`id: '${id}',[\\s\\S]*?href: '([^']+)'`));
  return match ? match[1] : null;
};
const exhibit = hrefOf('exhibit');
const trade = hrefOf('trade');
if (exhibit !== '/plant-entry' || trade !== '/vendors/apply') {
  console.error(`FAIL: exhibit -> ${exhibit}, trade -> ${trade}`);
  process.exit(1);
}
console.log('PASS: exhibiting orchids -> /plant-entry, trader -> /vendors/apply');

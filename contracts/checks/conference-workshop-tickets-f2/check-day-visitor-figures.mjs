// F2 (conference-workshop-tickets, M1) — A4: day-visitor is 150/1000/requiresDaySelection
// true, and excludedDays contains exactly ['2027-09-23'] (Thursday — Brad's message 6
// excludes Thursday from Day Pass days). capacity moves from the old 800 to the new 1000
// per-day ceiling Brad's message states; F4 is what makes it a TRUE per-day cap, this
// feature only sets the figure.
import { loadRepoModule, finish } from './_lib.mjs';

const { ADMISSION_PRODUCTS } = await loadRepoModule('lib/provisional-figures.ts');

const failures = [];
const dayVisitor = ADMISSION_PRODUCTS.find((p) => p.slug === 'day-visitor');

if (!dayVisitor) {
  finish('check-day-visitor-figures.mjs', ["no 'day-visitor' product in ADMISSION_PRODUCTS"]);
}

if (dayVisitor.price !== 150) {
  failures.push(`price is ${JSON.stringify(dayVisitor.price)}, expected 150`);
}
if (dayVisitor.capacity !== 1000) {
  failures.push(`capacity is ${JSON.stringify(dayVisitor.capacity)}, expected 1000`);
}
if (dayVisitor.requiresDaySelection !== true) {
  failures.push(`requiresDaySelection is ${JSON.stringify(dayVisitor.requiresDaySelection)}, expected true`);
}
if (!Array.isArray(dayVisitor.excludedDays) || dayVisitor.excludedDays.length !== 1 || dayVisitor.excludedDays[0] !== '2027-09-23') {
  failures.push(`excludedDays is ${JSON.stringify(dayVisitor.excludedDays)}, expected exactly ['2027-09-23']`);
}

finish(
  'check-day-visitor-figures.mjs',
  failures,
  'day-visitor is 150/1000/requiresDaySelection true, excludedDays is exactly [\'2027-09-23\'].',
);

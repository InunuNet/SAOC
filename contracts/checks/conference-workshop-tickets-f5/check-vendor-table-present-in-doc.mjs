// F5 (conference-workshop-tickets, M3) — A8: the golden's full field-mapping table (six
// rows) is reproduced or referenced in docs/national-show-conference-workshop-tickets.md,
// not summarized away. Checks each row's distinguishing field name/identifier is present
// — the table proves exactly which field drives vendor stand price TODAY (boothSize,
// numeric, stand-payment page) versus the five that don't, so Brad can map his R3500
// message against real code, not a paraphrase.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_REL_PATH = 'docs/national-show-conference-workshop-tickets.md';
const docPath = path.join(__dirname, '../../../', DOC_REL_PATH);

const failures = [];
let source;
try {
  source = readFileSync(docPath, 'utf8');
} catch (error) {
  console.error('FAIL: check-vendor-table-present-in-doc.mjs');
  console.error(`  - could not read ${DOC_REL_PATH}: ${error.message}`);
  process.exit(1);
}

// One entry per golden row: the field/identifier that distinguishes it from the other
// five, so a table that silently dropped or merged a row is caught.
const REQUIRED_IDENTIFIERS = [
  'boothSize',
  'VendorStandPaymentForm',
  'VendorBoothFieldset',
  'boothType',
  'VendorBoothPositionFieldset',
  'vendorCategory',
  'businessEntityType',
  'VendorBusinessIdentityFieldset',
  'exhibitorPassesRequired',
];

for (const id of REQUIRED_IDENTIFIERS) {
  if (!source.includes(id)) {
    failures.push(`doc never mentions '${id}' — the field-mapping table's six rows must be reproduced or referenced, not summarized away`);
  }
}

// The one load-bearing claim of the whole table: boothSize (numeric) is the ONLY
// price-driving field today — a table that lists boothSize without this distinction
// would mislead Brad into thinking any of the six fields could drive price.
if (!/\bONLY\b.{0,80}price-driving|price-driving.{0,80}\bONLY\b/is.test(source)) {
  failures.push("doc never states that boothSize (numeric) is the ONLY price-driving field today — this is the table's central finding, not an incidental detail");
}

if (failures.length > 0) {
  console.error('FAIL: check-vendor-table-present-in-doc.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: all six field-mapping table rows and the "boothSize is the only price-driving field" finding are present in the doc.');

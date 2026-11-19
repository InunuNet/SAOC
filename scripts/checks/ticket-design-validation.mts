// ticket-design-studio: renderers reject an invalid explicit design, and loadShippedDesign
// ignores prototype keys. No mail, no network.
//   pnpm exec tsx scripts/checks/ticket-design-validation.mts
import { DEFAULT_DESIGN, loadShippedDesign, type ShippedDesign } from '../../lib/ticket-design';
import { SAMPLE_ORDERS } from '../ticket-email-sample-fixtures';
import { studioEmailInput, studioPdfInput } from '../../lib/ticket-design/studio-samples';
import { buildTicketPdf } from '../../lib/ticket-pdf';
import { buildTicketTypeEmail } from '../../lib/ticket-type-email';

const EXIT_FAIL = 1;
const order = SAMPLE_ORDERS[0];
let failures = 0;

function check(name: string, ok: boolean): void {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures += 1;
}

async function throws(run: () => unknown): Promise<boolean> {
  try {
    await run();
    return false;
  } catch {
    return true;
  }
}

// Deliberately invalid designs: cast through unknown because they break the ShippedDesign type.
function bad(patch: (design: ShippedDesign) => void): ShippedDesign {
  const copy: ShippedDesign = JSON.parse(JSON.stringify(DEFAULT_DESIGN));
  patch(copy);
  return copy;
}

const emailInput = studioEmailInput(order);
const pdfInput = studioPdfInput(order);
const cssInjection = bad((d) => {
  (d.email as unknown as Record<string, unknown>).headerGround = 'red; } body { display: none';
});
const badDensity = bad((d) => {
  (d.email as unknown as Record<string, unknown>).density = 'bad';
});
const hexAccent = bad((d) => {
  (d.pdf as unknown as Record<string, unknown>).accent = '#ff0000';
});

check('email rejects CSS-injection headerGround', await throws(() => buildTicketTypeEmail({ ...emailInput, design: cssInjection })));
check('email rejects bad density', await throws(() => buildTicketTypeEmail({ ...emailInput, design: badDensity })));
check('email accepts the default design', !(await throws(() => buildTicketTypeEmail({ ...emailInput, design: DEFAULT_DESIGN }))));
check('pdf rejects hex accent', await throws(() => buildTicketPdf(pdfInput, hexAccent)));
check(
  'pdf rejects a legacy options object with a validation error',
  await (async () => {
    try {
      await buildTicketPdf(pdfInput, { testMode: false } as unknown as ShippedDesign);
      return false;
    } catch (error) {
      return error instanceof Error && error.message.startsWith('design');
    }
  })()
);
check('loadShippedDesign("toString") is the default', loadShippedDesign('toString') === DEFAULT_DESIGN);
check('loadShippedDesign("constructor") is the default', loadShippedDesign('constructor') === DEFAULT_DESIGN);
check('loadShippedDesign("vip") is not the default', loadShippedDesign('vip') !== DEFAULT_DESIGN);

if (failures > 0) process.exit(EXIT_FAIL);

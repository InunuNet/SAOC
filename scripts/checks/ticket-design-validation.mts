// ticket-design-studio: renderers reject an invalid explicit design, and loadShippedDesign
// ignores prototype keys. No mail, no network.
//   pnpm exec tsx scripts/checks/ticket-design-validation.mts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { themeFromDesign } from '../../emails/_shared/EmailShell';
import { DEFAULT_DESIGN, loadShippedDesign, type ShippedDesign } from '../../lib/ticket-design';
import { KNOWN_TICKET_TYPE_KEYS, readSavedDesign } from '../../lib/ticket-design/saved';
import { tokenHex } from '../../lib/ticket-design/tokens';
import { exportSamplesForKey } from '../generate-ticket-email-samples';
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

// Email half: themeFromDesign / TicketTypeConfirmation validate; tokens are own-property-safe.
const badQr = bad((d) => {
  (d.email as unknown as Record<string, unknown>).qrPx = '200px;background:red';
});
const protoGround = bad((d) => {
  (d.email as unknown as Record<string, unknown>).headerGround = 'toString';
});
check('themeFromDesign rejects qrPx injection', await throws(() => themeFromDesign(badQr.email)));
check('themeFromDesign rejects headerGround "toString"', await throws(() => themeFromDesign(protoGround.email)));
check('tokenHex rejects prototype keys', await throws(() => tokenHex('toString')));
check('tokenHex resolves royal', tokenHex('royal') === '#211a57');
for (const falsy of [null, '', 0, false]) {
  check(
    `email rejects falsy design ${JSON.stringify(falsy)}`,
    await throws(() => buildTicketTypeEmail({ ...emailInput, design: falsy as unknown as ShippedDesign }))
  );
}

// readSavedDesign: unknown keys throw; a known key without a settings file falls back to default.
for (const unknown of ['constructor', 'arbitrary-key', '../vip']) {
  check(`readSavedDesign rejects unknown key "${unknown}"`, await throws(() => readSavedDesign(unknown)));
}
const noFileKey = KNOWN_TICKET_TYPE_KEYS.find((key) => key !== 'vip');
check(
  'readSavedDesign falls back to default for a known key with no file',
  noFileKey !== undefined && (await readSavedDesign(noFileKey)) === DEFAULT_DESIGN
);

// Export reads the saved file at call time: change the accent on disk, export, bytes must differ.
const VIP_FILE = path.join('lib', 'ticket-design', 'settings', 'vip.json');
const outDir = mkdtempSync(path.join(tmpdir(), 'studio-export-'));
const original = readFileSync(VIP_FILE, 'utf8');
try {
  await exportSamplesForKey('vip', outDir);
  const before = readFileSync(path.join(outDir, 'ticket-vip.pdf'));
  const beforeEmail = readFileSync(path.join(outDir, 'email-vip.pdf'));
  const changed = JSON.parse(original);
  changed.email.accent = 'olive-700';
  changed.pdf.accent = 'olive-700';
  writeFileSync(VIP_FILE, JSON.stringify(changed, null, 2));
  check('readSavedDesign sees the saved accent', (await readSavedDesign('vip')).pdf.accent === 'olive-700');
  await exportSamplesForKey('vip', outDir);
  check('export renders the newly saved ticket accent', !before.equals(readFileSync(path.join(outDir, 'ticket-vip.pdf'))));
  check('export renders the newly saved email accent', !beforeEmail.equals(readFileSync(path.join(outDir, 'email-vip.pdf'))));
} finally {
  writeFileSync(VIP_FILE, original);
  rmSync(outDir, { recursive: true, force: true });
}

if (failures > 0) process.exit(EXIT_FAIL);

// The named pending inputs. This check FAILS while a crop or rect is still missing from goldens/crop-map.json: an inner route whose
// position is "pending" (/media-kit: NOS Design's final picks do not name it) or a derived source whose rect is "pending" (the
// ShowBand S3 rect: ruling 1 gives its constraints, now ruled as 300,1000-2700,2542). The mirror is not done until they land.
import { GOLDEN } from './_lib.mjs';

const pending = [
  ...GOLDEN.heroRoutes.filter((r) => r.position === 'pending').map((r) => `route ${r.path}: ${r.note ?? 'position pending'}`),
  ...GOLDEN.bands.filter((b) => b.image === 'pending').map((b) => `band ${b.name}: ${b.pendingNote}`),
  ...GOLDEN.derived.filter((d) => d.rect === 'pending').map((d) => `derived ${d.name}: rect pending (${d.ruling})`),
];
if (pending.length) { console.error(`check-crops-final FAILED: ${pending.length} pick(s) still missing:\n- ${pending.join('\n- ')}`); process.exit(1); }
console.log('check-crops-final pass');

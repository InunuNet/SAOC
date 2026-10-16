// Test oracles shared by the F18b live checks: the section sub-lede rules (spec 4.9) and small helpers.
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymd = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const dayOf = (d, plus = 0) => new Date(d.getTime() + plus*86400000);

// Independent oracle for the three section sub-lede texts: the same rules as lib/data/ticket-section-ledes.ts. Dates come from the nationalShow singleton, names from the CMS ticketType names.
export function expectedLedes(show, has, names) {
  const start = ymd(show?.showDate); const end = ymd(show?.showEndDate);
  const out = { thursday: null, passes: null, programme: null };
  if (start && start.getUTCDay() === 4 && has.vip && has.sunset) out.thursday = `Two evening events on Thursday ${start.getUTCDate()} ${MO[start.getUTCMonth()]}.`;
  if (start && end) {
    const f = dayOf(start, 1);
    if (f <= end && f.getUTCMonth() === end.getUTCMonth() && f.getUTCFullYear() === end.getUTCFullYear()) out.passes = `${WD[f.getUTCDay()]} ${f.getUTCDate()} to ${WD[end.getUTCDay()]} ${end.getUTCDate()} ${MO[end.getUTCMonth()]}.`;
  }
  if (has.symposium && has.wosa && has.workshops) out.programme = `The ${names.symposium}, the ${names.wosa} and ${names.workshops.toLowerCase()}.`;
  return out;
}

// Read-only: the public Sanity CDN query of the ticketType names and the nationalShow dates (a project id is a public identifier). null when it cannot be reached.
export async function loadCmsNames() {
  const pid = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const ds = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  if (!pid) return null;
  try {
    const q = encodeURIComponent('{"types":*[_type=="ticketType"]{name,"slug":slug.current},"show":*[_type=="nationalShow"][0]{showDate,showEndDate}}');
    const res = await fetch(`https://${pid}.apicdn.sanity.io/v2024-10-01/data/query/${ds}?query=${q}`);
    if (!res.ok) return null;
    const j = await res.json();
    return { names: Object.fromEntries((j.result?.types ?? []).map((t) => [t.slug, t.name])), show: j.result?.show ?? null };
  } catch { return null; }
}

export const PRODUCT_OF = (id) => id.replace('ticket-', '');
export const fileOf = (src) => decodeURIComponent(src ?? '').match(/orchid-(dark|pink|purple|violet|yellow)/)?.[0] ?? null;
export const rgbOfHex = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

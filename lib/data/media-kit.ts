// =============================================================
// SAOC — lib/data/media-kit.ts
// Pure helpers over lib/data/media-kit-manifest.json (written by scripts/generate-saoc-media-kit.py).
// Every file the media kit page offers comes from the manifest; a path the page asks for that the
// manifest lacks throws at build time, so the page can never link a file that does not exist.
// =============================================================

export interface MediaKitItem {
  path: string;
  href: string;
  format: string;
  width: number | null;
  height: number | null;
  bytes: number;
  section: string;
  label: string;
  rendition_label?: string;
  ink_label?: string;
  lockup_label?: string;
  wordmark_label?: string;
  mark_label?: string;
  variant_label?: string;
  orientation_label?: string;
  bundle_label?: string;
  bundle_for?: string;
}

export type InkId = 'indigo' | 'prussian' | 'viridian' | 'violet' | 'teal' | 'plum';
export type Ground = 'light' | 'dark';
type Orientation = 'horizontal' | 'vertical';

export interface Ink {
  id: InkId;
  label: string;
  hex: string;
}

// Presentation p.7 "Candidate emblem inks".
export const INKS: readonly Ink[] = [
  { id: 'indigo', label: '01 Indigo', hex: '#232A5E' },
  { id: 'prussian', label: '02 Prussian', hex: '#1D3557' },
  { id: 'viridian', label: '03 Viridian', hex: '#14503F' },
  { id: 'violet', label: '04 Violet', hex: '#3A2560' },
  { id: 'teal', label: '05 Teal', hex: '#123F4A' },
  { id: 'plum', label: '06 Plum', hex: '#4A1F45' },
];

export const DEFAULT_INK: InkId = 'indigo';

export type SectionZipKey = 'full-colour' | 'greyscale' | 'duotone' | 'mark-only' | 'national-show';

export interface NationalShowEmblem {
  png: MediaKitItem;
  svg: MediaKitItem;
}

export interface MediaKit {
  quickStart: MediaKitItem;
  everythingZip: MediaKitItem;
  sectionZips: Record<SectionZipKey, MediaKitItem>;
  fullColour: MediaKitItem[];
  greyscale: MediaKitItem[];
  duotone: Record<InkId, MediaKitItem[]>;
  chips: Record<Ground, MediaKitItem[]>;
  marks: MediaKitItem[];
  nationalShowLogos: MediaKitItem[];
  nationalShowEmblem: NationalShowEmblem;
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;
const LOCKUP_ORDER: ReadonlyArray<readonly [Orientation, Ground]> = [
  ['horizontal', 'light'],
  ['horizontal', 'dark'],
  ['vertical', 'light'],
  ['vertical', 'dark'],
];
const NOS_EMBLEM_BASENAME = 'nos/nos-disa-graminifolia-emblem';

export function formatBytes(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

/** "PNG · 4045×520 · 0.6 MB" — the format, pixel size (when it has one) and file size. */
export function itemMeta(item: MediaKitItem): string {
  const parts = [item.format];
  if (item.width !== null && item.height !== null) parts.push(`${item.width}×${item.height}`);
  parts.push(formatBytes(item.bytes));
  return parts.join(' · ');
}

export function buildMediaKit(items: readonly MediaKitItem[]): MediaKit {
  const byPath = new Map(items.map((item) => [item.path, item]));
  const need = (path: string): MediaKitItem => {
    const item = byPath.get(path);
    if (!item) throw new Error(`media kit manifest is missing ${path}`);
    return item;
  };
  const lockup = (orientation: Orientation, rendition: string, ground: Ground) =>
    need(
      `saoc/lockup/saoc-lockup-south-african-orchid-council-${orientation}-${rendition}-on-${ground}.png`,
    );
  const lockupGrid = (rendition: string) =>
    LOCKUP_ORDER.map(([orientation, ground]) => lockup(orientation, rendition, ground));
  const chips = (ground: Ground) =>
    items.filter((item) => item.path.startsWith('saoc/chip/') && item.path.endsWith(`-on-${ground}.png`));
  const everythingZip = items.find((item) => item.bundle_for === 'everything');
  if (!everythingZip) throw new Error('media kit manifest has no everything zip');
  const sectionZip = (key: SectionZipKey): MediaKitItem => {
    const zip = items.find((item) => item.bundle_for === key);
    if (!zip) throw new Error(`media kit manifest has no ${key} zip`);
    return zip;
  };
  const duotone = Object.fromEntries(
    INKS.map((ink) => [ink.id, lockupGrid(`duotone-${ink.id}`)]),
  ) as Record<InkId, MediaKitItem[]>; // keyed by exactly the InkId union via INKS

  return {
    quickStart: lockup('horizontal', 'duotone-indigo', 'light'),
    everythingZip,
    sectionZips: {
      'full-colour': sectionZip('full-colour'),
      greyscale: sectionZip('greyscale'),
      duotone: sectionZip('duotone'),
      'mark-only': sectionZip('mark-only'),
      'national-show': sectionZip('national-show'),
    },
    fullColour: lockupGrid('colour'),
    greyscale: lockupGrid('greyscale'),
    duotone,
    chips: { light: chips('light'), dark: chips('dark') },
    marks: items.filter((item) => item.path.startsWith('saoc/mark/')),
    nationalShowLogos: items.filter((item) => item.path.startsWith('nos/NOS-2027-logo-')),
    nationalShowEmblem: { png: need(`${NOS_EMBLEM_BASENAME}.png`), svg: need(`${NOS_EMBLEM_BASENAME}.svg`) },
  };
}
